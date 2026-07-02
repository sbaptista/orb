/** Shared todo/project domain types, used by TodoForm, QueryResultsModal, and TodoPanel. */

export type Todo = {
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

export type Product  = { id: string; name: string; color: string | null; icon: string | null; code: string | null; view_mode: 'list' | 'checklist' }
export type Priority = { value: number; label: string }
export type StatusDef = { id: string; name: string; sort_order: number; is_closed: boolean; is_open: boolean }
