export const AI_REQUEST_CSV_HEADERS = [
  'request_id', 'created_at_utc', 'provider', 'model', 'source', 'route_role', 'platform',
  'success', 'failure_code', 'attempt_count', 'latency_ms', 'input_tokens', 'output_tokens',
  'cached_input_tokens', 'cache_write_tokens', 'reasoning_tokens', 'total_tokens',
  'client_tool_calls', 'estimated_cost_usd', 'rate_version', 'rate_effective_date',
  'rate_input_per_million', 'rate_output_per_million', 'rate_cached_input_per_million',
  'rate_cache_write_per_million', 'correlation_id', 'evaluation_case_id', 'prompt_version',
  'context_packet_version',
] as const

type ExportRow = Record<string, any>

function textCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /^[=+\-@]/.test(text) ? `'${text}` : text
}

function scalarCell(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

export function escapeCsvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

export function csvLine(values: string[]): string {
  return values.map(escapeCsvCell).join(',') + '\r\n'
}

function rateValue(rate: ExportRow, camel: string, snake: string) {
  return rate?.[camel] ?? rate?.[snake] ?? null
}

export function aiRequestCsvHeader(): string {
  return csvLine([...AI_REQUEST_CSV_HEADERS])
}

export function aiRequestCsvRow(row: ExportRow): string {
  const rate = row.rate_snapshot ?? {}
  return csvLine([
    textCell(row.id), textCell(row.created_at), textCell(row.provider), textCell(row.model),
    textCell(row.source), textCell(row.route_role), textCell(row.platform), scalarCell(row.success),
    textCell(row.failure_code), scalarCell(row.attempt_count), scalarCell(row.latency_ms),
    scalarCell(row.input_tokens), scalarCell(row.output_tokens), scalarCell(row.cached_input_tokens),
    scalarCell(row.cache_write_tokens), scalarCell(row.reasoning_tokens), scalarCell(row.total_tokens),
    scalarCell(row.client_tool_calls), scalarCell(row.estimated_cost_usd),
    textCell(rateValue(rate, 'version', 'version')), textCell(rateValue(rate, 'effectiveDate', 'effective_date')),
    scalarCell(rateValue(rate, 'inputPerMillion', 'input_per_million')),
    scalarCell(rateValue(rate, 'outputPerMillion', 'output_per_million')),
    scalarCell(rateValue(rate, 'cachedInputPerMillion', 'cached_input_per_million')),
    scalarCell(rateValue(rate, 'cacheWritePerMillion', 'cache_write_per_million')),
    textCell(row.correlation_id), textCell(row.evaluation_case_id), textCell(row.prompt_version),
    textCell(row.context_packet_version),
  ])
}
