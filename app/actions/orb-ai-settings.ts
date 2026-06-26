'use server'

import { requireAdmin } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'
import { DEFAULT_ORB_AI_POLICY, type OrbAiPolicy, type OrbModelRateCard } from '@/lib/orb-model/policy'
import { supportsOrbRole } from '@/lib/orb-model/catalog'
import type { TtsProvider } from '@/lib/orb-model/tts'

export type TtsConfigResult = {
  provider: TtsProvider
  model: string | null
  voiceId: string | null
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

function mapPolicy(row: any): OrbAiPolicy {
  if (!row) return DEFAULT_ORB_AI_POLICY
  return {
    routingEnabled: row.routing_enabled,
    strategicReadsEnabled: row.strategic_reads_enabled,
    operationalProvider: row.operational_provider,
    operationalModel: row.operational_model,
    strategicProvider: row.strategic_provider,
    strategicModel: row.strategic_model,
    monthlyBudgetUsd: Number(row.monthly_budget_usd),
    strategicBudgetUsd: Number(row.strategic_budget_usd),
    operationalBudgetUsd: Number(row.operational_budget_usd),
    ttsProvider: row.tts_provider ?? 'browser',
    ttsModel: row.tts_model ?? null,
    ttsVoiceId: row.tts_voice_id ?? null,
  }
}

function mapRateCard(row: any): OrbModelRateCard {
  return {
    id: row.id,
    provider: row.provider,
    model: row.model,
    effectiveFrom: row.effective_from,
    inputPerMillion: Number(row.input_per_million),
    outputPerMillion: Number(row.output_per_million),
    cachedInputPerMillion: row.cached_input_per_million == null ? null : Number(row.cached_input_per_million),
    cacheWritePerMillion: row.cache_write_per_million == null ? null : Number(row.cache_write_per_million),
    notes: row.notes ?? null,
  }
}

export async function getTtsConfig(): Promise<TtsConfigResult> {
  const ctx = await requireAdmin()
  const { data } = await ctx.admin.from('orb_ai_policy').select('tts_provider, tts_model, tts_voice_id').eq('id', true).maybeSingle()
  return {
    provider: (data?.tts_provider as TtsProvider) ?? 'browser',
    model: data?.tts_model ?? null,
    voiceId: data?.tts_voice_id ?? null,
  }
}

export async function saveTtsConfig(config: TtsConfigResult) {
  const ctx = await requireAdmin()
  const { error } = await ctx.admin.from('orb_ai_policy').upsert({
    id: true,
    tts_provider: config.provider,
    tts_model: config.model,
    tts_voice_id: config.voiceId,
    updated_at: new Date().toISOString(),
    updated_by: ctx.user.id,
  })
  if (error) throw error
  return { ok: true }
}

export async function getOrbAiSettings() {
  const ctx = await requireAdmin()
  const [{ data: policy, error: policyError }, { data: rateCards, error: rateCardsError }] = await Promise.all([
    ctx.admin.from('orb_ai_policy').select('*').eq('id', true).maybeSingle(),
    ctx.admin.from('orb_model_rate_cards').select('*').order('provider').order('model').order('effective_from', { ascending: false }),
  ])
  if (policyError) throw policyError
  if (rateCardsError) throw rateCardsError
  return { policy: mapPolicy(policy), rateCards: (rateCards ?? []).map(mapRateCard) }
}

export async function saveOrbAiPolicy(next: OrbAiPolicy) {
  const ctx = await requireAdmin()
  if (!supportsOrbRole(next.operationalProvider, next.operationalModel, 'operational')) throw new Error('Unsupported operational model.')
  if (!supportsOrbRole(next.strategicProvider, next.strategicModel, 'strategic')) throw new Error('Unsupported strategic model.')
  const monthlyBudgetUsd = toNumber(next.monthlyBudgetUsd, 'Monthly budget')
  const strategicBudgetUsd = toNumber(next.strategicBudgetUsd, 'Strategic budget')
  const operationalBudgetUsd = toNumber(next.operationalBudgetUsd, 'Operational budget')
  if (strategicBudgetUsd + operationalBudgetUsd > monthlyBudgetUsd) throw new Error('Strategic and operational budgets cannot exceed the monthly total.')

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
    monthly_budget_usd: monthlyBudgetUsd,
    strategic_budget_usd: strategicBudgetUsd,
    operational_budget_usd: operationalBudgetUsd,
    tts_provider: next.ttsProvider || 'browser',
    tts_model: next.ttsModel || null,
    tts_voice_id: next.ttsVoiceId || null,
    updated_at: new Date().toISOString(),
    updated_by: ctx.user.id,
  })
  if (error) throw error
  await logAuditEvent({ action: 'orb_ai_policy_update', table_name: 'orb_ai_policy', record_id: 'global', before, after: next, actor: 'web-ui', user_id: ctx.user.id })
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
  return (data ?? []).map(row => ({
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
  if (!['anthropic', 'google', 'mistral', 'openai', 'elevenlabs'].includes(input.provider)) throw new Error('Unsupported provider.')
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
