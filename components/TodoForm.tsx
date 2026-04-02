'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Todo, Group, Category, Product, Priority } from './TodoView'

type Props = {
  productId?: string
  products: Product[]
  groups: Group[]
  categories: Category[]
  priorities: Priority[]
  onClose: () => void
  onCreate: (todo: Todo) => void
}

export default function TodoForm({
  productId,
  products,
  groups,
  categories,
  priorities,
  onClose,
  onCreate,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const defaultProductId = productId ?? products[0]?.id ?? ''

  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'open' as Todo['status'],
    priority_value: 3 as number,
    product_id: defaultProductId,
    group_id: null as string | null,
    category_id: null as string | null,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const filteredGroups = groups.filter((g) => g.product_id === form.product_id)
  const filteredCategories = categories.filter((c) => c.product_id === form.product_id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Title is required.')
      return
    }
    setSaving(true)
    setError('')

    const { data, error: err } = await supabase
      .from('todos')
      .insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        resolution_notes: null,
        status: form.status,
        priority_value: form.priority_value,
        product_id: form.product_id,
        group_id: form.group_id,
        category_id: form.category_id,
        urls: [],
        sort_order: 0,
      })
      .select('*, groups(name), categories(name)')
      .single()

    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    if (data) onCreate(data as Todo)
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
          <span className="text-sm font-medium">New Todo</span>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Title *</label>
            <input
              className="w-full border border-zinc-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              autoFocus
            />
          </div>

          {!productId && products.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Product</label>
              <select
                className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
                value={form.product_id}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    product_id: e.target.value,
                    group_id: null,
                    category_id: null,
                  }))
                }
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Status</label>
              <select
                className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as Todo['status'] }))
                }
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="on_hold">On Hold</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Priority</label>
              <select
                className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
                value={form.priority_value}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priority_value: Number(e.target.value) }))
                }
              >
                {priorities.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Group</label>
              <select
                className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
                value={form.group_id ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, group_id: e.target.value || null }))
                }
              >
                <option value="">None</option>
                {filteredGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Category</label>
              <select
                className="w-full border border-zinc-200 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
                value={form.category_id ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category_id: e.target.value || null }))
                }
              >
                <option value="">None</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Description</label>
            <textarea
              className="w-full border border-zinc-200 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-zinc-400"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-zinc-500 hover:text-zinc-800 px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="text-sm bg-zinc-900 text-white px-4 py-1.5 rounded hover:bg-zinc-700 disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
