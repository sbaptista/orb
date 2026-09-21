export class InteractionPolicyError extends Error {}

/** Shared read boundary: allowlisted projections cannot escape via embedded joins. */
const COLUMNS: Record<string, readonly string[]> = {
  "todos": [
    "id",
    "todo_number",
    "title",
    "description",
    "status",
    "priority_value",
    "product_id",
    "created_at",
    "updated_at",
    "closed_at",
    "resolution_notes",
    "due_at",
    "due_timezone",
    "due_city",
    "reminder_lead_value",
    "reminder_lead_unit",
    "urls",
    "group_id",
    "category_id",
    "deleted_at"
  ],
  "projects": [
    "id",
    "name",
    "code",
    "description",
    "created_by",
    "is_dormant",
    "sort_order"
  ],
  "knowledge_repo": [
    "id",
    "title",
    "content",
    "tags",
    "product_id",
    "origin_todo_id",
    "created_at"
  ],
  "audit_log": [
    "id",
    "action",
    "table_name",
    "record_id",
    "before",
    "after",
    "actor",
    "created_at",
    "user_id"
  ],
  "statuses": [
    "id",
    "name",
    "is_open",
    "is_closed",
    "sort_order"
  ],
  "priorities": [
    "id",
    "value",
    "label",
    "is_urgent"
  ],
  "categories": [
    "id",
    "name",
    "product_id",
    "deleted_at",
    "sort_order"
  ],
  "groups": [
    "id",
    "name",
    "product_id",
    "deleted_at",
    "sort_order"
  ],
  "tickets": [
    "id",
    "ticket_number",
    "type",
    "source",
    "summary",
    "detail",
    "conversation_snippet",
    "reported_by",
    "status",
    "dismiss_reason",
    "resolution_notes",
    "todo_id",
    "created_at",
    "closed_at",
    "deleted_at",
    "query_tickets",
    "support"
  ]
}
const JOINS: Record<string, Record<string, readonly string[]>> = {
  todos: { projects: ['code', 'name'], groups: ['name'], categories: ['name'] },
  knowledge_repo: { projects: ['code', 'name'] },
}

export function safeReadProjection(table: string, selection: unknown): string {
  const columns = COLUMNS[table]
  if (!columns) throw new InteractionPolicyError(`Table "${table}" is not queryable.`)
  const text = selection == null ? '*' : String(selection).trim()
  const parts: string[] = []
  let depth = 0, start = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(' && ++depth > 1) throw new InteractionPolicyError('Nested joins are not supported.')
    if (text[i] === ')' && --depth < 0) throw new InteractionPolicyError('Invalid projection.')
    if (text[i] === ',' && depth === 0) { parts.push(text.slice(start, i).trim()); start = i + 1 }
  }
  if (depth !== 0) throw new InteractionPolicyError('Invalid projection.')
  parts.push(text.slice(start).trim())
  return parts.map(part => {
    if (part === '*') return columns.join(',')
    if (columns.includes(part)) return part
    const join = /^([a-z_]+)\(([^()]+)\)$/.exec(part)
    if (!join) throw new InteractionPolicyError(`Unsupported projection: ${part}`)
    const allowed = JOINS[table]?.[join[1]]
    const fields = join[2].split(',').map(field => field.trim())
    if (!allowed || fields.some(field => !allowed.includes(field))) throw new InteractionPolicyError(`Unsupported join: ${part}`)
    return `${join[1]}(${fields.join(',')})`
  }).join(',')
}

export function resolveReadProject<T extends { id: string; code?: string | null }>(projects: T[], code: unknown): T {
  const normalized = String(code).trim().toUpperCase()
  const matches = projects.filter(project => project.code?.toUpperCase() === normalized)
  if (matches.length !== 1) throw new InteractionPolicyError(`Project "${code}" was not uniquely found in your accessible projects. Ask for the intended project; do not widen the search.`)
  return matches[0]
}

export function assertToolAccess(tool: string, isAdmin: boolean): void {
  if (['query_users', 'query_invitations', 'query_tickets', 'send_to_developer'].includes(tool) && !isAdmin) {
    throw new InteractionPolicyError('This tool requires an administrator role.')
  }
}
