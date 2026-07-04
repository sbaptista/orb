'use server'

import { requireAdmin } from '@/lib/auth'

export type AiRequestLogRow = {
  id: string
  created_at: string
  provider: string
  model: string
  source: string
  route_role: string
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

function validIsoDate(value: string | null | undefined, endOfDay = false): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date filter.')
  if (endOfDay) d.setUTCHours(23, 59, 59, 999)
  else d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

function sanitizeSearch(value: string): string {
  return value.replace(/[%,()]/g, ' ').trim()
}

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
    const search = sanitizeSearch(options.search ?? '')
    const dateFrom = validIsoDate(options.createdFrom)
    const dateTo = validIsoDate(options.createdTo, true)
    const dateBefore = validIsoDate(options.createdBefore)
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new Error('Date From must be before Date To.')
    }
    const requestedSortColumn = options.sortKey ? SORT_COLUMNS[options.sortKey] : undefined
    const sortColumn = requestedSortColumn ?? 'created_at'
    const ascending = requestedSortColumn ? options.sortDir !== 'desc' : false
    const sortKey = options.sortKey && SORT_COLUMNS[options.sortKey] ? options.sortKey : 'created_at'
    const sortDir = ascending ? 'asc' : 'desc'
    const cursor = parseCursor(options.cursor)

    const applyFilters = (query: any) => {
      if (search) {
        const pattern = `%${search}%`
        query = query.or([
          `provider.ilike.${pattern}`,
          `model.ilike.${pattern}`,
          `source.ilike.${pattern}`,
          `route_role.ilike.${pattern}`,
          `failure_code.ilike.${pattern}`,
          `evaluation_case_id.ilike.${pattern}`,
          `prompt_version.ilike.${pattern}`,
        ].join(','))
      }
      if (dateFrom) query = query.gte('created_at', dateFrom)
      if (dateTo) query = query.lte('created_at', dateTo)
      if (dateBefore) query = query.lt('created_at', dateBefore)
      return query
    }

    let query = applyFilters(ctx.admin
      .from('orb_model_requests')
      .select(`
        id,
        created_at,
        provider,
        model,
        source,
        route_role,
        input_tokens,
        output_tokens,
        cached_input_tokens,
        cache_write_tokens,
        latency_ms,
        attempt_count,
        success,
        failure_code,
        estimated_cost_usd,
        evaluation_case_id,
        prompt_version
      `))

    if (cursor) {
      if (cursor.sortKey !== sortKey || cursor.sortDir !== sortDir) throw new Error('AI Request Log cursor does not match the current sort.')
      const op = sortDir === 'asc' ? 'gt' : 'lt'
      query = query.or(`${sortColumn}.${op}.${cursor.sort},and(${sortColumn}.eq.${cursor.sort},id.gt.${cursor.id})`)
    }

    const countQuery = applyFilters(ctx.admin
      .from('orb_model_requests')
      .select('id', { count: 'exact', head: true }))

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
