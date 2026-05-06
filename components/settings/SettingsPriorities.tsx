'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import { useToast } from '@/components/ui/Toast'

type Priority = { label: string; value: number }
type PrioForm = { label: string; value: string }

const EMPTY_FORM: PrioForm = { label: '', value: '' }

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

export default function SettingsPriorities() {
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [todoCounts, setTodoCounts] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [editingValue, setEditingValue] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<PrioForm>(EMPTY_FORM)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<PrioForm>(EMPTY_FORM)
  const [confirmDeleteValue, setConfirmDeleteValue] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [prioRes, todoRes] = await Promise.all([
      supabase.from('priorities').select('*').order('value'),
      supabase.from('todos').select('priority_value'),
    ])
    setPriorities(prioRes.data ?? [])
    
    // Count todos per priority value
    const counts: Record<number, number> = {}
    todoRes.data?.forEach(t => {
      if (t.priority_value !== null) {
        counts[t.priority_value] = (counts[t.priority_value] || 0) + 1
      }
    })
    setTodoCounts(counts)
    setLoading(false)
  }, [supabase])

  useVisibilityRefetch(load)
  useEffect(() => { load() }, [load])

  function startAdd() {
    setShowAdd(true)
    setEditingValue(null)
    setConfirmDeleteValue(null)
    setAddForm({ label: '', value: String(priorities.length + 1) })
    setError('')
  }

  function startEdit(p: Priority) {
    setEditingValue(p.value)
    setEditForm({ label: p.label, value: String(p.value) })
    setShowAdd(false)
    setConfirmDeleteValue(null)
    setError('')
  }

  async function handleAdd() {
    const label = addForm.label.trim()
    if (!label) { setError('Label is required'); return }
    if (priorities.some(p => p.label.toLowerCase() === label.toLowerCase())) {
      setError('A priority with this label already exists'); return
    }

    setSaving(true)
    setError('')
    const { data, error: err } = await supabase
      .from('priorities')
      .insert({
        label,
        value: priorities.length + 1,
      })
      .select()
      .single()
    
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) { toast.success('Priority added.'); setPriorities(prev => [...prev, data as Priority]) }
    setShowAdd(false)
    setAddForm(EMPTY_FORM)
  }

  async function handleSave(value: number) {
    const label = editForm.label.trim()
    if (!label) { setError('Label is required'); return }
    if (priorities.some(p => p.value !== value && p.label.toLowerCase() === label.toLowerCase())) {
      setError('A priority with this label already exists'); return
    }

    setSaving(true)
    setError('')
    const { data, error: err } = await supabase
      .from('priorities')
      .update({ label })
      .eq('value', value)
      .select()
      .single()
    
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) { toast.success('Priority saved.'); setPriorities(prev => prev.map(p => p.value === value ? data as Priority : p)) }
    setEditingValue(null)
  }

  async function handleDelete(value: number) {
    setSaving(true)
    const { error: err } = await supabase.from('priorities').delete().eq('value', value)
    if (err) { setError(err.message); setSaving(false); return }

    // Shift higher ones down using the RPC logic (simplified here)
    const higher = priorities.filter(p => p.value > value)
    if (higher.length > 0) {
      await Promise.all(higher.map(p => 
        supabase.from('priorities')
          .update({ value: p.value - 1 })
          .eq('value', p.value)
      ))
    }
    
    setSaving(false)
    toast.success('Priority deleted.')
    setConfirmDeleteValue(null)
    load()
  }

  async function handleMove(label: string, direction: 'up' | 'down') {
    const idx = priorities.findIndex(p => p.label === label)
    if (idx === -1) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === priorities.length - 1) return

    const newValue = direction === 'up' ? priorities[idx - 1].value : priorities[idx + 1].value

    setSaving(true)
    setError('')

    const { error: rpcErr } = await supabase.rpc('smart_reorder_priorities', {
      p_label: label,
      p_new_value: newValue
    })

    if (rpcErr) {
      setError(`Failed to move: ${rpcErr.message}`)
    } else {
      load()
    }
    setSaving(false)
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
          Priorities
        </h2>
        {!showAdd && (
          <button onClick={startAdd} style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r)',
            padding: '7px var(--sp-md)', fontSize: 'var(--fs-sm)', color: 'var(--text2)', cursor: 'pointer',
          }}>
            + Add Priority
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
            <label style={labelStyle}>Label *</label>
            <div style={{ display: 'flex', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-md)' }}>
              <input
                style={inputStyle}
                value={addForm.label}
                onChange={e => setAddForm({ ...addForm, label: e.target.value })}
                autoFocus
                placeholder="Priority label"
              />
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
              <button onClick={handleAdd} disabled={saving} style={primaryBtnStyle(saving)}>
                {saving ? 'Adding…' : 'Add Priority'}
              </button>
              <button onClick={() => setShowAdd(false)} style={cancelBtnStyle}>Cancel</button>
            </div>
          </div>
        )}

        {priorities.map((p, idx) => (
          editingValue === p.value ? (
            <div key={`prio-edit-${p.value}`} style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: 'var(--sp-lg) var(--sp-xl)' }}>
              <label style={labelStyle}>Label *</label>
              <input
                value={editForm.label}
                onChange={e => setEditForm({ ...editForm, label: e.target.value })}
                autoFocus
                style={{ ...inputStyle, marginBottom: 'var(--sp-md)' }}
              />
              <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
                <button onClick={() => handleSave(p.value)} disabled={saving} style={primaryBtnStyle(saving)}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditingValue(null)} style={cancelBtnStyle}>Cancel</button>
              </div>
            </div>
          ) : confirmDeleteValue === p.value ? (
            <div key={`prio-del-${p.value}`} style={{ background: 'rgba(139, 32, 32, 0.05)', padding: '10px var(--sp-xl)', display: 'flex', alignItems: 'center', gap: 'var(--sp-md)', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 'var(--fs-sm)', flex: 1 }}>
                Delete <strong>{p.label}</strong>?
                {(todoCounts[p.value] ?? 0) > 0 && (
                  <span style={{ color: 'var(--muted)', marginLeft: 'var(--sp-xs)' }}>
                    Cannot delete — {todoCounts[p.value]} todos use this priority.
                  </span>
                )}
              </span>
              {(todoCounts[p.value] ?? 0) === 0 ? (
                <>
                  <button onClick={() => handleDelete(p.value)} disabled={saving} style={dangerConfirmBtnStyle}>Confirm</button>
                  <button onClick={() => setConfirmDeleteValue(null)} style={cancelBtnStyle}>Cancel</button>
                </>
              ) : (
                <button onClick={() => setConfirmDeleteValue(null)} style={cancelBtnStyle}>OK</button>
              )}
            </div>
          ) : (
            <div
              key={`prio-row-${p.value}`}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)', padding: '10px var(--sp-xl)', borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <div style={{ width: '24px', fontSize: 'var(--fs-xs)', color: 'var(--muted)', fontWeight: 600 }}>
                {p.value}
              </div>
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.label}</p>
              </div>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                {todoCounts[p.value] ?? 0} tasks
              </span>
              
              <div style={{ display: 'flex', gap: '2px', marginRight: 'var(--sp-md)' }}>
                <button 
                  onClick={() => handleMove(p.label, 'up')} 
                  disabled={idx === 0 || saving}
                  style={moveBtnStyle(idx === 0 || saving)}
                  onMouseEnter={e => idx > 0 && !saving && (e.currentTarget.style.color = 'var(--success)')}
                  onMouseLeave={e => idx > 0 && !saving && (e.currentTarget.style.color = 'var(--text3)')}
                  title="Move Up"
                >
                  <ArrowUp />
                </button>
                <button 
                  onClick={() => handleMove(p.label, 'down')} 
                  disabled={idx === priorities.length - 1 || saving}
                  style={moveBtnStyle(idx === priorities.length - 1 || saving)}
                  onMouseEnter={e => idx < priorities.length - 1 && !saving && (e.currentTarget.style.color = 'var(--success)')}
                  onMouseLeave={e => idx < priorities.length - 1 && !saving && (e.currentTarget.style.color = 'var(--text3)')}
                  title="Move Down"
                >
                  <ArrowDown />
                </button>
              </div>

              <button onClick={() => startEdit(p)} style={rowActionBtnStyle}>Edit</button>
              <button
                onClick={() => { setConfirmDeleteValue(p.value); setEditingValue(null) }}
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
