/** Shared types for view components (TaskListView, TaskChecklistView, TaskKanbanView). */

export type ViewTodo = {
  id: string
  product_id: string
  group_id: string | null
  category_id: string | null
  priority_value: number | null
  todo_number: number | null
  title: string
  description: string | null
  resolution_notes: string | null
  status: string
  urls: string[]
  sort_order: number
  created_at: string
  closed_at: string | null
  ticket_id: string | null
  groups: { name: string } | null
  categories: { name: string } | null
  due_at: string | null
  due_timezone: string | null
  reminder_lead_value: number | null
  reminder_lead_unit: string | null
  reminded_at: string | null
}

export type ViewPriority = {
  value: number
  label: string
  color?: string
  is_urgent?: boolean
}

export type ViewProps = {
  todos: ViewTodo[]
  priorities: ViewPriority[]
  isClosed: (status: string) => boolean
  statusColor: (status: string) => string
  productCodeMap: Map<string, string | null>
  onSelectTodo: (todo: ViewTodo) => void
  onToggleDone: (e: React.MouseEvent, todo: ViewTodo) => void
  onStatusChange?: (todo: ViewTodo, newStatus: string) => void
  selectedTodo: ViewTodo | null
  selectedIds: string[]
  onToggleId: (id: string) => void
  onToggleAll: () => void
  hoveredId: string | null
  onHover: (id: string | null) => void
  /** ORB-360: the user's canonical IANA timezone — all due-date badges and dates render in it. */
  timeZone: string
}
