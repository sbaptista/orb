'use client'

import { useState, useMemo, useId } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUrgencySnapshot, notifyIfEscalated } from '@/app/actions/push-actions'
import { logAudit } from '@/app/actions/log-audit'
import { useToast } from '@/components/ui/Toast'
import { isAuthError, handleSessionExpired } from '@/lib/action-utils'
import { collectSystemInfo } from '@/lib/system-info'
import type { Todo, Product, Priority, StatusDef } from '@/lib/todo-types'
import { useDirtyForm } from '@/lib/hooks/useDirtyForm'
import EditorModal from '@/components/ui/EditorModal'
import { startInteraction } from '@/lib/performance/telemetry'

type Props = {
  todo?: Todo | null
  productId?: string
  products: Product[]
  priorities: Priority[]
  statuses: StatusDef[]
  categories: { id: string; name: string; product_id: string }[]
  onClose: () => void
  onSave: (todo: Todo) => void
  onDelete?: (id: string) => void
}

type TodoEditorState = { todo: Todo; urlInput: string }

type FieldErrors = {
  title?: string
}

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

function getDefaultStatus(statuses: StatusDef[]): string {
  return statuses.find(s => s.is_open)?.name ?? statuses[0]?.name ?? 'open'
}

export default function TodoEditor({
  todo,
  productId,
  products,
  priorities,
  statuses,
  categories,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const isEditMode = !!todo
  const deleteDescriptionId = useId()
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()

  // For create mode, use the passed productId; for edit mode, use the todo's product_id
  const effectiveProductId = isEditMode ? todo.product_id : (productId ?? products[0]?.id ?? '')
  const defaultProductId = effectiveProductId
  const defaultStatus = getDefaultStatus(statuses)

  // For create mode, initialize with defaults
  const initialTodo: Todo = isEditMode
    ? todo
    : {
        id: '',
        product_id: effectiveProductId,
        group_id: null,
        category_id: null,
        priority_value: null,
        todo_number: null,
        title: '',
        description: null,
        resolution_notes: null,
        status: defaultStatus,
        urls: [],
        sort_order: 0,
        created_at: '',
        closed_at: null,
        ticket_id: null,
        groups: null,
        categories: null,
        due_at: null,
        reminded_at: null,
      }

  const editor = useDirtyForm<TodoEditorState>(
    { todo: { ...initialTodo }, urlInput: '' },
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

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Per-field validation errors - initialize with title error if empty (create mode)
  const [errors, setErrors] = useState<FieldErrors>(() => {
    const initialErrors: FieldErrors = {}
    if (!isEditMode && !initialTodo.title.trim()) {
      initialErrors.title = 'Title is required.'
    }
    return initialErrors
  })

  // Validate title on change
  const validateTitle = (title: string) => {
    if (!title.trim()) {
      setErrors(prev => ({ ...prev, title: 'Title is required.' }))
      return false
    }
    setErrors(prev => ({ ...prev, title: undefined }))
    return true
  }

  const projectCategories = categories.filter(c => c.product_id === form.product_id)

  // Helper to get error class for a field
  const getFieldClass = (field: keyof FieldErrors) => {
    return errors[field] ? 's-error' : ''
  }

  // Helper to get error message for a field
  const getFieldError = (field: keyof FieldErrors) => {
    return errors[field]
  }

  const todoRef = isEditMode
    ? (() => {
        const code = products.find(p => p.id === todo!.product_id)?.code
        return code && todo!.todo_number != null ? `${code}-${todo!.todo_number}` : null
      })()
    : null

  async function handleSave(): Promise<boolean> {
    const measurement = startInteraction({
      focus: 'dashboard-clicks',
      flow: 'dashboard-todos',
      interaction: isEditMode ? 'todo_panel_save' : 'todo_create',
      surface: 'dashboard',
      immediateFlush: true,
      metadata: { todoId: isEditMode ? todo!.id : null, projectId: form.product_id, status: form.status },
    })

    // Validate all fields
    const isValid = validateTitle(form.title)
    if (!isValid) {
      measurement.end(false, 'validation_failed')
      return false
    }

    setSaving(true)

    const beforeUrgency = await getUrgencySnapshot()
    measurement.mark('urgency_snapshot_loaded')

    const urls = normalizedUrls(urlInput)

    if (isEditMode) {
      const { data, error: err } = await supabase
        .from('todos')
        .update({
          title: form.title,
          description: form.description || null,
          resolution_notes: form.resolution_notes || null,
          status: form.status,
          priority_value: form.priority_value,
          product_id: form.product_id,
          group_id: form.group_id,
          category_id: form.category_id,
          urls,
          due_at: form.due_at || null,
          reminded_at: form.due_at !== todo!.due_at ? null : todo!.reminded_at,
          closed_at: statuses.find(s => s.name === form.status)?.is_closed
            ? (todo!.closed_at ?? new Date().toISOString())
            : null,
        })
        .eq('id', todo!.id)
        .select('*, groups(name), categories(name)')
        .single()
      measurement.mark('supabase_update_completed')

      setSaving(false)
      if (err) {
        if (isAuthError(err.message)) { measurement.end(false, 'auth_error'); handleSessionExpired(toast); return false }
        const isRLS = err.message?.includes('row-level security') || err.code === 'PGRST116'
        toast.error(isRLS ? 'You do not have permission to modify this item.' : 'Failed to save. Try again.')
        measurement.end(false, 'todo_save_failed', { error: err.message })
        return false
      }

      if (data) {
        const justClosed = statuses.find(s => s.name === form.status)?.is_closed &&
          !(statuses.find(s => s.name === todo!.status)?.is_closed ?? false)
        toast.success(justClosed ? 'Todo closed.' : 'Todo saved.')
        editor.markSaved({ todo: data as Todo, urlInput: urls.join('\n') })
        onSave(data as Todo)
        logAudit({
          action: justClosed ? 'todo_close' : 'todo_update',
          table_name: 'todos',
          record_id: todo!.id,
          before: { status: todo!.status, priority_value: todo!.priority_value, title: todo!.title },
          after: { status: form.status, priority_value: form.priority_value, title: form.title },
          system_info: collectSystemInfo(),
        })
        measurement.end(true, null, { todoId: data.id, justClosed })
        return true
      }
      measurement.end(false, 'todo_save_no_data')
      return false
    }

    // Create mode - use form.status (user's selection), not default
    const { data, error: err } = await supabase
      .from('todos')
      .insert({
        title: form.title.trim(),
        description: form.description?.trim() || null,
        resolution_notes: null,
        status: form.status,
        priority_value: form.priority_value,
        due_at: form.due_at || null,
        product_id: form.product_id,
        group_id: null,
        category_id: form.category_id,
        urls,
        sort_order: 0,
      })
      .select('*, groups(name), categories(name)')
      .single()
    measurement.mark('supabase_insert_completed')

    setSaving(false)
    if (err) {
      if (isAuthError(err.message)) { measurement.end(false, 'auth_error'); handleSessionExpired(toast); return false }
      toast.error('Failed to create todo. Try again.')
      measurement.end(false, 'todo_create_failed', { error: err.message })
      return false
    }

    if (data) {
      toast.success('Todo created')
      logAudit({
        action: 'todo_create',
        table_name: 'todos',
        record_id: data.id,
        after: { title: data.title, status: data.status, priority_value: data.priority_value, product_id: data.product_id },
        actor: 'web-ui',
        system_info: collectSystemInfo(),
      })
      onSave(data as Todo)
      measurement.end(true, null, { todoId: data.id, status: data.status })
      return true
    }
    measurement.end(false, 'todo_create_no_data')
    return false
  }

  async function handleDelete() {
    if (!isEditMode || !onDelete) return

    const measurement = startInteraction({
      focus: 'dashboard-clicks',
      flow: 'dashboard-todos',
      interaction: 'todo_panel_delete',
      surface: 'dashboard',
      immediateFlush: true,
      metadata: { todoId: todo!.id, projectId: todo!.product_id, status: todo!.status },
    })
    setDeleting(true)
    const beforeUrgency = await getUrgencySnapshot()
    measurement.mark('urgency_snapshot_loaded')
    const { error: err } = await supabase.from('todos').delete().eq('id', todo!.id)
    measurement.mark('supabase_delete_completed')
    if (err) {
      if (isAuthError(err.message)) { measurement.end(false, 'auth_error'); handleSessionExpired(toast); return }
      toast.error('Failed to delete. Try again.'); setDeleting(false); measurement.end(false, 'todo_delete_failed', { error: err.message }); return
    }
    logAudit({
      action: 'todo_delete',
      table_name: 'todos',
      record_id: todo!.id,
      before: { title: todo!.title, status: todo!.status },
      system_info: collectSystemInfo(),
    })
    setDeleting(false)
    toast.success('Todo deleted.')
    if (beforeUrgency) notifyIfEscalated(beforeUrgency)
    onDelete(todo!.id)
    measurement.end(true)
  }

  return (
    <>
      <EditorModal
        title={isEditMode ? 'Todo details' : 'New task'}
        titleId="todo-editor-title"
        isDirty={editor.isDirty}
        isSaving={saving}
        onSave={handleSave}
        onClose={onClose}
        headerStart={isEditMode && todoRef ? (
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(todoRef); setTimeout(() => {}, 1500) }}
            title="Copy ID"
            className="text-btn"
            style={{
              fontSize: 'var(--fs-xs)',
              color: 'var(--muted)',
              letterSpacing: 'var(--ls-body)',
              padding: 0,
              marginRight: 'var(--sp-sm)',
            }}
          >
            {todoRef}
          </button>
        ) : undefined}
        footerStart={isEditMode && onDelete && !confirmDelete ? (
          <button type="button" className="btn-danger" onClick={() => setConfirmDelete(true)} style={{ marginRight: 'auto' }}>
            Delete
          </button>
        ) : undefined}
        destructiveConfirmation={isEditMode && onDelete && confirmDelete ? {
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
          <div className={`pf-field ${getFieldClass('title')}`}>
            <label htmlFor="te-title" className="pf-label">Title *</label>
            <input
              id="te-title"
              className="pf-input"
              value={form.title}
              onChange={e => { 
                setForm(f => ({ ...f, title: e.target.value }));
                validateTitle(e.target.value);
              }}
              autoFocus={!isEditMode}
            />
            {getFieldError('title') && <p className="s-error">{getFieldError('title')}</p>}
          </div>

          {/* Description */}
          <div className="pf-field">
            <label htmlFor="te-description" className="pf-label">Description</label>
            <textarea
              id="te-description"
              className="pf-textarea"
              value={form.description ?? ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Add context, notes, or the next useful detail."
            />
          </div>

          {/* Status + Priority */}
          <div className="grid-2col">
            <div className="pf-field">
              <label htmlFor="te-status" className="pf-label">Status</label>
              <select
                id="te-status"
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
              <label htmlFor="te-priority" className="pf-label">Priority</label>
              <select
                id="te-priority"
                className="pf-select"
                value={form.priority_value ?? ''}
                onChange={e => setForm(f => ({ ...f, priority_value: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">None</option>
                {priorities.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Category */}
          <div className="pf-field">
            <label htmlFor="te-category" className="pf-label">Category</label>
            <select
              id="te-category"
              className="pf-select"
              value={form.category_id ?? ''}
              onChange={e => setForm(f => ({ ...f, category_id: e.target.value || null }))}
            >
              <option value="">None</option>
              {projectCategories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>

          {/* Product — only show when multiple projects */}
          {products.length > 1 && (
            <div className="pf-field">
              <label htmlFor="te-product" className="pf-label">Project</label>
              <select
                id="te-product"
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
              <label htmlFor="te-due-at" className="pf-label" style={{ margin: 0 }}>Due Date</label>
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
              id="te-due-at"
              type="datetime-local"
              className="pf-input"
              value={form.due_at ?? ''}
              onChange={e => setForm(f => ({ ...f, due_at: e.target.value || null }))}
            />
          </div>
        </div>

      </EditorModal>
    </>
  )
}
