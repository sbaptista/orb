'use server'

import { requireAdmin } from '@/lib/auth'
import { AI_REQUEST_LOG_COLUMNS, applyAiRequestLogFilters, parseAiRequestLogFilters } from '@/lib/ai-metrics/request-log'

export type AiRequestLogRow = {
  id: string
  created_at: string
  provider: string
  model: string
  source: string
  route_role: string
  platform: 'mac' | 'ipad' | 'iphone' | 'server' | 'unknown'
  input_tokens: number
  output_tokens: number
  cached_input_tokens: number | null
  cache_write_tokens: number | null
  latency_ms: number
  attempt_count: number
  success: boolean
  failure_code: string | null
  estimated_cost_usd: number | string | null
  evaluation_case_id: string | null
  prompt_version: string | null
}

const SORT_COLUMNS: Record<string, string> = {
  created_at: 'created_at',
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function sanitizeCursorValue(value: unknown): string {
  return String(value).replace(/[(),]/g, ' ').trim()
}

function parseCursor(value: string | null | undefined): { sort: string; id: string; sortKey: string; sortDir: 'asc' | 'desc' } | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    if (
      typeof parsed?.sort !== 'string' ||
      typeof parsed?.sortKey !== 'string' ||
      !SORT_COLUMNS[parsed.sortKey] ||
      !['asc', 'desc'].includes(parsed?.sortDir) ||
      !UUID_PATTERN.test(parsed?.id ?? '')
    ) {
      throw new Error()
    }
    return parsed
  } catch {
    throw new Error('Invalid AI Request Log cursor.')
  }
}

export async function getAiRequestLog(options: {
  page?: number
  pageSize?: number
  search?: string
  sortKey?: string | null
  sortDir?: 'asc' | 'desc'
  cursor?: string | null
  createdFrom?: string | null
  createdTo?: string | null
  createdBefore?: string | null
} = {}) {
  const ctx = await requireAdmin()

  try {
    const page = Math.max(0, options.page ?? 0)
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 50))
    const filters = parseAiRequestLogFilters(options)
    const requestedSortColumn = options.sortKey ? SORT_COLUMNS[options.sortKey] : undefined
    const sortColumn = requestedSortColumn ?? 'created_at'
    const ascending = requestedSortColumn ? options.sortDir !== 'desc' : false
    const sortKey = options.sortKey && SORT_COLUMNS[options.sortKey] ? options.sortKey : 'created_at'
    const sortDir = ascending ? 'asc' : 'desc'
    const cursor = parseCursor(options.cursor)

    let query = applyAiRequestLogFilters(ctx.admin
      .from('orb_model_requests')
      .select(AI_REQUEST_LOG_COLUMNS), filters)

    if (cursor) {
      if (cursor.sortKey !== sortKey || cursor.sortDir !== sortDir) throw new Error('AI Request Log cursor does not match the current sort.')
      const op = sortDir === 'asc' ? 'gt' : 'lt'
      query = query.or(`${sortColumn}.${op}.${cursor.sort},and(${sortColumn}.eq.${cursor.sort},id.gt.${cursor.id})`)
    }

    const countQuery = applyAiRequestLogFilters(ctx.admin
      .from('orb_model_requests')
      .select('id', { count: 'exact', head: true }), filters)

    const pageQuery = query
      .order(sortColumn, { ascending, nullsFirst: false })
      .order('id', { ascending })

    const [{ data, error }, { count, error: countError }] = await Promise.all([
      !cursor && page > 0
        ? pageQuery.range(page * pageSize, page * pageSize + pageSize)
        : pageQuery.limit(pageSize + 1),
      countQuery,
    ])

    if (error) throw error
    if (countError) throw countError
    const results = (data ?? []) as AiRequestLogRow[]
    const hasNext = results.length > pageSize
    const rows = hasNext ? results.slice(0, pageSize) : results
    const lastRow = rows.at(-1)
    const sortValue = lastRow?.[sortKey as keyof AiRequestLogRow]
    const nextCursor = hasNext && lastRow && sortValue !== null && sortValue !== undefined
      ? JSON.stringify({
        sort: sanitizeCursorValue(sortValue),
        id: lastRow.id,
        sortKey,
        sortDir,
      })
      : null

    return {
      ok: true,
      data: rows,
      count: count ?? rows.length,
      nextCursor,
    }
  } catch (err: any) {
    console.error('[getAiRequestLog] Error:', err)
    return { error: err.message }
  }
}
