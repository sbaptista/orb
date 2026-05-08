'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import { useToast } from '@/components/ui/Toast'

type Status = { id: string; name: string; sort_order: number; is_closed: boolean }
type StatusForm = { name: string; is_closed: boolean }

const EMPTY_FORM: StatusForm = { name: '', is_closed: false }

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
  fontSize: 'var(--fs-sm)',
  color: 'var(--muted)',
  cursor: 'pointer',
  padding: '4px var(--sp-sm)',
  flexShrink: 0,
  transition: 'all var(--transition)',
}

const moveBtnStyle = (disabled: boolean): React.CSSProperties => ({
  ...rowActionBtnStyle,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4px',
  color: disabled ? 'var(--border)' : 'var(--text3)',
  cursor: disabled ? 'default' : 'pointer',
})

const ArrowUp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m18 15-6-6-6 6"/>
  </svg>
)

const ArrowDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
)

const dangerConfirmBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 'var(--fs-sm)',
  color: 'var(--error)',
  fontWeight: 'var(--fw-medium)',
  cursor: 'pointer',
  padding: '8px var(--sp-md)',
}

export default function SettingsStatuses() {
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const [statuses, setStatuses] = useState<Status[]>([])
  const [todoCounts, setTodoCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<StatusForm>(EMPTY_FORM)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<StatusForm>(EMPTY_FORM)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [statusRes, todoRes] = await Promise.all([
      supabase.from('statuses').select('*').order('sort_order'),
      supabase.from('todos').select('status'),
    ])
    setStatuses(statusRes.data ?? [])
    
    // Count todos per status name
    const counts: Record<string, number> = {}
    todoRes.data?.forEach(t => {
      if (t.status) {
        counts[t.status] = (counts[t.status] || 0) + 1
      }
    })
    
    const idCounts: Record<string, number> = {}
    statusRes.data?.forEach(s => {
      idCounts[s.id] = counts[s.name] || 0
    })
    setTodoCounts(idCounts)
    setLoading(false)
  }, [supabase])

  useVisibilityRefetch(load)
  useEffect(() => { load() }, [load])

  function startAdd() {
    setShowAdd(true)
    setEditingId(null)
    setConfirmDeleteId(null)
    setAddForm({ name: '', is_closed: false })
    setError('')
  }

  function startEdit(s: Status) {
    setEditingId(s.id)
    setEditForm({ name: s.name, is_closed: s.is_closed })
    setShowAdd(false)
    setConfirmDeleteId(null)
    setError('')
  }

  async function handleAdd() {
    const name = addForm.name.trim().toLowerCase()
    if (!name) { setError('Name is required'); return }
    if (statuses.some(s => s.name.toLowerCase() === name)) {
      setError('A status with this name already exists'); return
    }

    setSaving(true)
    setError('')
    const { data, error: err } = await supabase
      .from('statuses')
      .insert({
        name,
        is_closed: addForm.is_closed,
        sort_order: statuses.length + 1,
      })
      .select()
      .single()
    
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) { toast.success('Status added.'); setStatuses(prev => [...prev, data as Status]) }
    setShowAdd(false)
    setAddForm(EMPTY_FORM)
  }

  async function handleSave(id: string) {
    const name = editForm.name.trim().toLowerCase()
    if (!name) { setError('Name is required'); return }
    if (statuses.some(s => s.id !== id && s.name.toLowerCase() === name)) {
      setError('A status with this name already exists'); return
    }

    setSaving(true)
    setError('')
    const { data, error: err } = await supabase
      .from('statuses')
      .update({ name, is_closed: editForm.is_closed })
      .eq('id', id)
      .select()
      .single()
    
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) { toast.success('Status saved.'); setStatuses(prev => prev.map(s => s.id === id ? data as Status : s)) }
    setEditingId(null)
  }

  async function handleDelete(id: string) {
    const target = statuses.find(s => s.id === id)
    if (!target) return

    setSaving(true)
    const { error: err } = await supabase.from('statuses').delete().eq('id', id)
    if (err) { setError(err.message); setSaving(false); return }

    const higher = statuses.filter(s => s.sort_order > target.sort_order)
    if (higher.length > 0) {
      await Promise.all(higher.map(s => 
        supabase.from('statuses')
          .update({ sort_order: s.sort_order - 1 })
          .eq('id', s.id)
      ))
    }

    setSaving(false)
    toast.success('Status deleted.')
    setConfirmDeleteId(null)
    load()
  }

  async function handleMove(id: string, direction: 'up' | 'down') {
    const idx = statuses.findIndex(s => s.id === id)
    if (idx === -1) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === statuses.length - 1) return

    const otherIdx = direction === 'up' ? idx - 1 : idx + 1
    const s1 = statuses[idx]
    const s2 = statuses[otherIdx]

    setSaving(true)
    setError('')

    try {
      // Step 1: Use a temporary sort order for s1 to avoid unique constraint collision
      const tempOrder = -999
      const { error: err1 } = await supabase.from('statuses').update({ sort_order: tempOrder }).eq('id', s1.id)
      if (err1) throw err1

      // Step 2: Set s2 to s1's original order
      const { error: err2 } = await supabase.from('statuses').update({ sort_order: s1.sort_order }).eq('id', s2.id)
      if (err2) {
        await supabase.from('statuses').update({ sort_order: s1.sort_order }).eq('id', s1.id)
        throw err2
      }

      // Step 3: Set s1 to s2's original order
      const { error: err3 } = await supabase.from('statuses').update({ sort_order: s2.sort_order }).eq('id', s1.id)
      if (err3) throw err3

      load()
    } catch (err: any) {
      setError(`Failed to move: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div style={{ padding: 'var(--sp-3xl)', fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>
      Loading…
    </div>
  )

  return (
    <div style={{ padding: 'var(--sp-2xl)', maxWidth: '600px', fontFamily: 'var(--font-ui)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-xl)' }}>
        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text)', margin: 0 }}>
          Statuses
        </h2>
        {!showAdd && (
          <button onClick={startAdd} style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r)',
            padding: '7px var(--sp-md)', fontSize: 'var(--fs-sm)', color: 'var(--text2)', cursor: 'pointer',
          }}>
            + Add Status
          </button>
        )}
      </div>

      {error && (
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--error)', margin: '0 0 var(--sp-md)' }}>
          {error}
        </p>
      )}

      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        {showAdd && (
          <div key="add-form" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: 'var(--sp-lg) var(--sp-xl)' }}>
            <div style={{ marginBottom: 'var(--sp-md)' }}>
              <label style={labelStyle}>Name *</label>
              <input
                style={inputStyle}
                value={addForm.name}
                onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                autoFocus
                placeholder="Status name (e.g. open, in_progress)"
              />
            </div>
            <div style={{ marginBottom: 'var(--sp-md)', display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
              <input
                type="checkbox"
                id="add-is-closed"
                checked={addForm.is_closed}
                onChange={e => setAddForm({ ...addForm, is_closed: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="add-is-closed" style={{ ...labelStyle, marginBottom: 0, cursor: 'pointer' }}>
                Is Closed (Todo is finished)
              </label>
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
              <button onClick={handleAdd} disabled={saving} style={primaryBtnStyle(saving)}>
                {saving ? 'Adding…' : 'Add Status'}
              </button>
              <button onClick={() => setShowAdd(false)} style={cancelBtnStyle}>Cancel</button>
            </div>
          </div>
        )}

        {statuses.map((s, idx) => (
          editingId === s.id ? (
            <div key={`status-edit-${s.id}`} style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: 'var(--sp-lg) var(--sp-xl)' }}>
              <div style={{ marginBottom: 'var(--sp-md)' }}>
                <label style={labelStyle}>Name *</label>
                <input
                  style={inputStyle}
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: 'var(--sp-md)', display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
                <input
                  type="checkbox"
                  id={`edit-is-closed-${s.id}`}
                  checked={editForm.is_closed}
                  onChange={e => setEditForm({ ...editForm, is_closed: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor={`edit-is-closed-${s.id}`} style={{ ...labelStyle, marginBottom: 0, cursor: 'pointer' }}>
                  Is Closed (Todo is finished)
                </label>
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
                <button onClick={() => handleSave(s.id)} disabled={saving} style={primaryBtnStyle(saving)}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditingId(null)} style={cancelBtnStyle}>Cancel</button>
              </div>
            </div>
          ) : confirmDeleteId === s.id ? (
            <div key={`status-del-${s.id}`} style={{ background: 'rgba(139, 32, 32, 0.05)', padding: '10px var(--sp-xl)', display: 'flex', alignItems: 'center', gap: 'var(--sp-md)', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 'var(--fs-sm)', flex: 1 }}>
                Delete <strong>{s.name}</strong>?
                {(todoCounts[s.id] ?? 0) > 0 && (
                  <span style={{ color: 'var(--muted)', marginLeft: 'var(--sp-xs)' }}>
                    Cannot delete — {todoCounts[s.id]} todos use this status.
                  </span>
                )}
              </span>
              {(todoCounts[s.id] ?? 0) === 0 ? (
                <>
                  <button onClick={() => handleDelete(s.id)} disabled={saving} style={dangerConfirmBtnStyle}>Confirm</button>
                  <button onClick={() => setConfirmDeleteId(null)} style={cancelBtnStyle}>Cancel</button>
                </>
              ) : (
                <button onClick={() => setConfirmDeleteId(null)} style={cancelBtnStyle}>OK</button>
              )}
            </div>
          ) : (
            <div
              key={`status-row-${s.id}`}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)', padding: '10px var(--sp-xl)', borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <div style={{ width: '24px', fontSize: 'var(--fs-xs)', color: 'var(--muted)', fontWeight: 600 }}>
                {s.sort_order}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
                  <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text)', fontWeight: 500 }}>{s.name}</p>
                  {s.is_closed && (
                    <span style={{ fontSize: '10px', background: 'var(--bg3)', color: 'var(--text3)', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Closed
                    </span>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', flexShrink: 0 }}>
                {todoCounts[s.id] ?? 0} todos
              </span>
              
              <div style={{ display: 'flex', gap: '2px', marginRight: 'var(--sp-md)' }}>
                <button 
                  onClick={() => handleMove(s.id, 'up')} 
                  disabled={idx === 0 || saving}
                  style={moveBtnStyle(idx === 0 || saving)}
                  onMouseEnter={e => idx > 0 && !saving && (e.currentTarget.style.color = 'var(--success)')}
                  onMouseLeave={e => idx > 0 && !saving && (e.currentTarget.style.color = 'var(--text3)')}
                  title="Move Up"
                >
                  <ArrowUp />
                </button>
                <button 
                  onClick={() => handleMove(s.id, 'down')} 
                  disabled={idx === statuses.length - 1 || saving}
                  style={moveBtnStyle(idx === statuses.length - 1 || saving)}
                  onMouseEnter={e => idx < statuses.length - 1 && !saving && (e.currentTarget.style.color = 'var(--success)')}
                  onMouseLeave={e => idx < statuses.length - 1 && !saving && (e.currentTarget.style.color = 'var(--text3)')}
                  title="Move Down"
                >
                  <ArrowDown />
                </button>
              </div>

              <button onClick={() => startEdit(s)} style={rowActionBtnStyle}>Edit</button>
              <button
                onClick={() => { setConfirmDeleteId(s.id); setEditingId(null) }}
                style={rowActionBtnStyle}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--error)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
              >
                Delete
              </button>
            </div>
          )
        ))}
      </div>
    </div>
  )
}
