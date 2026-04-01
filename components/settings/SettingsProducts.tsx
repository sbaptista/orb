'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

type Product = {
  id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  sort_order: number
}

type ItemForm = {
  name: string
  description: string
  color: string
  icon: string
  sort_order: string
}

const EMPTY_FORM: ItemForm = {
  name: '',
  description: '',
  color: '#6366f1',
  icon: '',
  sort_order: '0',
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
    <div className="px-4 py-4 bg-zinc-50 border-b border-zinc-100">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Name *</label>
          <input
            className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
            value={form.name}
            onChange={e => onChange({ ...form, name: e.target.value })}
            autoFocus
            placeholder="Product name"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Icon (emoji)</label>
          <input
            className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
            value={form.icon}
            onChange={e => onChange({ ...form, icon: e.target.value })}
            placeholder="📦"
            maxLength={2}
          />
        </div>
      </div>
      <div className="mb-3">
        <label className="block text-xs text-zinc-500 mb-1">Description</label>
        <input
          className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
          value={form.description}
          onChange={e => onChange({ ...form, description: e.target.value })}
          placeholder="Optional description"
        />
      </div>
      <div className="flex items-end gap-4 mb-3">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Color</label>
          <input
            type="color"
            className="h-8 w-16 border border-zinc-200 rounded cursor-pointer p-0.5"
            value={form.color}
            onChange={e => onChange({ ...form, color: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Sort Order</label>
          <input
            type="number"
            className="w-20 border border-zinc-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
            value={form.sort_order}
            onChange={e => onChange({ ...form, sort_order: e.target.value })}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          disabled={saving}
          className="text-sm bg-zinc-900 text-white px-3 py-1.5 rounded hover:bg-zinc-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
        <button
          onClick={onCancel}
          className="text-sm text-zinc-500 hover:text-zinc-800 px-3 py-1.5"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function SettingsProducts() {
  const supabase = useMemo(() => createClient(), [])
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

  useEffect(() => {
    async function load() {
      const [prodRes, todoRes] = await Promise.all([
        supabase.from('products').select('*').order('sort_order'),
        supabase.from('todos').select('product_id'),
      ])
      setProducts(prodRes.data ?? [])
      const counts: Record<string, number> = {}
      todoRes.data?.forEach(t => {
        counts[t.product_id] = (counts[t.product_id] || 0) + 1
      })
      setTodoCounts(counts)
      setLoading(false)
    }
    load()
  }, [supabase])

  function startEdit(p: Product) {
    setEditingId(p.id)
    setEditForm({
      name: p.name,
      description: p.description ?? '',
      color: p.color ?? '#6366f1',
      icon: p.icon ?? '',
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
      .from('products')
      .update({
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        color: editForm.color,
        icon: editForm.icon.trim() || null,
        sort_order: Number(editForm.sort_order) || 0,
      })
      .eq('id', id)
      .select()
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) setProducts(prev => prev.map(p => p.id === id ? data as Product : p))
    setEditingId(null)
  }

  async function handleAdd() {
    if (!addForm.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase
      .from('products')
      .insert({
        name: addForm.name.trim(),
        description: addForm.description.trim() || null,
        color: addForm.color,
        icon: addForm.icon.trim() || null,
        sort_order: Number(addForm.sort_order) || 0,
      })
      .select()
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) setProducts(prev => [...prev, data as Product])
    setShowAdd(false)
    setAddForm(EMPTY_FORM)
  }

  async function handleDelete(id: string) {
    setSaving(true)
    await supabase.from('products').delete().eq('id', id)
    setSaving(false)
    setProducts(prev => prev.filter(p => p.id !== id))
    setConfirmDeleteId(null)
  }

  if (loading) return <div className="p-8 text-sm text-zinc-400">Loading…</div>

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Products</h2>
        {!showAdd && (
          <button
            onClick={() => {
              setShowAdd(true)
              setEditingId(null)
              setConfirmDeleteId(null)
              setAddForm(EMPTY_FORM)
              setError('')
            }}
            className="text-sm border border-zinc-200 px-3 py-1.5 rounded text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 transition-colors"
          >
            + Add Product
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        {showAdd && (
          <ProductForm
            form={addForm}
            onChange={setAddForm}
            onSubmit={handleAdd}
            onCancel={() => { setShowAdd(false); setError('') }}
            submitLabel="Add Product"
            saving={saving}
          />
        )}

        {products.length === 0 && !showAdd ? (
          <p className="text-sm text-zinc-400 px-4 py-8 text-center">No products yet.</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {products.map(p =>
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
                <div key={p.id} className="flex items-center gap-3 px-4 py-3 bg-red-50">
                  <span className="text-sm flex-1">
                    Delete <strong>{p.name}</strong>?
                    {(todoCounts[p.id] ?? 0) > 0 && (
                      <span className="text-zinc-500 ml-1">
                        Cannot delete — {todoCounts[p.id]} todo{todoCounts[p.id] !== 1 ? 's' : ''} exist.
                      </span>
                    )}
                  </span>
                  {(todoCounts[p.id] ?? 0) === 0 ? (
                    <>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={saving}
                        className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-sm text-zinc-500 hover:text-zinc-800"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-sm text-zinc-500 hover:text-zinc-800"
                    >
                      OK
                    </button>
                  )}
                </div>
              ) : (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                  <span
                    className="w-4 h-4 rounded shrink-0 border border-zinc-200"
                    style={{ backgroundColor: p.color ?? '#e5e7eb' }}
                  />
                  <span className="text-base leading-none shrink-0">{p.icon ?? '📦'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-800">{p.name}</p>
                    {p.description && (
                      <p className="text-xs text-zinc-400 truncate">{p.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400 shrink-0">
                    {todoCounts[p.id] ?? 0} todos
                  </span>
                  <button
                    onClick={() => startEdit(p)}
                    className="text-xs text-zinc-400 hover:text-zinc-700 shrink-0"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { setConfirmDeleteId(p.id); setEditingId(null) }}
                    className="text-xs text-zinc-400 hover:text-red-600 shrink-0"
                  >
                    Delete
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
