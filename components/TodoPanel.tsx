'use client'

import { useState, useMemo, useId } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Todo, Product, Priority, StatusDef } from './TodoView'
import DistillModal from './DistillModal'
import { logAudit } from '@/app/actions/log-audit'
import { collectSystemInfo } from '@/lib/system-info'
import { getUrgencySnapshot, notifyIfEscalated } from '@/app/actions/push-actions'
import { useToast } from '@/components/ui/Toast'
import { isAuthError, handleSessionExpired } from '@/lib/action-utils'
import { useDirtyForm } from '@/lib/hooks/useDirtyForm'
import EditorModal from '@/components/ui/EditorModal'

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

type TodoEditorState = { todo: Todo; urlInput: string }

function normalizedUrls(value: string): string[] {
  return value.split('\n').map(url => url.trim()).filter(Boolean)
}

function normalizeTodoEditor(value: TodoEditorState) {
  const { todo, urlInput } = value
  return {
    title: todo.title,
    description: todo.description || null,
    resolution_notes: todo.resolution_notes || null,
    status: todo.status,
    priority_value: todo.priority_value,
    product_id: todo.product_id,
    group_id: todo.group_id,
    category_id: todo.category_id,
    due_at: todo.due_at || null,
    urls: normalizedUrls(urlInput),
  }
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
  const deleteDescriptionId = useId()
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const editor = useDirtyForm<TodoEditorState>(
    { todo: { ...todo }, urlInput: (todo.urls ?? []).join('\n') },
    normalizeTodoEditor,
  )
  const form = editor.form.todo
  const urlInput = editor.form.urlInput
  const setForm = (next: Todo | ((current: Todo) => Todo)) => {
    editor.setForm(current => ({
      ...current,
      todo: typeof next === 'function' ? next(current.todo) : next,
    }))
  }
  const setUrlInput = (value: string) => editor.setForm(current => ({ ...current, urlInput: value }))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [idCopied, setIdCopied] = useState(false)
  const [showDistill, setShowDistill] = useState(false)

  const isDone             = statuses.find(s => s.name === form.status)?.is_closed ?? false

  const todoRef = (() => {
    const code = products.find(p => p.id === todo.product_id)?.code
    return code && todo.todo_number != null ? `${code}-${todo.todo_number}` : null
  })()

  async function handleSave(andClose = false): Promise<boolean> {
    setSaving(true)
    const beforeUrgency = await getUrgencySnapshot()
    const urls = normalizedUrls(urlInput)
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
      if (isAuthError(err.message)) { handleSessionExpired(toast); return false }
      const isRLS = err.message?.includes('row-level security') || err.code === 'PGRST116'
      toast.error(isRLS ? 'You do not have permission to modify this item.' : 'Failed to save. Try again.')
      return false
    }
    if (data) {
      const justClosed = isDone && !(statuses.find(s => s.name === todo.status)?.is_closed ?? false)
      toast.success(justClosed ? 'Todo closed.' : 'Todo saved.')
      editor.markSaved({ todo: data as Todo, urlInput: urls.join('\n') })
      onSave(data as Todo)
      logAudit({
        action: justClosed ? 'todo_close' : 'todo_update',
        table_name: 'todos',
        record_id: todo.id,
        before: { status: todo.status, priority_value: todo.priority_value, title: todo.title },
        after: { status: form.status, priority_value: form.priority_value, title: form.title },
        system_info: collectSystemInfo(),
      })
      if (justClosed) {
        setShowDistill(true)
      } else if (andClose) {
        onClose()
      }
      return true
    }
    return false
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
      before: { title: todo.title, status: todo.status },
      system_info: collectSystemInfo(),
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
      <EditorModal
        title={todoRef ? (idCopied ? 'Copied!' : todoRef) : 'Todo details'}
        titleId="todo-details-title"
        isDirty={editor.isDirty}
        isSaving={saving}
        onSave={handleSave}
        onClose={onClose}
        headerStart={todoRef ? (
          <button
            type="button"
            onClick={copyId}
            title="Copy ID"
            className="text-btn"
            style={{
              fontSize: 'var(--fs-xs)',
              color: idCopied ? 'var(--pill-active-color)' : 'var(--muted)',
              letterSpacing: 'var(--ls-body)',
              padding: 0,
              marginRight: 'var(--sp-sm)',
            }}
          >
            {idCopied ? 'Copied!' : todoRef}
          </button>
        ) : undefined}
        footerStart={!confirmDelete ? (
          <button type="button" className="btn-danger" onClick={() => setConfirmDelete(true)} style={{ marginRight: 'auto' }}>
            Delete
          </button>
        ) : undefined}
        destructiveConfirmation={confirmDelete ? {
          description: <span id={deleteDescriptionId}>Delete this todo? This cannot be undone.</span>,
          onCancel: () => setConfirmDelete(false),
          onConfirm: handleDelete,
          confirming: deleting,
        } : undefined}
      >
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
                  style={{ fontSize: 'var(--fs-version)', color: 'var(--error)', padding: 0 }}
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
              fontSize: 'var(--fs-version)',
              display: 'inline-block',
              transition: 'transform var(--transition)',
              transform: showDetails ? 'rotate(90deg)' : 'rotate(0deg)',
            }}>▶</span>
            Details
          </button>

          {showDetails && (
            <>
              {/* URLs */}
              <div className="pf-field">
                <label htmlFor="tp-urls" className="pf-label">URLs (one per line)</label>
                <textarea
                  id="tp-urls"
                  className="pf-textarea"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', minHeight: '64px' }}
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

      </EditorModal>

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
