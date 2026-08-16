'use server'

import { requireAdmin } from '@/lib/auth'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'
import { type OrbAiPolicy, type OrbModelRateCard } from '@/lib/orb-model/policy'
import { supportsOrbRole } from '@/lib/orb-model/catalog'
import type { TtsProvider } from '@/lib/orb-model/tts'
import { fetchOrbAiSettings } from '@/lib/orb-model/ai-settings-core'

export type TtsConfigResult = {
  provider: TtsProvider
  model: string | null
  voiceId: string | null
  retiredProviderReset?: boolean
}

export type OrbCostReconciliation = {
  id: string
  provider: string
  periodStart: string
  periodEnd: string
  actualOrbCostUsd: number
  notes: string | null
  createdAt: string
}

function toNumber(value: unknown, name: string): number {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) throw new Error(`${name} must be a non-negative number.`)
  return number
}

function toOptionalNumber(value: unknown, name: string): number | null {
  if (value === null || value === undefined || value === '') return null
  return toNumber(value, name)
}

export type AiFundingCapsInput = {
  anthropicApi: number | null
  openaiApi: number | null
  mistralApi: number | null
  moonshotApi: number | null
}

export async function getTtsConfig(): Promise<TtsConfigResult> {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { provider: 'browser', model: null, voiceId: null }
  const { data } = await supabase.from('users').select('tts_provider, tts_model, tts_voice_id').eq('id', user.id).single()
  const provider: TtsProvider = data?.tts_provider === 'openai' ? 'openai' : 'browser'
  return {
    provider,
    model: provider === 'openai' ? data?.tts_model ?? 'tts-1' : null,
    voiceId: provider === 'openai' ? data?.tts_voice_id ?? null : null,
    retiredProviderReset: data?.tts_provider === 'elevenlabs',
  }
}

export async function saveTtsConfig(config: TtsConfigResult) {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  if (config.provider !== 'browser' && config.provider !== 'openai') throw new Error('Unsupported TTS provider.')
  const { error } = await supabase.from('users').update({
    tts_provider: config.provider,
    tts_model: config.model,
    tts_voice_id: config.voiceId,
    updated_at: new Date().toISOString(),
  }).eq('id', user.id)
  if (error) throw error
  return { ok: true }
}

export async function getOrbAiSettings() {
  return fetchOrbAiSettings(await requireAdmin())
}

export async function saveOrbAiPolicy(next: OrbAiPolicy) {
  const ctx = await requireAdmin()
  if (next.ttsProvider !== 'browser' && next.ttsProvider !== 'openai') throw new Error('Unsupported TTS provider.')
  if (!supportsOrbRole(next.operationalProvider, next.operationalModel, 'operational')) throw new Error('Unsupported operational model.')
  if (!supportsOrbRole(next.strategicProvider, next.strategicModel, 'strategic')) throw new Error('Unsupported strategic model.')
  if (!supportsOrbRole(next.evaluationProvider, next.evaluationModel, 'evaluation')) throw new Error('Unsupported evaluation model.')
  const monthlyBudgetUsd = toNumber(next.monthlyBudgetUsd, 'Monthly budget')
  const strategicBudgetUsd = toNumber(next.strategicBudgetUsd, 'Strategic budget')
  const operationalBudgetUsd = toNumber(next.operationalBudgetUsd, 'Operational budget')
  const voiceBudgetUsd = toNumber(next.voiceBudgetUsd, 'Voice budget')
  if (strategicBudgetUsd + operationalBudgetUsd + voiceBudgetUsd > monthlyBudgetUsd) throw new Error('Strategic, operational, and voice budgets cannot exceed the monthly total.')
  const warningThresholdPct = toNumber(next.warningThresholdPct, 'Warning threshold')
  if (warningThresholdPct <= 0 || warningThresholdPct > 100) throw new Error('Warning threshold must be between 0 and 100.')
  const anthropicSpendCapUsd = toNumber(next.anthropicSpendCapUsd, 'Anthropic spend cap')
  const openaiSpendCapUsd = toNumber(next.openaiSpendCapUsd, 'OpenAI spend cap')
  const geminiSpendCapUsd = toNumber(next.geminiSpendCapUsd, 'Gemini spend cap')

  const { data: before, error: beforeError } = await ctx.admin.from('orb_ai_policy').select('*').eq('id', true).maybeSingle()
  if (beforeError) throw beforeError
  const { error } = await ctx.admin.from('orb_ai_policy').upsert({
    id: true,
    routing_enabled: next.routingEnabled,
    strategic_reads_enabled: next.strategicReadsEnabled,
    operational_provider: next.operationalProvider,
    operational_model: next.operationalModel,
    strategic_provider: next.strategicProvider,
    strategic_model: next.strategicModel,
    evaluation_provider: next.evaluationProvider,
    evaluation_model: next.evaluationModel,
    monthly_budget_usd: monthlyBudgetUsd,
    strategic_budget_usd: strategicBudgetUsd,
    operational_budget_usd: operationalBudgetUsd,
    voice_budget_usd: voiceBudgetUsd,
    tts_provider: next.ttsProvider || 'browser',
    tts_model: next.ttsModel || null,
    tts_voice_id: next.ttsVoiceId || null,
    warning_threshold_pct: warningThresholdPct,
    anthropic_spend_cap_usd: anthropicSpendCapUsd,
    openai_spend_cap_usd: openaiSpendCapUsd,
    gemini_spend_cap_usd: geminiSpendCapUsd,
    updated_at: new Date().toISOString(),
    updated_by: ctx.user.id,
  })
  if (error) throw error
  await logAuditEvent({ action: 'orb_ai_policy_update', table_name: 'orb_ai_policy', record_id: 'global', before, after: next, actor: 'web-ui', user_id: ctx.user.id })
  return { ok: true }
}

export async function saveAiFundingCaps(input: AiFundingCapsInput) {
  const ctx = await requireAdmin()
  const caps = {
    anthropic_api: toOptionalNumber(input.anthropicApi, 'Anthropic API cap'),
    openai_api: toOptionalNumber(input.openaiApi, 'OpenAI API cap'),
    mistral_api: toOptionalNumber(input.mistralApi, 'Mistral API cap'),
    moonshot_api: toOptionalNumber(input.moonshotApi, 'Moonshot API cap'),
  }
  const { data: before, error: beforeError } = await ctx.admin
    .from('orb_ai_funding_pools')
    .select('pool_key, spending_cap_usd')
    .in('pool_key', Object.keys(caps))
  if (beforeError) throw beforeError

  const now = new Date().toISOString()
  const poolDefinitions = {
    anthropic_api: { provider: 'anthropic', display_name: 'Anthropic API', sort_order: 10 },
    openai_api: { provider: 'openai', display_name: 'OpenAI API', sort_order: 20 },
    mistral_api: { provider: 'mistral', display_name: 'Mistral API', sort_order: 30 },
    moonshot_api: { provider: 'moonshot', display_name: 'Moonshot API', sort_order: 40 },
  } as const
  const rows = Object.entries(caps).map(([poolKey, spendingCapUsd]) => ({
    pool_key: poolKey,
    ...poolDefinitions[poolKey as keyof typeof poolDefinitions],
    funding_mode: 'prepaid_credit',
    spending_cap_usd: spendingCapUsd,
    active: true,
    updated_at: now,
    updated_by: ctx.user.id,
  }))
  const { error } = await ctx.admin
    .from('orb_ai_funding_pools')
    .upsert(rows, { onConflict: 'pool_key' })
  if (error) throw error

  // Keep the two legacy provider-warning fields aligned while the warning
  // pipeline is migrated to funding pools in a later ORB-373 phase.
  const { error: compatibilityError } = await ctx.admin
    .from('orb_ai_policy')
    .update({
      anthropic_spend_cap_usd: caps.anthropic_api ?? 0,
      openai_spend_cap_usd: caps.openai_api ?? 0,
      updated_at: now,
      updated_by: ctx.user.id,
    })
    .eq('id', true)
  if (compatibilityError) throw compatibilityError

  await logAuditEvent({
    action: 'orb_ai_funding_caps_update',
    table_name: 'orb_ai_funding_pools',
    record_id: 'prepaid-pools',
    before,
    after: rows,
    actor: 'web-ui',
    user_id: ctx.user.id,
  })
  return { ok: true }
}

export async function saveOrbModelRateCard(input: Omit<OrbModelRateCard, 'id'> & { id?: string }) {
  const ctx = await requireAdmin()
  if (!input.provider || !input.model || !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) throw new Error('Provider, model, and effective date are required.')
  const payload = {
    provider: input.provider,
    model: input.model,
    effective_from: input.effectiveFrom,
    input_per_million: toNumber(input.inputPerMillion, 'Input rate'),
    output_per_million: toNumber(input.outputPerMillion, 'Output rate'),
    cached_input_per_million: input.cachedInputPerMillion == null ? null : toNumber(input.cachedInputPerMillion, 'Cached-input rate'),
    cache_write_per_million: input.cacheWritePerMillion == null ? null : toNumber(input.cacheWritePerMillion, 'Cache-write rate'),
    notes: input.notes?.trim() || null,
    created_by: ctx.user.id,
  }
  const { data: before } = input.id
    ? await ctx.admin.from('orb_model_rate_cards').select('*').eq('id', input.id).maybeSingle()
    : { data: null }
  const { error } = input.id
    ? await ctx.admin.from('orb_model_rate_cards').update(payload).eq('id', input.id)
    : await ctx.admin.from('orb_model_rate_cards').insert(payload)
  if (error) throw error
  await logAuditEvent({ action: input.id ? 'orb_model_rate_card_update' : 'orb_model_rate_card_create', table_name: 'orb_model_rate_cards', record_id: input.id, before, after: payload, actor: 'web-ui', user_id: ctx.user.id })
  return { ok: true }
}

export async function getOrbCostReconciliations() {
  const ctx = await requireAdmin()
  const { data, error } = await ctx.admin
    .from('orb_cost_reconciliations')
    .select('*')
    .order('period_start', { ascending: false })
    .order('provider')
  if (error) throw error
  return (data ?? [])
    .filter(row => !row.notes?.startsWith('Auto-populated by the ORB-353 usage-check cron'))
    .map(row => ({
    id: row.id,
    provider: row.provider,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    actualOrbCostUsd: Number(row.actual_orb_cost_usd),
    notes: row.notes ?? null,
    createdAt: row.created_at,
    }) satisfies OrbCostReconciliation)
}

export async function saveOrbCostReconciliation(input: Omit<OrbCostReconciliation, 'id' | 'createdAt'> & { id?: string }) {
  const ctx = await requireAdmin()
  if (!['anthropic', 'google', 'mistral', 'moonshot', 'openai', 'elevenlabs'].includes(input.provider)) throw new Error('Unsupported provider.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(input.periodEnd)) throw new Error('A valid billing period is required.')
  if (input.periodEnd < input.periodStart) throw new Error('Period end must follow period start.')
  const payload = {
    provider: input.provider,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    actual_orb_cost_usd: toNumber(input.actualOrbCostUsd, 'Actual Orb cost'),
    notes: input.notes?.trim() || null,
    created_by: ctx.user.id,
  }
  const { data: before } = input.id
    ? await ctx.admin.from('orb_cost_reconciliations').select('*').eq('id', input.id).maybeSingle()
    : { data: null }
  const { error } = input.id
    ? await ctx.admin.from('orb_cost_reconciliations').update(payload).eq('id', input.id)
    : await ctx.admin.from('orb_cost_reconciliations').upsert(payload, { onConflict: 'provider,period_start,period_end' })
  if (error) throw error
  await logAuditEvent({ action: input.id ? 'orb_cost_reconciliation_update' : 'orb_cost_reconciliation_save', table_name: 'orb_cost_reconciliations', record_id: input.id, before, after: payload, actor: 'web-ui', user_id: ctx.user.id })
  return { ok: true }
}

export async function deleteOrbCostReconciliation(id: string) {
  const ctx = await requireAdmin()
  const { data: before, error: beforeError } = await ctx.admin
    .from('orb_cost_reconciliations')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (beforeError) throw beforeError
  if (!before) throw new Error('Provider bill entry not found.')

  const { error } = await ctx.admin
    .from('orb_cost_reconciliations')
    .delete()
    .eq('id', id)
  if (error) throw error

  await logAuditEvent({
    action: 'orb_cost_reconciliation_delete',
    table_name: 'orb_cost_reconciliations',
    record_id: id,
    before,
    after: null,
    actor: 'web-ui',
    user_id: ctx.user.id,
  })
  return { ok: true }
}
