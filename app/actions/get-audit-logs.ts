'use server'

import { requireAdmin } from '@/lib/auth'

const SORT_COLUMNS: Record<string, string> = {
  table_name: 'table_name',
  action: 'action',
  actor: 'actor',
  created_at: 'created_at',
}

function validIsoTimestamp(value: string | null | undefined): string | null {
  if (!value) return null
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) throw new Error('Invalid Created date filter.')
  return timestamp.toISOString()
}

export async function getAuditLogs(options: {
  page?: number
  pageSize?: number
  search?: string
  sortKey?: string | null
  sortDir?: 'asc' | 'desc'
  createdFrom?: string | null
  createdTo?: string | null
  createdBefore?: string | null
} = {}) {
  const ctx = await requireAdmin()

  try {
    const page = Math.max(0, options.page ?? 0)
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 50))
    const from = page * pageSize
    const search = options.search?.trim() ?? ''
    const createdFrom = validIsoTimestamp(options.createdFrom)
    const createdTo = validIsoTimestamp(options.createdTo)
    const createdBefore = validIsoTimestamp(options.createdBefore)
    if (createdFrom && createdTo && createdFrom > createdTo) {
      throw new Error('Created From must be before Created To.')
    }
    if (createdFrom && createdBefore && createdFrom >= createdBefore) {
      throw new Error('Created date range is invalid.')
    }
    const requestedSortColumn = options.sortKey ? SORT_COLUMNS[options.sortKey] : undefined
    const sortColumn = requestedSortColumn ?? 'created_at'
    const ascending = requestedSortColumn ? options.sortDir !== 'desc' : false

    const { data, error } = await ctx.admin.rpc('get_audit_log_page', {
      p_search: search,
      p_created_from: createdFrom,
      p_created_to: createdTo,
      p_created_before: createdBefore,
      p_sort_key: sortColumn,
      p_sort_dir: ascending ? 'asc' : 'desc',
      p_limit: pageSize,
      p_offset: from,
    })

    if (error) throw error
    const count = data?.[0]?.total_count ?? 0
    const rows = ((data ?? []) as Array<Record<string, any>>).map(row => {
      const auditRow = { ...row }
      delete auditRow.total_count
      return auditRow
    })
    return { ok: true, data: rows, count }
  } catch (err: any) {
    console.error('[getAuditLogs] Error:', err)
    return { error: err.message }
  }
}
