'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { getTickets, createTodoFromTicket, dismissTicket, updateTicket, type Ticket, type TicketType, type TicketStatus } from '@/app/actions/ticket-actions'
import { getAdminProjects } from '@/app/actions/manage-project'
import { useToast } from '@/components/ui/Toast'
import HScrollNav from '@/components/ui/HScrollNav'

type Project = { id: string; name: string; code: string | null }

const TYPE_COLORS: Record<TicketType, string> = {
  bug: '#e53e3e',
  suggestion: '#3182ce',
  capability_gap: '#805ad5',
  workflow_friction: '#dd6b20',
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  open:         { bg: 'var(--bg-hover)',  color: 'var(--muted)' },
  in_progress:  { bg: '#e8f0e8',          color: '#2d5a2d' },
  closed:       { bg: '#edf2f7',          color: '#4a5568' },
  dismissed:    { bg: 'var(--bg-hover)',  color: 'var(--muted)' },
}

function relativeDate(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function reporterName(ticket: Ticket): string {
  const r = ticket.reporter
  if (!r) return '—'
  const full = [r.first_name, r.last_name].filter(Boolean).join(' ')
  return full || r.email
}

function linkedRef(ticket: Ticket): string | null {
  const t = ticket.linked_todo as any
  if (!t) return null
  const code = t.projects?.code
  const num = t.todo_number
  if (!code || num == null) return null
  return `${code}-${num}`
}

export default function SettingsTickets() {
  const toast = useToast()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Per-row UI state
  const [createTodoFor, setCreateTodoFor] = useState<string | null>(null) // ticketId
  const [createForm, setCreateForm] = useState({ projectId: '', title: '' })
  const [creating, setCreating] = useState(false)

  const [dismissFor, setDismissFor] = useState<string | null>(null) // ticketId
  const [dismissReason, setDismissReason] = useState('')
  const [dismissing, setDismissing] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const tableScrollRef = useRef<HTMLDivElement>(null)

  // Edit modal state
  const [editTicket, setEditTicket] = useState<Ticket | null>(null)
  const [editForm, setEditForm] = useState({ summary: '', type: '' as TicketType, status: '' as TicketStatus })
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [ticketsRes, projectsRes] = await Promise.all([
        getTickets(),
        getAdminProjects(),
      ])
      setTickets((ticketsRes.data ?? []) as Ticket[])
      setProjects((projectsRes.projects ?? []) as Project[])
      setLoading(false)
    }
    load()
  }, [])

  const displayed = useMemo(() => {
    if (!search.trim()) return tickets
    const q = search.toLowerCase()
    return tickets.filter(t =>
      t.summary.toLowerCase().includes(q) ||
      t.type.includes(q) ||
      reporterName(t).toLowerCase().includes(q) ||
      t.status.includes(q)
    )
  }, [tickets, search])

  async function handleCreateTodo(ticketId: string) {
    if (!createForm.projectId || !createForm.title.trim()) {
      toast.error('Project and title are required.')
      return
    }
    setCreating(true)
    const res = await createTodoFromTicket(ticketId, {
      projectId: createForm.projectId,
      title: createForm.title.trim(),
    })
    setCreating(false)
    if (res.error) { toast.error(res.error); return }
    toast.success(`Created ${res.data?.ref ?? 'todo'}.`)
    // Refresh tickets to show linked ref
    const refreshed = await getTickets()
    setTickets((refreshed.data ?? []) as Ticket[])
    setCreateTodoFor(null)
    setCreateForm({ projectId: '', title: '' })
  }

  async function handleDismiss(ticketId: string) {
    setDismissing(true)
    const res = await dismissTicket(ticketId, dismissReason.trim() || undefined)
    setDismissing(false)
    if (res.error) { toast.error(res.error); return }
    toast.success('Ticket dismissed.')
    setTickets(prev => prev.map(t =>
      t.id === ticketId ? { ...t, status: 'dismissed', dismiss_reason: dismissReason.trim() || null } : t
    ))
    setDismissFor(null)
    setDismissReason('')
  }

  async function handleBulkDismiss() {
    if (selectedIds.length === 0) return
    const count = selectedIds.length
    if (!confirm(`Dismiss ${count} ticket${count > 1 ? 's' : ''}?`)) return
    setDismissing(true)
    let failed = 0
    for (const id of selectedIds) {
      const res = await dismissTicket(id)
      if (res.error) failed++
    }
    setDismissing(false)
    if (failed > 0) toast.error(`${failed} ticket${failed > 1 ? 's' : ''} failed to dismiss.`)
    else toast.success(`${count} ticket${count > 1 ? 's' : ''} dismissed.`)
    setSelectedIds([])
    // Refresh
    const refreshed = await getTickets()
    setTickets((refreshed.data ?? []) as Ticket[])
  }

  function openEditModal(ticket: Ticket) {
    setEditTicket(ticket)
    setEditForm({ summary: ticket.summary, type: ticket.type, status: ticket.status })
  }

  function closeEditModal() {
    setEditTicket(null)
  }

  async function handleEditSave() {
    if (!editTicket) return
    if (!editForm.summary.trim()) { toast.error('Summary is required.'); return }
    setEditSaving(true)
    const res = await updateTicket(editTicket.id, {
      summary: editForm.summary.trim(),
      type: editForm.type,
      status: editForm.status,
    })
    setEditSaving(false)
    if (res.error) { toast.error(res.error); return }
    toast.success('Ticket updated.')
    setTickets(prev => prev.map(t =>
      t.id === editTicket.id ? { ...t, summary: editForm.summary.trim(), type: editForm.type, status: editForm.status } : t
    ))
    closeEditModal()
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleSelectAll() {
    const actionable = displayed.filter(t => t.status !== 'dismissed' && t.status !== 'closed')
    if (actionable.every(t => selectedIds.includes(t.id))) setSelectedIds([])
    else setSelectedIds(actionable.map(t => t.id))
  }

  const COLS = ['', 'Code', 'Type', 'Summary', 'Reporter', 'Status', 'Linked todo', 'Created', 'Actions']
  const WIDTHS = ['36px', '9%', '11%', '22%', '13%', '11%', '9%', '9%', '8%']

  if (loading) return <div className="s-loading">Loading…</div>

  return (
    <div className="settings-page s-page-wide">
      <div className="s-header">
        <div>
          <h2 className="s-title">Tickets</h2>
          <p className="text-sm text-muted">{displayed.length} ticket{displayed.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter by summary, type, reporter, or status…"
          className="crud-search-input"
        />
      </div>

      {selectedIds.length > 0 && (
        <div className="crud-bulk-bar">
          <span className="text-sm" style={{ fontWeight: 500 }}>
            {selectedIds.length} selected
          </span>
          <button
            className="oc-tool-btn"
            onClick={handleBulkDismiss}
            disabled={dismissing}
            style={{ fontSize: '12px', color: 'var(--error)', borderColor: 'var(--error)' }}
          >
            Dismiss
          </button>
          <button
            className="text-btn text-sm"
            onClick={() => setSelectedIds([])}
            style={{ color: 'var(--muted)' }}
          >
            Cancel
          </button>
        </div>
      )}

      {displayed.length === 0 ? (
        <div className="s-card s-empty">No tickets yet.</div>
      ) : (
        <HScrollNav scrollRef={tableScrollRef as React.RefObject<HTMLElement>} className="crud-table-scroll">
          <div className="s-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div ref={tableScrollRef} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="audit-table">
              <thead>
                <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                  {COLS.map((col, i) => (
                    <th
                      key={col || '__checkbox'}
                      className="audit-th"
                      style={{
                        width: WIDTHS[i],
                        textAlign: col === 'Actions' ? 'right' : col === '' ? 'center' : 'left',
                      }}
                    >
                      {col === '' ? (
                        <input type="checkbox" checked={(() => {
                          const actionable = displayed.filter(t => t.status !== 'dismissed' && t.status !== 'closed')
                          return actionable.length > 0 && actionable.every(t => selectedIds.includes(t.id))
                        })()} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
                      ) : col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map(ticket => {
                  const isCreating = createTodoFor === ticket.id
                  const isDismissing = dismissFor === ticket.id
                  const ref = linkedRef(ticket)
                  const statusStyle = STATUS_STYLES[ticket.status] ?? STATUS_STYLES.open
                  const typeColor = TYPE_COLORS[ticket.type] ?? '#4a5568'
                  const canAct = ticket.status !== 'dismissed' && ticket.status !== 'closed'

                  if (isCreating) {
                    return (
                      <tr key={ticket.id}>
                        <td colSpan={9} className="audit-td">
                          <div className="s-form" style={{ padding: '12px 16px' }}>
                            <p className="text-sm" style={{ marginBottom: '12px', fontWeight: 500 }}>
                              Create todo for: <em>{ticket.summary}</em>
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '12px' }}>
                              <div>
                                <label className="label">Project</label>
                                <select
                                  className="input"
                                  style={{ width: '100%', height: '40px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}
                                  value={createForm.projectId}
                                  onChange={e => setCreateForm(f => ({ ...f, projectId: e.target.value }))}
                                >
                                  <option value="">— Select project</option>
                                  {projects.map(p => (
                                    <option key={p.id} value={p.id}>
                                      {p.code ? `${p.code} — ${p.name}` : p.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="label">Title</label>
                                <input
                                  className="input"
                                  value={createForm.title}
                                  onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                                  placeholder={ticket.summary}
                                />
                              </div>
                            </div>
                            <div className="flex-row gap-sm">
                              <button className="btn-primary" onClick={() => handleCreateTodo(ticket.id)} disabled={creating}>
                                {creating ? 'Creating…' : 'Create todo'}
                              </button>
                              <button className="btn-cancel" onClick={() => { setCreateTodoFor(null); setCreateForm({ projectId: '', title: '' }) }}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  if (isDismissing) {
                    return (
                      <tr key={ticket.id}>
                        <td colSpan={9} className="audit-td">
                          <div className="s-row-delete" style={{ border: 'none', padding: '12px 16px' }}>
                            <span className="text-sm flex-1">
                              Dismiss <strong>{ticket.summary}</strong>?
                            </span>
                            <input
                              className="input"
                              placeholder="Reason (optional)"
                              value={dismissReason}
                              onChange={e => setDismissReason(e.target.value)}
                              style={{ maxWidth: '220px', fontSize: '13px' }}
                            />
                            <button className="btn-danger-confirm" onClick={() => handleDismiss(ticket.id)} disabled={dismissing}>
                              {dismissing ? 'Dismissing…' : 'Confirm'}
                            </button>
                            <button className="btn-cancel" onClick={() => { setDismissFor(null); setDismissReason('') }}>
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={ticket.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                      onClick={e => {
                        const tag = (e.target as HTMLElement).tagName
                        if (['BUTTON', 'A', 'INPUT', 'SELECT', 'SVG', 'PATH'].includes(tag)) return
                        if ((e.target as HTMLElement).closest('button, a, input, select')) return
                        openEditModal(ticket)
                      }}
                    >
                      <td className="audit-td" style={{ textAlign: 'center' }}>
                        {canAct ? (
                          <input type="checkbox" checked={selectedIds.includes(ticket.id)} onChange={() => toggleSelect(ticket.id)} style={{ cursor: 'pointer' }} />
                        ) : null}
                      </td>
                      {/* Code */}
                      <td className="audit-td" style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text2)', fontSize: '12px' }}>
                        TICKETS-{ticket.ticket_number}
                      </td>
                      {/* Type */}
                      <td className="audit-td">
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          background: typeColor,
                          color: '#fff',
                        }}>
                          {ticket.type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      {/* Summary */}
                      <td className="audit-td" style={{ fontWeight: 500, maxWidth: 0 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ticket.summary}
                        </span>
                      </td>
                      {/* Reporter */}
                      <td className="audit-td" style={{ color: 'var(--text)', fontSize: '12px' }}>
                        {reporterName(ticket)}
                      </td>
                      {/* Status */}
                      <td className="audit-td" style={{ textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          background: statusStyle.bg,
                          color: statusStyle.color,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </td>
                      {/* Linked todo */}
                      <td className="audit-td" style={{ fontFamily: 'monospace', fontSize: '12px', color: ref ? 'var(--text)' : undefined }}>
                        {ref ?? <span style={{ opacity: 0.4 }}>—</span>}
                      </td>
                      {/* Created */}
                      <td className="audit-td" style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        {relativeDate(ticket.created_at)}
                      </td>
                      {/* Actions */}
                      <td className="audit-td" style={{ textAlign: 'right' }}>
                        <div className="flex-row gap-xs" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="text-btn"
                            style={{ fontSize: '12px', padding: '4px' }}
                            onClick={() => openEditModal(ticket)}
                          >
                            Edit
                          </button>
                          {canAct && !ref && (
                            <button
                              className="text-btn"
                              style={{ fontSize: '12px', padding: '4px' }}
                              onClick={() => {
                                setCreateForm({ projectId: '', title: ticket.summary })
                                setCreateTodoFor(ticket.id)
                                setDismissFor(null)
                              }}
                            >
                              Create todo
                            </button>
                          )}
                          {canAct && (
                            <button
                              className="text-btn"
                              style={{ fontSize: '12px', padding: '4px', color: 'var(--error)' }}
                              onClick={() => {
                                setDismissFor(ticket.id)
                                setCreateTodoFor(null)
                              }}
                            >
                              Dismiss
                            </button>
                          )}
                          {!canAct && !ref && <span style={{ fontSize: '12px', color: 'var(--muted)', opacity: 0.5 }}>—</span>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        </HScrollNav>
      )}

      {/* ── Floating modal for Edit ── */}
      {editTicket && (
        <>
          <div className="modal-backdrop" onClick={closeEditModal} />
          <div className="modal-center">
            <div className="modal-header">
              <h3 style={{ flex: 1, margin: 0, fontSize: 'var(--fs-base)', fontWeight: 600 }}>
                Edit Ticket — TICKETS-{editTicket.ticket_number}
              </h3>
              <button className="close-btn" onClick={closeEditModal} aria-label="Close">×</button>
            </div>
            <div className="modal-body" style={{ padding: 'var(--sp-lg) var(--sp-xl)' }}>
              <div className="grid-2col mb-md">
                <div>
                  <label className="label">Summary *</label>
                  <input
                    className="input"
                    value={editForm.summary}
                    onChange={e => setEditForm(f => ({ ...f, summary: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label">Type</label>
                  <select
                    className="input"
                    style={{ width: '100%', padding: '6px var(--sp-sm)', height: '40px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}
                    value={editForm.type}
                    onChange={e => setEditForm(f => ({ ...f, type: e.target.value as TicketType }))}
                  >
                    <option value="bug">Bug</option>
                    <option value="suggestion">Suggestion</option>
                    <option value="capability_gap">Capability Gap</option>
                    <option value="workflow_friction">Workflow Friction</option>
                  </select>
                </div>
              </div>

              <div className="mb-md">
                <label className="label">Status</label>
                <select
                  className="input"
                  style={{ width: '100%', padding: '6px var(--sp-sm)', height: '40px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r)', maxWidth: '220px' }}
                  value={editForm.status}
                  onChange={e => setEditForm(f => ({ ...f, status: e.target.value as TicketStatus }))}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="closed">Closed</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </div>

              {editTicket.detail && Object.keys(editTicket.detail).length > 0 && (
                <div className="mb-md">
                  <label className="label">Detail</label>
                  <div style={{
                    padding: '10px 12px',
                    background: 'var(--bg-hover)',
                    borderRadius: 'var(--r)',
                    fontSize: '13px',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '200px',
                    overflowY: 'auto',
                  }}>
                    {typeof editTicket.detail === 'object'
                      ? Object.entries(editTicket.detail).map(([k, v]) => (
                          <div key={k}><strong>{k}:</strong> {String(v)}</div>
                        ))
                      : String(editTicket.detail)}
                  </div>
                </div>
              )}

              {editTicket.conversation_snippet && (
                <div className="mb-md">
                  <label className="label">Conversation Snippet</label>
                  <div style={{
                    padding: '10px 12px',
                    background: 'var(--bg-hover)',
                    borderRadius: 'var(--r)',
                    fontSize: '13px',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    fontStyle: 'italic',
                    color: 'var(--muted)',
                  }}>
                    {editTicket.conversation_snippet}
                  </div>
                </div>
              )}

              {editTicket.dismiss_reason && (
                <div className="mb-md">
                  <label className="label">Dismiss Reason</label>
                  <div style={{ fontSize: '13px', color: 'var(--muted)' }}>{editTicket.dismiss_reason}</div>
                </div>
              )}

              <div className="mb-lg" style={{ fontSize: '12px', color: 'var(--muted)' }}>
                <span>Reporter: {reporterName(editTicket)}</span>
                {linkedRef(editTicket) && <span style={{ marginLeft: '16px' }}>Linked: {linkedRef(editTicket)}</span>}
                <span style={{ marginLeft: '16px' }}>Created: {relativeDate(editTicket.created_at)}</span>
              </div>

              <div className="flex-row gap-sm">
                <button className="btn-primary" onClick={handleEditSave} disabled={editSaving}>
                  {editSaving ? 'Saving…' : 'Save'}
                </button>
                <button className="btn-cancel" onClick={closeEditModal}>Cancel</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
