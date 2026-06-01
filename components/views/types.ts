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
}

/** Parse a timezone-agnostic datetime string as local time */
export function parseLocalDatetime(str: string): Date {
  const [datePart, timePart] = str.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hours, minutes] = (timePart ?? '00:00').split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes)
}
