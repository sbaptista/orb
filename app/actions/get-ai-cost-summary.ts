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

function cleanBreakdown(rows: AiCostBreakdownRow[]) {
  return rows
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

type AiCostRollupRow = {
  group_type: 'total' | 'provider' | 'role' | 'source' | 'model_option'
  key: string
  provider: string | null
  model: string | null
  route_role: string | null
  source: string | null
  request_count: number | string | null
  input_tokens: number | string | null
  output_tokens: number | string | null
  cached_input_tokens: number | string | null
  cache_write_tokens: number | string | null
  estimated_cost_usd: number | string | null
  avg_latency_ms: number | string | null
  actual_start: string | null
  actual_end: string | null
}

function rollupToBreakdown(row: AiCostRollupRow): AiCostBreakdownRow {
  return {
    key: row.key,
    provider: row.provider ?? 'unknown',
    model: row.model ?? 'unknown',
    routeRole: row.route_role ?? 'operational',
    source: row.source ?? 'conversation',
    requestCount: asNumber(row.request_count),
    inputTokens: asNumber(row.input_tokens),
    outputTokens: asNumber(row.output_tokens),
    cachedInputTokens: asNumber(row.cached_input_tokens),
    cacheWriteTokens: asNumber(row.cache_write_tokens),
    estimatedCostUsd: asNumber(row.estimated_cost_usd),
    avgLatencyMs: row.avg_latency_ms === null || row.avg_latency_ms === undefined ? null : Math.round(asNumber(row.avg_latency_ms)),
  }
}

export async function getAiCostSummary(options: AiCostSummaryOptions = {}): Promise<AiCostSummary> {
  const ctx = await requireAdmin()
  const window = resolveWindow(options)
  const modelKey = options.modelKey ?? 'all'
  let modelProvider: string | null = null
  let modelName: string | null = null
  if (modelKey && modelKey !== 'all') {
    const [provider, ...modelParts] = modelKey.split(':')
    modelProvider = provider
    modelName = modelParts.join(':')
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

  const [{ data: rollups, error: rollupsError }, { data: reconciliations, error: reconciliationsError }] = await Promise.all([
    ctx.admin.rpc('get_ai_cost_summary_rollups', {
      p_start: window.startIso,
      p_end: window.endIso,
      p_provider: modelProvider,
      p_model: modelName,
    }),
    reconciliationQuery,
  ])

  if (rollupsError) throw rollupsError
  if (reconciliationsError) throw reconciliationsError

  const modelMap = new Map<string, AiCostModelOption>()
  const rows = (rollups ?? []) as AiCostRollupRow[]
  for (const row of rows.filter(row => row.group_type === 'model_option')) {
    if (!row.provider || !row.model) continue
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

  const total = rows.find(row => row.group_type === 'total')
  const providerBreakdown = rows.filter(row => row.group_type === 'provider').map(rollupToBreakdown)
  const roleBreakdown = rows.filter(row => row.group_type === 'role').map(rollupToBreakdown)
  const sourceBreakdown = rows.filter(row => row.group_type === 'source').map(rollupToBreakdown)

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
    actualStart: total?.actual_start ?? null,
    actualEnd: total?.actual_end ?? null,
    modelKey,
    modelOptions: Array.from(modelMap.values()).sort((a, b) => a.label.localeCompare(b.label)),
    requestCount: asNumber(total?.request_count),
    estimatedLiveCostUsd: asNumber(total?.estimated_cost_usd),
    inputTokens: asNumber(total?.input_tokens),
    outputTokens: asNumber(total?.output_tokens),
    cachedInputTokens: asNumber(total?.cached_input_tokens),
    cacheWriteTokens: asNumber(total?.cache_write_tokens),
    providerBreakdown: cleanBreakdown(providerBreakdown),
    roleBreakdown: cleanBreakdown(roleBreakdown),
    sourceBreakdown: cleanBreakdown(sourceBreakdown),
    reconciliations: reconciliationRows,
    reconciledTotalUsd: reconciliationRows.reduce((sum, row) => sum + row.actualOrbCostUsd, 0),
  }
}
