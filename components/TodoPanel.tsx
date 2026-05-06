'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Todo, Product, Priority } from './TodoView'
import DistillModal from './DistillModal'
import { logAudit } from '@/app/actions/log-audit'
import { useToast } from '@/components/ui/Toast'

type Props = {
  todo: Todo
  products: Product[]
  priorities: Priority[]
  isAll: boolean
  onClose: () => void
  onSave: (updated: Todo) => void
  onDelete: (id: string) => void
}

export default function TodoPanel({
  todo,
  products,
  priorities,
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

  useEffect(() => {
    setForm({ ...todo })
    setUrlInput((todo.urls ?? []).join('\n'))
    setConfirmDelete(false)
    setShowDetails(false)
  }, [todo.id])

  const isDone             = form.status === 'done'

  const todoRef = (() => {
    const code = products.find(p => p.id === todo.product_id)?.code
    return code && todo.todo_number != null ? `${code}-${todo.todo_number}` : null
  })()

  async function handleSave() {
    setSaving(true)
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
        closed_at: form.status === 'done'
          ? (todo.closed_at ?? new Date().toISOString())
          : null,
      })
      .eq('id', todo.id)
      .select('*, groups(name), categories(name)')
      .single()
    setSaving(false)
    if (err) { toast.error('Failed to save. Try again.'); return }
    if (data) {
      const justClosed = form.status === 'done' && todo.status !== 'done'
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
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const { error: err } = await supabase.from('todos').delete().eq('id', todo.id)
    if (err) { toast.error('Failed to delete. Try again.'); setDeleting(false); return }
    logAudit({
      action: 'todo_delete',
      table_name: 'todos',
      record_id: todo.id,
      before: { title: todo.title, status: todo.status }
    })
    setDeleting(false)
    toast.success('Todo deleted.')
    onDelete(todo.id)
  }

  function copyId() {
    navigator.clipboard.writeText(todoRef ?? todo.id)
    setIdCopied(true)
    setTimeout(() => setIdCopied(false), 1500)
  }

  const field: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  }

  const label: React.CSSProperties = {
    fontSize: 'var(--fs-xs)',
    fontWeight: 500,
    color: 'var(--text3)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  }

  const input: React.CSSProperties = {
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--fs-base)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r)',
    padding: '8px 12px',
    color: 'var(--text)',
    outline: 'none',
    WebkitAppearance: 'none',
    appearance: 'none',
    width: '100%',
  }

  const select: React.CSSProperties = {
    ...input,
    cursor: 'pointer',
  }

  const textarea: React.CSSProperties = {
    ...input,
    resize: 'vertical',
    lineHeight: '1.5',
    minHeight: '80px',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(42,51,42,0.25)', zIndex: 40 }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Todo details"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100%',
          width: '460px',
          maxWidth: '100%',
          background: 'var(--bg2)',
          boxShadow: '-4px 0 24px rgba(42,51,42,0.12)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-ui)',
        }}
      >

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--sp-lg) var(--sp-xl)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
            {todoRef && (
              <button
                onClick={copyId}
                title="Copy ID"
                style={{
                  fontSize: 'var(--fs-xs)',
                  color: idCopied ? 'var(--pill-active-color)' : 'var(--muted)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
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
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--muted)',
              fontSize: '22px',
              lineHeight: 1,
              cursor: 'pointer',
              padding: '0 4px',
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--sp-xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-lg)',
          WebkitOverflowScrolling: 'touch',
        }}>

          {/* Title */}
          <div style={field}>
            <label htmlFor="tp-title" style={label}>Title</label>
            <input
              id="tp-title"
              style={input}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* Status + Priority */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-md)' }}>
            <div style={field}>
              <label htmlFor="tp-status" style={label}>Status</label>
              <select
                id="tp-status"
                style={select}
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as Todo['status'] }))}
                onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="on_hold">On Hold</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div style={field}>
              <label htmlFor="tp-priority" style={label}>Priority</label>
              <select
                id="tp-priority"
                style={select}
                value={form.priority_value ?? ''}
                onChange={e => setForm(f => ({ ...f, priority_value: e.target.value ? Number(e.target.value) : null }))}
                onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              >
                <option value="">None</option>
                {priorities.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Product — all view only */}
          {isAll && (
            <div style={field}>
              <label htmlFor="tp-product" style={label}>Product</label>
              <select
                id="tp-product"
                style={select}
                value={form.product_id}
                onChange={e => setForm(f => ({ ...f, product_id: e.target.value, group_id: null, category_id: null }))}
                onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              >
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {/* Resolution Notes — only when done */}
          {isDone && (
            <div style={field}>
              <label htmlFor="tp-resolution" style={label}>Resolution Notes</label>
              <textarea
                id="tp-resolution"
                style={textarea}
                value={form.resolution_notes ?? ''}
                placeholder="What was done to resolve this…"
                onChange={e => setForm(f => ({ ...f, resolution_notes: e.target.value }))}
                onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
          )}

          {/* Details toggle */}
          <button
            onClick={() => setShowDetails(d => !d)}
            aria-expanded={showDetails}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-sm)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted)',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--fs-sm)',
              padding: 0,
              textAlign: 'left',
            }}
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
              <div style={field}>
                <label htmlFor="tp-description" style={label}>Description</label>
                <textarea
                  id="tp-description"
                  style={textarea}
                  value={form.description ?? ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>

              {/* URLs */}
              <div style={field}>
                <label htmlFor="tp-urls" style={label}>URLs (one per line)</label>
                <textarea
                  id="tp-urls"
                  style={{ ...textarea, fontFamily: 'monospace', fontSize: 'var(--fs-sm)', minHeight: '64px' }}
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: 'var(--sp-lg) var(--sp-xl)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          {confirmDelete ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--error)' }}>Delete this todo?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: 'var(--fs-sm)',
                  background: 'var(--error)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--r)',
                  padding: '6px 14px',
                  cursor: 'pointer',
                  opacity: deleting ? 0.5 : 1,
                }}
              >
                {deleting ? 'Deleting…' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: 'var(--fs-sm)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--fs-sm)',
                background: 'transparent',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 500,
              background: 'var(--pill-active-bg)',
              border: '1px solid var(--pill-active-border)',
              borderRadius: 'var(--r)',
              padding: '8px 20px',
              color: 'var(--pill-active-color)',
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
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
