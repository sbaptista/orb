'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { ViewProps, ViewTodo } from './types'
import { parseLocalDatetime } from './types'

/** Status columns in workflow order: active pipeline first, then parked statuses. */
const COLUMN_ORDER = ['open', 'in progress', 'closed', 'deferred', 'on hold']

const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)

function KanbanCard({
  todo, isClosed, productCodeMap, priorities,
  onSelectTodo, selectedTodo, hoveredId, onHover,
  onDragStart, isDragging, isTouchDevice,
}: {
  todo: ViewTodo
  isClosed: (s: string) => boolean
  productCodeMap: Map<string, string | null>
  priorities: ViewProps['priorities']
  onSelectTodo: (t: ViewTodo) => void
  selectedTodo: ViewTodo | null
  hoveredId: string | null
  onHover: (id: string | null) => void
  onDragStart: (todo: ViewTodo) => void
  isDragging: boolean
  isTouchDevice: boolean
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
      draggable={!isTouchDevice}
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

  // Refs for tracking status change and drop targets natively to avoid closure issues
  const dropTargetRef = useRef<string | null>(null)
  const onStatusChangeRef = useRef<ViewProps['onStatusChange']>(onStatusChange)

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  // Touch drag state — long-press (300ms hold) + movement activation
  const touchDragRef = useRef<{
    todo: ViewTodo
    startX: number
    startY: number
    clone: HTMLElement | null
    active: boolean
    holdReady: boolean
    holdTimer: ReturnType<typeof setTimeout> | null
    originElement: HTMLElement | null
    moveListener?: (e: TouchEvent) => void
    endListener?: () => void
  } | null>(null)
  const kanbanRef = useRef<HTMLDivElement>(null)

  // Helper to cleanly dismantle touch dragging listeners and DOM clones
  const cleanupTouchDrag = useCallback(() => {
    const ref = touchDragRef.current
    if (ref) {
      if (ref.holdTimer) clearTimeout(ref.holdTimer)
      if (ref.clone) ref.clone.remove()
      if (ref.moveListener) {
        document.removeEventListener('touchmove', ref.moveListener)
      }
      if (ref.endListener) {
        document.removeEventListener('touchend', ref.endListener)
        document.removeEventListener('touchcancel', ref.endListener)
      }
    }
    touchDragRef.current = null
  }, [])

  // Cleanup orphaned clones and listeners on unmount
  useEffect(() => {
    return () => {
      cleanupTouchDrag()
      document.querySelectorAll('[data-kanban-drag-clone]').forEach(el => el.remove())
    }
  }, [cleanupTouchDrag])

  // --- Desktop HTML5 drag handlers (unchanged from original) ---

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

  // --- Touch drag handlers ---

  const handleTouchEnd = useCallback(() => {
    const ref = touchDragRef.current
    if (ref) {
      const { active, clone, todo } = ref
      const target = dropTargetRef.current

      cleanupTouchDrag()
      if (active && clone) {
        const onStatusChangeFn = onStatusChangeRef.current
        if (target && todo.status !== target && onStatusChangeFn) {
          onStatusChangeFn(todo, target)
        }
      }
    }
    setDraggingTodo(null)
    setDropTarget(null)
  }, [cleanupTouchDrag])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const ref = touchDragRef.current
    if (!ref) return

    const touch = e.touches[0]
    const dx = Math.abs(touch.clientX - ref.startX)
    const dy = Math.abs(touch.clientY - ref.startY)

    // If the finger moved before the hold timer fired, this is a scroll — cancel
    if (!ref.holdReady && !ref.active && (dx > 8 || dy > 8)) {
      cleanupTouchDrag()
      return
    }

    // Once the hold is ready, we are dragging. Prevent any default browser scrolling/selection.
    if (ref.holdReady) {
      e.preventDefault()
    }

    // Activate drag only after hold is ready AND 2px movement
    if (!ref.active && ref.holdReady && (dx > 2 || dy > 2)) {
      ref.active = true
      setDraggingTodo(ref.todo)

      // Create floating clone — tagged for defensive cleanup
      const source = ref.originElement
      if (source) {
        const clone = source.cloneNode(true) as HTMLElement
        clone.setAttribute('data-kanban-drag-clone', 'true')
        clone.style.position = 'fixed'
        clone.style.width = `${source.offsetWidth}px`
        clone.style.opacity = '0.85'
        clone.style.pointerEvents = 'none'
        clone.style.zIndex = '9999'
        clone.style.transform = 'rotate(2deg) scale(1.02)'
        clone.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'
        document.body.appendChild(clone)
        ref.clone = clone
      }
    }

    if (ref.active && ref.clone) {
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
            if (status) {
              dropTargetRef.current = status
              setDropTarget(status)
              found = true
            }
          }
        })
        if (!found) {
          dropTargetRef.current = null
          setDropTarget(null)
        }
      }
    }
  }, [cleanupTouchDrag])

  const handleTouchStart = useCallback((e: React.TouchEvent, todo: ViewTodo) => {
    // Clean up any leaked state from a previous drag
    cleanupTouchDrag()

    const touch = e.touches[0]
    const element = e.currentTarget as HTMLElement

    const holdTimer = setTimeout(() => {
      if (touchDragRef.current) {
        touchDragRef.current.holdReady = true
      }
    }, 300)

    const moveListener = (ev: TouchEvent) => handleTouchMove(ev)
    const endListener = () => handleTouchEnd()

    touchDragRef.current = {
      todo,
      startX: touch.clientX,
      startY: touch.clientY,
      clone: null,
      active: false,
      holdReady: false,
      holdTimer,
      originElement: element,
      moveListener,
      endListener,
    }

    document.addEventListener('touchmove', moveListener, { passive: false })
    document.addEventListener('touchend', endListener)
    document.addEventListener('touchcancel', endListener)
  }, [handleTouchMove, handleTouchEnd, cleanupTouchDrag])

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
                >
                  <KanbanCard
                    todo={todo}
                    isClosed={isClosed}
                    productCodeMap={productCodeMap}
                    priorities={priorities}
                    onSelectTodo={onSelectTodo}
                    selectedTodo={selectedTodo}
                    hoveredId={hoveredId}
                    onHover={onHover}
                    onDragStart={handleDragStart}
                    isDragging={draggingTodo?.id === todo.id}
                    isTouchDevice={isTouchDevice}
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
