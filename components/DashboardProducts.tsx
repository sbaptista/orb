'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { visibleProjectsQuery } from '@/lib/projects'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import OrbVersionLabel from '@/components/ui/OrbVersionLabel'

type Product = {
  id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  sort_order: number
  code: string | null
}

type ProductForm = {
  name: string
  description: string
  color: string
  icon: string
  sort_order: string
  code: string
}

const EMPTY_FORM: ProductForm = {
  name: '',
  description: '',
  color: '#6366f1',
  icon: '',
  sort_order: '0',
  code: '',
}

function InlineProductForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  saving,
}: {
  form: ProductForm
  onChange: (f: ProductForm) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
  saving: boolean
}) {
  const [codeAutoSync, setCodeAutoSync] = useState(!form.code)

  return (
    <div className="px-4 py-4 bg-zinc-50 rounded-lg border border-zinc-200">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Name *</label>
          <input
            className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
            value={form.name}
            onChange={e => {
              const name = e.target.value
              const autoCode = name.slice(0, 4).toUpperCase()
              onChange(codeAutoSync ? { ...form, name, code: autoCode } : { ...form, name })
            }}
            autoFocus
            placeholder="Product name"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Code</label>
          <input
            className="w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-zinc-400"
            value={form.code}
            onChange={e => {
              setCodeAutoSync(false)
              onChange({ ...form, code: e.target.value.toUpperCase() })
            }}
            placeholder="HELM"
            maxLength={10}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
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
          className="btn-primary btn-sm"
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
        <button
          onClick={onCancel}
          className="btn-cancel btn-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function DashboardProducts() {
  const supabase = useMemo(() => createClient(), [])
  const [products, setProducts] = useState<Product[]>([])
  const [todoCounts, setTodoCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ProductForm>(EMPTY_FORM)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<ProductForm>(EMPTY_FORM)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [prodRes, todoRes] = await Promise.all([
      visibleProjectsQuery(supabase),
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
      icon: p.icon ?? '',
      sort_order: String(p.sort_order),
      code: p.code ?? '',
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
        icon: editForm.icon.trim() || null,
        sort_order: Number(editForm.sort_order) || 0,
        code: editForm.code.trim() || null,
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
      .from('projects')
      .insert({
        name: addForm.name.trim(),
        description: addForm.description.trim() || null,
        color: addForm.color,
        icon: addForm.icon.trim() || null,
        sort_order: Number(addForm.sort_order) || 0,
        code: addForm.code.trim() || null,
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
    await supabase.from('projects').delete().eq('id', id)
    setSaving(false)
    setProducts(prev => prev.filter(p => p.id !== id))
    setConfirmDeleteId(null)
  }

  if (loading) return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <p className="text-sm text-zinc-400">Loading…</p>
    </main>
  )

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold">Products</h1>
        <div className="flex items-center gap-3">
          {!showAdd && (
            <button
              onClick={() => {
                setShowAdd(true)
                setEditingId(null)
                setConfirmDeleteId(null)
                setAddForm(EMPTY_FORM)
                setError('')
              }}
              className="btn-outline btn-sm"
            >
              + Add Product
            </button>
          )}
          <Link
            href="/settings"
            className="text-zinc-400 hover:text-zinc-700 transition-colors"
            aria-label="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </Link>
        </div>
      </div>

      {showAdd && (
        <div className="mb-6">
          <InlineProductForm
            form={addForm}
            onChange={setAddForm}
            onSubmit={handleAdd}
            onCancel={() => { setShowAdd(false); setError('') }}
            submitLabel="Add Product"
            saving={saving}
          />
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Link
          href="/dashboard/all"
          className="flex flex-col gap-1 p-5 rounded-lg border border-zinc-200 bg-white hover:border-zinc-400 transition-colors"
        >
          <span className="text-2xl">📋</span>
          <span className="font-medium text-sm mt-1">All</span>
          <span className="text-xs text-zinc-500">View all todos</span>
        </Link>

        {products.map(p =>
          editingId === p.id ? (
            <div key={p.id} className="col-span-2 sm:col-span-3">
              <InlineProductForm
                form={editForm}
                onChange={setEditForm}
                onSubmit={() => handleSave(p.id)}
                onCancel={() => { setEditingId(null); setError('') }}
                submitLabel="Save"
                saving={saving}
              />
            </div>
          ) : confirmDeleteId === p.id ? (
            <div key={p.id} className="col-span-2 sm:col-span-3 flex items-center gap-3 px-4 py-3 bg-red-50 rounded-lg border border-red-100">
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
                    className="btn-danger-confirm btn-sm"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="btn-cancel btn-sm"
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
            <div key={p.id} className="flex flex-col rounded-lg border border-zinc-200 bg-white hover:border-zinc-400 transition-colors overflow-hidden">
              <Link
                href={`/dashboard/${p.id}`}
                className="flex flex-col gap-1 p-5 flex-1"
              >
                <span className="text-2xl">{p.icon ?? '📦'}</span>
                <span className="font-medium text-sm mt-1">{p.name}</span>
                {p.code && (
                  <span className="text-xs text-zinc-400 font-mono">{p.code}</span>
                )}
                {p.description && (
                  <span className="text-xs text-zinc-500 line-clamp-2">{p.description}</span>
                )}
              </Link>
              <div className="flex items-center gap-3 px-4 py-2 border-t border-zinc-100 bg-zinc-50">
                <span className="text-xs text-zinc-400 flex-1">
                  {todoCounts[p.id] ?? 0} todos
                </span>
                <button
                  onClick={() => startEdit(p)}
                  className="btn-row-action btn-row-edit"
                >
                  Edit
                </button>
                <button
                  onClick={() => { setConfirmDeleteId(p.id); setEditingId(null) }}
                  className="btn-row-action btn-row-delete"
                >
                  Delete
                </button>
              </div>
            </div>
          )
        )}
      </div>
      <div className="auth-version" style={{ position: 'static' }}>
        <OrbVersionLabel className="auth-version-text" />
      </div>
    </main>
  )
}
