'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import { useToast } from '@/components/ui/Toast'

type Product = { id: string; name: string }
type Category = { id: string; name: string; product_id: string | null; sort_order: number }
type CatForm = { name: string; product_id: string; sort_order: string }

const EMPTY_FORM: CatForm = { name: '', product_id: '', sort_order: '0' }

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 'var(--r)',
  padding: '10px var(--sp-md)',
  fontSize: 'var(--fs-input)',
  background: 'var(--bg)',
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
  width: '100%',
  transition: 'border-color var(--transition)',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--fs-xs)',
  fontWeight: 'var(--fw-medium)',
  color: 'var(--text3)',
  marginBottom: 'var(--sp-xs)',
}

const primaryBtnStyle = (disabled: boolean): React.CSSProperties => ({
  background: 'var(--success)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--r)',
  padding: '8px var(--sp-lg)',
  fontSize: 'var(--fs-sm)',
  fontWeight: 'var(--fw-medium)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
})

const cancelBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 'var(--fs-sm)',
  color: 'var(--muted)',
  cursor: 'pointer',
  padding: '8px var(--sp-md)',
}

const rowActionBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 'var(--fs-xs)',
  color: 'var(--muted)',
  cursor: 'pointer',
  padding: '4px var(--sp-sm)',
  flexShrink: 0,
}

const dangerConfirmBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 'var(--fs-sm)',
  color: 'var(--error)',
  fontWeight: 'var(--fw-medium)',
  cursor: 'pointer',
  padding: '8px var(--sp-md)',
}

export default function SettingsCategories() {
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [todoCounts, setTodoCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<CatForm>(EMPTY_FORM)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<CatForm>(EMPTY_FORM)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [prodRes, catRes, todoRes] = await Promise.all([
      supabase.from('projects').select('id, name').order('sort_order'),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('todos').select('category_id'),
    ])
    setProducts(prodRes.data ?? [])
    setCategories(catRes.data ?? [])
    const counts: Record<string, number> = {}
    todoRes.data?.forEach(t => {
      if (t.category_id) counts[t.category_id] = (counts[t.category_id] || 0) + 1
    })
    setTodoCounts(counts)
    setLoading(false)
  }, [supabase])

  useVisibilityRefetch(load)
  useEffect(() => { load() }, [load])

  const displayed = categories.filter(c =>
    scope === '' ? c.product_id === null : c.product_id === scope
  )

  function startAdd() {
    setShowAdd(true)
    setEditingId(null)
    setConfirmDeleteId(null)
    setAddForm({ name: '', product_id: scope, sort_order: '0' })
    setError('')
  }

  function startEdit(c: Category) {
    setEditingId(c.id)
    setEditForm({
      name: c.name,
      product_id: c.product_id ?? '',
      sort_order: String(c.sort_order),
    })
    setShowAdd(false)
    setConfirmDeleteId(null)
    setError('')
  }

  async function handleAdd() {
    if (!addForm.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase
      .from('categories')
      .insert({
        name: addForm.name.trim(),
        product_id: addForm.product_id || null,
        sort_order: Number(addForm.sort_order) || 0,
      })
      .select()
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) { toast.success('Category added.'); setCategories(prev => [...prev, data as Category]) }
    setShowAdd(false)
    setAddForm(EMPTY_FORM)
  }

  async function handleSave(id: string) {
    if (!editForm.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase
      .from('categories')
      .update({
        name: editForm.name.trim(),
        product_id: editForm.product_id || null,
        sort_order: Number(editForm.sort_order) || 0,
      })
      .eq('id', id)
      .select()
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) { toast.success('Category saved.'); setCategories(prev => prev.map(c => c.id === id ? data as Category : c)) }
    setEditingId(null)
  }

  async function handleDelete(id: string) {
    setSaving(true)
    await supabase.from('categories').delete().eq('id', id)
    setSaving(false)
    toast.success('Category deleted.')
    setCategories(prev => prev.filter(c => c.id !== id))
    setConfirmDeleteId(null)
  }

  function CatFormComp({
    form,
    onChange,
    onSubmit,
    onCancel,
    submitLabel,
  }: {
    form: CatForm
    onChange: (f: CatForm) => void
    onSubmit: () => void
    onCancel: () => void
    submitLabel: string
  }) {
    return (
      <div style={{
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        padding: 'var(--sp-lg) var(--sp-xl)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-md)', marginBottom: 'var(--sp-md)' }}>
          <div>
            <label style={labelStyle}>Name *</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={e => onChange({ ...form, name: e.target.value })}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              autoFocus
              placeholder="Category name"
            />
          </div>
          <div>
            <label style={labelStyle}>Sort Order</label>
            <input
              type="number"
              style={inputStyle}
              value={form.sort_order}
              onChange={e => onChange({ ...form, sort_order: e.target.value })}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>
        </div>
        <div style={{ marginBottom: 'var(--sp-md)' }}>
          <label style={labelStyle}>Product</label>
          <select
            style={selectStyle}
            value={form.product_id}
            onChange={e => onChange({ ...form, product_id: e.target.value })}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <option value="">Global</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
          <button
            onClick={onSubmit}
            disabled={saving}
            style={primaryBtnStyle(saving)}
          >
            {saving ? 'Saving…' : submitLabel}
          </button>
          <button onClick={onCancel} style={cancelBtnStyle}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (loading) return (
    <div style={{ padding: 'var(--sp-3xl)', fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>
      Loading…
    </div>
  )

  return (
    <div style={{ padding: 'var(--sp-2xl)', maxWidth: '600px', fontFamily: 'var(--font-ui)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-xl)' }}>
        <h2 style={{
          fontSize: 'var(--fs-lg)',
          fontWeight: 'var(--fw-bold)',
          color: 'var(--text)',
          margin: 0,
        }}>
          Categories
        </h2>
        {!showAdd && (
          <button
            onClick={startAdd}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r)',
              padding: '7px var(--sp-md)',
              fontSize: 'var(--fs-sm)',
              color: 'var(--text2)',
              cursor: 'pointer',
            }}
          >
            + Add Category
          </button>
        )}
      </div>

      {/* Product scope selector */}
      <div style={{ display: 'flex', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-xl)', flexWrap: 'wrap' }}>
        <button
          onClick={() => setScope('')}
          style={{
            fontSize: 'var(--fs-sm)',
            padding: '6px 14px',
            borderRadius: '20px',
            cursor: 'pointer',
            ...(scope === ''
              ? {
                  background: 'var(--pill-active-bg)',
                  border: '1px solid var(--pill-active-border)',
                  color: 'var(--pill-active-color)',
                }
              : {
                  border: '1px solid var(--border)',
                  color: 'var(--text3)',
                  background: 'transparent',
                }),
          }}
        >
          Global
        </button>
        {products.map(p => (
          <button
            key={p.id}
            onClick={() => setScope(p.id)}
            style={{
              fontSize: 'var(--fs-sm)',
              padding: '6px 14px',
              borderRadius: '20px',
              cursor: 'pointer',
              ...(scope === p.id
                ? {
                    background: 'var(--pill-active-bg)',
                    border: '1px solid var(--pill-active-border)',
                    color: 'var(--pill-active-color)',
                  }
                : {
                    border: '1px solid var(--border)',
                    color: 'var(--text3)',
                    background: 'transparent',
                  }),
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

      {error && (
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--error)', margin: '0 0 var(--sp-md)' }}>
          {error}
        </p>
      )}

      <div style={{
        background: 'var(--bg2)',
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        {showAdd && (
          <CatFormComp
            form={addForm}
            onChange={setAddForm}
            onSubmit={handleAdd}
            onCancel={() => { setShowAdd(false); setError('') }}
            submitLabel="Add Category"
          />
        )}

        {displayed.length === 0 && !showAdd ? (
          <p style={{ padding: 'var(--sp-3xl)', textAlign: 'center', fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>
            No categories in this scope.
          </p>
        ) : (
          displayed.map(c =>
            editingId === c.id ? (
              <CatFormComp
                key={c.id}
                form={editForm}
                onChange={setEditForm}
                onSubmit={() => handleSave(c.id)}
                onCancel={() => { setEditingId(null); setError('') }}
                submitLabel="Save"
              />
            ) : confirmDeleteId === c.id ? (
              <div key={c.id} style={{
                background: 'rgba(139, 32, 32, 0.05)',
                padding: '10px var(--sp-xl)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-md)',
                borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: 'var(--fs-sm)', flex: 1 }}>
                  Delete <strong>{c.name}</strong>?
                  {(todoCounts[c.id] ?? 0) > 0 && (
                    <span style={{ color: 'var(--muted)', marginLeft: 'var(--sp-xs)' }}>
                      Cannot delete — {todoCounts[c.id]} todo{todoCounts[c.id] !== 1 ? 's' : ''} use this category.
                    </span>
                  )}
                </span>
                {(todoCounts[c.id] ?? 0) === 0 ? (
                  <>
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={saving}
                      style={{ ...dangerConfirmBtnStyle, opacity: saving ? 0.6 : 1 }}
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      style={cancelBtnStyle}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    style={cancelBtnStyle}
                  >
                    OK
                  </button>
                )}
              </div>
            ) : (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-md)',
                  padding: '10px var(--sp-xl)',
                  borderBottom: '1px solid var(--border)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text)' }}>{c.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>sort: {c.sort_order}</p>
                </div>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', flexShrink: 0 }}>
                  {todoCounts[c.id] ?? 0} todos
                </span>
                <button
                  onClick={() => startEdit(c)}
                  style={rowActionBtnStyle}
                >
                  Edit
                </button>
                <button
                  onClick={() => { setConfirmDeleteId(c.id); setEditingId(null) }}
                  style={rowActionBtnStyle}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--error)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                >
                  Delete
                </button>
              </div>
            )
          )
        )}
      </div>
    </div>
  )
}
