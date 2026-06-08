'use client'

import { useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { visibleProjectsQuery } from '@/lib/projects'
import type { Todo, Product, Priority, StatusDef } from './TodoView'

type ResultItem = { id: string; code: string; title: string; status: string; priority_value: number | null }

const PRIORITY_DOT: Record<number, string> = {
  1: '#a05010',
  2: '#5a3090',
  3: 'var(--muted)',
  4: 'var(--muted)',
}

function statusColor(status: string) {
  return `var(--status-${status.replace(/\s+/g, '-')})`
}

function InlineTodoEditor({
  todo, priorities, statuses, onSave, onDelete, onCancel
}: {
  todo: Todo
  priorities: Priority[]
  statuses: StatusDef[]
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

  const isDone = statuses.find(s => s.name === form.status)?.is_closed ?? false

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
        due_at: form.due_at || null,
        reminded_at: form.due_at !== todo.due_at ? null : todo.reminded_at,
        closed_at: isDone ? (todo.closed_at ?? new Date().toISOString()) : null,
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
    <div className="qr-editor">
      <div className="pf-field">
        <label className="pf-label">Title</label>
        <input className="pf-input" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} />
      </div>

      <div className="grid-2col">
        <div className="pf-field">
          <label className="pf-label">Status</label>
          <select className="pf-select" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
            {statuses.map(s => (
              <option key={s.id} value={s.name}>{s.name.charAt(0).toUpperCase() + s.name.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="pf-field">
          <label className="pf-label">Priority</label>
          <select className="pf-select" value={form.priority_value ?? ''} onChange={e => setForm(f => ({...f, priority_value: e.target.value ? Number(e.target.value) : null}))}>
            <option value="">None</option>
            {priorities.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div className="pf-field">
        <label className="pf-label">Due Date</label>
        <input
          type="datetime-local"
          className="pf-input"
          value={form.due_at ?? ''}
          onChange={e => setForm(f => ({ ...f, due_at: e.target.value || null }))}
        />
      </div>

      <div className="pf-field">
        <label className="pf-label">Description</label>
        <textarea className="pf-textarea" value={form.description ?? ''} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
      </div>

      {isDone && (
        <div className="pf-field">
          <label className="pf-label">Resolution Notes</label>
          <textarea className="pf-textarea" value={form.resolution_notes ?? ''} placeholder="What was done to resolve this…" onChange={e => setForm(f => ({...f, resolution_notes: e.target.value}))} />
        </div>
      )}

      <div className="pf-field">
        <label className="pf-label">URLs (one per line)</label>
        <textarea className="pf-textarea" style={{ fontFamily: 'monospace', fontSize: 'var(--fs-sm)', minHeight: '60px' }} value={urlInput} onChange={e => setUrlInput(e.target.value)} />
      </div>

      <div className="qr-editor-footer">
        {confirmDelete ? (
          <div className="flex-row flex-center" style={{ gap: 'var(--sp-sm)' }}>
            <span className="text-xs text-error">Are you sure?</span>
            <button className="tv-bulk-confirm" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Yes, Delete'}</button>
            <button className="text-btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        ) : (
          <button className="text-btn" onClick={() => setConfirmDelete(true)}>Delete</button>
        )}

        <div className="flex-row" style={{ gap: 'var(--sp-sm)' }}>
          <button className="text-btn" onClick={onCancel}>Cancel</button>
          <button className="save-btn" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

export default function QueryResultsModal({
  results,
  queryLabel,
  onClose,
  fullText,
}: {
  results: ResultItem[]
  queryLabel: string
  onClose: () => void
  fullText?: string
}) {
  const supabase = useMemo(() => createClient(), [])
  const [copied, setCopied] = useState(false)
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [statusDefs, setStatusDefs] = useState<StatusDef[]>([])
  const [items, setItems] = useState<ResultItem[]>(results)

  const handleCopy = useCallback(() => {
    const text = items.map(it => `${it.code} ${it.title}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }, [items])

  async function openTodo(item: ResultItem) {
    const [todoRes, prodRes, priRes, statRes] = await Promise.all([
      supabase.from('todos').select('*').eq('id', item.id).single(),
      visibleProjectsQuery(supabase, 'id, name, color, code'),
      supabase.from('priorities').select('value, label').order('value'),
      supabase.from('statuses').select('id, name, sort_order, is_closed, is_open').order('sort_order'),
    ])
    if (todoRes.data) {
      setProducts((prodRes.data ?? []).map((p: { id: string; name: string; color: string | null; code: string | null }) => ({ ...p, icon: null })))
      setPriorities(priRes.data ?? [])
      setStatusDefs(statRes.data ?? [])
      setSelectedTodo(todoRes.data as Todo)
    }
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />

      <div role="dialog" aria-modal="true" aria-label="Query results" className="modal-center">
        {/* Header */}
        <div className="modal-header">
          <p className="qr-label">{queryLabel}</p>
          <button
            onClick={handleCopy}
            aria-label="Copy list"
            title="Copy list"
            className="qr-copy-btn"
            style={{ color: copied ? 'var(--success)' : undefined }}
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
          <button onClick={onClose} aria-label="Close" className="close-btn">
            <svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Content */}
        <div className="modal-body">
          {fullText ? (
            <div className="qr-fulltext">{fullText}</div>
          ) : items.length === 0 ? (
            <p className="qr-empty">No results</p>
          ) : (
            items.map((item, i) => (
              <div key={item.id} style={{ display: 'flex', flexDirection: 'column', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <button
                  onClick={() => selectedTodo?.id === item.id ? setSelectedTodo(null) : openTodo(item)}
                  className="qr-row"
                  aria-expanded={selectedTodo?.id === item.id}
                >
                  <span className="tv-priority-dot" style={{ background: item.priority_value ? PRIORITY_DOT[item.priority_value] ?? 'var(--muted)' : 'var(--border)' }} />
                  <span className="qr-code">{item.code}</span>
                  <span className="qr-title">{item.title}</span>
                  <span className="qr-status" style={{ color: statusColor(item.status) }}>
                    {item.status.replace('_', ' ')}
                  </span>
                </button>
                {selectedTodo?.id === item.id && selectedTodo && (
                  <InlineTodoEditor
                    todo={selectedTodo}
                    priorities={priorities}
                    statuses={statusDefs}
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
    </>
  )
}
