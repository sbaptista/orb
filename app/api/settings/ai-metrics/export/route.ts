import { requireAdmin } from '@/lib/auth'
import { AI_REQUEST_EXPORT_COLUMNS, applyAiRequestLogFilters, parseAiRequestLogFilters } from '@/lib/ai-metrics/request-log'
import { aiRequestCsvHeader, aiRequestCsvRow } from '@/lib/ai-metrics/csv'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 1_000
const MAX_EXPORT_ROWS = 100_000

export async function GET(request: Request) {
  try {
    const { admin } = await requireAdmin()
    const url = new URL(request.url)
    const filters = parseAiRequestLogFilters({
      search: url.searchParams.get('search'),
      createdFrom: url.searchParams.get('createdFrom'),
      createdTo: url.searchParams.get('createdTo'),
      createdBefore: url.searchParams.get('createdBefore'),
    })

    const countQuery = applyAiRequestLogFilters(
      admin.from('orb_model_requests').select('id', { count: 'exact', head: true }),
      filters,
    )
    const { count, error: countError } = await countQuery
    if (countError) throw countError
    const rowCount = count ?? 0
    if (rowCount > MAX_EXPORT_ROWS) {
      return Response.json(
        { error: `This export matches ${rowCount.toLocaleString()} rows. Narrow the filters to ${MAX_EXPORT_ROWS.toLocaleString()} rows or fewer.` },
        { status: 413, headers: { 'Cache-Control': 'private, no-store' } },
      )
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode('\uFEFF' + aiRequestCsvHeader()))
          let cursor: { createdAt: string; id: string } | null = null
          let emitted = 0
          while (emitted < rowCount) {
            let query = applyAiRequestLogFilters(
              admin.from('orb_model_requests').select(AI_REQUEST_EXPORT_COLUMNS),
              filters,
            )
            if (cursor) {
              query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.gt.${cursor.id})`)
            }
            const { data, error } = await query
              .order('created_at', { ascending: false })
              .order('id', { ascending: true })
              .limit(Math.min(PAGE_SIZE, rowCount - emitted))
            if (error) throw error
            const rows = data ?? []
            if (rows.length === 0) break
            for (const row of rows) controller.enqueue(encoder.encode(aiRequestCsvRow(row)))
            emitted += rows.length
            const last = rows.at(-1) as { created_at: string; id: string }
            cursor = { createdAt: last.created_at, id: last.id }
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
    })

    const filename = `orb-ai-requests-${new Date().toISOString().slice(0, 10)}.csv`
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Export-Row-Count': String(rowCount),
      },
    })
  } catch (error) {
    console.error('[ai-metrics/export] Export failed:', error)
    const message = error instanceof Error ? error.message : 'Could not export AI request data.'
    const status = message === 'Not authenticated' ? 401
      : message === 'Admin access required' ? 403
        : /Invalid date filter|Date From must be before Date To/.test(message) ? 400
          : 500
    const publicMessage = status === 500 ? 'Could not export AI request data.' : message
    return Response.json({ error: publicMessage }, { status, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
