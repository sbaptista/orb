'use client'

import { useState } from 'react'
import SettingsCrudList from './SettingsCrudList'
import TextSearchModal from './TextSearchModal'
import DateSearchModal, { type CreatedFilter } from './DateSearchModal'
import { getTickets, createTodoFromTicket, dismissTicket, updateTicket, deleteTicket, type Ticket, type TicketType, type TicketStatus } from '@/app/actions/ticket-actions'
import { getAdminProjects } from '@/app/actions/manage-project'
import { useToast } from '@/components/ui/Toast'

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

const PAGE_SIZE = 25

const SCOPES = [
  { id: 'active', label: 'Active' },
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
]

export default function SettingsTickets() {
  const toast = useToast()

  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null)
  const [createTodoFor, setCreateTodoFor] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({ projectId: '', title: '' })
  const [creating, setCreating] = useState(false)
  const [refresher, setRefresher] = useState(0)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  const [scope, setScope] = useState('active')
  const [showTextSearch, setShowTextSearch] = useState(false)
  const [textSearchTerm, setTextSearchTerm] = useState('')
  const [showCreatedFilter, setShowCreatedFilter] = useState(false)
  const [createdFilter, setCreatedFilter] = useState<CreatedFilter | null>(null)

  const hasAnyFilter = !!textSearchTerm || !!createdFilter

  function resetAll() {
    setTextSearchTerm('')
    setCreatedFilter(null)
  }

  return (
    <>
    <SettingsCrudList<Ticket, TicketForm>
      key={refresher}
      config={{
        title: 'Tickets',
        table: 'tickets',
        itemLabel: 'Ticket',
        emptyForm: EMPTY_FORM,
        pageClass: 'settings-page s-page-wide',
        layout: 'table',
        pagination: { pageSize: PAGE_SIZE, serverSearch: true, serverSort: true },
        subtitle: (_items, total, pageInfo) => {
          if (!total) return 'No tickets found.'
          const ps = pageInfo?.pageSize ?? PAGE_SIZE
          const pg = pageInfo?.page ?? 0
          const start = pg * ps + 1
          const end = Math.min(start + _items.length - 1, total)
          if (start === end) return `Ticket ${start} of ${total}.`
          return `Tickets ${start}–${end} of ${total}.`
        },
        externalSearchTerm: textSearchTerm,
        searchCaption: 'Search by text, date, or both',
        externalFilterKey: `${scope}|${createdFilter?.from ?? ''}|${createdFilter?.to ?? ''}|${createdFilter?.before ?? ''}`,
        onResetFilters: resetAll,
        toolbarLeading: (
          <div style={{ marginBottom: 'var(--sp-sm)' }}>
            <label className="label">Filters</label>
            <div className="flex-row gap-sm" style={{ flexWrap: 'wrap' }}>
              {SCOPES.map(s => (
                <button
                  key={s.id}
                  className={`pill ${scope === s.id ? 'pill-active' : ''}`}
                  onClick={() => setScope(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ),
        toolbarExtra: (
          <>
            <button type="button" className="btn-primary" onClick={() => setShowTextSearch(true)}>
              {textSearchTerm || 'Search by Text'}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowCreatedFilter(true)}
              aria-label={createdFilter ? `Change date filter: ${createdFilter.label}` : 'Search by date'}
            >
              {createdFilter ? (
                createdFilter.label2 ? (
                  <span className="audit-date-stack">
                    <span>{createdFilter.label} –</span>
                    <span>{createdFilter.label2}</span>
                  </span>
                ) : createdFilter.label
              ) : 'Search by Date'}
            </button>
            {hasAnyFilter && (
              <button type="button" className="btn-primary" onClick={resetAll}>
                Reset
              </button>
            )}
          </>
        ),
        tableColumns: [
          { label: 'Code', width: '90px' },
          { label: 'Type', width: '110px' },
          { label: 'Summary', width: '260px' },
          { label: 'Reporter', width: '150px' },
          { label: 'Status', width: '120px' },
          { label: 'Linked todo', width: '120px' },
          { label: 'Created', width: '120px' },
          { label: 'Actions', width: '130px' },
        ],
        load: async (_supabase, pagination) => {
          const [ticketsRes, projectsRes] = await Promise.all([
            getTickets({
              page: pagination?.page,
              pageSize: pagination?.pageSize,
              search: pagination?.search,
              scope,
              createdFrom: createdFilter?.from,
              createdTo: createdFilter?.to,
              createdBefore: createdFilter?.before,
            }),
            getAdminProjects(),
          ])
          const rawTickets = (ticketsRes.data ?? []) as any[]
          const ticketsWithReporter = rawTickets.map(t => ({
            ...t,
            reporter: t.users || null,
            linked_todo: t.todos || null,
          })) as Ticket[]
          return {
            items: ticketsWithReporter,
            extra: {
              projects: (projectsRes.projects ?? []) as Project[],
              superAdminProjectId: (projectsRes as any).superAdminProjectId || null,
            },
            totalCount: ticketsRes.count ?? 0,
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
        toRecord: (form) => ({
          summary: form.summary.trim(),
          type: form.type,
          status: form.status,
          dismiss_reason: form.status === 'dismissed' ? (form.dismissReason || null) : null,
          resolution_notes: form.emailMessageOverride || null,
          version: ['closed', 'pending_release'].includes(form.status) ? (form.version || null) : null,
          emailMessageOverride: form.emailMessageOverride || undefined,
          sendEmail: form.sendEmail,
        }),
        getId: item => item.id,
        onSave: async (_supabase, id, record) => {
          const res = await updateTicket(id, record)
          if (res.error) throw new Error(res.error)
          setRefresher(r => r + 1)
        },
        onDelete: async (supabase, item) => {
          const res = await deleteTicket(item.id)
          if (res.error) throw new Error(res.error)
        },
        deleteWarning: (item) => <>Permanently delete <strong>{item.summary}</strong>? This cannot be undone.</>,
        editModalTitle: 'Edit Ticket',
        modalClass: 'modal-compose',
        onClose: () => setEditingTicket(null),

        renderForm: ({ form, onChange }) => {
          const isLinkedTodoClosed = editingTicket?.linked_todo?.status === 'closed'
          const needsAction = isLinkedTodoClosed && form.status !== 'closed' && form.status !== 'dismissed'
          const ref = editingTicket ? linkedRef(editingTicket) : null

          return (
            <div className="compose-body">
              {/* Left Column: Form Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
                {editingTicket?.detail?.system && (
                  <div style={{
                    padding: 'var(--sp-sm) var(--sp-md)',
                    background: 'var(--bg-hover)',
                    borderRadius: 'var(--r)',
                    fontSize: 'var(--fs-sm)',
                    color: 'var(--muted)',
                    display: 'flex',
                    gap: 'var(--sp-lg)',
                    flexWrap: 'wrap',
                  }}>
                    <span>🖥 {editingTicket.detail.system.browser}</span>
                    <span>{editingTicket.detail.system.os} {editingTicket.detail.system.os_version}</span>
                    <span>{editingTicket.detail.system.viewport}</span>
                  </div>
                )}
                {needsAction && ref && (
                  <div style={{
                    padding: 'var(--sp-md)',
                    background: '#fef3c7',
                    color: '#d97706',
                    border: '1px solid rgba(217, 119, 6, 0.2)',
                    borderRadius: 'var(--r)',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 'var(--fw-medium)',
                  }}>
                    ⚠️ The linked todo <strong>{ref}</strong> has been completed. Please update the ticket status and notify the reporter.
                  </div>
                )}
                <div className="pf-field">
                  <label className="pf-label">Summary *</label>
                  <textarea
                    className="pf-textarea"
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

                <div className="grid-2col">
                  <div className="pf-field">
                    <label className="pf-label">Type</label>
                    <select
                      className="pf-select"
                      value={form.type}
                      onChange={e => onChange({ ...form, type: e.target.value as TicketType })}
                    >
                      <option value="bug">Bug</option>
                      <option value="suggestion">Suggestion</option>
                      <option value="capability_gap">Capability Gap</option>
                      <option value="workflow_friction">Workflow Friction</option>
                    </select>
                  </div>
                  <div className="pf-field">
                    <label className="pf-label">Status</label>
                    <select
                      className="pf-select"
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
                  <div className="pf-field">
                    <label className="pf-label">Dismiss Reason</label>
                    <input
                      className="pf-input"
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
                  <div className="pf-field">
                    <label className="pf-label">Release Version</label>
                    <input
                      className="pf-input"
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

                <div style={{ padding: 'var(--sp-md)', background: 'var(--bg-hover)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="checkbox"
                      id="send-email-checkbox"
                      checked={form.sendEmail}
                      onChange={e => onChange({ ...form, sendEmail: e.target.checked })}
                      style={{ cursor: 'pointer', width: '20px', height: '20px' }}
                    />
                    <label htmlFor="send-email-checkbox" style={{ fontWeight: 'var(--fw-medium)', cursor: 'pointer' }}>
                      Send email notification to reporter
                    </label>
                  </div>

                  {form.sendEmail && (
                    <div className="pf-field" style={{ marginTop: 'var(--sp-sm)' }}>
                      <label className="pf-label">Custom Email Message</label>
                      <textarea
                        className="pf-textarea"
                        value={form.emailMessageOverride}
                        onChange={e => onChange({ ...form, emailMessageOverride: e.target.value })}
                        placeholder="Customize the message body..."
                      />
                    </div>
                  )}
                </div>

              </div>

              {/* Right Column: Live Email Preview */}
              <div>
                <label className="pf-label">Email Preview (Live)</label>
                {!form.sendEmail ? (
                  <div style={{
                    padding: 'var(--sp-xl)',
                    background: 'var(--bg-hover)',
                    border: '1px dashed var(--border)',
                    borderRadius: 'var(--r)',
                    textAlign: 'center',
                    color: 'var(--muted)',
                    marginTop: '5px',
                    fontSize: 'var(--fs-base)',
                  }}>
                    Email notification is disabled for this update.
                  </div>
                ) : (
                  <div style={{
                    padding: 'var(--sp-md) var(--sp-lg)',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 'var(--r)',
                    fontFamily: 'var(--font-ui)',
                    color: '#1a1a1a',
                    boxShadow: 'var(--shadow-sm)',
                    fontSize: 'var(--fs-base)',
                    lineHeight: 'var(--lh-normal)',
                    marginTop: '5px',
                  }}>
                    <div style={{ borderBottom: '1px solid #edf2f7', paddingBottom: '8px', marginBottom: '12px', color: '#718096' }}>
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

        renderRow: ({ item, onEdit, onDelete, extra, checkbox }) => {
          const ref = linkedRef(item)
          const isLinkedTodoClosed = item.linked_todo?.status === 'closed'
          const needsAction = isLinkedTodoClosed && item.status !== 'closed' && item.status !== 'dismissed'
          const statusStyle = STATUS_STYLES[item.status] ?? STATUS_STYLES.open
          const typeColor = TYPE_COLORS[item.type] ?? '#4a5568'
          const canAct = item.status !== 'dismissed' && item.status !== 'closed'
          const isCreating = createTodoFor === item.id
          const projects = (extra.projects ?? []) as Project[]
          const superAdminProjectId = (extra as any).superAdminProjectId as string | null

          const handleCreateTodo = async () => {
            if (!createForm.projectId || !createForm.title.trim()) {
              toast.error('Project and title are required.')
              return
            }
            setCreating(true)
            const res = await createTodoFromTicket(item.id, {
              projectId: createForm.projectId,
              title: createForm.title.trim(),
            })
            setCreating(false)
            if (res.error) { toast.error(res.error); return }
            toast.success(`Created ${res.data?.ref ?? 'todo'}.`)
            setCreateTodoFor(null)
            setCreateForm({ projectId: '', title: '' })
            setRefresher(r => r + 1)
          }

          if (isCreating) {
            return (
              <tr key={item.id}>
                {checkbox && <td className="audit-td" />}
                <td colSpan={8} className="audit-td">
                  <div className="s-form" style={{ padding: '12px 16px' }}>
                    <p className="text-sm" style={{ marginBottom: '12px', fontWeight: 'var(--fw-medium)' }}>
                      Create todo for: <em>{item.summary}</em>
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label className="label">Project</label>
                        {superAdminProjectId ? (
                          <div style={{
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 var(--sp-sm)',
                            background: 'var(--bg-hover)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--r)',
                            fontSize: 'var(--fs-base)',
                            color: 'var(--text2)',
                            fontWeight: 'var(--fw-medium)'
                          }}>
                            {projects.find(p => p.id === superAdminProjectId)?.name || 'Orb'}
                          </div>
                        ) : (
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
                        )}
                      </div>
                      <div>
                        <label className="label">Title</label>
                        <input
                          className="input"
                          value={createForm.title}
                          onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                          placeholder={item.summary}
                        />
                      </div>
                    </div>
                    <div className="flex-row gap-sm">
                      <button className="btn-primary" onClick={handleCreateTodo} disabled={creating}>
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

          return (
            <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
              onClick={e => {
                const tag = (e.target as HTMLElement).tagName
                if (['BUTTON', 'A', 'INPUT', 'SELECT', 'SVG', 'PATH'].includes(tag)) return
                if ((e.target as HTMLElement).closest('button, a, input, select')) return
                setEditingTicket(item) // Cache editing ticket
                onEdit(e)
              }}
            >
              {checkbox}
              {/* Code */}
              <td className="audit-td" style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-semibold)', color: 'var(--text2)' }}>
                TICKETS-{item.ticket_number}
              </td>
              {/* Type */}
              <td className="audit-td">
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: 'var(--fs-version)',
                  fontWeight: 'var(--fw-bold)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--ls-body)',
                  background: typeColor,
                  color: '#fff',
                }}>
                  {item.type.replace(/_/g, ' ')}
                </span>
              </td>
              {/* Summary */}
              <td className="audit-td" style={{ fontWeight: 'var(--fw-medium)' }}>
                {item.summary}
              </td>
              {/* Reporter */}
              <td className="audit-td" style={{ color: 'var(--text)' }}>
                {reporterName(item)}
              </td>
              {/* Status */}
              <td className="audit-td" style={{ textAlign: 'center' }}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: 'var(--fs-version)',
                  background: statusStyle.bg,
                  color: statusStyle.color,
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--ls-body)',
                }}>
                  {item.status.replace('_', ' ')}
                </span>
              </td>
              {/* Linked todo */}
              <td className="audit-td" style={{ fontFamily: 'var(--font-mono)', color: ref ? 'var(--text)' : undefined }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {ref ?? <span style={{ opacity: 'var(--opacity-muted)' }}>—</span>}
                  {needsAction && (
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: 'var(--fs-version)',
                      fontWeight: 'var(--fw-semibold)',
                      textTransform: 'uppercase',
                      letterSpacing: 'var(--ls-body)',
                      background: '#fef3c7',
                      color: '#d97706',
                      width: 'fit-content'
                    }}>
                      Todo Closed
                    </span>
                  )}
                </div>
              </td>
              {/* Created */}
              <td className="audit-td" style={{ color: 'var(--muted)' }}>
                {relativeDate(item.created_at)}
              </td>
              {/* Actions */}
              <td className="audit-td" onClick={e => e.stopPropagation()} style={{ overflow: 'visible', position: 'relative' }}>
                <div className="action-cell">
                  <button
                    className="action-link"
                    onClick={() => {
                      setEditingTicket(item)
                      onEdit()
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn-overflow"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpenId(menuOpenId === item.id ? null : item.id)
                    }}
                  >
                    &#x22EE;
                  </button>
                </div>
                {menuOpenId === item.id && (
                  <>
                    <div className="dropdown-backdrop" onClick={(e) => { e.stopPropagation(); setMenuOpenId(null) }} />
                    <div className="dropdown-menu" style={{ top: '100%', bottom: 'auto', marginTop: '2px' }}>
                      {canAct && !ref && (
                        <button className="dropdown-item" onClick={() => {
                          setCreateForm({ projectId: superAdminProjectId || '', title: item.summary })
                          setCreateTodoFor(item.id)
                          setMenuOpenId(null)
                        }}>
                          Create todo
                        </button>
                      )}
                      {canAct && (
                        <button className="dropdown-item" style={{ color: 'var(--error)' }} onClick={async () => {
                          setMenuOpenId(null)
                          const res = await dismissTicket(item.id)
                          if (res.error) { toast.error(res.error) }
                          else { toast.success('Ticket dismissed.'); setRefresher(r => r + 1) }
                        }}>
                          Dismiss
                        </button>
                      )}
                      <button className="dropdown-item" style={{ color: 'var(--error)' }} onClick={() => {
                        setMenuOpenId(null)
                        onDelete()
                      }}>
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </td>
            </tr>
          )
        },

        renderMobileRow: ({ item, onEdit, onDelete }) => {
          const ref = linkedRef(item)
          const isLinkedTodoClosed = item.linked_todo?.status === 'closed'
          const needsAction = isLinkedTodoClosed && item.status !== 'closed' && item.status !== 'dismissed'
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
                setEditingTicket(item)
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
                  fontSize: 'var(--fs-version)',
                  fontWeight: 'var(--fw-bold)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--ls-body)',
                  background: typeColor,
                  color: '#fff',
                }}>
                  {item.type.replace(/_/g, ' ')}
                </span>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: 'var(--fs-version)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--ls-body)',
                  background: statusStyle.bg,
                  color: statusStyle.color,
                }}>
                  {item.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="crud-card-meta">
                <span>{reporterName(item)}</span>
                {ref && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{ref}</span>
                    {needsAction && (
                      <span style={{
                        display: 'inline-block',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: 'var(--fs-version)',
                        fontWeight: 'var(--fw-semibold)',
                        textTransform: 'uppercase',
                        letterSpacing: 'var(--ls-body)',
                        background: '#fef3c7',
                        color: '#d97706',
                      }}>
                        Todo Closed
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="crud-card-actions">
                <button className="text-btn btn-sm"
                  onClick={e => { setEditingTicket(item); onEdit(e) }}>
                  Edit
                </button>
                {canAct && (
                  <button className="btn-danger-confirm btn-sm"
                    onClick={async () => {
                      const res = await dismissTicket(item.id)
                      if (res.error) { toast.error(res.error) }
                      else { toast.success('Ticket dismissed.'); setRefresher(r => r + 1) }
                    }}>
                    Dismiss
                  </button>
                )}
                <button className="btn-danger-confirm btn-sm"
                  onClick={onDelete}>
                  Delete
                </button>
              </div>
            </div>
          )
        },
      }}
    />

    <TextSearchModal
      open={showTextSearch}
      onClose={() => setShowTextSearch(false)}
      onApply={term => { setTextSearchTerm(term); setShowTextSearch(false) }}
      onClear={() => { setTextSearchTerm(''); setShowTextSearch(false) }}
      currentTerm={textSearchTerm}
      placeholder="Search tickets then press"
      ariaLabel="Search tickets"
    />

    <DateSearchModal
      open={showCreatedFilter}
      onClose={() => setShowCreatedFilter(false)}
      onApply={filter => { setCreatedFilter(filter); setShowCreatedFilter(false) }}
      onClear={() => { setCreatedFilter(null); setShowCreatedFilter(false) }}
      currentFilter={createdFilter}
    />
    </>
  )
}
