'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUrgencySnapshot, notifyIfEscalated } from '@/app/actions/push-actions'
import { logAudit } from '@/app/actions/log-audit'
import { useToast } from '@/components/ui/Toast'
import { isAuthError, handleSessionExpired } from '@/lib/action-utils'
import { collectSystemInfo } from '@/lib/system-info'
import type { Todo, Product, Priority } from '@/lib/todo-types'
import { startInteraction } from '@/lib/performance/telemetry'
import ComboSelect from '@/components/ui/ComboSelect'

type Props = {
  productId?: string
  products: Product[]
  priorities: Priority[]
  categories: { id: string; name: string; product_id: string }[]
  onClose: () => void
  onCreate: (todo: Todo) => void
}

export default function TodoForm({
  productId,
  products,
  priorities,
  categories,
  onClose,
  onCreate,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const defaultProductId = productId ?? products[0]?.id ?? ''

  const [title,         setTitle]         = useState('')
  const [description,   setDescription]   = useState('')
  const [priorityValue, setPriorityValue] = useState<number | ''>('')
  const [selectedProduct, setSelectedProduct] = useState(defaultProductId)
  const [categoryId,      setCategoryId]      = useState<string | null>(null)
  const [dueAt,           setDueAt]           = useState('')
  const [urlInput,        setUrlInput]        = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const projectCategories = categories.filter(c => c.product_id === selectedProduct)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const measurement = startInteraction({
      focus: 'dashboard-clicks',
      flow: 'dashboard-todos',
      interaction: 'todo_create',
      surface: 'dashboard',
      immediateFlush: true,
      metadata: { projectId: selectedProduct, hasDueDate: !!dueAt, hasPriority: priorityValue !== '' },
    })
    if (!title.trim()) { setError('Title is required.'); measurement.end(false, 'validation_failed'); return }
    if (!categoryId) { setError('Category is required.'); measurement.end(false, 'validation_failed'); return }
    setSaving(true)
    setError('')

    const beforeUrgency = await getUrgencySnapshot()
    measurement.mark('urgency_snapshot_loaded')

    const { data: openStatus } = await supabase
      .from('statuses').select('name').eq('is_open', true).limit(1).single()
    measurement.mark('open_status_loaded')

    const urls = urlInput.split('\n').map(u => u.trim()).filter(Boolean)
    const { data, error: err } = await supabase
      .from('todos')
      .insert({
        title:            title.trim(),
        description:      description.trim() || null,
        resolution_notes: null,
        status:           openStatus?.name ?? 'open',
        priority_value:   priorityValue === '' ? null : priorityValue,
        due_at:           dueAt || null,
        product_id:       selectedProduct,
        group_id:         null,
        category_id:      categoryId,
        urls,
        sort_order:       0,
      })
      .select('*, groups(name), categories(name)')
      .single()
    measurement.mark('supabase_insert_completed')

    setSaving(false)
    if (err) {
      if (isAuthError(err.message)) { measurement.end(false, 'auth_error'); handleSessionExpired(toast); return }
      toast.error('Failed to create todo. Try again.')
      measurement.end(false, 'todo_create_failed', { error: err.message })
      return
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
      if (beforeUrgency) notifyIfEscalated(beforeUrgency)
      onCreate(data as Todo)
      measurement.end(true, null, { todoId: data.id, status: data.status })
    }
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-todo-title"
        className="modal-center modal-lg"
      >
        <div className="modal-header" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 id="new-todo-title" style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-semibold)' }}>
              New task
            </h2>
            <p className="text-xs text-muted" style={{ margin: '2px 0 0' }}>
              Capture the work now. Details can be refined later.
            </p>
          </div>
          <button onClick={onClose} className="close-btn" aria-label="Close" style={{ marginTop: '-6px', marginRight: '-8px' }}>
            <svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="todo-create-form">
          <div className="modal-body todo-create-body">
            <div className="pf-field">
              <label htmlFor="todo-create-title" className="pf-label">Title *</label>
              <input
                id="todo-create-title"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="What needs doing?"
                autoFocus
                className="pf-input todo-create-title-input"
              />
            </div>

            <div className="pf-field">
              <label htmlFor="todo-create-description" className="pf-label">Description</label>
              <textarea
                id="todo-create-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Add context, notes, or the next useful detail."
                className="pf-textarea"
              />
            </div>

            <div className="todo-create-grid">
              <div className="pf-field">
                <label htmlFor="todo-create-priority" className="pf-label">Priority</label>
                <select
                  id="todo-create-priority"
                  value={priorityValue}
                  onChange={e => setPriorityValue(e.target.value === '' ? '' : Number(e.target.value))}
                  className="pf-select"
                >
                  <option value="">No priority</option>
                  {priorities.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>

              {!productId && products.length > 1 && (
                <div className="pf-field">
                  <label htmlFor="todo-create-project" className="pf-label">Project</label>
                  <select
                    id="todo-create-project"
                    value={selectedProduct}
                    onChange={e => { setSelectedProduct(e.target.value); setCategoryId(null) }}
                    className="pf-select"
                  >
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="pf-field">
              <label htmlFor="todo-create-category" className="pf-label">Category *</label>
              <ComboSelect
                id="todo-create-category"
                options={projectCategories}
                value={categoryId}
                onChange={setCategoryId}
                placeholder="Search categories…"
                emptyMessage="This project has no categories yet — add one in Settings → Categories."
                required
              />
            </div>

            <div className="pf-field">
              <label htmlFor="todo-create-due" className="pf-label">Due date</label>
              <input
                id="todo-create-due"
                type="datetime-local"
                value={dueAt}
                onChange={e => setDueAt(e.target.value)}
                className="pf-input"
              />
            </div>

            <div className="pf-field">
              <label htmlFor="todo-create-urls" className="pf-label">URLs</label>
              <textarea
                id="todo-create-urls"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                className="pf-textarea todo-create-urls"
                placeholder="One link per line"
              />
            </div>

            {error && <p className="s-error">{error}</p>}
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create task'}</button>
          </div>
        </form>
      </div>
    </>
  )
}
