export const ORB_TODO_FIELD_SELECT = [
  'id',
  'todo_number',
  'title',
  'description',
  'resolution_notes',
  'status',
  'priority_value',
  'product_id',
  'group_id',
  'category_id',
  'ticket_id',
  'urls',
  'sort_order',
  'created_at',
  'updated_at',
  'closed_at',
  'due_at',
  'due_timezone',
  'due_city',
  'reminder_lead_value',
  'reminder_lead_unit',
  'reminded_at',
  'reminder_nudge_dismissed_at',
].join(', ')

export const ORB_TODO_JOIN_SELECT = [
  'projects!inner(id, name, code, created_by, is_dormant, deleted_at, users!created_by(first_name, last_name, email))',
  'groups(name)',
  'categories(name)',
  'tickets!ticket_id(ticket_number)',
].join(', ')

export const ORB_TODO_FULL_SELECT = `${ORB_TODO_FIELD_SELECT}, ${ORB_TODO_JOIN_SELECT}`

type NamedJoin = { name: string } | null
type TicketJoin = { ticket_number: number } | null

export type OrbTodoRow = {
  id: string
  todo_number: number
  title: string
  description: string | null
  resolution_notes: string | null
  status: string
  priority_value: number | null
  product_id: string
  group_id: string | null
  category_id: string | null
  ticket_id: string | null
  urls: string[]
  sort_order: number
  created_at: string
  updated_at: string
  closed_at: string | null
  due_at: string | null
  due_timezone: string | null
  due_city: string | null
  reminder_lead_value: number | null
  reminder_lead_unit: string | null
  reminded_at: string | null
  reminder_nudge_dismissed_at: string | null
  projects: {
    id: string
    name: string
    code: string
    created_by: string
    is_dormant?: boolean
    deleted_at?: string | null
    users?: { first_name: string | null; last_name: string | null; email: string | null } | null
  }
  groups?: NamedJoin
  categories?: NamedJoin
  tickets?: TicketJoin
}

/** One canonical, transport-neutral representation of every readable todo field. */
export function shapeOrbTodoFact(row: OrbTodoRow, owner?: string) {
  const urls = Array.isArray(row.urls) ? row.urls.filter(Boolean) : []
  const joinedOwner = row.projects.users
  const resolvedOwner = owner ?? (
    joinedOwner
      ? [joinedOwner.first_name, joinedOwner.last_name].filter(Boolean).join(' ') || joinedOwner.email || null
      : null
  )
  return {
    id: row.id,
    code: `${row.projects.code}-${row.todo_number}`,
    todo_number: row.todo_number,
    title: row.title,
    description: row.description,
    resolution_notes: row.resolution_notes,
    status: row.status,
    priority_value: row.priority_value,
    product_id: row.product_id,
    project: { id: row.projects.id, name: row.projects.name, code: row.projects.code },
    owner: resolvedOwner,
    group_id: row.group_id,
    group: row.groups?.name ?? null,
    category_id: row.category_id,
    category: row.categories?.name ?? null,
    ticket_id: row.ticket_id,
    linked_ticket_code: row.tickets?.ticket_number ? `TICKETS-${row.tickets.ticket_number}` : null,
    urls,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
    closed_at: row.closed_at,
    due_at: row.due_at,
    due_timezone: row.due_timezone,
    due_city: row.due_city,
    reminder_lead_value: row.reminder_lead_value,
    reminder_lead_unit: row.reminder_lead_unit,
    reminded_at: row.reminded_at,
    reminder_nudge_dismissed_at: row.reminder_nudge_dismissed_at,
  }
}

export type OrbTodoFact = ReturnType<typeof shapeOrbTodoFact>

export function renderOrbTodoFactForPrompt(fact: OrbTodoFact) {
  const fields = [
    `code=${fact.code}`,
    `id=${fact.id}`,
    `todo_number=${fact.todo_number}`,
    `title=${JSON.stringify(fact.title)}`,
    `description=${JSON.stringify(fact.description)}`,
    `status=${JSON.stringify(fact.status)}`,
    `priority_value=${fact.priority_value ?? 'null'}`,
    `project=${JSON.stringify(fact.project)}`,
    `owner=${JSON.stringify(fact.owner)}`,
    `group_id=${fact.group_id ?? 'null'}`,
    `group=${JSON.stringify(fact.group)}`,
    `category_id=${fact.category_id ?? 'null'}`,
    `category=${JSON.stringify(fact.category)}`,
    `ticket_id=${fact.ticket_id ?? 'null'}`,
    `linked_ticket_code=${JSON.stringify(fact.linked_ticket_code)}`,
    `resolution_notes=${JSON.stringify(fact.resolution_notes)}`,
    `urls=${JSON.stringify(fact.urls)}`,
    `sort_order=${fact.sort_order}`,
    `created_at=${fact.created_at}`,
    `updated_at=${fact.updated_at}`,
    `closed_at=${fact.closed_at ?? 'null'}`,
    `due_at=${fact.due_at ?? 'null'}`,
    `due_timezone=${JSON.stringify(fact.due_timezone)}`,
    `due_city=${JSON.stringify(fact.due_city)}`,
    `reminder_lead_value=${fact.reminder_lead_value ?? 'null'}`,
    `reminder_lead_unit=${JSON.stringify(fact.reminder_lead_unit)}`,
    `reminded_at=${fact.reminded_at ?? 'null'}`,
    `reminder_nudge_dismissed_at=${fact.reminder_nudge_dismissed_at ?? 'null'}`,
  ]
  return `  TODO { ${fields.join('; ')} }`
}
