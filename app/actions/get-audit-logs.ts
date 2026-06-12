'use server'

import { requireAdmin } from '@/lib/auth'

const SORT_COLUMNS: Record<string, string> = {
  table_name: 'table_name',
  action: 'action',
  actor: 'actor',
  created_at: 'created_at',
}

export async function getAuditLogs(options: {
  page?: number
  pageSize?: number
  search?: string
  sortKey?: string | null
  sortDir?: 'asc' | 'desc'
} = {}) {
  const ctx = await requireAdmin()

  try {
    const page = Math.max(0, options.page ?? 0)
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 50))
    const from = page * pageSize
    const to = from + pageSize - 1
    const search = options.search?.trim().replace(/[,%_()]/g, ' ') ?? ''
    const requestedSortColumn = options.sortKey ? SORT_COLUMNS[options.sortKey] : undefined
    const sortColumn = requestedSortColumn ?? 'created_at'
    const ascending = requestedSortColumn ? options.sortDir !== 'desc' : false

    let query = ctx.admin
      .from('audit_log')
      .select('*', { count: 'exact' })

    if (search) {
      const filters = [
        `table_name.ilike.%${search}%`,
        `action.ilike.%${search}%`,
        `actor.ilike.%${search}%`,
      ]
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(search)) {
        filters.push(`record_id.eq.${search}`)
      }
      query = query.or(filters.join(','))
    }

    query = query.order(sortColumn, { ascending })
    if (sortColumn !== 'created_at') {
      query = query.order('created_at', { ascending: false })
    }

    const { data, error, count } = await query.range(from, to)

    if (error) throw error
    return { ok: true, data, count }
  } catch (err: any) {
    console.error('[getAuditLogs] Error:', err)
    return { error: err.message }
  }
}
