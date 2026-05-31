'use client'

import type { ViewProps, ViewTodo } from './types'
import { parseLocalDatetime } from './types'

/** Status columns in workflow order: active pipeline first, then parked statuses. */
const COLUMN_ORDER = ['open', 'in progress', 'closed', 'deferred', 'on hold']

function KanbanCard({
  todo, isClosed, statusColor, productCodeMap, priorities,
  onSelectTodo, selectedTodo, hoveredId, onHover,
}: {
  todo: ViewTodo
  isClosed: (s: string) => boolean
  statusColor: (s: string) => string
  productCodeMap: Map<string, string | null>
  priorities: ViewProps['priorities']
  onSelectTodo: (t: ViewTodo) => void
  selectedTodo: ViewTodo | null
  hoveredId: string | null
  onHover: (id: string | null) => void
}) {
  const isDone = isClosed(todo.status)
  const todoRef = productCodeMap.get(todo.product_id) && todo.todo_number != null
    ? `${productCodeMap.get(todo.product_id)}-${todo.todo_number}` : null
  const priority = todo.priority_value !== null
    ? priorities.find(p => p.value === todo.priority_value) : null
  const isSelected = selectedTodo?.id === todo.id
  const isHovered = hoveredId === todo.id

  return (
    <button
      className="tv-kanban-card"
      onClick={() => onSelectTodo(todo)}
      onMouseEnter={() => onHover(todo.id)}
      onMouseLeave={() => onHover(null)}
      aria-label={`${todo.title}, ${todo.status}`}
      data-selected={isSelected || undefined}
      data-hovered={isHovered || undefined}
    >
      {/* Priority dot + ref */}
      <div className="tv-kanban-card-meta">
        {priority && (
          <span
            className="tv-kanban-priority-dot"
            style={{ background: priority.color }}
            title={priority.label}
          />
        )}
        {todoRef && <span className="tv-kanban-card-ref">{todoRef}</span>}
      </div>

      {/* Title */}
      <p className="tv-kanban-card-title" style={{
        color: isDone ? 'var(--muted)' : 'var(--text)',
        textDecoration: isDone ? 'line-through' : 'none',
      }}>
        {todo.title}
      </p>

      {/* Due date */}
      {todo.due_at && !isDone && (() => {
        const isOverdue = parseLocalDatetime(todo.due_at) < new Date()
        const isDueToday = parseLocalDatetime(todo.due_at).toDateString() === new Date().toDateString()
        return (
          <div className="tv-kanban-card-due" style={{
            color: isOverdue ? 'var(--error)' : isDueToday ? '#d97706' : 'var(--muted)',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>
              {parseLocalDatetime(todo.due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          </div>
        )
      })()}
    </button>
  )
}

export default function TaskKanbanView({
  todos, priorities, isClosed, statusColor, productCodeMap,
  onSelectTodo, selectedTodo, hoveredId, onHover,
}: ViewProps) {
  // Group todos by status
  const columns = COLUMN_ORDER.map(status => ({
    status,
    label: status.charAt(0).toUpperCase() + status.slice(1),
    todos: todos.filter(t => t.status === status),
  }))

  return (
    <div className="tv-kanban">
      {columns.map(col => (
        <div key={col.status} className="tv-kanban-column">
          <div className="tv-kanban-column-header">
            <span
              className="tv-kanban-column-dot"
              style={{ background: statusColor(col.status) }}
            />
            <span className="tv-kanban-column-label">{col.label}</span>
            <span className="tv-kanban-column-count">{col.todos.length}</span>
          </div>
          <div className="tv-kanban-column-body">
            {col.todos.length === 0 ? (
              <p className="tv-kanban-empty">No tasks</p>
            ) : (
              col.todos.map(todo => (
                <KanbanCard
                  key={todo.id}
                  todo={todo}
                  isClosed={isClosed}
                  statusColor={statusColor}
                  productCodeMap={productCodeMap}
                  priorities={priorities}
                  onSelectTodo={onSelectTodo}
                  selectedTodo={selectedTodo}
                  hoveredId={hoveredId}
                  onHover={onHover}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
