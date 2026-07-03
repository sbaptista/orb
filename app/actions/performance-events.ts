'use server'

import { requireAdmin } from '@/lib/auth'
import { VERSION } from '@/lib/version'

const SORT_COLUMNS: Record<string, string> = {
  created_at: 'created_at',
  duration_ms: 'duration_ms',
  focus: 'focus',
  flow: 'flow',
  interaction: 'interaction',
  platform: 'platform',
  browser: 'browser',
  environment: 'environment',
}

function validIsoTimestamp(value: string | null | undefined): string | null {
  if (!value) return null
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) throw new Error('Invalid Created date filter.')
  return timestamp.toISOString()
}

function applyFilters(query: any, options: PerformanceEventQuery) {
  const search = options.search?.trim()
  if (search) {
    const pattern = `%${search}%`
    query = query.or([
      `route.ilike.${pattern}`,
      `focus.ilike.${pattern}`,
      `flow.ilike.${pattern}`,
      `interaction.ilike.${pattern}`,
      `surface.ilike.${pattern}`,
      `browser.ilike.${pattern}`,
      `failure_code.ilike.${pattern}`,
    ].join(','))
  }
  if (options.createdFrom) query = query.gte('created_at', validIsoTimestamp(options.createdFrom))
  if (options.createdTo) query = query.lte('created_at', validIsoTimestamp(options.createdTo))
  if (options.createdBefore) query = query.lt('created_at', validIsoTimestamp(options.createdBefore))
  if (options.environment && options.environment !== 'all') query = query.eq('environment', options.environment)
  if (options.focus && options.focus !== 'all') query = query.eq('focus', options.focus)
  if (options.platform && options.platform !== 'all') query = query.eq('platform', options.platform)
  if (options.browser && options.browser !== 'all') query = query.eq('browser', options.browser)
  if (options.success === 'success') query = query.eq('success', true)
  if (options.success === 'failure') query = query.eq('success', false)
  if (options.version && options.version !== 'all') query = query.eq('app_version', options.version)
  return query
}

export type PerformanceEventQuery = {
  page?: number
  pageSize?: number
  search?: string
  sortKey?: string | null
  sortDir?: 'asc' | 'desc'
  createdFrom?: string | null
  createdTo?: string | null
  createdBefore?: string | null
  environment?: string
  focus?: string
  platform?: string
  browser?: string
  success?: 'all' | 'success' | 'failure'
  version?: string
}

export type PerformanceEventRecord = {
  environment: string
  app_version: string
  route: string
  focus: string
  flow: string
  interaction: string
  surface: string
  platform: string | null
  browser: string | null
  duration_ms: number
  success: boolean
  failure_code: string | null
  stages: unknown
  metadata: unknown
}

function cleanPerformanceEventRecord(record: Record<string, any>): PerformanceEventRecord {
  const stages = Array.isArray(record.stages) ? record.stages : []
  const metadata = record.metadata && typeof record.metadata === 'object' && !Array.isArray(record.metadata) ? record.metadata : {}
  const duration = Number(record.duration_ms)
  if (!Number.isFinite(duration) || duration < 0) throw new Error('Duration must be a non-negative number.')
  return {
    environment: String(record.environment || 'unknown').slice(0, 40),
    app_version: String(record.app_version || VERSION).slice(0, 40),
    route: String(record.route || '/settings/performance').slice(0, 300),
    focus: String(record.focus || 'settings').slice(0, 80),
    flow: String(record.flow || 'manual').slice(0, 120),
    interaction: String(record.interaction || 'manual_event').slice(0, 160),
    surface: String(record.surface || 'settings').slice(0, 160),
    platform: record.platform ? String(record.platform).slice(0, 40) : null,
    browser: record.browser ? String(record.browser).slice(0, 80) : null,
    duration_ms: Math.round(duration),
    success: record.success !== false,
    failure_code: record.failure_code ? String(record.failure_code).slice(0, 120) : null,
    stages,
    metadata,
  }
}

export async function getPerformanceEvents(options: PerformanceEventQuery = {}) {
  const ctx = await requireAdmin()
  try {
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 50))
    const page = Math.max(0, options.page ?? 0)
    const sortColumn = options.sortKey ? SORT_COLUMNS[options.sortKey] ?? 'created_at' : 'created_at'
    const ascending = options.sortDir === 'asc'
    let query = ctx.admin
      .from('performance_events')
      .select('*', { count: 'exact' })
    query = applyFilters(query, options)
    const { data, error, count } = await query
      .order(sortColumn, { ascending })
      .range(page * pageSize, page * pageSize + pageSize - 1)
    if (error) throw error
    return { ok: true, data: data ?? [], totalCount: count ?? 0 }
  } catch (err: any) {
    console.error('[getPerformanceEvents] Error:', err)
    return { error: err.message }
  }
}

export async function savePerformanceEvent(id: string | null, record: Record<string, any>) {
  const ctx = await requireAdmin()
  try {
    const cleaned = cleanPerformanceEventRecord(record)
    const query = id
      ? ctx.admin.from('performance_events').update(cleaned).eq('id', id)
      : ctx.admin.from('performance_events').insert(cleaned)
    const { error } = await query
    if (error) throw error
    return { ok: true }
  } catch (err: any) {
    console.error('[savePerformanceEvent] Error:', err)
    return { error: err.message }
  }
}

export async function deletePerformanceEvents(ids: string[]) {
  const ctx = await requireAdmin()
  try {
    const { error } = await ctx.admin.from('performance_events').delete().in('id', ids)
    if (error) throw error
    return { ok: true }
  } catch (err: any) {
    console.error('[deletePerformanceEvents] Error:', err)
    return { error: err.message }
  }
}

export async function getPerformanceSummary(options: Omit<PerformanceEventQuery, 'page' | 'pageSize' | 'sortKey' | 'sortDir'> = {}) {
  const ctx = await requireAdmin()
  try {
    let query = ctx.admin
      .from('performance_events')
      .select('created_at, environment, focus, flow, interaction, platform, browser, duration_ms, success')
      .limit(5000)
    query = applyFilters(query, options)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    const rows = (data ?? []) as Array<{ created_at: string; environment: string; focus: string; flow: string; interaction: string; platform: string | null; browser: string | null; duration_ms: number; success: boolean }>
    const groups = new Map<string, { environment: string; focus: string; flow: string; interaction: string; platform: string; browser: string; durations: number[]; failures: number; totalCount: number }>()
    const coverage = new Map<string, { environment: string; platform: string; browser: string; count: number; successes: number; failures: number; latestAt: string }>()
    for (const row of rows) {
      const key = [row.environment, row.focus, row.flow, row.interaction, row.platform ?? 'unknown', row.browser ?? 'unknown'].join('|')
      const group = groups.get(key) ?? {
        environment: row.environment,
        focus: row.focus,
        flow: row.flow,
        interaction: row.interaction,
        platform: row.platform ?? 'unknown',
        browser: row.browser ?? 'unknown',
        durations: [],
        failures: 0,
        totalCount: 0,
      }
      group.totalCount += 1
      if (row.success) group.durations.push(row.duration_ms)
      if (!row.success) group.failures += 1
      groups.set(key, group)

      const coverageKey = [row.environment, row.platform ?? 'unknown', row.browser ?? 'unknown'].join('|')
      const coverageGroup = coverage.get(coverageKey) ?? {
        environment: row.environment,
        platform: row.platform ?? 'unknown',
        browser: row.browser ?? 'unknown',
        count: 0,
        successes: 0,
        failures: 0,
        latestAt: row.created_at,
      }
      coverageGroup.count += 1
      if (row.success) coverageGroup.successes += 1
      else coverageGroup.failures += 1
      if (row.created_at > coverageGroup.latestAt) coverageGroup.latestAt = row.created_at
      coverage.set(coverageKey, coverageGroup)
    }
    const percentile = (values: number[], p: number) => {
      if (values.length === 0) return 0
      const sorted = [...values].sort((a, b) => a - b)
      return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]
    }
    const summary = [...groups.values()]
      .map(group => ({
        ...group,
        count: group.durations.length,
        p50: percentile(group.durations, 0.5),
        p75: percentile(group.durations, 0.75),
        p95: percentile(group.durations, 0.95),
        max: group.durations.length ? Math.max(...group.durations) : 0,
        failureRate: group.totalCount ? group.failures / group.totalCount : 0,
        durations: undefined,
      }))
      .sort((a, b) => (b.p95 - a.p95) || (b.failures - a.failures))
      .slice(0, 25)
    return {
      ok: true,
      data: summary,
      coverage: [...coverage.values()].sort((a, b) => b.count - a.count),
      totals: {
        events: rows.length,
        successes: rows.filter(row => row.success).length,
        failures: rows.filter(row => !row.success).length,
        environments: [...new Set(rows.map(row => row.environment))],
      },
      appVersion: VERSION,
    }
  } catch (err: any) {
    console.error('[getPerformanceSummary] Error:', err)
    return { error: err.message }
  }
}
