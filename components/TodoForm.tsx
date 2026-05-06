'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
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
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required.'); return }
    setSaving(true)
    setError('')

    const { data, error: err } = await supabase
      .from('todos')
      .insert({
        title:            title.trim(),
        description:      null,
        resolution_notes: null,
        status:           'open',
        priority_value:   priorityValue === '' ? null : priorityValue,
        product_id:       selectedProduct,
        group_id:         null,
        category_id:      null,
        urls:             [],
        sort_order:       0,
      })
      .select('*, groups(name), categories(name)')
      .single()

    setSaving(false)
    if (err) { toast.error('Failed to create todo. Try again.'); return }
    if (data) { toast.success('Todo created'); onCreate(data as Todo) }
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--fs-input)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r)',
    padding: '10px 14px',
    color: 'var(--text)',
    outline: 'none',
    width: '100%',
    WebkitAppearance: 'none',
    appearance: 'none',
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(42,51,42,0.25)',
      zIndex: 40,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--sp-lg)',
    }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg2)',
          borderRadius: 'var(--r-xl)',
          boxShadow: 'var(--shadow-lg)',
          width: '100%',
          maxWidth: '420px',
          fontFamily: 'var(--font-ui)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--sp-lg) var(--sp-xl)',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text2)' }}>
            New todo
          </span>
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

        {/* Form */}
        <form onSubmit={handleSubmit} style={{
          padding: 'var(--sp-xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-md)',
        }}>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="What needs doing?"
            autoFocus
            aria-label="Todo title"
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />

          <div style={{ display: 'grid', gridTemplateColumns: !productId && products.length > 1 ? '1fr 1fr' : '1fr', gap: 'var(--sp-sm)' }}>
            <select
              value={priorityValue}
              onChange={e => setPriorityValue(e.target.value === '' ? '' : Number(e.target.value))}
              aria-label="Priority"
              style={{ ...inputStyle, fontSize: 'var(--fs-base)', cursor: 'pointer' }}
              onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            >
              <option value="">No priority</option>
              {priorities.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>

            {!productId && products.length > 1 && (
              <select
                value={selectedProduct}
                onChange={e => setSelectedProduct(e.target.value)}
                aria-label="Product"
                style={{ ...inputStyle, fontSize: 'var(--fs-base)', cursor: 'pointer' }}
                onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              >
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>

          {error && (
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--error)' }}>{error}</p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-sm)', paddingTop: 'var(--sp-xs)' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--fs-sm)',
                background: 'transparent',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
                padding: '8px 12px',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
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
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
