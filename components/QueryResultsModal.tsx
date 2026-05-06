'use client'

import { useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { OrbResponse } from '@/app/actions/orb-converse'
import type { Todo, Product, Priority } from './TodoView'

type ResultItem = NonNullable<OrbResponse['results']>[number]

const PRIORITY_DOT: Record<number, string> = {
  1: '#a05010',
  2: '#5a3090',
  3: 'var(--muted)',
  4: 'var(--muted)',
}

const STATUS_COLOR: Record<string, string> = {
  open:        'var(--status-open)',
  in_progress: 'var(--status-in-progress)',
  on_hold:     'var(--status-on-hold)',
  done:        'var(--status-done)',
}

function InlineTodoEditor({
  todo, priorities, onSave, onDelete, onCancel
}: {
  todo: Todo
  priorities: Priority[]
  onSave: (updated: Todo) => void
  onDelete: (id: string) => void
  onCancel: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [form, setForm] = useState({ ...todo })
  const [urlInput, setUrlInput] = useState((todo.urls ?? []).join('\\n'))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isDone = form.status === 'done'

  async function handleSave() {
    setSaving(true)
    const urls = urlInput.split('\\n').map(u => u.trim()).filter(Boolean)
    const { data } = await supabase
      .from('todos')
      .update({
        title: form.title,
        status: form.status,
        priority_value: form.priority_value,
        description: form.description || null,
        resolution_notes: form.resolution_notes || null,
        urls,
        closed_at: form.status === 'done' ? (todo.closed_at ?? new Date().toISOString()) : null,
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

  const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '5px' }
  const label: React.CSSProperties = { fontSize: 'var(--fs-xs)', fontWeight: 500, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }
  const input: React.CSSProperties = { fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-base)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '8px 12px', color: 'var(--text)', outline: 'none' }
  const textarea: React.CSSProperties = { ...input, resize: 'vertical', minHeight: '60px' }

  return (
    <div style={{ padding: 'var(--sp-xl)', background: 'var(--bg2)', borderTop: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
      <div style={field}>
        <label style={label}>Title</label>
        <input style={input} value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-md)' }}>
        <div style={field}>
          <label style={label}>Status</label>
          <select style={input} value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value as Todo['status']}))}>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="on_hold">On Hold</option>
            <option value="done">Done</option>
          </select>
        </div>
        <div style={field}>
          <label style={label}>Priority</label>
          <select style={input} value={form.priority_value ?? ''} onChange={e => setForm(f => ({...f, priority_value: e.target.value ? Number(e.target.value) : null}))}>
            <option value="">None</option>
            {priorities.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div style={field}>
        <label style={label}>Description</label>
        <textarea style={textarea} value={form.description ?? ''} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
      </div>

      {isDone && (
        <div style={field}>
          <label style={label}>Resolution Notes</label>
          <textarea style={textarea} value={form.resolution_notes ?? ''} placeholder="What was done to resolve this…" onChange={e => setForm(f => ({...f, resolution_notes: e.target.value}))} />
        </div>
      )}

      <div style={field}>
        <label style={label}>URLs (one per line)</label>
        <textarea style={{...textarea, fontFamily: 'monospace', fontSize: 'var(--fs-sm)'}} value={urlInput} onChange={e => setUrlInput(e.target.value)} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--sp-md)' }}>
        {confirmDelete ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--error)' }}>Are you sure?</span>
            <button onClick={handleDelete} disabled={deleting} style={{ fontSize: 'var(--fs-xs)', background: 'var(--error)', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}>{deleting ? 'Deleting...' : 'Yes, Delete'}</button>
            <button onClick={() => setConfirmDelete(false)} style={{ fontSize: 'var(--fs-xs)', background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} style={{ fontSize: 'var(--fs-xs)', background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>Delete</button>
        )}

        <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
          <button onClick={onCancel} style={{ fontSize: 'var(--fs-sm)', background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '6px 12px' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ fontSize: 'var(--fs-sm)', background: 'var(--pill-active-bg)', border: '1px solid var(--pill-active-border)', color: 'var(--pill-active-color)', borderRadius: 'var(--r)', padding: '6px 16px', cursor: 'pointer' }}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

export default function QueryResultsModal({
  results,
  queryLabel,
  onClose,
}: {
  results: ResultItem[]
  queryLabel: string
  onClose: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [copied, setCopied] = useState(false)
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [items, setItems] = useState<ResultItem[]>(results)

  const handleCopy = useCallback(() => {
    const text = items.map(it => `${it.code} ${it.title}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }, [items])

  async function openTodo(item: ResultItem) {
    const [todoRes, prodRes, priRes] = await Promise.all([
      supabase.from('todos').select('*').eq('id', item.id).single(),
      supabase.from('projects').select('id, name, color, code').order('sort_order'),
      supabase.from('priorities').select('value, label').order('value'),
    ])
    if (todoRes.data) {
      setProducts((prodRes.data ?? []).map((p: { id: string; name: string; color: string | null; code: string | null }) => ({ ...p, icon: null })))
      setPriorities(priRes.data ?? [])
      setSelectedTodo(todoRes.data as Todo)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.25)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Query results"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 50,
          width: '100%',
          maxWidth: '480px',
          maxHeight: '70dvh',
          background: 'var(--bg2)',
          borderRadius: 'var(--r-xl)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-md)',
          padding: 'var(--sp-lg) var(--sp-xl)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <p style={{
            flex: 1,
            margin: 0,
            fontSize: 'var(--fs-sm)',
            color: 'var(--text3)',
            fontFamily: 'var(--font-ui)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {queryLabel}
          </p>
          <button
            onClick={handleCopy}
            aria-label="Copy list"
            title="Copy list"
            style={{
              background: 'none',
              border: 'none',
              color: copied ? 'var(--success)' : 'var(--muted)',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1,
              flexShrink: 0,
              transition: 'color var(--transition)',
            }}
          >
            {copied ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            )}
          </button>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {items.length === 0 ? (
            <p style={{ padding: 'var(--sp-2xl)', textAlign: 'center', fontSize: 'var(--fs-sm)', color: 'var(--muted)', margin: 0 }}>
              No results
            </p>
          ) : (
            items.map((item, i) => (
              <div key={item.id} style={{ display: 'flex', flexDirection: 'column', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <button
                  onClick={() => selectedTodo?.id === item.id ? setSelectedTodo(null) : openTodo(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-md)',
                    width: '100%',
                    padding: 'var(--sp-md) var(--sp-xl)',
                    background: selectedTodo?.id === item.id ? 'var(--bg3)' : 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background var(--transition)',
                  }}
                  onMouseEnter={e => { if (selectedTodo?.id !== item.id) e.currentTarget.style.background = 'var(--bg3, var(--bg))' }}
                  onMouseLeave={e => { if (selectedTodo?.id !== item.id) e.currentTarget.style.background = 'none' }}
                >
                  {/* Priority dot */}
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: item.priority_value ? PRIORITY_DOT[item.priority_value] ?? 'var(--muted)' : 'var(--border)',
                    flexShrink: 0,
                  }} />

                  {/* Code */}
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: 'var(--fs-xs)',
                    color: 'var(--muted)',
                    flexShrink: 0,
                    minWidth: '64px',
                  }}>
                    {item.code}
                  </span>

                  {/* Title */}
                  <span style={{
                    flex: 1,
                    fontSize: 'var(--fs-sm)',
                    color: 'var(--text)',
                    fontFamily: 'var(--font-ui)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {item.title}
                  </span>

                  {/* Status */}
                  <span style={{
                    fontSize: 'var(--fs-xs)',
                    color: STATUS_COLOR[item.status] ?? 'var(--muted)',
                    flexShrink: 0,
                    textTransform: 'capitalize',
                  }}>
                    {item.status.replace('_', ' ')}
                  </span>
                </button>
                {selectedTodo?.id === item.id && (
                  <InlineTodoEditor
                    todo={selectedTodo}
                    priorities={priorities}
                    onSave={updated => {
                      setSelectedTodo(null)
                      setItems(prev => prev.map(it => it.id === updated.id ? { ...it, title: updated.title, status: updated.status, priority_value: updated.priority_value } : it))
                    }}
                    onDelete={id => {
                      setSelectedTodo(null)
                      setItems(prev => prev.filter(it => it.id !== id))
                    }}
                    onCancel={() => setSelectedTodo(null)}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Inline Editor removes need for TodoPanel */}
    </>
  )
}
