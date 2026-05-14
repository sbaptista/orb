'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import { useToast } from '@/components/ui/Toast'
import { getUserDetail, getUserProjects } from '@/app/actions/get-user-detail'
import { createProject, updateProject, deleteProject } from '@/app/actions/manage-project'
import { useUnsavedChanges } from '@/lib/hooks/useUnsavedChanges'
import Link from 'next/link'

type Product = {
  id: string
  name: string
  code: string | null
  description: string | null
  color: string | null
  sort_order: number
}

type ItemForm = {
  name: string
  code: string
  codeAutoSync: boolean
  description: string
  color: string
  sort_order: string
}

const EMPTY_FORM: ItemForm = {
  name: '',
  code: '',
  codeAutoSync: true,
  description: '',
  color: '#6366f1',
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
  function handleNameChange(value: string) {
    const updated: ItemForm = { ...form, name: value }
    if (form.codeAutoSync) updated.code = value.slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '')
    onChange(updated)
  }

  function handleCodeChange(value: string) {
    onChange({ ...form, code: value.toUpperCase().replace(/[^A-Z0-9]/g, ''), codeAutoSync: false })
  }

  return (
    <div className="s-form">
      <div className="mb-md">
        <label className="label">Name *</label>
        <input
          className="input"
          value={form.name}
          onChange={e => handleNameChange(e.target.value)}
          autoFocus
          placeholder="Project name"
        />
      </div>
      <div className="mb-md">
        <label className="label">Code *</label>
        <input
          className="input"
          style={{ fontFamily: 'monospace', width: '120px' }}
          value={form.code}
          onChange={e => handleCodeChange(e.target.value)}
          placeholder="PROJ"
          maxLength={6}
        />
      </div>
      <div className="mb-md">
        <label className="label">Description</label>
        <input
          className="input"
          value={form.description}
          onChange={e => onChange({ ...form, description: e.target.value })}
          placeholder="Optional description"
        />
      </div>
      <div className="flex-center gap-xl mb-md" style={{ alignItems: 'flex-end' }}>
        <div>
          <label className="label">Color</label>
          <input
            type="color"
            className="color-swatch"
            value={form.color}
            onChange={e => onChange({ ...form, color: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Sort Order</label>
          <input
            type="number"
            className="input"
            style={{ width: '80px' }}
            value={form.sort_order}
            onChange={e => onChange({ ...form, sort_order: e.target.value })}
          />
        </div>
      </div>
      <div className="flex-row gap-sm">
        <button
          className="btn-primary"
          onClick={onSubmit}
          disabled={saving}
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
        <button className="btn-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function SettingsUserDetail({ userId }: { userId: string }) {
  const toast = useToast()
  const { setDirty } = useUnsavedChanges()

  const [userProfile, setUserProfile] = useState<{ first_name: string | null; last_name: string | null; email: string } | null>(null)
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
  const [accessDenied, setAccessDenied] = useState(false)
  const loaded = useRef(false)

  const load = useCallback(async () => {
    if (!loaded.current) setLoading(true)
    const [userRes, projRes] = await Promise.all([
      getUserDetail(userId),
      getUserProjects(userId),
    ])

    if (userRes.error || !userRes.profile) {
       if (userRes.error === 'Access denied') setAccessDenied(true)
       setLoading(false)
       return
    }

    setUserProfile(userRes.profile)
    setProducts(projRes.projects as Product[])
    setTodoCounts(projRes.todoCounts)
    setLoading(false)
    loaded.current = true
  }, [userId])

  useVisibilityRefetch(load)
  useEffect(() => { load() }, [load])

  function startEdit(p: Product) {
    setEditingId(p.id)
    setEditForm({
      name: p.name,
      code: p.code ?? '',
      codeAutoSync: false,
      description: p.description ?? '',
      color: p.color ?? '#6366f1',
      sort_order: String(p.sort_order),
    })
    setShowAdd(false)
    setConfirmDeleteId(null)
    setError('')
    setDirty(true)
  }

  async function handleSave(id: string) {
    if (!editForm.name.trim()) { setError('Name is required'); return }
    if (!editForm.code.trim()) { setError('Code is required'); return }
    setSaving(true)
    setError('')
    const res = await updateProject(id, {
      name: editForm.name.trim(),
      code: editForm.code.trim() || null,
      description: editForm.description.trim() || null,
      color: editForm.color,
      sort_order: Number(editForm.sort_order) || 0,
    })
    setSaving(false)
    if (res.error) { setError(res.error); return }
    if (res.project) { toast.success('Project saved.'); setProducts(prev => prev.map(p => p.id === id ? res.project as Product : p)) }
    setEditingId(null)
    setDirty(false)
  }

  async function handleAdd() {
    if (!addForm.name.trim()) { setError('Name is required'); return }
    if (!addForm.code.trim()) { setError('Code is required'); return }
    setSaving(true)
    setError('')
    const res = await createProject({
      name: addForm.name.trim(),
      code: addForm.code.trim() || null,
      description: addForm.description.trim() || null,
      color: addForm.color,
      sort_order: Number(addForm.sort_order) || 0,
      ownerId: userId,
    })
    setSaving(false)
    if (res.error) { setError(res.error); return }
    if (res.project) { toast.success('Project added.'); setProducts(prev => [...prev, res.project as Product]) }
    setShowAdd(false)
    setAddForm(EMPTY_FORM)
    setDirty(false)
  }

  async function handleDelete(id: string) {
    setSaving(true)
    const res = await deleteProject(id)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    toast.success('Project deleted.')
    setProducts(prev => prev.filter(p => p.id !== id))
    setConfirmDeleteId(null)
  }

  if (loading) return <div className="s-loading">Loading…</div>
  if (accessDenied) return (
      <div className="settings-page s-page" style={{ alignItems: 'center', justifyContent: 'center', paddingTop: '10vh' }}>
          <div className="s-card" style={{ maxWidth: '500px', textAlign: 'center', padding: 'var(--sp-2xl)' }}>
              <h3 style={{ fontSize: 'var(--fs-lg)', marginBottom: 'var(--sp-sm)', fontWeight: 600 }}>Access Denied</h3>
              <p style={{ color: 'var(--text2)', marginBottom: 'var(--sp-xl)', lineHeight: 1.6 }}>
                  You do not have permission to view this user's details.
              </p>
              <Link href="/settings/users" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
                  Back to Users
              </Link>
          </div>
      </div>
  )
  if (!userProfile) return (
      <div className="settings-page s-page" style={{ alignItems: 'center', justifyContent: 'center', paddingTop: '10vh' }}>
          <div className="s-card" style={{ maxWidth: '500px', textAlign: 'center', padding: 'var(--sp-2xl)' }}>
              <h3 style={{ fontSize: 'var(--fs-lg)', marginBottom: 'var(--sp-sm)', fontWeight: 600 }}>User not found</h3>
              <p style={{ color: 'var(--text2)', marginBottom: 'var(--sp-xl)', lineHeight: 1.6 }}>
                  This user could not be loaded.
              </p>
              <Link href="/settings/users" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
                  Back to Users
              </Link>
          </div>
      </div>
  )

  const displayName = [userProfile.first_name, userProfile.last_name].filter(Boolean).join(' ') || userProfile.email

  return (
    <div className="settings-page s-page">
      <div className="s-header">
        <div>
            <h2 className="s-title" style={{ marginBottom: '4px' }}>{displayName}'s Projects</h2>
            <p className="text-sm text-muted">{userProfile.email}</p>
        </div>
        {!showAdd && (
          <button
            className="btn-outline"
            onClick={() => {
              setShowAdd(true)
              setEditingId(null)
              setConfirmDeleteId(null)
              setAddForm(EMPTY_FORM)
              setError('')
              setDirty(true)
            }}
          >
            + Add Project
          </button>
        )}
      </div>

      {error && <p className="s-error">{error}</p>}

      <div className="s-list">
        {products.length > 0 && !showAdd && (
          <div className="s-row" style={{ fontWeight: 600, fontSize: 'var(--fs-xs)', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--sp-xs)' }}>
            <span style={{ width: '16px', flexShrink: 0 }} />
            <div className="s-row-info" style={{ flex: 1 }}>Project</div>
            <span className="s-row-meta">Todos</span>
            <span style={{ width: '240px', textAlign: 'right' }}>Actions</span>
          </div>
        )}
        {showAdd && (
          <ProductForm
            form={addForm}
            onChange={setAddForm}
            onSubmit={handleAdd}
            onCancel={() => { setShowAdd(false); setError(''); setDirty(false) }}
            submitLabel="Add Project"
            saving={saving}
          />
        )}

        {products.length === 0 && !showAdd ? (
          <p className="s-empty">This user has no projects.</p>
        ) : (
          products.map(p =>
            editingId === p.id ? (
              <ProductForm
                key={p.id}
                form={editForm}
                onChange={setEditForm}
                onSubmit={() => handleSave(p.id)}
                onCancel={() => { setEditingId(null); setError(''); setDirty(false) }}
                submitLabel="Save"
                saving={saving}
              />
            ) : confirmDeleteId === p.id ? (
              <div key={p.id} className="s-row-delete">
                <span className="text-sm flex-1">
                  Delete <strong>{p.name}</strong>?
                  {(todoCounts[p.id] ?? 0) > 0 && (
                    <span className="text-muted" style={{ marginLeft: 'var(--sp-xs)' }}>
                      Cannot delete — {todoCounts[p.id]} todo{todoCounts[p.id] !== 1 ? 's' : ''} exist.
                    </span>
                  )}
                </span>
                {(todoCounts[p.id] ?? 0) === 0 ? (
                  <>
                    <button
                      className="btn-danger-confirm"
                      onClick={() => handleDelete(p.id)}
                      disabled={saving}
                      style={{ opacity: saving ? 0.6 : 1 }}
                    >
                      Confirm
                    </button>
                    <button className="btn-cancel" onClick={() => setConfirmDeleteId(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button className="btn-cancel" onClick={() => setConfirmDeleteId(null)}>
                    OK
                  </button>
                )}
              </div>
            ) : (
              <div key={p.id} className="s-row">
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
                <div className="s-row-info" style={{ flex: 1 }}>
                  <Link href={`/settings/projects/${p.id}`} className="text-sm" style={{ fontWeight: 500, color: 'var(--text)', textDecoration: 'none' }}>
                    {p.name}
                  </Link>
                  {p.description && (
                    <p style={{ margin: '2px 0 0' }} className="text-xs text-muted truncate">
                      {p.description}
                    </p>
                  )}
                </div>
                <span className="s-row-meta">
                  {todoCounts[p.id] ?? 0} todos
                </span>
                <Link href={`/settings/projects/${p.id}`} className="btn-row-action" style={{ textDecoration: 'none' }}>
                  View Todos
                </Link>
                <button className="btn-row-action" onClick={() => startEdit(p)}>
                  Edit
                </button>
                <button
                  className="btn-row-action btn-row-delete"
                  onClick={() => { setConfirmDeleteId(p.id); setEditingId(null) }}
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
