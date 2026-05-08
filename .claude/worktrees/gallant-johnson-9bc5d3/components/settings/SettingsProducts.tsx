'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import { useToast } from '@/components/ui/Toast'

type Product = {
  id: string
  name: string
  description: string | null
  color: string | null
  sort_order: number
}

type ItemForm = {
  name: string
  description: string
  color: string
  sort_order: string
}

const EMPTY_FORM: ItemForm = {
  name: '',
  description: '',
  color: '#6366f1',
  sort_order: '0',
}

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

function ProductForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  saving,
}: {
  form: ItemForm
  onChange: (f: ItemForm) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
  saving: boolean
}) {
  return (
    <div style={{
      background: 'var(--bg)',
      borderBottom: '1px solid var(--border)',
      padding: 'var(--sp-lg) var(--sp-xl)',
    }}>
      <div style={{ marginBottom: 'var(--sp-md)' }}>
        <label style={labelStyle}>Name *</label>
        <input
          style={inputStyle}
          value={form.name}
          onChange={e => onChange({ ...form, name: e.target.value })}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          autoFocus
          placeholder="Project name"
        />
      </div>
      <div style={{ marginBottom: 'var(--sp-md)' }}>
        <label style={labelStyle}>Description</label>
        <input
          style={inputStyle}
          value={form.description}
          onChange={e => onChange({ ...form, description: e.target.value })}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          placeholder="Optional description"
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--sp-xl)', marginBottom: 'var(--sp-md)' }}>
        <div>
          <label style={labelStyle}>Color</label>
          <input
            type="color"
            style={{
              height: '32px',
              width: '64px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r)',
              cursor: 'pointer',
              padding: '2px',
              background: 'var(--bg)',
            }}
            value={form.color}
            onChange={e => onChange({ ...form, color: e.target.value })}
          />
        </div>
        <div>
          <label style={labelStyle}>Sort Order</label>
          <input
            type="number"
            style={{ ...inputStyle, width: '80px' }}
            value={form.sort_order}
            onChange={e => onChange({ ...form, sort_order: e.target.value })}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
        <button
          onClick={onSubmit}
          disabled={saving}
          style={primaryBtnStyle(saving)}
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
        <button
          onClick={onCancel}
          style={cancelBtnStyle}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function SettingsProducts() {
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [todoCounts, setTodoCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ItemForm>(EMPTY_FORM)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<ItemForm>(EMPTY_FORM)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [prodRes, todoRes] = await Promise.all([
      supabase.from('projects').select('*').order('sort_order'),
      supabase.from('todos').select('product_id'),
    ])
    setProducts(prodRes.data ?? [])
    const counts: Record<string, number> = {}
    todoRes.data?.forEach(t => {
      counts[t.product_id] = (counts[t.product_id] || 0) + 1
    })
    setTodoCounts(counts)
    setLoading(false)
  }, [supabase])

  useVisibilityRefetch(load)
  useEffect(() => { load() }, [load])

  function startEdit(p: Product) {
    setEditingId(p.id)
    setEditForm({
      name: p.name,
      description: p.description ?? '',
      color: p.color ?? '#6366f1',
      sort_order: String(p.sort_order),
    })
    setShowAdd(false)
    setConfirmDeleteId(null)
    setError('')
  }

  async function handleSave(id: string) {
    if (!editForm.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase
      .from('projects')
      .update({
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        color: editForm.color,
        sort_order: Number(editForm.sort_order) || 0,
      })
      .eq('id', id)
      .select()
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) { toast.success('Project saved.'); setProducts(prev => prev.map(p => p.id === id ? data as Product : p)) }
    setEditingId(null)
  }

  async function handleAdd() {
    if (!addForm.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase
      .from('projects')
      .insert({
        name: addForm.name.trim(),
        description: addForm.description.trim() || null,
        color: addForm.color,
        sort_order: Number(addForm.sort_order) || 0,
      })
      .select()
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) { toast.success('Project added.'); setProducts(prev => [...prev, data as Product]) }
    setShowAdd(false)
    setAddForm(EMPTY_FORM)
  }

  async function handleDelete(id: string) {
    setSaving(true)
    await supabase.from('projects').delete().eq('id', id)
    setSaving(false)
    toast.success('Project deleted.')
    setProducts(prev => prev.filter(p => p.id !== id))
    setConfirmDeleteId(null)
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
          Projects
        </h2>
        {!showAdd && (
          <button
            onClick={() => {
              setShowAdd(true)
              setEditingId(null)
              setConfirmDeleteId(null)
              setAddForm(EMPTY_FORM)
              setError('')
            }}
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
            + Add Project
          </button>
        )}
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
          <ProductForm
            form={addForm}
            onChange={setAddForm}
            onSubmit={handleAdd}
            onCancel={() => { setShowAdd(false); setError('') }}
            submitLabel="Add Project"
            saving={saving}
          />
        )}

        {products.length === 0 && !showAdd ? (
          <p style={{ padding: 'var(--sp-3xl)', textAlign: 'center', fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>
            No projects yet.
          </p>
        ) : (
          products.map(p =>
            editingId === p.id ? (
              <ProductForm
                key={p.id}
                form={editForm}
                onChange={setEditForm}
                onSubmit={() => handleSave(p.id)}
                onCancel={() => { setEditingId(null); setError('') }}
                submitLabel="Save"
                saving={saving}
              />
            ) : confirmDeleteId === p.id ? (
              <div key={p.id} style={{
                background: 'rgba(139, 32, 32, 0.05)',
                padding: '10px var(--sp-xl)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-md)',
                borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: 'var(--fs-sm)', flex: 1 }}>
                  Delete <strong>{p.name}</strong>?
                  {(todoCounts[p.id] ?? 0) > 0 && (
                    <span style={{ color: 'var(--muted)', marginLeft: 'var(--sp-xs)' }}>
                      Cannot delete — {todoCounts[p.id]} todo{todoCounts[p.id] !== 1 ? 's' : ''} exist.
                    </span>
                  )}
                </span>
                {(todoCounts[p.id] ?? 0) === 0 ? (
                  <>
                    <button
                      onClick={() => handleDelete(p.id)}
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
                key={p.id}
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
                <span
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: 'var(--r)',
                    flexShrink: 0,
                    border: '1px solid var(--border)',
                    backgroundColor: p.color ?? '#e5e7eb',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text)' }}>{p.name}</p>
                  {p.description && (
                    <p style={{ margin: '2px 0 0', fontSize: 'var(--fs-xs)', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.description}
                    </p>
                  )}
                </div>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', flexShrink: 0 }}>
                  {todoCounts[p.id] ?? 0} todos
                </span>
                <button
                  onClick={() => startEdit(p)}
                  style={rowActionBtnStyle}
                >
                  Edit
                </button>
                <button
                  onClick={() => { setConfirmDeleteId(p.id); setEditingId(null) }}
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
