type DisplayRow = Record<string, unknown>

export type OrbQueryDisplayFormat = 'table' | 'bullets' | 'paragraphs'
export type OrbQueryDisplayDetail = 'brief' | 'full'

export type OrbQueryPresentationRequest = {
  format?: OrbQueryDisplayFormat
  fields?: string[]
  detail?: OrbQueryDisplayDetail
}

export type OrbQueryPresentation = {
  format: OrbQueryDisplayFormat
  fields: string[]
  markdown: string
  unavailableFields?: string[]
}

export type OrbQueryDisplayPacket = Record<string, unknown> & {
  count?: number
  offset?: number
}

export type DirectQueryPresentationMode = 'count' | 'records'

/** Recognize a request whose desired result is the trusted data itself. */
export function directQueryPresentationMode(input: string): DirectQueryPresentationMode | null {
  const normalized = input.trim()
  if (!normalized) return null
  if (/\b(?:why|explain|recommend|suggest|should|analy[sz]e|compare|interpret|evaluate|assess|summarize)\b/i.test(normalized)) {
    return null
  }
  if (/\b(?:how many|number of|count(?: of)?|total number of)\b/i.test(normalized)) return 'count'
  if (/\b(?:list|show|display|see|give me|what are|which are)\b/i.test(normalized)) return 'records'
  return null
}

export function directQueryPresentationModeForTurn(
  input: string,
  history: Array<{ role: 'user' | 'assistant'; text: string }> = [],
): DirectQueryPresentationMode | null {
  const direct = directQueryPresentationMode(input)
  if (direct) return direct

  const confirmsClarification = /\b(?:yes|yeah|yep|correct|right|i meant)\b/i.test(input)
  if (!confirmsClarification) return null
  const latestAssistantIndex = history.findLastIndex(message => message.role === 'assistant')
  if (latestAssistantIndex < 0 || !/\bdid you mean\b/i.test(history[latestAssistantIndex].text)) return null
  for (let index = latestAssistantIndex - 1; index >= 0; index -= 1) {
    if (history[index].role !== 'user') continue
    return directQueryPresentationMode(history[index].text)
  }
  return null
}

export function renderDirectQueryCount(packet: OrbQueryDisplayPacket | null | undefined): string | null {
  if (!packet || typeof packet.count !== 'number') return null
  return `${packet.count} matching result${packet.count === 1 ? '' : 's'}.`
}

export function directQuerySpokenSummary(packet: OrbQueryDisplayPacket | null | undefined): string | undefined {
  if (!packet || typeof packet.count !== 'number') return undefined
  return `${packet.count} matching result${packet.count === 1 ? '' : 's'}. I put the details on screen.`
}

/** Shared by the serial and Realtime tool inventories. Retrieval stays
 * independent of presentation: these arguments select only how trusted rows
 * are shown after the database command returns. */
export const ORB_QUERY_PRESENTATION_PROPERTIES = {
  format: {
    type: 'string',
    enum: ['table', 'bullets', 'paragraphs'],
    description: 'How to display the returned records. Copy the format the user requested. Defaults to table for a multi-row list.',
  },
  fields: {
    type: 'array',
    items: { type: 'string' },
    description: 'Fields to display, in the user-requested order. Use the field names the user asked for; omit only when they did not choose fields.',
  },
  detail: {
    type: 'string',
    enum: ['brief', 'full'],
    description: 'brief shortens long displayed values; full preserves them. Use brief only when the user asks for brief or concise values.',
  },
} as const

export const ORB_PRESENTABLE_QUERY_TOOL_NAMES = new Set([
  // Serial and Realtime use a few different adapter names, but both feed the
  // same returned row shapes into this presenter.
  'query_todos', 'list_todos', 'get_todo_details', 'query_projects',
  'query_users', 'query_invitations', 'query_tickets', 'query_db',
  'search_knowledge', 'query_audit_trail', 'query_audit',
])

export function orbQueryPresentationRequest(args: Record<string, unknown>): OrbQueryPresentationRequest {
  const format = args.format === 'table' || args.format === 'bullets' || args.format === 'paragraphs'
    ? args.format
    : undefined
  const detail = args.detail === 'brief' || args.detail === 'full' ? args.detail : undefined
  const fields = Array.isArray(args.fields)
    ? args.fields.filter((field): field is string => typeof field === 'string')
    : undefined
  return { format, fields, detail }
}

const PACKET_METADATA_KEYS = new Set([
  'kind', 'count', 'offset', 'observedAt', 'observed_at', 'source', 'statuses',
  'spokenText', 'spoken_text', 'project', 'table', 'truncated', 'presentation',
])

function isDisplayRow(value: unknown): value is DisplayRow {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** Locate records by shape, not by table or tool name. This lets every
 * structured read packet use the same renderer without a per-table branch. */
export function queryRowsFromResult(result: unknown): DisplayRow[] {
  if (!isDisplayRow(result)) return []
  for (const [key, value] of Object.entries(result)) {
    if (PACKET_METADATA_KEYS.has(key) || !Array.isArray(value)) continue
    if (value.length === 0 || value.every(isDisplayRow)) return value as DisplayRow[]
  }
  for (const key of ['task', 'entry', 'record']) {
    if (isDisplayRow(result[key])) return [result[key] as DisplayRow]
  }
  return []
}

function normalizedField(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function fieldLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/[|*_`\[\]<>]/g, '')
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

function fieldKeys(rows: DisplayRow[]) {
  const keys: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key)
        keys.push(key)
      }
    }
  }
  return keys
}

function defaultDisplayFields(available: string[]) {
  const preferred = ['code', 'title', 'name', 'summary', 'status', 'project', 'owner', 'type']
  const selected = preferred.filter(field => available.includes(field)).slice(0, 5)
  return selected.length > 0 ? selected : available.slice(0, 5)
}

function resolveField(requested: string, available: string[]) {
  const wanted = normalizedField(requested)
  const exact = available.find(field => normalizedField(field) === wanted)
  if (exact) return exact
  if (wanted === 'name' && available.includes('first_name') && available.includes('last_name')) return '__full_name'
  return available.find(field => normalizedField(field.replace(/_(?:value|at|code|order)$/i, '')) === wanted)
}

function valueAtPath(row: DisplayRow, field: string) {
  if (field === '__full_name') return [row.first_name, row.last_name].filter(Boolean).join(' ')
  let current: unknown = row
  for (const part of field.split('.')) {
    if (!isDisplayRow(current)) return undefined
    current = current[part]
  }
  return current
}

function readableValue(value: unknown): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(readableValue).filter(Boolean).join(', ')
  if (isDisplayRow(value)) {
    const name = typeof value.name === 'string' ? value.name : ''
    const code = typeof value.code === 'string' ? value.code : ''
    if (name && code) return `${name} (${code})`
    if (name || code) return name || code
    return JSON.stringify(value)
  }
  return String(value)
}

function shorten(value: string, detail: OrbQueryDisplayDetail) {
  if (detail !== 'brief' || value.length <= 180) return value
  const excerpt = value.slice(0, 177)
  const sentenceEnd = Math.max(excerpt.lastIndexOf('. '), excerpt.lastIndexOf('! '), excerpt.lastIndexOf('? '))
  return `${(sentenceEnd >= 60 ? excerpt.slice(0, sentenceEnd + 1) : excerpt).trimEnd()}…`
}

function escapedInline(value: string) {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function markdownTable(headers: string[], rows: string[][]) {
  const heading = `| ${headers.join(' | ')} |`
  const divider = `| ${headers.map(() => '---').join(' | ')} |`
  return [heading, divider, ...rows.map(row => `| ${row.map(escapedInline).join(' | ')} |`)].join('\n')
}

function renderRows(format: OrbQueryDisplayFormat, fields: string[], rows: string[][]) {
  const labels = fields.map(fieldLabel)
  if (format === 'table') return markdownTable(labels, rows)
  const record = (row: string[]) => row
    .map((value, index) => `**${labels[index]}:** ${value || '—'}`)
    .join('; ')
  if (format === 'bullets') return rows.map(row => `- ${record(row)}`).join('\n')
  return rows.map(record).join('\n\n')
}

export function buildOrbQueryPresentation(
  result: unknown,
  request: OrbQueryPresentationRequest = {},
): OrbQueryPresentation | null {
  const rows = queryRowsFromResult(result)
  if (rows.length === 0) return null

  const available = fieldKeys(rows)
  const rawRequested = (request.fields ?? []).map(field => field.trim()).filter(Boolean)
  const requestsAllFields = rawRequested.some(field => field === '*' || ['all', 'allfields', 'everyfield'].includes(normalizedField(field)))
  const requested = requestsAllFields ? [] : rawRequested
  const resolved = requested.length
    ? requested.map(field => ({ requested: field, resolved: resolveField(field, available) }))
    : (requestsAllFields ? available : defaultDisplayFields(available))
      .map(field => ({ requested: field, resolved: field }))
  const fields = resolved.flatMap(field => field.resolved ? [field.resolved] : [])
  if (fields.length === 0) return null

  const detail = request.detail ?? 'full'
  const values = rows.map(row => fields.map(field => shorten(readableValue(valueAtPath(row, field)), detail)))
  const format = request.format ?? (rows.length > 1 ? 'table' : 'paragraphs')
  const unavailableFields = resolved.filter(field => !field.resolved).map(field => field.requested)
  return {
    format,
    fields: requested.length ? resolved.filter(field => field.resolved).map(field => field.requested) : fields,
    markdown: renderRows(format, requested.length ? resolved.filter(field => field.resolved).map(field => field.requested) : fields, values),
    ...(unavailableFields.length ? { unavailableFields } : {}),
  }
}

/** Converts any trusted structured query packet into the same Markdown used by
 * serial text results. There are no table-specific column lists here: the
 * requested fields are resolved against the fields actually returned. */
export function renderOrbQueryPacketMarkdown(
  packet: OrbQueryDisplayPacket | null | undefined,
  request: OrbQueryPresentationRequest = {},
) {
  if (!packet) return null
  const presentation = buildOrbQueryPresentation(packet, request)
  if (!presentation) return null

  const rows = queryRowsFromResult(packet)
  const shown = rows.length
  const total = typeof packet.count === 'number' ? packet.count : shown
  const from = (typeof packet.offset === 'number' ? packet.offset : 0) + 1
  const to = from + shown - 1
  const note = total > shown
    ? `\n\n_${from}–${to} of ${total}${to < total ? '. Say "show the next page" for more.' : '. Last page.'}_`
    : ''
  return presentation.markdown + note
}
