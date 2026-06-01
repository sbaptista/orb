'use client'

import { useState, useRef, useCallback } from 'react'
import type { ViewProps, ViewTodo } from './types'
import { parseLocalDatetime } from './types'

/** Status columns in workflow order: active pipeline first, then parked statuses. */
const COLUMN_ORDER = ['open', 'in progress', 'closed', 'deferred', 'on hold']

function KanbanCard({
  todo, isClosed, statusColor, productCodeMap, priorities,
  onSelectTodo, selectedTodo, hoveredId, onHover,
  onDragStart, isDragging,
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
  onDragStart: (todo: ViewTodo) => void
  isDragging: boolean
}) {
  const isDone = isClosed(todo.status)
  const todoRef = productCodeMap.get(todo.product_id) && todo.todo_number != null
    ? `${productCodeMap.get(todo.product_id)}-${todo.todo_number}` : null
  const priority = todo.priority_value !== null
    ? priorities.find(p => p.value === todo.priority_value) : null
  const isSelected = selectedTodo?.id === todo.id
  const isHovered = hoveredId === todo.id

  return (
    <div
      className="tv-kanban-card"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', todo.id)
        onDragStart(todo)
      }}
      onClick={() => onSelectTodo(todo)}
      onMouseEnter={() => onHover(todo.id)}
      onMouseLeave={() => onHover(null)}
      aria-label={`${todo.title}, ${todo.status}`}
      data-selected={isSelected || undefined}
      data-hovered={isHovered || undefined}
      data-dragging={isDragging || undefined}
      role="button"
      tabIndex={0}
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
    </div>
  )
}

export default function TaskKanbanView({
  todos, priorities, isClosed, statusColor, productCodeMap,
  onSelectTodo, selectedTodo, hoveredId, onHover, onStatusChange,
}: ViewProps) {
  const [draggingTodo, setDraggingTodo] = useState<ViewTodo | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  // Touch drag state
  const touchDragRef = useRef<{
    todo: ViewTodo
    startX: number
    startY: number
    clone: HTMLElement | null
    active: boolean
  } | null>(null)
  const kanbanRef = useRef<HTMLDivElement>(null)

  const handleDragStart = useCallback((todo: ViewTodo) => {
    setDraggingTodo(todo)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, status: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(status)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDropTarget(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetStatus: string) => {
    e.preventDefault()
    setDropTarget(null)
    if (draggingTodo && draggingTodo.status !== targetStatus && onStatusChange) {
      onStatusChange(draggingTodo, targetStatus)
    }
    setDraggingTodo(null)
  }, [draggingTodo, onStatusChange])

  const handleDragEnd = useCallback(() => {
    setDraggingTodo(null)
    setDropTarget(null)
  }, [])

  // Touch handlers for mobile drag-and-drop
  const handleTouchStart = useCallback((e: React.TouchEvent, todo: ViewTodo) => {
    const touch = e.touches[0]
    touchDragRef.current = {
      todo,
      startX: touch.clientX,
      startY: touch.clientY,
      clone: null,
      active: false,
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const ref = touchDragRef.current
    if (!ref) return

    const touch = e.touches[0]
    const dx = Math.abs(touch.clientX - ref.startX)
    const dy = Math.abs(touch.clientY - ref.startY)

    // Activate drag after 10px movement
    if (!ref.active && (dx > 10 || dy > 10)) {
      ref.active = true
      setDraggingTodo(ref.todo)

      // Create floating clone
      const target = e.currentTarget as HTMLElement
      const clone = target.cloneNode(true) as HTMLElement
      clone.style.position = 'fixed'
      clone.style.width = `${target.offsetWidth}px`
      clone.style.opacity = '0.85'
      clone.style.pointerEvents = 'none'
      clone.style.zIndex = '9999'
      clone.style.transform = 'rotate(2deg) scale(1.02)'
      clone.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'
      document.body.appendChild(clone)
      ref.clone = clone
    }

    if (ref.active && ref.clone) {
      e.preventDefault()
      ref.clone.style.left = `${touch.clientX - 90}px`
      ref.clone.style.top = `${touch.clientY - 30}px`

      // Find which column we're over
      const kanban = kanbanRef.current
      if (kanban) {
        const columns = kanban.querySelectorAll<HTMLElement>('.tv-kanban-column')
        let found = false
        columns.forEach(col => {
          const rect = col.getBoundingClientRect()
          if (touch.clientX >= rect.left && touch.clientX <= rect.right) {
            const status = col.dataset.status
            if (status) { setDropTarget(status); found = true }
          }
        })
        if (!found) setDropTarget(null)
      }
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    const ref = touchDragRef.current
    if (ref?.active && ref.clone) {
      ref.clone.remove()
      if (dropTarget && ref.todo.status !== dropTarget && onStatusChange) {
        onStatusChange(ref.todo, dropTarget)
      }
    }
    touchDragRef.current = null
    setDraggingTodo(null)
    setDropTarget(null)
  }, [dropTarget, onStatusChange])

  // Group todos by status
  const columns = COLUMN_ORDER.map(status => ({
    status,
    label: status.charAt(0).toUpperCase() + status.slice(1),
    todos: todos.filter(t => t.status === status),
  }))

  return (
    <div className="tv-kanban" ref={kanbanRef} onDragEnd={handleDragEnd}>
      {columns.map(col => (
        <div
          key={col.status}
          className="tv-kanban-column"
          data-status={col.status}
          data-drop-target={dropTarget === col.status || undefined}
          onDragOver={(e) => handleDragOver(e, col.status)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, col.status)}
        >
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
              <p className="tv-kanban-empty">
                {draggingTodo ? 'Drop here' : 'No tasks displayed, check filters.'}
              </p>
            ) : (
              col.todos.map(todo => (
                <div
                  key={todo.id}
                  onTouchStart={(e) => handleTouchStart(e, todo)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <KanbanCard
                    todo={todo}
                    isClosed={isClosed}
                    statusColor={statusColor}
                    productCodeMap={productCodeMap}
                    priorities={priorities}
                    onSelectTodo={onSelectTodo}
                    selectedTodo={selectedTodo}
                    hoveredId={hoveredId}
                    onHover={onHover}
                    onDragStart={handleDragStart}
                    isDragging={draggingTodo?.id === todo.id}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
