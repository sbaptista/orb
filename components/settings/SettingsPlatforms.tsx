'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

type Platform = { id: string; name: string; sort_order: number }
type PlatformForm = { name: string; sort_order: string }

const EMPTY_FORM: PlatformForm = { name: '', sort_order: '0' }

export default function SettingsPlatforms() {
  const supabase = useMemo(() => createClient(), [])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<PlatformForm>(EMPTY_FORM)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<PlatformForm>(EMPTY_FORM)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('platforms').select('*').order('sort_order')
      setPlatforms(data ?? [])
      setLoading(false)
    }
    load()
  }, [supabase])

  function startEdit(p: Platform) {
    setEditingId(p.id)
    setEditForm({ name: p.name, sort_order: String(p.sort_order) })
    setShowAdd(false)
    setConfirmDeleteId(null)
    setError('')
  }

  async function handleAdd() {
    if (!addForm.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase
      .from('platforms')
      .insert({
        name: addForm.name.trim(),
        sort_order: Number(addForm.sort_order) || 0,
      })
      .select()
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) setPlatforms(prev => [...prev, data as Platform])
    setShowAdd(false)
    setAddForm(EMPTY_FORM)
  }

  async function handleSave(id: string) {
    if (!editForm.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase
      .from('platforms')
      .update({
        name: editForm.name.trim(),
        sort_order: Number(editForm.sort_order) || 0,
      })
      .eq('id', id)
      .select()
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) setPlatforms(prev => prev.map(p => p.id === id ? data as Platform : p))
    setEditingId(null)
  }

  async function handleDelete(id: string) {
    setSaving(true)
    // Delete junction rows first, then the platform
    await supabase.from('todo_platforms').delete().eq('platform_id', id)
    await supabase.from('platforms').delete().eq('id', id)
    setSaving(false)
    setPlatforms(prev => prev.filter(p => p.id !== id))
    setConfirmDeleteId(null)
  }

  function PlatformForm({
    form,
    onChange,
    onSubmit,
    onCancel,
    submitLabel,
  }: {
    form: PlatformForm
    onChange: (f: PlatformForm) => void
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
              placeholder="Platform name"
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
        <h2 className="text-lg font-semibold">Platforms</h2>
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
            + Add Platform
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        {showAdd && (
          <PlatformForm
            form={addForm}
            onChange={setAddForm}
            onSubmit={handleAdd}
            onCancel={() => { setShowAdd(false); setError('') }}
            submitLabel="Add Platform"
          />
        )}

        {platforms.length === 0 && !showAdd ? (
          <p className="text-sm text-zinc-400 px-4 py-8 text-center">No platforms yet.</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {platforms.map(p =>
              editingId === p.id ? (
                <PlatformForm
                  key={p.id}
                  form={editForm}
                  onChange={setEditForm}
                  onSubmit={() => handleSave(p.id)}
                  onCancel={() => { setEditingId(null); setError('') }}
                  submitLabel="Save"
                />
              ) : confirmDeleteId === p.id ? (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3 bg-red-50">
                  <span className="text-sm flex-1">
                    Delete <strong>{p.name}</strong>? All todo associations will also be removed.
                  </span>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={saving}
                    className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                  >
                    {saving ? 'Deleting…' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="text-sm text-zinc-500 hover:text-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-800">{p.name}</p>
                    <p className="text-xs text-zinc-400">sort: {p.sort_order}</p>
                  </div>
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
