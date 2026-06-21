'use server'

import { requireAdmin } from '@/lib/auth'

const SORT_COLUMNS: Record<string, string> = {
  table_name: 'table_name',
  action: 'action',
  actor: 'actor',
  created_at: 'created_at',
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function validIsoTimestamp(value: string | null | undefined): string | null {
  if (!value) return null
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) throw new Error('Invalid Created date filter.')
  return timestamp.toISOString()
}

function parseCursor(value: string | null | undefined): { sort: string; id: string } | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    if (typeof parsed?.sort !== 'string' || !UUID_PATTERN.test(parsed?.id ?? '')) throw new Error()
    return parsed
  } catch {
    throw new Error('Invalid Audit Log cursor.')
  }
}

export async function getAuditLogs(options: {
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
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 50))
    const search = options.search?.trim() ?? ''
    const createdFrom = validIsoTimestamp(options.createdFrom)
    const createdTo = validIsoTimestamp(options.createdTo)
    const createdBefore = validIsoTimestamp(options.createdBefore)
    if (createdFrom && createdTo && createdFrom > createdTo) throw new Error('Created From must be before Created To.')
    if (createdFrom && createdBefore && createdFrom >= createdBefore) throw new Error('Created date range is invalid.')

    const sortColumn = options.sortKey ? SORT_COLUMNS[options.sortKey] : 'created_at'
    const sortDir = options.sortDir === 'asc' ? 'asc' : 'desc'
    const cursor = parseCursor(options.cursor)
    const { data, error } = await ctx.admin.rpc('get_audit_log_cursor_page', {
      p_search: search,
      p_created_from: createdFrom,
      p_created_to: createdTo,
      p_created_before: createdBefore,
      p_sort_key: sortColumn,
      p_sort_dir: sortDir,
      p_limit: pageSize + 1,
      p_cursor: cursor,
    })
    if (error) throw error

    const results = (data ?? []) as Array<Record<string, unknown>>
    const hasNext = results.length > pageSize
    const rows = hasNext ? results.slice(0, pageSize) : results
    const lastRow = rows.at(-1)
    const sortValue = sortColumn === 'actor' ? lastRow?.actor ?? '' : lastRow?.[sortColumn]
    const nextCursor = hasNext && lastRow && sortValue !== null && sortValue !== undefined
      ? JSON.stringify({ sort: String(sortValue), id: lastRow.id })
      : null

    return { ok: true, data: rows, nextCursor }
  } catch (err: any) {
    console.error('[getAuditLogs] Error:', err)
    return { error: err.message }
  }
}

export async function getAuditLogCount(options: {
  search?: string
  createdFrom?: string | null
  createdTo?: string | null
  createdBefore?: string | null
} = {}) {
  const ctx = await requireAdmin()

  try {
    const search = options.search?.trim() ?? ''
    const createdFrom = validIsoTimestamp(options.createdFrom)
    const createdTo = validIsoTimestamp(options.createdTo)
    const createdBefore = validIsoTimestamp(options.createdBefore)
    if (createdFrom && createdTo && createdFrom > createdTo) throw new Error('Created From must be before Created To.')
    if (createdFrom && createdBefore && createdFrom >= createdBefore) throw new Error('Created date range is invalid.')

    const { data, error } = await ctx.admin.rpc('get_audit_log_count', {
      p_search: search,
      p_created_from: createdFrom,
      p_created_to: createdTo,
      p_created_before: createdBefore,
    })
    if (error) throw error
    return { ok: true, count: Number(data ?? 0) }
  } catch (err: any) {
    console.error('[getAuditLogCount] Error:', err)
    return { error: err.message }
  }
}
