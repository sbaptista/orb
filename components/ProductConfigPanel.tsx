'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

type Platform = { id: string; name: string; sort_order: number }
type Form     = { name: string; sort_order: string }

const EMPTY: Form = { name: '', sort_order: '0' }

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r)',
  padding: '8px var(--sp-md)',
  fontSize: 'var(--fs-sm)',
  background: 'var(--bg)',
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color var(--transition)',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--fs-xs)',
  fontWeight: 'var(--fw-medium)',
  color: 'var(--text3)',
  marginBottom: 'var(--sp-xs)',
}

function RowForm({ nameLabel, namePlaceholder, form, onChange, onSubmit, onCancel, submitLabel, saving }: {
  nameLabel: string
  namePlaceholder: string
  form: Form
  onChange: (f: Form) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
  saving: boolean
}) {
  return (
    <div style={{
      padding: 'var(--sp-md) var(--sp-lg)',
      background: 'var(--bg3)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 'var(--sp-md)', marginBottom: 'var(--sp-md)' }}>
        <div>
          <label style={labelStyle}>{nameLabel} *</label>
          <input
            style={inputStyle}
            value={form.name}
            onChange={e => onChange({ ...form, name: e.target.value })}
            autoFocus
            placeholder={namePlaceholder}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
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
          style={{
            background: 'var(--success)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--r)',
            padding: '7px var(--sp-md)',
            fontSize: 'var(--fs-sm)',
            fontWeight: 'var(--fw-medium)',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
        <button
          onClick={onCancel}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 'var(--fs-sm)',
            color: 'var(--text3)',
            cursor: 'pointer',
            padding: '7px var(--sp-sm)',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function PlatformsSection({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const toast = useToast()
  const [platforms, setPlatforms]         = useState<Platform[]>([])
  const [loading, setLoading]             = useState(true)
  const [editingId, setEditingId]         = useState<string | null>(null)
  const [editForm, setEditForm]           = useState<Form>(EMPTY)
  const [showAdd, setShowAdd]             = useState(false)
  const [addForm, setAddForm]             = useState<Form>(EMPTY)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('platforms').select('*').order('sort_order')
      setPlatforms(data ?? [])
      setLoading(false)
    }
    load()
  }, [supabase])

  async function handleAdd() {
    if (!addForm.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    const { data, error: err } = await supabase.from('platforms')
      .insert({ name: addForm.name.trim(), sort_order: Number(addForm.sort_order) || 0 })
      .select().single()
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) { toast.success('Platform added.'); setPlatforms(prev => [...prev, data as Platform]) }
    setShowAdd(false); setAddForm(EMPTY)
  }

  async function handleSave(id: string) {
    if (!editForm.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    const { data, error: err } = await supabase.from('platforms')
      .update({ name: editForm.name.trim(), sort_order: Number(editForm.sort_order) || 0 })
      .eq('id', id).select().single()
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) { toast.success('Platform saved.'); setPlatforms(prev => prev.map(p => p.id === id ? data as Platform : p)) }
    setEditingId(null)
  }

  async function handleDelete(id: string) {
    setSaving(true)
    await supabase.from('todo_platforms').delete().eq('platform_id', id)
    await supabase.from('platforms').delete().eq('id', id)
    setSaving(false)
    toast.success('Platform deleted.')
    setPlatforms(prev => prev.filter(p => p.id !== id))
    setConfirmDeleteId(null)
  }

  if (loading) return <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', padding: 'var(--sp-lg)' }}>Loading…</p>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--sp-md) var(--sp-lg)', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--text2)' }}>Platforms</span>
        {!showAdd && (
          <button
            onClick={() => { setShowAdd(true); setEditingId(null); setAddForm(EMPTY); setError('') }}
            style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '4px var(--sp-sm)', background: 'none', cursor: 'pointer' }}
          >
            + Add
          </button>
        )}
      </div>

      {error && <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--error)', padding: 'var(--sp-sm) var(--sp-lg)' }}>{error}</p>}

      {showAdd && <RowForm nameLabel="Name" namePlaceholder="Platform name" form={addForm} onChange={setAddForm} onSubmit={handleAdd} onCancel={() => { setShowAdd(false); setError('') }} submitLabel="Add Platform" saving={saving} />}

      {platforms.length === 0 && !showAdd ? (
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', padding: 'var(--sp-lg)' }}>No platforms yet.</p>
      ) : (
        <div>
          {platforms.map(p => editingId === p.id ? (
            <RowForm key={p.id} nameLabel="Name" namePlaceholder="Platform name" form={editForm} onChange={setEditForm} onSubmit={() => handleSave(p.id)} onCancel={() => { setEditingId(null); setError('') }} submitLabel="Save" saving={saving} />
          ) : confirmDeleteId === p.id ? (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)', padding: 'var(--sp-md) var(--sp-lg)', borderBottom: '1px solid var(--border)', background: 'rgba(139,32,32,0.05)' }}>
              <span style={{ fontSize: 'var(--fs-sm)', flex: 1, color: 'var(--text)' }}>
                Delete <strong>{p.name}</strong>? All todo associations will also be removed.
              </span>
              <button onClick={() => handleDelete(p.id)} disabled={saving} style={{ fontSize: 'var(--fs-sm)', color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'var(--fw-medium)' }}>{saving ? 'Deleting…' : 'Confirm'}</button>
              <button onClick={() => setConfirmDeleteId(null)} style={{ fontSize: 'var(--fs-sm)', color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
            </div>
          ) : (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)', padding: '10px var(--sp-lg)', borderBottom: '1px solid var(--border)' }}>
              <span style={{ flex: 1, fontSize: 'var(--fs-sm)', color: 'var(--text)' }}>{p.name}</span>
              <button onClick={() => { setEditingId(p.id); setEditForm({ name: p.name, sort_order: String(p.sort_order) }); setShowAdd(false); setConfirmDeleteId(null); setError('') }} style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>Edit</button>
              <button onClick={() => { setConfirmDeleteId(p.id); setEditingId(null) }} style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProductConfigPanel({ productId, productName, productIcon, onClose }: {
  productId: string
  productName: string
  productIcon: string | null
  onClose: () => void
}) {
  const supabase = useMemo(() => createClient(), [])

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(42, 51, 42, 0.25)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed',
        insetBlock: 0,
        right: 0,
        zIndex: 50,
        width: '100%',
        maxWidth: '480px',
        background: 'var(--bg2)',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-md)',
          padding: 'var(--sp-lg) var(--sp-xl)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '20px' }}>{productIcon ?? '📦'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{productName}</p>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', margin: 0 }}>Product configuration</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px', lineHeight: 1 }}
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <PlatformsSection supabase={supabase} />
        </div>
      </div>
    </>
  )
}
