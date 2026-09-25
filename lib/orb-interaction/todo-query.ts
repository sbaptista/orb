export type TodoQuerySortField =
  | 'priority'
  | 'created_at'
  | 'updated_at'
  | 'closed_at'
  | 'due_at'
  | 'todo_number'

export type TodoQuerySortDirection = 'asc' | 'desc'

type TodoQueryInput = {
  product_code?: unknown
  ownership_scope?: unknown
  code?: unknown
  codes?: unknown
}

/** Resolve the default read scope without relying on the model to repeat the
 * selected project. Explicit cross-project ownership and exact task codes
 * remain global within the user's accessible surface. */
export function defaultTodoQueryProjectCode(
  input: TodoQueryInput,
  currentProjectCode: string | null | undefined,
  userText: string,
): string | null {
  if (typeof input.product_code === 'string' && input.product_code.trim()) return input.product_code.trim()
  if (typeof input.code === 'string' && input.code.trim()) return null
  if (Array.isArray(input.codes) && input.codes.length > 0) return null
  if (input.ownership_scope === 'current_user' || input.ownership_scope === 'all_visible') return null
  if (/\b(?:all|across|each|every)\s+(?:of\s+)?(?:my\s+)?projects?\b|\bmy\s+projects?\b/i.test(userText)) return null
  return currentProjectCode?.trim() || null
}

function sortableValue(row: Record<string, unknown>, field: TodoQuerySortField): number | string | null {
  const key = field === 'priority' ? 'priority_value' : field
  const value = row[key]
  if (value == null || value === '') return null
  if (field === 'priority' || field === 'todo_number') {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
  }
  if (field.endsWith('_at')) {
    const timestamp = Date.parse(String(value))
    return Number.isFinite(timestamp) ? timestamp : null
  }
  return String(value)
}

export function sortTodoQueryRows<T extends Record<string, unknown>>(
  rows: readonly T[],
  field: TodoQuerySortField = 'priority',
  direction: TodoQuerySortDirection = 'asc',
): T[] {
  const sign = direction === 'desc' ? -1 : 1
  return rows.map((row, index) => ({ row, index })).sort((left, right) => {
    const a = sortableValue(left.row, field)
    const b = sortableValue(right.row, field)
    if (a == null && b == null) return left.index - right.index
    if (a == null) return 1
    if (b == null) return -1
    const compared = typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b))
    return compared === 0 ? left.index - right.index : compared * sign
  }).map(item => item.row)
}
