'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Todo, Group, Category, Product, Priority } from './TodoView'

type Props = {
  todo: Todo
  groups: Group[]
  categories: Category[]
  products: Product[]
  priorities: Priority[]
  isAll: boolean
  onClose: () => void
  onSave: (updated: Todo) => void
  onDelete: (id: string) => void
}

export default function TodoPanel({
  todo,
  groups,
  categories,
  products,
  priorities,
  isAll,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [form, setForm] = useState({ ...todo })
  const [urlInput, setUrlInput] = useState((todo.urls ?? []).join('\n'))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setForm({ ...todo })
    setUrlInput((todo.urls ?? []).join('\n'))
    setConfirmDelete(false)
  }, [todo.id])

  const filteredGroups = groups.filter((g) => g.product_id === form.product_id)
  const filteredCategories = categories.filter((c) => c.product_id === form.product_id)

  async function handleSave() {
    setSaving(true)
    const urls = urlInput.split('\n').map((u) => u.trim()).filter(Boolean)
    const { data } = await supabase
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
        closed_at:
          form.status === 'done'
            ? (todo.closed_at ?? new Date().toISOString())
            : null,
      })
      .eq('id', todo.id)
      .select('*, groups(name), categories(name)')
      .single()
    setSaving(false)
    if (data) onSave(data as Todo)
  }

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('todos').delete().eq('id', todo.id)
    setDeleting(false)
    onDelete(todo.id)
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-[480px] max-w-full bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 shrink-0">
          <span className="text-sm font-medium text-zinc-700">Edit Todo</span>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Title</label>
            <input
              className="w-full border border-zinc-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

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
                value={form.priority_value ?? 3}
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

          {isAll && (
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
              rows={5}
              value={form.description ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Resolution Notes</label>
            <textarea
              className="w-full border border-zinc-200 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-zinc-400"
              rows={5}
              value={form.resolution_notes ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, resolution_notes: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">URLs (one per line)</label>
            <textarea
              className="w-full border border-zinc-200 rounded px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-1 focus:ring-zinc-400"
              rows={3}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">ID</label>
            <input
              readOnly
              className="w-full border border-zinc-100 rounded px-3 py-2 text-xs font-mono text-zinc-400 bg-zinc-50 cursor-text focus:outline-none"
              value={(() => {
                const code = products.find(p => p.id === todo.product_id)?.code
                return code && todo.todo_number != null ? `${code}-${todo.todo_number}` : todo.id
              })()}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-200 flex items-center justify-between shrink-0">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-600">Delete this todo?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-sm bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-sm text-zinc-500 hover:text-zinc-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Delete
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm bg-zinc-900 text-white px-4 py-1.5 rounded hover:bg-zinc-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </>
  )
}
