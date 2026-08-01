'use server'

import { requireAdmin, type AuthContext } from '@/lib/auth'
import { fetchOrbAiSettings, type OrbAiSettingsResult } from '@/lib/orb-model/ai-settings-core'

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

export type AiFundingMode = 'prepaid_credit' | 'subscription_quota' | 'subscription_cash'

export type AiRunwayPool = {
  poolKey: string
  provider: string
  displayName: string
  fundingMode: AiFundingMode
  spendingCapUsd: number | null
  recurringCostUsd: number | null
  usedUsd: number | null
  remainingUsd: number | null
  usageValue: number | null
  usageLimit: number | null
  usageUnit: string | null
  dailyBurn7d: number | null
  dailyBurn30d: number | null
  evalShare7d: number | null
  runwayDays: number | null
  usageSource: 'provider_reported' | 'ledger_estimate' | 'provider_quota' | 'not_available'
  dataFreshAt: string | null
  latestRequestAt: string | null
  status: 'comfortable' | 'warning' | 'attention' | 'needs_setup' | 'no_usage'
}

export type AiObservabilityStatus = {
  generatedAt: string
  runwayPools: AiRunwayPool[]
  subscriptions: AiRunwayPool[]
}

export type AiCostHistoryPoint = {
  date: string
  provider: string
  scope: 'eval' | 'product'
  costUsd: number
}

export type AiCostHistory = {
  days: number
  points: AiCostHistoryPoint[]
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

async function computeAiCostSummary(ctx: AuthContext, options: AiCostSummaryOptions = {}): Promise<AiCostSummary> {
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

type FundingPoolRow = {
  pool_key: string
  provider: string
  display_name: string
  funding_mode: AiFundingMode
  spending_cap_usd: number | string | null
  recurring_cost_usd: number | string | null
  sort_order: number
}

type ProviderSnapshotRow = {
  pool_key: string
  provider: string
  spending_usd: number | string | null
  usage_value: number | string | null
  usage_limit: number | string | null
  usage_unit: string | null
  fetched_at: string
}

type ProviderBurnRow = {
  provider: string
  cost_7d: number | string | null
  cost_30d: number | string | null
  cost_current_month: number | string | null
  eval_cost_7d: number | string | null
  product_cost_7d: number | string | null
  latest_request_at: string | null
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

async function computeAiCostHistory(ctx: AuthContext, days = 30, timeZone = 'UTC'): Promise<AiCostHistory> {
  const safeDays = Math.min(Math.max(Math.round(days), 1), 366)
  const safeTimeZone = (() => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone }).format()
      return timeZone
    } catch {
      return 'UTC'
    }
  })()
  const { data, error } = await ctx.admin.rpc('get_ai_cost_history', { p_days: safeDays, p_time_zone: safeTimeZone })
  if (error) throw error
  return {
    days: safeDays,
    points: (data ?? []).map((row: any) => ({
      date: row.usage_date,
      provider: row.provider,
      scope: row.usage_scope,
      costUsd: asNumber(row.estimated_cost_usd),
    })),
  }
}

function runwayStatus(cap: number | null, remaining: number | null, runwayDays: number | null, burn: number | null): AiRunwayPool['status'] {
  if (cap === null) return 'needs_setup'
  if (remaining !== null && remaining <= 0) return 'attention'
  if (!burn) return 'no_usage'
  if (runwayDays !== null && runwayDays <= 7) return 'warning'
  return 'comfortable'
}

async function computeAiObservabilityStatus(ctx: AuthContext, now = new Date()): Promise<AiObservabilityStatus> {
  const since = new Date(now)
  since.setUTCDate(since.getUTCDate() - 31)

  const [{ data: pools, error: poolsError }, { data: snapshots, error: snapshotsError }, { data: burns, error: burnsError }] = await Promise.all([
    ctx.admin
      .from('orb_ai_funding_pools')
      .select('pool_key, provider, display_name, funding_mode, spending_cap_usd, recurring_cost_usd, sort_order')
      .eq('active', true)
      .order('sort_order'),
    ctx.admin
      .from('orb_provider_consumption_snapshots')
      .select('pool_key, provider, spending_usd, usage_value, usage_limit, usage_unit, fetched_at')
      .gte('fetched_at', since.toISOString())
      .order('fetched_at', { ascending: false }),
    ctx.admin.rpc('get_ai_provider_burn', { p_as_of: now.toISOString() }),
  ])

  if (poolsError) throw poolsError
  if (snapshotsError) throw snapshotsError
  if (burnsError) throw burnsError

  const snapshotRows = (snapshots ?? []) as ProviderSnapshotRow[]
  const snapshotsByPool = new Map<string, ProviderSnapshotRow[]>()
  for (const snapshot of snapshotRows) {
    const rows = snapshotsByPool.get(snapshot.pool_key) ?? []
    rows.push(snapshot)
    snapshotsByPool.set(snapshot.pool_key, rows)
  }
  const burnByProvider = new Map(((burns ?? []) as ProviderBurnRow[]).map(row => [row.provider, row]))

  const mapped = ((pools ?? []) as FundingPoolRow[]).map(pool => {
    const poolSnapshots = snapshotsByPool.get(pool.pool_key) ?? []
    const latestSnapshot = poolSnapshots[0] ?? null
    const burn = burnByProvider.get(pool.provider) ?? null
    const dailyBurn7d = burn ? asNumber(burn.cost_7d) / 7 : null
    const dailyBurn30d = burn ? asNumber(burn.cost_30d) / 30 : null
    const conservativeBurn = Math.max(dailyBurn7d ?? 0, dailyBurn30d ?? 0)
    const evalCost7d = burn ? asNumber(burn.eval_cost_7d) : 0
    const totalCost7d = burn ? asNumber(burn.cost_7d) : 0
    const evalShare7d = totalCost7d > 0 ? evalCost7d / totalCost7d : null
    const spendingCapUsd = nullableNumber(pool.spending_cap_usd)
    const providerSpent = nullableNumber(latestSnapshot?.spending_usd)
    const ledgerSpent = burn ? asNumber(burn.cost_current_month) : null
    const usedUsd = pool.funding_mode === 'prepaid_credit' ? (providerSpent ?? ledgerSpent) : null
    const remainingUsd = spendingCapUsd === null || usedUsd === null ? null : Math.max(spendingCapUsd - usedUsd, 0)
    let quotaBurn: number | null = null

    if (pool.funding_mode === 'subscription_quota' && latestSnapshot) {
      const older = poolSnapshots.find(snapshot => {
        const ageDays = (new Date(latestSnapshot.fetched_at).getTime() - new Date(snapshot.fetched_at).getTime()) / 86_400_000
        return ageDays >= 1
      })
      if (older) {
        const latestUsage = nullableNumber(latestSnapshot.usage_value)
        const olderUsage = nullableNumber(older.usage_value)
        const elapsedDays = Math.max(1, (new Date(latestSnapshot.fetched_at).getTime() - new Date(older.fetched_at).getTime()) / 86_400_000)
        if (latestUsage !== null && olderUsage !== null && latestUsage >= olderUsage) quotaBurn = (latestUsage - olderUsage) / elapsedDays
      }
    }

    const usageValue = nullableNumber(latestSnapshot?.usage_value)
    const usageLimit = nullableNumber(latestSnapshot?.usage_limit)
    const quotaRemaining = usageValue !== null && usageLimit !== null ? Math.max(usageLimit - usageValue, 0) : null
    const runwayDays = pool.funding_mode === 'prepaid_credit'
      ? (remainingUsd !== null && conservativeBurn > 0 ? remainingUsd / conservativeBurn : null)
      : (quotaRemaining !== null && quotaBurn && quotaBurn > 0 ? quotaRemaining / quotaBurn : null)
    const status = pool.funding_mode === 'prepaid_credit'
      ? runwayStatus(spendingCapUsd, remainingUsd, runwayDays, conservativeBurn)
      : pool.funding_mode === 'subscription_quota'
        ? (usageLimit === null ? 'needs_setup' : quotaRemaining === 0 ? 'attention' : runwayDays !== null && runwayDays <= 7 ? 'warning' : 'comfortable')
        : 'comfortable'

    return {
      poolKey: pool.pool_key,
      provider: pool.provider,
      displayName: pool.display_name,
      fundingMode: pool.funding_mode,
      spendingCapUsd,
      recurringCostUsd: nullableNumber(pool.recurring_cost_usd),
      usedUsd,
      remainingUsd,
      usageValue,
      usageLimit,
      usageUnit: latestSnapshot?.usage_unit ?? null,
      dailyBurn7d: pool.funding_mode === 'subscription_quota' ? quotaBurn : dailyBurn7d,
      dailyBurn30d: pool.funding_mode === 'subscription_quota' ? null : dailyBurn30d,
      evalShare7d,
      runwayDays,
      usageSource: pool.funding_mode === 'subscription_quota'
        ? latestSnapshot ? 'provider_quota' : 'not_available'
        : providerSpent !== null ? 'provider_reported' : burn ? 'ledger_estimate' : 'not_available',
      dataFreshAt: latestSnapshot?.fetched_at ?? burn?.latest_request_at ?? null,
      latestRequestAt: burn?.latest_request_at ?? null,
      status,
    } satisfies AiRunwayPool
  })

  return {
    generatedAt: now.toISOString(),
    runwayPools: mapped.filter(pool => pool.fundingMode !== 'subscription_cash'),
    subscriptions: mapped.filter(pool => pool.fundingMode === 'subscription_cash'),
  }
}

export async function getAiCostSummary(options: AiCostSummaryOptions = {}): Promise<AiCostSummary> {
  return computeAiCostSummary(await requireAdmin(), options)
}

export async function getAiCostHistory(days = 30, timeZone = 'UTC'): Promise<AiCostHistory> {
  return computeAiCostHistory(await requireAdmin(), days, timeZone)
}

// ORB-312: one auth check + server-side parallel fetch, replacing the client's
// Promise.all([getAiCostSummary(), getOrbAiSettings()]) which Next.js ran as two
// serial server actions, each paying a full getAuthContext()/getUser() round-trip.
export async function getAiMetricsBundle(options: AiCostSummaryOptions = {}, timeZone = 'UTC'): Promise<{ summary: AiCostSummary; settings: OrbAiSettingsResult; observability: AiObservabilityStatus; history: AiCostHistory }> {
  const ctx = await requireAdmin()
  const [summary, settings, observability, history] = await Promise.all([
    computeAiCostSummary(ctx, options),
    fetchOrbAiSettings(ctx),
    computeAiObservabilityStatus(ctx),
    computeAiCostHistory(ctx, 30, timeZone),
  ])
  return { summary, settings, observability, history }
}
