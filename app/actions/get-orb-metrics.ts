'use server'

import { requireAdmin } from '@/lib/auth'

const SORT_COLUMNS: Record<string, string> = {
  date: 'date',
  model: 'model',
  call_count: 'call_count',
  speech_chars: 'speech_chars',
  voice_speech_chars: 'voice_speech_chars',
  input_chars: 'input_chars',
  tool_call_count: 'tool_call_count',
  ambient_chars: 'ambient_chars',
  input_tokens: 'input_tokens',
  output_tokens: 'output_tokens',
  cache_creation_input_tokens: 'cache_creation_input_tokens',
  cache_read_input_tokens: 'cache_read_input_tokens',
}

function validIsoDate(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date filter.')
  return d.toISOString().split('T')[0]
}

export async function getOrbMetrics(options: {
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
    const dateFrom = validIsoDate(options.createdFrom)
    const dateTo = validIsoDate(options.createdTo)
    const dateBefore = validIsoDate(options.createdBefore)
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new Error('Date From must be before Date To.')
    }
    const requestedSortColumn = options.sortKey ? SORT_COLUMNS[options.sortKey] : undefined
    const sortColumn = requestedSortColumn ?? 'date'
    const ascending = requestedSortColumn ? options.sortDir !== 'desc' : false

    const filters = {
      p_search: search,
      p_date_from: dateFrom,
      p_date_to: dateTo,
      p_date_before: dateBefore,
    }
    const [{ data, error }, { data: summary, error: summaryError }] = await Promise.all([
      ctx.admin.rpc('get_orb_metrics_page', {
        ...filters,
        p_sort_key: sortColumn,
        p_sort_dir: ascending ? 'asc' : 'desc',
        p_limit: pageSize,
        p_offset: from,
      }),
      ctx.admin.rpc('get_orb_metrics_summary', filters),
    ])

    if (error) throw error
    if (summaryError) throw summaryError
    const count = data?.[0]?.total_count ?? 0
    const rows = ((data ?? []) as Array<Record<string, any>>).map(row => {
      const metricRow = { ...row }
      delete metricRow.total_count
      return metricRow
    })
    return { ok: true, data: rows, count, summary: summary ?? [] }
  } catch (err: any) {
    console.error('[getOrbMetrics] Error:', err)
    return { error: err.message }
  }
}
