'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUrgencySnapshot, notifyIfEscalated } from '@/app/actions/push-actions'
import { useToast } from '@/components/ui/Toast'
import { isAuthError, handleSessionExpired } from '@/lib/action-utils'
import type { Todo, Product, Priority } from './TodoView'

type Props = {
  productId?: string
  products: Product[]
  priorities: Priority[]
  onClose: () => void
  onCreate: (todo: Todo) => void
}

export default function TodoForm({
  productId,
  products,
  priorities,
  onClose,
  onCreate,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const defaultProductId = productId ?? products[0]?.id ?? ''

  const [title,         setTitle]         = useState('')
  const [priorityValue, setPriorityValue] = useState<number | ''>('')
  const [selectedProduct, setSelectedProduct] = useState(defaultProductId)
  const [dueAt,           setDueAt]           = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required.'); return }
    setSaving(true)
    setError('')

    const beforeUrgency = await getUrgencySnapshot()

    const { data: openStatus } = await supabase
      .from('statuses').select('name').eq('is_open', true).limit(1).single()

    const { data, error: err } = await supabase
      .from('todos')
      .insert({
        title:            title.trim(),
        description:      null,
        resolution_notes: null,
        status:           openStatus?.name ?? 'open',
        priority_value:   priorityValue === '' ? null : priorityValue,
        due_at:           dueAt || null,
        product_id:       selectedProduct,
        group_id:         null,
        category_id:      null,
        urls:             [],
        sort_order:       0,
      })
      .select('*, groups(name), categories(name)')
      .single()

    setSaving(false)
    if (err) {
      if (isAuthError(err.message)) { handleSessionExpired(toast); return }
      toast.error('Failed to create todo. Try again.'); return
    }
    if (data) {
      toast.success('Todo created')
      if (beforeUrgency) notifyIfEscalated(beforeUrgency)
      onCreate(data as Todo)
    }
  }

  return (
    <div className="tf-backdrop">
      <div onClick={e => e.stopPropagation()} className="tf-card">
        <div className="tf-header">
          <span className="tf-header-title">New todo</span>
          <button onClick={onClose} className="close-btn" style={{ fontSize: '22px', padding: '0 4px' }} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="tf-form">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="What needs doing?"
            autoFocus
            aria-label="Todo title"
            className="pf-input"
          />

          <div style={{ display: 'grid', gridTemplateColumns: !productId && products.length > 1 ? '1fr 1fr' : '1fr', gap: 'var(--sp-sm)' }}>
            <select
              value={priorityValue}
              onChange={e => setPriorityValue(e.target.value === '' ? '' : Number(e.target.value))}
              aria-label="Priority"
              className="pf-select"
            >
              <option value="">No priority</option>
              {priorities.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>

            {!productId && products.length > 1 && (
              <select
                value={selectedProduct}
                onChange={e => setSelectedProduct(e.target.value)}
                aria-label="Product"
                className="pf-select"
              >
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>

          <div style={{ marginTop: 'var(--sp-xs)' }}>
            <label className="label text-xs text-muted" style={{ display: 'block', marginBottom: '4px' }}>Due Date</label>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={e => setDueAt(e.target.value)}
              className="pf-input"
              style={{ width: '100%', margin: 0 }}
              aria-label="Due Date"
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="tf-footer">
            <button type="button" onClick={onClose} className="text-btn">Cancel</button>
            <button type="submit" disabled={saving} className="save-btn">{saving ? 'Adding…' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
