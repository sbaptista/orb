'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'

type Product = { id: string; name: string }
type Category = { id: string; name: string; product_id: string | null; sort_order: number }
type CatForm = { name: string; product_id: string; sort_order: string }

const EMPTY_FORM: CatForm = { name: '', product_id: '', sort_order: '0' }

export default function SettingsCategories() {
  const supabase = useMemo(() => createClient(), [])
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
    if (data) setCategories(prev => [...prev, data as Category])
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
    if (data) setCategories(prev => prev.map(c => c.id === id ? data as Category : c))
    setEditingId(null)
  }

  async function handleDelete(id: string) {
    setSaving(true)
    await supabase.from('categories').delete().eq('id', id)
    setSaving(false)
    setCategories(prev => prev.filter(c => c.id !== id))
    setConfirmDeleteId(null)
  }

  function CatForm({
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
      <div className="px-4 py-4 bg-zinc-50 border-b border-zinc-100">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Name *</label>
            <input
              className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
              value={form.name}
              onChange={e => onChange({ ...form, name: e.target.value })}
              autoFocus
              placeholder="Category name"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Sort Order</label>
            <input
              type="number"
              className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
              value={form.sort_order}
              onChange={e => onChange({ ...form, sort_order: e.target.value })}
            />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs text-zinc-500 mb-1">Product</label>
          <select
            className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
            value={form.product_id}
            onChange={e => onChange({ ...form, product_id: e.target.value })}
          >
            <option value="">Global</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onSubmit}
            disabled={saving}
            className="text-sm bg-zinc-900 text-white px-3 py-1.5 rounded hover:bg-zinc-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : submitLabel}
          </button>
          <button onClick={onCancel} className="text-sm text-zinc-500 hover:text-zinc-800 px-3 py-1.5">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (loading) return <div className="p-8 text-sm text-zinc-400">Loading…</div>

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Categories</h2>
        {!showAdd && (
          <button
            onClick={startAdd}
            className="text-sm border border-zinc-200 px-3 py-1.5 rounded text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 transition-colors"
          >
            + Add Category
          </button>
        )}
      </div>

      {/* Product scope selector */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setScope('')}
          className={`text-sm px-3 py-1.5 rounded border transition-colors ${
            scope === ''
              ? 'bg-zinc-900 text-white border-zinc-900'
              : 'border-zinc-200 text-zinc-600 hover:border-zinc-400'
          }`}
        >
          Global
        </button>
        {products.map(p => (
          <button
            key={p.id}
            onClick={() => setScope(p.id)}
            className={`text-sm px-3 py-1.5 rounded border transition-colors ${
              scope === p.id
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'border-zinc-200 text-zinc-600 hover:border-zinc-400'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        {showAdd && (
          <CatForm
            form={addForm}
            onChange={setAddForm}
            onSubmit={handleAdd}
            onCancel={() => { setShowAdd(false); setError('') }}
            submitLabel="Add Category"
          />
        )}

        {displayed.length === 0 && !showAdd ? (
          <p className="text-sm text-zinc-400 px-4 py-8 text-center">No categories in this scope.</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {displayed.map(c =>
              editingId === c.id ? (
                <CatForm
                  key={c.id}
                  form={editForm}
                  onChange={setEditForm}
                  onSubmit={() => handleSave(c.id)}
                  onCancel={() => { setEditingId(null); setError('') }}
                  submitLabel="Save"
                />
              ) : confirmDeleteId === c.id ? (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3 bg-red-50">
                  <span className="text-sm flex-1">
                    Delete <strong>{c.name}</strong>?
                    {(todoCounts[c.id] ?? 0) > 0 && (
                      <span className="text-zinc-500 ml-1">
                        Cannot delete — {todoCounts[c.id]} todo{todoCounts[c.id] !== 1 ? 's' : ''} use this category.
                      </span>
                    )}
                  </span>
                  {(todoCounts[c.id] ?? 0) === 0 ? (
                    <>
                      <button
                        onClick={() => handleDelete(c.id)}
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
                <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-800">{c.name}</p>
                    <p className="text-xs text-zinc-400">sort: {c.sort_order}</p>
                  </div>
                  <span className="text-xs text-zinc-400 shrink-0">
                    {todoCounts[c.id] ?? 0} todos
                  </span>
                  <button
                    onClick={() => startEdit(c)}
                    className="text-xs text-zinc-400 hover:text-zinc-700 shrink-0"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { setConfirmDeleteId(c.id); setEditingId(null) }}
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
