'use client'

import SettingsCrudListV2 from './SettingsCrudListV2'
import { getTickets, dismissTicket, updateTicket, deleteTicket, type Ticket, type TicketType, type TicketStatus } from '@/app/actions/ticket-actions'
import { getAdminProjects } from '@/app/actions/manage-project'
import { useToast } from '@/components/ui/Toast'
import { useState } from 'react'

type Project = { id: string; name: string; code: string | null }
type TicketForm = {
  summary: string
  type: TicketType
  status: TicketStatus
  dismissReason: string
  resolution_notes: string
  version: string
  emailMessageOverride: string
  sendEmail: boolean
}

const TYPE_COLORS: Record<TicketType, string> = {
  bug: '#e53e3e',
  suggestion: '#3182ce',
  capability_gap: '#805ad5',
  workflow_friction: '#dd6b20',
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  open:                 { bg: 'var(--bg-hover)',  color: 'var(--muted)' },
  in_progress:          { bg: '#e8f0e8',          color: '#2d5a2d' },
  closed:               { bg: '#edf2f7',          color: '#4a5568' },
  dismissed:            { bg: 'var(--bg-hover)',  color: 'var(--muted)' },
  pending:              { bg: '#fef3c7',          color: '#d97706' },
  awaiting_input:       { bg: '#fef3c7',          color: '#d97706' },
  pending_release:      { bg: '#e0f2fe',          color: '#0284c7' },
  pending_verification: { bg: '#e0f2fe',          color: '#0284c7' },
  on_hold:              { bg: '#fee2e2',          color: '#dc2626' },
  deferred:             { bg: '#f3f4f6',          color: '#4b5563' },
}

function getDefaultEmailMessage(status: TicketStatus, summary: string, dismissReason = '', version = ''): string {
  switch (status) {
    case 'in_progress':
      return `We've started working on your feedback: "${summary}". We'll let you know when it's resolved.`
    case 'closed':
      if (version) {
        return `We have addressed your feedback: "${summary}"\n\nThis change is included in version ${version}.\n\nThanks for helping us improve Orb.`
      }
      return `We have addressed your feedback: "${summary}". Thanks for helping us improve Orb.`
    case 'dismissed':
      return `We reviewed your feedback: "${summary}". After consideration, we've decided not to act on this at this time.${dismissReason ? '\n\nExplanation:\n' + dismissReason : ''}`
    case 'pending':
      return `We reviewed your feedback: "${summary}" and it is currently pending further review.`
    case 'awaiting_input':
      return `We need a bit more information or context from you before we can proceed: "${summary}"`
    case 'pending_release':
      if (version) {
        return `We've resolved your feedback: "${summary}" and it is pending release in version ${version}.`
      }
      return `We've resolved your feedback: "${summary}" and it is pending release in the next update.`
    case 'pending_verification':
      return `We've implemented a fix for: "${summary}". It is pending verification. Please let us know if it works for you.`
    case 'on_hold':
      return `We've placed your feedback: "${summary}" on hold for now due to other development priorities.`
    case 'deferred':
      return `We reviewed your feedback: "${summary}" and deferred it to a future release cycle.`
    default:
      return `We reviewed your feedback: "${summary}" and placed it on status ${status.replace('_', ' ')}.`
  }
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

const EMPTY_FORM: TicketForm = {
  summary: '',
  type: 'bug',
  status: 'open',
  dismissReason: '',
  resolution_notes: '',
  version: '',
  emailMessageOverride: '',
  sendEmail: true,
}

export default function SettingsTicketsPrototype() {
  const toast = useToast()

  const [createTodoFor, setCreateTodoFor] = useState<string | null>(null)
  const [refresher, setRefresher] = useState(0)

  return (
    <SettingsCrudListV2<Ticket, TicketForm>
      key={refresher}
      config={{
        title: 'Tickets (Prototype)',
        table: 'tickets',
        itemLabel: 'Ticket',
        emptyForm: EMPTY_FORM,
        pageClass: 'settings-page s-page-wide',
        layout: 'table',
        subtitle: items => `${items.length} ticket${items.length !== 1 ? 's' : ''}`,
        tableColumns: [
          { label: 'Code', width: '9%' },
          { label: 'Type', width: '11%' },
          { label: 'Summary' },
          { label: 'Reporter', width: '14%' },
          { label: 'Status', width: '11%' },
          { label: 'Linked todo', width: '9%' },
          { label: 'Created', width: '9%' },
          { label: 'Actions', width: '18%', align: 'right' },
        ],
        load: async (supabase) => {
          const [ticketsRes, projectsRes] = await Promise.all([
            getTickets(),
            getAdminProjects(),
          ])
          const rawTickets = (ticketsRes.data ?? []) as any[]
          const ticketsWithReporter = rawTickets.map(t => ({
            ...t,
            reporter: t.users || null,
          })) as Ticket[]
          return {
            items: ticketsWithReporter,
            extra: {
              projects: (projectsRes.projects ?? []) as Project[],
            }
          }
        },
        searchFilter: (item, query) => {
          const q = query.toLowerCase()
          return (
            item.summary.toLowerCase().includes(q) ||
            item.type.includes(q) ||
            reporterName(item).toLowerCase().includes(q) ||
            item.status.includes(q)
          )
        },
        searchPlaceholder: 'Search by summary, type, reporter, or status.',
        scopeFilter: {
          defaultScope: 'active',
          defaultLabel: 'Active',
          getScopes: () => [
            { id: 'all', label: 'All' },
            { id: 'open', label: 'Open' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'pending', label: 'Pending' },
            { id: 'awaiting_input', label: 'Awaiting Input' },
            { id: 'pending_release', label: 'Pending Release' },
            { id: 'pending_verification', label: 'Pending Verification' },
            { id: 'on_hold', label: 'On Hold' },
            { id: 'deferred', label: 'Deferred' },
            { id: 'closed', label: 'Closed' },
            { id: 'dismissed', label: 'Dismissed' },
          ],
          filterItem: (item, scope) => {
            if (scope === 'all') return true
            if (scope === 'active') return item.status !== 'closed' && item.status !== 'dismissed'
            return item.status === scope
          }
        },
        bulkDelete: {
          onDelete: async (supabase, items) => {
            let failed = 0
            for (const item of items) {
              const res = await deleteTicket(item.id)
              if (res.error) failed++
            }
            if (failed > 0) return { error: `${failed} ticket${failed > 1 ? 's' : ''} failed to delete.` }
            return {}
          },
          confirmMessage: (count) => `Permanently delete ${count} ticket${count > 1 ? 's' : ''}? This cannot be undone.`
        },
        validate: (form) => {
          if (!form.summary.trim()) return 'Summary is required.'
          return null
        },
        toForm: (item) => ({
          summary: item.summary,
          type: item.type,
          status: item.status,
          dismissReason: item.dismiss_reason || '',
          resolution_notes: item.resolution_notes || '',
          version: item.version || '',
          emailMessageOverride: item.resolution_notes || getDefaultEmailMessage(item.status, item.summary, item.dismiss_reason || '', item.version || ''),
          sendEmail: true,
        }),
        toRecord: (form) => ({}),
        getId: item => item.id,
        onSave: async (supabase, id, record, items) => {},
        onDelete: async (supabase, item) => {
          const res = await deleteTicket(item.id)
          if (res.error) throw new Error(res.error)
        },
        deleteWarning: (item) => <>Permanently delete <strong>{item.summary}</strong>? This cannot be undone.</>,

        editModalTitle: 'Edit Ticket',

        renderForm: ({ form, onChange, onSubmit, onCancel, submitLabel, saving, extra }) => {
          const projects = (extra.projects ?? []) as Project[]
          const handleCustomSave = async () => {
            if (!createTodoFor) return
            const res = await updateTicket(createTodoFor, {
              summary: form.summary.trim(),
              type: form.type,
              status: form.status,
              dismiss_reason: form.status === 'dismissed' ? (form.dismissReason || null) : null,
              resolution_notes: form.resolution_notes || null,
              version: ['closed', 'pending_release'].includes(form.status) ? (form.version || null) : null,
              emailMessageOverride: form.emailMessageOverride || undefined,
              sendEmail: form.sendEmail,
            })
            if (res.error) {
              toast.error(res.error)
            } else {
              toast.success('Ticket updated.')
              onCancel()
              setRefresher(r => r + 1)
            }
          }

          return (
            <div className="grid-2col" style={{ gap: 'var(--sp-xl)', width: '920px', maxWidth: '100%' }}>
              {/* Left Column: Form Controls */}
              <div>
                <div className="mb-md">
                  <label className="label">Summary *</label>
                  <textarea
                    className="input"
                    style={{ width: '100%', minHeight: '80px', padding: '10px var(--sp-md)', resize: 'vertical', fontFamily: 'inherit' }}
                    value={form.summary}
                    onChange={e => {
                      const newSummary = e.target.value
                      onChange({
                        ...form,
                        summary: newSummary,
                        emailMessageOverride: getDefaultEmailMessage(form.status, newSummary, form.dismissReason, form.version),
                      })
                    }}
                    autoFocus
                  />
                </div>

                <div className="grid-2col mb-md">
                  <div>
                    <label className="label">Type</label>
                    <select
                      className="input"
                      style={{ width: '100%', padding: '6px var(--sp-sm)', height: '40px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}
                      value={form.type}
                      onChange={e => onChange({ ...form, type: e.target.value as TicketType })}
                    >
                      <option value="bug">Bug</option>
                      <option value="suggestion">Suggestion</option>
                      <option value="capability_gap">Capability Gap</option>
                      <option value="workflow_friction">Workflow Friction</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select
                      className="input"
                      style={{ width: '100%', padding: '6px var(--sp-sm)', height: '40px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}
                      value={form.status}
                      onChange={e => {
                        const newStatus = e.target.value as TicketStatus
                        onChange({
                          ...form,
                          status: newStatus,
                          emailMessageOverride: getDefaultEmailMessage(newStatus, form.summary, form.dismissReason, form.version),
                        })
                      }}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="pending">Pending</option>
                      <option value="awaiting_input">Awaiting Input</option>
                      <option value="pending_release">Pending Release</option>
                      <option value="pending_verification">Pending Verification</option>
                      <option value="on_hold">On Hold</option>
                      <option value="deferred">Deferred</option>
                      <option value="closed">Closed</option>
                      <option value="dismissed">Dismissed</option>
                    </select>
                  </div>
                </div>

                {form.status === 'dismissed' && (
                  <div className="mb-md">
                    <label className="label">Dismiss Reason</label>
                    <input
                      className="input"
                      value={form.dismissReason}
                      onChange={e => {
                        const newReason = e.target.value
                        onChange({
                          ...form,
                          dismissReason: newReason,
                          emailMessageOverride: getDefaultEmailMessage(form.status, form.summary, newReason, form.version),
                        })
                      }}
                      placeholder="Why is this feedback being dismissed?"
                    />
                  </div>
                )}

                {['closed', 'pending_release'].includes(form.status) && (
                  <div className="mb-md">
                    <label className="label">Release Version</label>
                    <input
                      className="input"
                      value={form.version}
                      onChange={e => {
                        const newVersion = e.target.value
                        onChange({
                          ...form,
                          version: newVersion,
                          emailMessageOverride: getDefaultEmailMessage(form.status, form.summary, form.dismissReason, newVersion),
                        })
                      }}
                      placeholder="e.g. v0.5.148"
                    />
                  </div>
                )}

                <div className="mb-md" style={{ padding: 'var(--sp-md)', background: 'var(--bg-hover)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="checkbox"
                      id="send-email-checkbox-proto"
                      checked={form.sendEmail}
                      onChange={e => onChange({ ...form, sendEmail: e.target.checked })}
                      style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor="send-email-checkbox-proto" style={{ fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>
                      Send email notification to reporter
                    </label>
                  </div>

                  {form.sendEmail && (
                    <div>
                      <label className="label" style={{ fontSize: '11px', marginTop: 'var(--sp-sm)' }}>Custom Email Message</label>
                      <textarea
                        className="input"
                        style={{ width: '100%', minHeight: '80px', padding: '8px 10px', fontSize: '13px', resize: 'vertical', fontFamily: 'inherit' }}
                        value={form.emailMessageOverride}
                        onChange={e => onChange({ ...form, emailMessageOverride: e.target.value })}
                        placeholder="Customize the message body..."
                      />
                    </div>
                  )}
                </div>

                <div className="flex-row gap-sm" style={{ marginTop: '16px' }}>
                  <button className="btn-primary" onClick={handleCustomSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button className="btn-cancel" onClick={onCancel}>Cancel</button>
                </div>
              </div>

              {/* Right Column: Live Email Preview */}
              <div>
                <label className="label">Email Preview (Live)</label>
                {!form.sendEmail ? (
                  <div style={{
                    padding: 'var(--sp-xl)',
                    background: 'var(--bg-hover)',
                    border: '1px dashed var(--border)',
                    borderRadius: 'var(--r)',
                    textAlign: 'center',
                    color: 'var(--muted)',
                    fontSize: '13px'
                  }}>
                    Email notification is disabled for this update.
                  </div>
                ) : (
                  <div style={{
                    padding: 'var(--sp-md) var(--sp-lg)',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 'var(--r)',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    color: '#1a1a1a',
                    boxShadow: 'var(--shadow-sm)',
                    fontSize: '13px',
                    lineHeight: '1.5',
                  }}>
                    <div style={{ borderBottom: '1px solid #edf2f7', paddingBottom: '8px', marginBottom: '12px', fontSize: '11px', color: '#718096' }}>
                      <div><strong>From:</strong> Stan Baptista &lt;noreply@stanbaptista.me&gt;</div>
                      <div style={{ marginTop: '2px', color: '#2d3748' }}>
                        <strong>Subject:</strong> {
                          form.status === 'in_progress' ? "[Orb] We're working on your feedback" :
                          form.status === 'closed' ? "[Orb] Your feedback has been addressed" :
                          "[Orb] Update on your feedback"
                        }
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'inline-block', width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #2d5a2d, #5a3090)' }} />
                    </div>
                    <p style={{ margin: '0 0 10px 0' }}>Hi there,</p>
                    <p style={{ whiteSpace: 'pre-wrap', margin: '0 0 16px 0', color: '#2d3748' }}>
                      {form.emailMessageOverride || ' '}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        },

        // Desktop table row — simplified (no inline create-todo form; use modal instead)
        renderRow: ({ item, index, items, onEdit, onDelete, saving, extra, checkbox }) => {
          const ref = linkedRef(item)
          const statusStyle = STATUS_STYLES[item.status] ?? STATUS_STYLES.open
          const typeColor = TYPE_COLORS[item.type] ?? '#4a5568'
          const canAct = item.status !== 'dismissed' && item.status !== 'closed'

          return (
            <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
              onClick={e => {
                const tag = (e.target as HTMLElement).tagName
                if (['BUTTON', 'A', 'INPUT', 'SELECT', 'SVG', 'PATH'].includes(tag)) return
                if ((e.target as HTMLElement).closest('button, a, input, select')) return
                setCreateTodoFor(item.id)
                onEdit(e)
              }}
            >
              {checkbox}
              <td className="audit-td" style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text2)', fontSize: '12px' }}>
                TICKETS-{item.ticket_number}
              </td>
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
                  {item.type.replace(/_/g, ' ')}
                </span>
              </td>
              <td className="audit-td" style={{ fontWeight: 500 }}>
                {item.summary}
              </td>
              <td className="audit-td" style={{ color: 'var(--text)', fontSize: '12px' }}>
                {reporterName(item)}
              </td>
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
                  {item.status.replace('_', ' ')}
                </span>
              </td>
              <td className="audit-td" style={{ fontFamily: 'monospace', fontSize: '12px', color: ref ? 'var(--text)' : undefined }}>
                {ref ?? <span style={{ opacity: 0.4 }}>—</span>}
              </td>
              <td className="audit-td" style={{ fontSize: '12px', color: 'var(--muted)' }}>
                {relativeDate(item.created_at)}
              </td>
              <td className="audit-td" style={{ textAlign: 'right' }}>
                <div className="flex-row gap-xs" style={{ justifyContent: 'flex-end' }}>
                  <button
                    className="text-btn"
                    style={{ fontSize: '12px', padding: '4px' }}
                    onClick={(e) => {
                      setCreateTodoFor(item.id)
                      onEdit(e)
                    }}
                  >
                    Edit
                  </button>
                  {canAct && (
                    <button
                      className="text-btn"
                      style={{ fontSize: '12px', padding: '4px', color: 'var(--error)' }}
                      onClick={async () => {
                        const res = await dismissTicket(item.id)
                        if (res.error) { toast.error(res.error) }
                        else { toast.success('Ticket dismissed.'); setRefresher(r => r + 1) }
                      }}
                    >
                      Dismiss
                    </button>
                  )}
                  <button
                    className="text-btn"
                    style={{ fontSize: '12px', padding: '4px', color: 'var(--error)' }}
                    onClick={onDelete}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          )
        },

        // Mobile card row
        renderMobileRow: ({ item, onEdit, onDelete, saving, extra }) => {
          const ref = linkedRef(item)
          const statusStyle = STATUS_STYLES[item.status] ?? STATUS_STYLES.open
          const typeColor = TYPE_COLORS[item.type] ?? '#4a5568'
          const canAct = item.status !== 'dismissed' && item.status !== 'closed'

          return (
            <div
              key={item.id}
              className="crud-card"
              onClick={e => {
                const tag = (e.target as HTMLElement).tagName
                if (['BUTTON', 'A', 'INPUT', 'SELECT', 'SVG', 'PATH'].includes(tag)) return
                if ((e.target as HTMLElement).closest('button, a, input, select')) return
                setCreateTodoFor(item.id)
                onEdit(e)
              }}
            >
              <div className="crud-card-header">
                <span className="crud-card-code">TICKETS-{item.ticket_number}</span>
                <span className="crud-card-date">{relativeDate(item.created_at)}</span>
              </div>

              <div className="crud-card-title">{item.summary}</div>

              <div className="crud-card-pills">
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
                  {item.type.replace(/_/g, ' ')}
                </span>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  background: statusStyle.bg,
                  color: statusStyle.color,
                }}>
                  {item.status.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="crud-card-meta">
                <span>{reporterName(item)}</span>
                {ref && <span style={{ fontFamily: 'monospace' }}>{ref}</span>}
              </div>

              <div className="crud-card-actions">
                <button
                  className="text-btn"
                  style={{ fontSize: '12px', padding: '6px 8px' }}
                  onClick={e => {
                    setCreateTodoFor(item.id)
                    onEdit(e)
                  }}
                >
                  Edit
                </button>
                {canAct && (
                  <button
                    className="text-btn"
                    style={{ fontSize: '12px', padding: '6px 8px', color: 'var(--error)' }}
                    onClick={async () => {
                      const res = await dismissTicket(item.id)
                      if (res.error) { toast.error(res.error) }
                      else { toast.success('Ticket dismissed.'); setRefresher(r => r + 1) }
                    }}
                  >
                    Dismiss
                  </button>
                )}
                <button
                  className="text-btn"
                  style={{ fontSize: '12px', padding: '6px 8px', color: 'var(--error)' }}
                  onClick={onDelete}
                >
                  Delete
                </button>
              </div>
            </div>
          )
        },
      }}
    />
  )
}
