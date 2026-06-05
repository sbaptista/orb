'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import { useToast } from '@/components/ui/Toast'

type Product = { id: string; name: string }
type Group = { id: string; name: string; product_id: string | null; sort_order: number }
type GroupForm = { name: string; product_id: string; sort_order: string }

const EMPTY_FORM: GroupForm = { name: '', product_id: '', sort_order: '0' }

export default function SettingsGroups() {
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [todoCounts, setTodoCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<GroupForm>(EMPTY_FORM)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<GroupForm>(EMPTY_FORM)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [prodRes, groupRes, todoRes] = await Promise.all([
      supabase.from('projects').select('id, name').order('sort_order'),
      supabase.from('groups').select('*').order('sort_order'),
      supabase.from('todos').select('group_id'),
    ])
    setProducts(prodRes.data ?? [])
    setGroups(groupRes.data ?? [])
    const counts: Record<string, number> = {}
    todoRes.data?.forEach(t => {
      if (t.group_id) counts[t.group_id] = (counts[t.group_id] || 0) + 1
    })
    setTodoCounts(counts)
    setLoading(false)
  }, [supabase])

  useVisibilityRefetch(load)
  useEffect(() => { load() }, [load])

  const displayed = groups.filter(g =>
    scope === '' ? g.product_id === null : g.product_id === scope
  )

  function startAdd() {
    setShowAdd(true)
    setEditingId(null)
    setConfirmDeleteId(null)
    setAddForm({ name: '', product_id: scope, sort_order: '0' })
    setError('')
  }

  function startEdit(g: Group) {
    setEditingId(g.id)
    setEditForm({
      name: g.name,
      product_id: g.product_id ?? '',
      sort_order: String(g.sort_order),
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
      .from('groups')
      .insert({
        name: addForm.name.trim(),
        product_id: addForm.product_id || null,
        sort_order: Number(addForm.sort_order) || 0,
      })
      .select()
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) { toast.success('Group added.'); setGroups(prev => [...prev, data as Group]) }
    setShowAdd(false)
    setAddForm(EMPTY_FORM)
  }

  async function handleSave(id: string) {
    if (!editForm.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase
      .from('groups')
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
    if (data) { toast.success('Group saved.'); setGroups(prev => prev.map(g => g.id === id ? data as Group : g)) }
    setEditingId(null)
  }

  async function handleDelete(id: string) {
    setSaving(true)
    await supabase.from('groups').delete().eq('id', id)
    setSaving(false)
    toast.success('Group deleted.')
    setGroups(prev => prev.filter(g => g.id !== id))
    setConfirmDeleteId(null)
  }

  if (loading) return <div className="s-loading">Loading…</div>

  return (
    <div className="s-page">
      <div className="s-header">
        <h2 className="s-title">Groups</h2>
        {!showAdd && (
          <button className="btn-outline" onClick={startAdd}>+ Add Group</button>
        )}
      </div>

      <div className="flex-row gap-sm mb-xl" style={{ flexWrap: 'wrap' }}>
        <button
          className={`pill ${scope === '' ? 'pill-active' : ''}`}
          onClick={() => setScope('')}
        >
          Global
        </button>
        {products.map(p => (
          <button
            key={p.id}
            className={`pill ${scope === p.id ? 'pill-active' : ''}`}
            onClick={() => setScope(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>

      {error && <p className="s-error">{error}</p>}

      <div className="s-list">
        {showAdd && (
          <GroupFormComp
            form={addForm}
            onChange={setAddForm}
            onSubmit={handleAdd}
            onCancel={() => { setShowAdd(false); setError('') }}
            submitLabel="Add Group"
            products={products}
            saving={saving}
          />
        )}

        {displayed.length === 0 && !showAdd ? (
          <p className="s-empty">No groups in this scope.</p>
        ) : (
          displayed.map(g =>
            editingId === g.id ? (
              <GroupFormComp
                key={g.id}
                form={editForm}
                onChange={setEditForm}
                onSubmit={() => handleSave(g.id)}
                onCancel={() => { setEditingId(null); setError('') }}
                submitLabel="Save"
                products={products}
                saving={saving}
              />
            ) : confirmDeleteId === g.id ? (
              <div key={g.id} className="s-row-delete">
                <span className="text-sm flex-1">
                  Delete <strong>{g.name}</strong>?
                  {(todoCounts[g.id] ?? 0) > 0 && (
                    <span className="text-muted" style={{ marginLeft: 'var(--sp-xs)' }}>
                      Cannot delete — {todoCounts[g.id]} todo{todoCounts[g.id] !== 1 ? 's' : ''} use this group.
                    </span>
                  )}
                </span>
                {(todoCounts[g.id] ?? 0) === 0 ? (
                  <>
                    <button
                      className="btn-danger-confirm"
                      onClick={() => handleDelete(g.id)}
                      disabled={saving}
                      style={{ opacity: saving ? 0.6 : 1 }}
                    >
                      Confirm
                    </button>
                    <button className="btn-cancel" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                  </>
                ) : (
                  <button className="btn-cancel" onClick={() => setConfirmDeleteId(null)}>OK</button>
                )}
              </div>
            ) : (
              <div key={g.id} className="s-row">
                <div className="s-row-info">
                  <p style={{ margin: 0 }} className="text-sm">{g.name}</p>
                  <p style={{ margin: '2px 0 0' }} className="text-xs text-muted">sort: {g.sort_order}</p>
                </div>
                <span className="s-row-meta">{todoCounts[g.id] ?? 0} todos</span>
                <button className="btn-row-action" onClick={() => startEdit(g)}>Edit</button>
                <button
                  className="btn-row-action btn-row-delete"
                  onClick={() => { setConfirmDeleteId(g.id); setEditingId(null) }}
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

function GroupFormComp({
  form,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  products,
  saving,
}: {
  form: GroupForm
  onChange: (f: GroupForm) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
  products: Product[]
  saving: boolean
}) {
  return (
    <div className="s-form">
      <div className="grid-2col mb-md">
        <div>
          <label className="label">Name *</label>
          <input
            className="input"
            value={form.name}
            onChange={e => onChange({ ...form, name: e.target.value })}
            autoFocus
            placeholder="Group name"
          />
        </div>
        <div>
          <label className="label">Sort Order</label>
          <input
            type="number"
            className="input"
            value={form.sort_order}
            onChange={e => onChange({ ...form, sort_order: e.target.value })}
          />
        </div>
      </div>
      <div className="mb-md">
        <label className="label">Product</label>
        <select
          className="select"
          value={form.product_id}
          onChange={e => onChange({ ...form, product_id: e.target.value })}
        >
          <option value="">Global</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="flex-row gap-sm">
        <button className="btn-primary" onClick={onSubmit} disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
        <button className="btn-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
