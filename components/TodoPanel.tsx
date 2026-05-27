'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Todo, Product, Priority, StatusDef } from './TodoView'
import DistillModal from './DistillModal'
import { logAudit } from '@/app/actions/log-audit'
import { getUrgencySnapshot, notifyIfEscalated } from '@/app/actions/push-actions'
import { useToast } from '@/components/ui/Toast'
import { isAuthError, handleSessionExpired } from '@/lib/action-utils'
import { updateTicketStatus } from '@/app/actions/ticket-actions'

type Props = {
  todo: Todo
  products: Product[]
  priorities: Priority[]
  statuses: StatusDef[]
  isAll: boolean
  onClose: () => void
  onSave: (updated: Todo) => void
  onDelete: (id: string) => void
}

export default function TodoPanel({
  todo,
  products,
  priorities,
  statuses,
  isAll,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const [form, setForm] = useState({ ...todo })
  const [urlInput, setUrlInput] = useState((todo.urls ?? []).join('\n'))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [idCopied, setIdCopied] = useState(false)
  const [showDistill, setShowDistill] = useState(false)
  const [platforms, setPlatforms] = useState<any[]>([])
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([])

  useEffect(() => {
    setForm({ ...todo })
    setUrlInput((todo.urls ?? []).join('\n'))
    setConfirmDelete(false)
    setShowDetails(false)

    async function loadPlatforms() {
      const [allRes, assocRes] = await Promise.all([
        supabase.from('platforms').select('*').order('sort_order'),
        supabase.from('todo_platforms').select('platform_id').eq('todo_id', todo.id)
      ])
      setPlatforms(allRes.data ?? [])
      setSelectedPlatformIds((assocRes.data ?? []).map((x: any) => x.platform_id))
    }
    loadPlatforms()
  }, [todo.id, supabase])

  const isDone             = statuses.find(s => s.name === form.status)?.is_closed ?? false

  const todoRef = (() => {
    const code = products.find(p => p.id === todo.product_id)?.code
    return code && todo.todo_number != null ? `${code}-${todo.todo_number}` : null
  })()

  async function handleSave() {
    setSaving(true)
    const beforeUrgency = await getUrgencySnapshot()
    const urls = urlInput.split('\n').map(u => u.trim()).filter(Boolean)
    const { data, error: err } = await supabase
      .from('todos')
      .update({
        title:            form.title,
        description:      form.description || null,
        resolution_notes: form.resolution_notes || null,
        status:           form.status,
        priority_value:   form.priority_value,
        product_id:       form.product_id,
        group_id:         form.group_id,
        category_id:      form.category_id,
        urls,
        due_at:           form.due_at || null,
        reminded_at:      form.due_at !== todo.due_at ? null : todo.reminded_at,
        closed_at: isDone
          ? (todo.closed_at ?? new Date().toISOString())
          : null,
      })
      .eq('id', todo.id)
      .select('*, groups(name), categories(name)')
      .single()
    setSaving(false)
    // Fire-and-forget: check urgency escalation
    if (beforeUrgency) notifyIfEscalated(beforeUrgency)
    if (err) {
      if (isAuthError(err.message)) { handleSessionExpired(toast); return }
      const isRLS = err.message?.includes('row-level security') || err.code === 'PGRST116'
      toast.error(isRLS ? 'You do not have permission to modify this item.' : 'Failed to save. Try again.')
      return
    }
    if (data) {
      await supabase.from('todo_platforms').delete().eq('todo_id', todo.id)
      if (selectedPlatformIds.length > 0) {
        const inserts = selectedPlatformIds.map(pid => ({ todo_id: todo.id, platform_id: pid }))
        await supabase.from('todo_platforms').insert(inserts)
      }

      const justClosed = isDone && !(statuses.find(s => s.name === todo.status)?.is_closed ?? false)
      toast.success(justClosed ? 'Todo closed.' : 'Todo saved.')
      onSave(data as Todo)
      logAudit({
        action: justClosed ? 'todo_close' : 'todo_update',
        table_name: 'todos',
        record_id: todo.id,
        before: { status: todo.status, priority_value: todo.priority_value, title: todo.title },
        after: { status: form.status, priority_value: form.priority_value, title: form.title }
      })
      if (justClosed) {
        setShowDistill(true)
      }

      // Propagate status to linked ticket (fire-and-forget)
      if (todo.ticket_id && form.status !== todo.status) {
        const ticketStatus =
          form.status === 'in progress' ? 'in_progress' :
          (statuses.find(s => s.name === form.status)?.is_closed ? 'closed' : null)
        if (ticketStatus) {
          updateTicketStatus(todo.ticket_id, ticketStatus).catch(err =>
            console.error('[TodoPanel] ticket propagation failed:', err)
          )
        }
      }
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const beforeUrgency = await getUrgencySnapshot()
    const { error: err } = await supabase.from('todos').delete().eq('id', todo.id)
    if (err) {
      if (isAuthError(err.message)) { handleSessionExpired(toast); return }
      toast.error('Failed to delete. Try again.'); setDeleting(false); return
    }
    logAudit({
      action: 'todo_delete',
      table_name: 'todos',
      record_id: todo.id,
      before: { title: todo.title, status: todo.status }
    })
    setDeleting(false)
    toast.success('Todo deleted.')
    if (beforeUrgency) notifyIfEscalated(beforeUrgency)
    onDelete(todo.id)
  }

  function copyId() {
    navigator.clipboard.writeText(todoRef ?? todo.id)
    setIdCopied(true)
    setTimeout(() => setIdCopied(false), 1500)
  }

  return (
    <>
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={onClose} />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Todo details"
        className="modal-center"
      >

        {/* Header */}
        <div className="modal-header" style={{ justifyContent: 'space-between' }}>
          <div className="flex-row flex-center" style={{ gap: 'var(--sp-sm)' }}>
            {todoRef && (
              <button
                onClick={copyId}
                title="Copy ID"
                className="text-btn"
                style={{
                  fontSize: 'var(--fs-xs)',
                  color: idCopied ? 'var(--pill-active-color)' : 'var(--muted)',
                  letterSpacing: '0.04em',
                  padding: 0,
                }}
              >
                {idCopied ? 'Copied!' : todoRef}
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="close-btn"
            style={{ fontSize: '22px', padding: '0 4px' }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="modal-body" style={{
          padding: 'var(--sp-xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-lg)',
        }}>

          {/* Title */}
          <div className="pf-field">
            <label htmlFor="tp-title" className="pf-label">Title</label>
            <input
              id="tp-title"
              className="pf-input"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>

          {/* Status + Priority */}
          <div className="grid-2col">
            <div className="pf-field">
              <label htmlFor="tp-status" className="pf-label">Status</label>
              <select
                id="tp-status"
                className="pf-select"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                {statuses.map(s => (
                  <option key={s.id} value={s.name}>{s.name.charAt(0).toUpperCase() + s.name.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="pf-field">
              <label htmlFor="tp-priority" className="pf-label">Priority</label>
              <select
                id="tp-priority"
                className="pf-select"
                value={form.priority_value ?? ''}
                onChange={e => setForm(f => ({ ...f, priority_value: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">None</option>
                {priorities.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Product — all view only */}
          {isAll && (
            <div className="pf-field">
              <label htmlFor="tp-product" className="pf-label">Product</label>
              <select
                id="tp-product"
                className="pf-select"
                value={form.product_id}
                onChange={e => setForm(f => ({ ...f, product_id: e.target.value, group_id: null, category_id: null }))}
              >
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {/* Due Date */}
          <div className="pf-field">
            <div className="flex-row flex-center" style={{ justifyContent: 'space-between', marginBottom: '4px' }}>
              <label htmlFor="tp-due-at" className="pf-label" style={{ margin: 0 }}>Due Date</label>
              {form.due_at && (
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, due_at: null }))}
                  className="text-btn"
                  style={{ fontSize: '11px', color: 'var(--error)', padding: 0 }}
                >
                  Clear
                </button>
              )}
            </div>
            <input
              id="tp-due-at"
              type="datetime-local"
              className="pf-input"
              value={form.due_at ?? ''}
              onChange={e => setForm(f => ({ ...f, due_at: e.target.value || null }))}
            />
          </div>

          {(() => {
            const sortedPlatforms = [
              ...platforms.filter(p => p.name === 'All'),
              ...platforms.filter(p => p.name !== 'All')
            ]
            if (sortedPlatforms.length === 0) return null

            return (
              <div className="pf-field">
                <label className="pf-label">Platforms</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                  {sortedPlatforms.map(p => {
                    const checked = selectedPlatformIds.includes(p.id)
                    const isAllPill = p.name === 'All'
                    return (
                      <label
                        key={p.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          background: checked ? 'var(--pill-active-bg)' : 'var(--bg3)',
                          border: `${isAllPill ? '1.5px' : '1px'} ${isAllPill ? 'dashed' : 'solid'} ${checked ? 'var(--pill-active-color)' : 'var(--border)'}`,
                          color: checked ? 'var(--pill-active-color)' : 'var(--text)',
                          fontWeight: isAllPill ? '600' : 'normal',
                          fontSize: '12px',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'all 0.15s',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedPlatformIds(prev => {
                              const exists = prev.includes(p.id)
                              if (isAllPill) {
                                return exists ? [] : [p.id]
                              } else {
                                const allItem = platforms.find(x => x.name === 'All')
                                let next = exists ? prev.filter(x => x !== p.id) : [...prev, p.id]
                                if (allItem) {
                                  next = next.filter(id => id !== allItem.id)
                                }
                                return next
                              }
                            })
                          }}
                          style={{ display: 'none' }}
                        />
                        <span>{isAllPill ? '✦ All' : p.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Resolution Notes — only when done */}
          {isDone && (
            <div className="pf-field">
              <label htmlFor="tp-resolution" className="pf-label">Resolution Notes</label>
              <textarea
                id="tp-resolution"
                className="pf-textarea"
                value={form.resolution_notes ?? ''}
                placeholder="What was done to resolve this…"
                onChange={e => setForm(f => ({ ...f, resolution_notes: e.target.value }))}
              />
            </div>
          )}

          {/* Details toggle */}
          <button
            onClick={() => setShowDetails(d => !d)}
            aria-expanded={showDetails}
            className="tv-done-header"
            style={{ padding: 0 }}
          >
            <span style={{
              fontSize: '10px',
              display: 'inline-block',
              transition: 'transform var(--transition)',
              transform: showDetails ? 'rotate(90deg)' : 'rotate(0deg)',
            }}>▶</span>
            Details
          </button>

          {showDetails && (
            <>
              {/* Description */}
              <div className="pf-field">
                <label htmlFor="tp-description" className="pf-label">Description</label>
                <textarea
                  id="tp-description"
                  className="pf-textarea"
                  value={form.description ?? ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              {/* URLs */}
              <div className="pf-field">
                <label htmlFor="tp-urls" className="pf-label">URLs (one per line)</label>
                <textarea
                  id="tp-urls"
                  className="pf-textarea"
                  style={{ fontFamily: 'monospace', fontSize: 'var(--fs-sm)', minHeight: '64px' }}
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {confirmDelete ? (
            <div className="flex-row flex-center" style={{ gap: 'var(--sp-sm)' }}>
              <span className="text-sm text-error">Delete this todo?</span>
              <button
                className="tv-bulk-confirm"
                onClick={handleDelete}
                disabled={deleting}
                style={{ opacity: deleting ? 0.5 : 1 }}
              >
                {deleting ? 'Deleting…' : 'Confirm'}
              </button>
              <button className="text-btn" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button className="text-btn" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          )}

          <button
            className="save-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {showDistill && (
        <DistillModal
          todoId={todo.id}
          productId={todo.product_id}
          initialTitle={`Lesson: ${todo.title}`}
          initialContent={todo.resolution_notes || todo.description || ''}
          onClose={() => setShowDistill(false)}
          onSaved={() => setShowDistill(false)}
        />
      )}
    </>
  )
}
