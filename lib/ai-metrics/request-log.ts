export type AiRequestLogFilters = {
  search: string
  createdFrom: string | null
  createdTo: string | null
  createdBefore: string | null
}

export const AI_REQUEST_LOG_COLUMNS = `
  id,
  created_at,
  provider,
  model,
  source,
  route_role,
  platform,
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
`

export const AI_REQUEST_EXPORT_COLUMNS = `
  id,
  created_at,
  provider,
  model,
  source,
  route_role,
  platform,
  success,
  failure_code,
  attempt_count,
  latency_ms,
  input_tokens,
  output_tokens,
  cached_input_tokens,
  cache_write_tokens,
  reasoning_tokens,
  total_tokens,
  client_tool_calls,
  estimated_cost_usd,
  rate_snapshot,
  correlation_id,
  evaluation_case_id,
  prompt_version,
  context_packet_version
`

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

export function parseAiRequestLogFilters(options: {
  search?: string | null
  createdFrom?: string | null
  createdTo?: string | null
  createdBefore?: string | null
}): AiRequestLogFilters {
  const filters = {
    search: sanitizeSearch(options.search ?? ''),
    createdFrom: validIsoDate(options.createdFrom),
    createdTo: validIsoDate(options.createdTo, true),
    createdBefore: validIsoDate(options.createdBefore),
  }
  if (filters.createdFrom && filters.createdTo && filters.createdFrom > filters.createdTo) {
    throw new Error('Date From must be before Date To.')
  }
  return filters
}

export function applyAiRequestLogFilters(query: any, filters: AiRequestLogFilters) {
  if (filters.search) {
    const pattern = `%${filters.search}%`
    query = query.or([
      `provider.ilike.${pattern}`,
      `model.ilike.${pattern}`,
      `source.ilike.${pattern}`,
      `route_role.ilike.${pattern}`,
      `platform.ilike.${pattern}`,
      `failure_code.ilike.${pattern}`,
      `evaluation_case_id.ilike.${pattern}`,
      `prompt_version.ilike.${pattern}`,
    ].join(','))
  }
  if (filters.createdFrom) query = query.gte('created_at', filters.createdFrom)
  if (filters.createdTo) query = query.lte('created_at', filters.createdTo)
  if (filters.createdBefore) query = query.lt('created_at', filters.createdBefore)
  return query
}
