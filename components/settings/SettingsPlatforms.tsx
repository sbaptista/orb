'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

type Platform = { id: string; name: string; sort_order: number }
type PlatformForm = { name: string; sort_order: string }

const EMPTY_FORM: PlatformForm = { name: '', sort_order: '0' }

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

export default function SettingsPlatforms() {
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
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
    if (data) { toast.success('Platform added.'); setPlatforms(prev => [...prev, data as Platform]) }
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
    if (data) { toast.success('Platform saved.'); setPlatforms(prev => prev.map(p => p.id === id ? data as Platform : p)) }
    setEditingId(null)
  }

  async function handleDelete(id: string) {
    setSaving(true)
    // Delete junction rows first, then the platform
    await supabase.from('todo_platforms').delete().eq('platform_id', id)
    await supabase.from('platforms').delete().eq('id', id)
    setSaving(false)
    toast.success('Platform deleted.')
    setPlatforms(prev => prev.filter(p => p.id !== id))
    setConfirmDeleteId(null)
  }

  function PlatformFormComp({
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
              placeholder="Platform name"
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
          Platforms
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
            + Add Platform
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
          <PlatformFormComp
            form={addForm}
            onChange={setAddForm}
            onSubmit={handleAdd}
            onCancel={() => { setShowAdd(false); setError('') }}
            submitLabel="Add Platform"
          />
        )}

        {platforms.length === 0 && !showAdd ? (
          <p style={{ padding: 'var(--sp-3xl)', textAlign: 'center', fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>
            No platforms yet.
          </p>
        ) : (
          platforms.map(p =>
            editingId === p.id ? (
              <PlatformFormComp
                key={p.id}
                form={editForm}
                onChange={setEditForm}
                onSubmit={() => handleSave(p.id)}
                onCancel={() => { setEditingId(null); setError('') }}
                submitLabel="Save"
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
                  Delete <strong>{p.name}</strong>? All todo associations will also be removed.
                </span>
                <button
                  onClick={() => handleDelete(p.id)}
                  disabled={saving}
                  style={{ ...dangerConfirmBtnStyle, opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? 'Deleting…' : 'Confirm'}
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  style={cancelBtnStyle}
                >
                  Cancel
                </button>
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
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text)' }}>{p.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>sort: {p.sort_order}</p>
                </div>
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
