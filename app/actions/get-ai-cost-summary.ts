'use server'

import { requireAdmin } from '@/lib/auth'

export type AiCostBreakdownRow = {
  key: string
  provider: string
  model: string
  routeRole: string
  source: string
  requestCount: number
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  cacheWriteTokens: number
  estimatedCostUsd: number
  avgLatencyMs: number | null
}

export type AiCostDateMode = 'all_tracked' | 'last_7_days' | 'last_30_days' | 'current_month' | 'specific_month' | 'custom_range'

export type AiCostSummaryOptions = {
  dateMode?: AiCostDateMode
  from?: string | null
  to?: string | null
  month?: string | null
  modelKey?: string | null
}

export type AiCostModelOption = {
  key: string
  provider: string
  model: string
  label: string
}

export type AiCostReconciliationRow = {
  id: string
  provider: string
  periodStart: string
  periodEnd: string
  actualOrbCostUsd: number
  notes: string | null
}

export type AiCostSummary = {
  dateMode: AiCostDateMode
  periodStart: string
  periodEnd: string
  actualStart: string | null
  actualEnd: string | null
  modelKey: string
  modelOptions: AiCostModelOption[]
  requestCount: number
  estimatedLiveCostUsd: number
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  cacheWriteTokens: number
  providerBreakdown: AiCostBreakdownRow[]
  roleBreakdown: AiCostBreakdownRow[]
  sourceBreakdown: AiCostBreakdownRow[]
  reconciliations: AiCostReconciliationRow[]
  reconciledTotalUsd: number
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function endExclusive(dateOnly: string) {
  const date = new Date(`${dateOnly}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString()
}

function validDateOnly(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : value
}

function validMonth(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}-01T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : value
}

function resolveWindow(options: AiCostSummaryOptions, now = new Date()) {
  const mode = options.dateMode ?? 'all_tracked'
  const today = toDateOnly(now)

  if (mode === 'last_7_days' || mode === 'last_30_days') {
    const days = mode === 'last_7_days' ? 7 : 30
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    start.setUTCDate(start.getUTCDate() - (days - 1))
    const startDate = toDateOnly(start)
    return { mode, startDate, endDate: today, startIso: `${startDate}T00:00:00.000Z`, endIso: endExclusive(today) }
  }

  if (mode === 'current_month') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    return { mode, startDate: toDateOnly(start), endDate: today, startIso: start.toISOString(), endIso: endExclusive(today) }
  }

  if (mode === 'specific_month') {
    const month = validMonth(options.month) ?? today.slice(0, 7)
    const start = new Date(`${month}-01T00:00:00.000Z`)
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
    const finalDay = new Date(end)
    finalDay.setUTCDate(finalDay.getUTCDate() - 1)
    return { mode, startDate: toDateOnly(start), endDate: toDateOnly(finalDay), startIso: start.toISOString(), endIso: end.toISOString() }
  }

  if (mode === 'custom_range') {
    const from = validDateOnly(options.from) ?? today
    const to = validDateOnly(options.to) ?? from
    const startDate = from <= to ? from : to
    const endDate = from <= to ? to : from
    return { mode, startDate, endDate, startIso: `${startDate}T00:00:00.000Z`, endIso: endExclusive(endDate) }
  }

  return { mode: 'all_tracked' as const, startDate: 'All tracked', endDate: 'Now', startIso: null, endIso: null }
}

function asNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function emptyBreakdown(key: string, row: any): AiCostBreakdownRow {
  return {
    key,
    provider: row.provider ?? 'unknown',
    model: row.model ?? 'unknown',
    routeRole: row.route_role ?? 'operational',
    source: row.source ?? 'conversation',
    requestCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
    estimatedCostUsd: 0,
    avgLatencyMs: null,
  }
}

function addToBreakdown(map: Map<string, AiCostBreakdownRow & { latencyTotal: number }>, key: string, row: any) {
  const existing = map.get(key) ?? { ...emptyBreakdown(key, row), latencyTotal: 0 }
  existing.requestCount += 1
  existing.inputTokens += asNumber(row.input_tokens)
  existing.outputTokens += asNumber(row.output_tokens)
  existing.cachedInputTokens += asNumber(row.cached_input_tokens)
  existing.cacheWriteTokens += asNumber(row.cache_write_tokens)
  existing.estimatedCostUsd += asNumber(row.estimated_cost_usd)
  existing.latencyTotal += asNumber(row.latency_ms)
  existing.avgLatencyMs = Math.round(existing.latencyTotal / existing.requestCount)
  map.set(key, existing)
}

function cleanBreakdown(map: Map<string, AiCostBreakdownRow & { latencyTotal: number }>) {
  return Array.from(map.values())
    .map(({ latencyTotal: _latencyTotal, ...row }) => row)
    .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd)
}

function formatModel(provider: string, model: string) {
  if (provider === 'anthropic' && model === 'claude-haiku-4-5') return 'Claude Haiku 4.5'
  if (provider === 'google' && model === 'gemini-3.1-pro-preview') return 'Gemini 3.1 Pro Preview'
  if (provider === 'mistral' && model === 'mistral-medium-latest') return 'Mistral Medium'
  if (provider === 'openai' && model === 'tts-1') return 'OpenAI tts-1'
  if (provider === 'openai' && model === 'tts-1-hd') return 'OpenAI tts-1 HD'
  if (provider === 'elevenlabs' && model === 'eleven_turbo_v2_5') return 'ElevenLabs Turbo v2.5'
  return model
}

export async function getAiCostSummary(options: AiCostSummaryOptions = {}): Promise<AiCostSummary> {
  const ctx = await requireAdmin()
  const window = resolveWindow(options)
  const modelKey = options.modelKey ?? 'all'

  let requestQuery = ctx.admin
    .from('orb_model_requests')
    .select('created_at, provider, model, route_role, source, input_tokens, output_tokens, cached_input_tokens, cache_write_tokens, latency_ms, estimated_cost_usd')
    .eq('success', true)
    .order('created_at', { ascending: true })
    .limit(10000)
  if (window.startIso) requestQuery = requestQuery.gte('created_at', window.startIso)
  if (window.endIso) requestQuery = requestQuery.lt('created_at', window.endIso)
  if (modelKey && modelKey !== 'all') {
    const [provider, ...modelParts] = modelKey.split(':')
    requestQuery = requestQuery.eq('provider', provider).eq('model', modelParts.join(':'))
  }

  let reconciliationQuery = ctx.admin
    .from('orb_cost_reconciliations')
    .select('id, provider, period_start, period_end, actual_orb_cost_usd, notes')
    .order('period_start', { ascending: false })
  if (window.startIso && window.endIso) {
    reconciliationQuery = reconciliationQuery
      .lte('period_start', window.endDate)
      .gte('period_end', window.startDate)
  }

  const [{ data: requests, error: requestsError }, { data: reconciliations, error: reconciliationsError }, { data: models, error: modelsError }] = await Promise.all([
    requestQuery,
    reconciliationQuery,
    ctx.admin
      .from('orb_model_requests')
      .select('provider, model')
      .eq('success', true)
      .order('provider')
      .order('model')
      .limit(10000),
  ])

  if (requestsError) throw requestsError
  if (reconciliationsError) throw reconciliationsError
  if (modelsError) throw modelsError

  const modelMap = new Map<string, AiCostModelOption>()
  for (const row of models ?? []) {
    const key = `${row.provider}:${row.model}`
    if (!modelMap.has(key)) {
      modelMap.set(key, {
        key,
        provider: row.provider,
        model: row.model,
        label: formatModel(row.provider, row.model),
      })
    }
  }

  const byProvider = new Map<string, AiCostBreakdownRow & { latencyTotal: number }>()
  const byRole = new Map<string, AiCostBreakdownRow & { latencyTotal: number }>()
  const bySource = new Map<string, AiCostBreakdownRow & { latencyTotal: number }>()

  let estimatedLiveCostUsd = 0
  let inputTokens = 0
  let outputTokens = 0
  let cachedInputTokens = 0
  let cacheWriteTokens = 0
  let actualStart: string | null = null
  let actualEnd: string | null = null

  for (const row of requests ?? []) {
    actualStart ??= row.created_at
    actualEnd = row.created_at
    estimatedLiveCostUsd += asNumber(row.estimated_cost_usd)
    inputTokens += asNumber(row.input_tokens)
    outputTokens += asNumber(row.output_tokens)
    cachedInputTokens += asNumber(row.cached_input_tokens)
    cacheWriteTokens += asNumber(row.cache_write_tokens)
    addToBreakdown(byProvider, `${row.provider}:${row.model}`, row)
    addToBreakdown(byRole, row.route_role ?? 'operational', row)
    addToBreakdown(bySource, row.source ?? 'conversation', row)
  }

  const reconciliationRows = (reconciliations ?? []).map(row => ({
    id: row.id,
    provider: row.provider,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    actualOrbCostUsd: asNumber(row.actual_orb_cost_usd),
    notes: row.notes ?? null,
  }))

  return {
    dateMode: window.mode,
    periodStart: window.startDate,
    periodEnd: window.endDate,
    actualStart,
    actualEnd,
    modelKey,
    modelOptions: Array.from(modelMap.values()).sort((a, b) => a.label.localeCompare(b.label)),
    requestCount: requests?.length ?? 0,
    estimatedLiveCostUsd,
    inputTokens,
    outputTokens,
    cachedInputTokens,
    cacheWriteTokens,
    providerBreakdown: cleanBreakdown(byProvider),
    roleBreakdown: cleanBreakdown(byRole),
    sourceBreakdown: cleanBreakdown(bySource),
    reconciliations: reconciliationRows,
    reconciledTotalUsd: reconciliationRows.reduce((sum, row) => sum + row.actualOrbCostUsd, 0),
  }
}
