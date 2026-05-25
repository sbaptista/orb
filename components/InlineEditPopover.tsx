'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/app/actions/log-audit'
import { getUrgencySnapshot, notifyIfEscalated } from '@/app/actions/push-actions'
import { useToast } from '@/components/ui/Toast'
import { isAuthError, handleSessionExpired } from '@/lib/action-utils'
import type { Todo, Priority, StatusDef } from './TodoView'
import { updateTicketStatus } from '@/app/actions/ticket-actions'

type Props = {
  todo: Todo
  priorities: Priority[]
  statuses: StatusDef[]
  anchorRect: DOMRect
  onClose: () => void
  onSave: (updated: Todo) => void
}

/** Narrow viewport breakpoint — below this, render as bottom sheet */
const NARROW_BP = 480
/** Minimum gap from viewport edge */
const EDGE_PAD = 12

export default function InlineEditPopover({
  todo,
  priorities,
  statuses,
  anchorRect,
  onClose,
  onSave,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; isSheet: boolean }>({
    left: 0,
    isSheet: false,
  })
  const [saving, setSaving] = useState<string | null>(null) // field name being saved
  const [closedMsg, setClosedMsg] = useState(false)

  // ── Position calculation ──
  useEffect(() => {
    const el = popRef.current
    if (!el) return

    const vw = window.innerWidth
    const vh = window.innerHeight

    if (vw < NARROW_BP) {
      // Bottom sheet mode for narrow screens
      setPos({ bottom: 0, left: 0, isSheet: true })
      return
    }

    const popW = el.offsetWidth
    const popH = el.offsetHeight

    // Horizontal: align left edge with anchor, clamp to viewport
    let left = anchorRect.left
    if (left + popW > vw - EDGE_PAD) left = vw - EDGE_PAD - popW
    if (left < EDGE_PAD) left = EDGE_PAD

    // Vertical: prefer below the row, flip above if not enough space
    const spaceBelow = vh - anchorRect.bottom
    const spaceAbove = anchorRect.top

    if (spaceBelow >= popH + EDGE_PAD) {
      setPos({ top: anchorRect.bottom + 4, left, isSheet: false })
    } else if (spaceAbove >= popH + EDGE_PAD) {
      setPos({ top: anchorRect.top - popH - 4, left, isSheet: false })
    } else {
      // Not enough space either way — bottom sheet fallback
      setPos({ bottom: 0, left: 0, isSheet: true })
    }
  }, [anchorRect])

  // ── Click outside to close ──
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Delay binding so the opening right-click/click doesn't immediately close
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  // ── Escape to close ──
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // ── Auto-save a single field ──
  const saveField = useCallback(
    async (field: string, value: unknown) => {
      setSaving(field)
      setClosedMsg(false)

      const beforeUrgency = await getUrgencySnapshot()

      const patch: Record<string, unknown> = { [field]: value }

      // If due_at changed, clear reminded_at so the reminder can re-fire
      if (field === 'due_at') {
        patch.reminded_at = null
      }

      const { data, error } = await supabase
        .from('todos')
        .update(patch)
        .eq('id', todo.id)
        .select('*, groups(name), categories(name)')
        .single()

      setSaving(null)

      if (error) {
        if (isAuthError(error.message)) { handleSessionExpired(toast); return }
        const isRLS =
          error.message?.includes('row-level security') || error.code === 'PGRST116'
        toast.error(
          isRLS
            ? 'You do not have permission to modify this item.'
            : 'Failed to save. Try again.',
        )
        return
      }

      if (data) {
        onSave(data as Todo)
        logAudit({
          action: 'todo_update',
          table_name: 'todos',
          record_id: todo.id,
          before: { [field]: (todo as Record<string, unknown>)[field] },
          after: { [field]: value, title: todo.title },
        })
        if (beforeUrgency) notifyIfEscalated(beforeUrgency)

        // Propagate status to linked ticket (fire-and-forget)
        if (field === 'status' && todo.ticket_id && value !== todo.status) {
          const newStatus = value as string
          const ticketStatus = newStatus === 'in progress' ? 'in_progress' : null
          if (ticketStatus) {
            updateTicketStatus(todo.ticket_id, ticketStatus).catch(err =>
              console.error('[InlineEditPopover] ticket propagation failed:', err)
            )
          }
        }
      }
    },
    [supabase, todo, onSave, toast],
  )

  // ── Handlers ──
  function handleStatusChange(newStatus: string) {
    // Block closing from popover — require full panel
    const statusDef = statuses.find(s => s.name === newStatus)
    if (statusDef?.is_closed) {
      setClosedMsg(true)
      return
    }
    setClosedMsg(false)
    if (newStatus !== todo.status) {
      saveField('status', newStatus)
    }
  }

  function handlePriorityChange(newValue: number | null) {
    if (newValue !== todo.priority_value) {
      saveField('priority_value', newValue)
    }
  }

  function handleDueDateChange(newValue: string) {
    const val = newValue || null
    if (val !== (todo.due_at ?? null)) {
      saveField('due_at', val)
    }
  }

  // Non-closed statuses for the popover
  const editableStatuses = statuses.filter(s => !s.is_closed)

  const containerStyle: React.CSSProperties = pos.isSheet
    ? {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        borderRadius: 'var(--r-xl) var(--r-xl) 0 0',
        paddingBottom: 'calc(var(--sp-xl) + env(safe-area-inset-bottom, 0px))',
      }
    : {
        position: 'fixed',
        top: pos.top != null ? `${pos.top}px` : undefined,
        left: `${pos.left}px`,
        zIndex: 60,
        borderRadius: 'var(--r-lg)',
        maxWidth: '320px',
        width: '320px',
      }

  return (
    <>
      {/* Transparent backdrop — blocks interaction, click to dismiss */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 55,
          background: pos.isSheet ? 'rgba(42, 51, 42, 0.25)' : 'transparent',
        }}
        onClick={onClose}
      />

      <div
        ref={popRef}
        role="dialog"
        aria-label="Quick edit"
        className="ie-popover"
        style={containerStyle}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Status ── */}
        <div className="ie-section">
          <span className="pf-label">Status</span>
          <div className="ie-chip-row">
            {editableStatuses.map(s => {
              const active = s.name === todo.status
              return (
                <button
                  key={s.id}
                  className={`ie-chip ${active ? 'ie-chip-active' : ''}`}
                  onClick={() => handleStatusChange(s.name)}
                  disabled={saving === 'status'}
                  style={{
                    '--chip-color': `var(--status-${s.name.replace(/\s+/g, '-')})`,
                  } as React.CSSProperties}
                >
                  {s.name.charAt(0).toUpperCase() + s.name.slice(1)}
                  {saving === 'status' && active && (
                    <span className="ie-saving-dot" />
                  )}
                </button>
              )
            })}
          </div>
          {closedMsg && (
            <p className="ie-hint">
              Closing requires resolution notes — use the full panel.
            </p>
          )}
        </div>

        {/* ── Priority ── */}
        <div className="ie-section">
          <span className="pf-label">Priority</span>
          <div className="ie-chip-row">
            {priorities.map(p => {
              const active = p.value === todo.priority_value
              return (
                <button
                  key={p.value}
                  className={`ie-chip ${active ? 'ie-chip-active' : ''}`}
                  onClick={() => handlePriorityChange(p.value)}
                  disabled={saving === 'priority_value'}
                >
                  {p.label}
                  {saving === 'priority_value' && active && (
                    <span className="ie-saving-dot" />
                  )}
                </button>
              )
            })}
            <button
              className={`ie-chip ${todo.priority_value == null ? 'ie-chip-active' : ''}`}
              onClick={() => handlePriorityChange(null)}
              disabled={saving === 'priority_value'}
            >
              None
            </button>
          </div>
        </div>

        {/* ── Due Date ── */}
        <div className="ie-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="pf-label" style={{ margin: 0 }}>Due Date</span>
            {todo.due_at && (
              <button
                type="button"
                onClick={() => handleDueDateChange('')}
                className="text-btn"
                style={{ fontSize: '11px', color: 'var(--error)', padding: 0 }}
                disabled={saving === 'due_at'}
              >
                Clear
              </button>
            )}
          </div>
          <input
            type="datetime-local"
            className="pf-input"
            defaultValue={todo.due_at ?? ''}
            onChange={e => handleDueDateChange(e.target.value)}
            onBlur={e => handleDueDateChange(e.target.value)}
            disabled={saving === 'due_at'}
            style={{ fontSize: 'var(--fs-sm)' }}
          />
        </div>

        {saving && (
          <div className="ie-status-bar-saving">
            Saving…
          </div>
        )}
      </div>
    </>
  )
}
