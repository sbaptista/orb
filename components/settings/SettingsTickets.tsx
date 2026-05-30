'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { getTickets, createTodoFromTicket, dismissTicket, type Ticket, type TicketType } from '@/app/actions/ticket-actions'
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
                    <tr key={ticket.id} style={{ borderBottom: '1px solid var(--border)' }}>
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
                          {!canAct && <span style={{ fontSize: '12px', color: 'var(--muted)', opacity: 0.5 }}>—</span>}
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
    </div>
  )
}
