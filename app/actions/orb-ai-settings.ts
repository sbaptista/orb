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

export async function getTtsConfig(): Promise<TtsConfigResult> {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { provider: 'browser', model: null, voiceId: null }
  const { data } = await supabase.from('users').select('tts_provider, tts_model, tts_voice_id').eq('id', user.id).single()
  return {
    provider: (data?.tts_provider as TtsProvider) ?? 'browser',
    model: data?.tts_model ?? null,
    voiceId: data?.tts_voice_id ?? null,
  }
}

export async function saveTtsConfig(config: TtsConfigResult) {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
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
