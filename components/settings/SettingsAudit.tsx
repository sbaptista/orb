'use client'

import { useState, useSyncExternalStore } from 'react'
import SettingsCrudList from './SettingsCrudList'
import TextSearchModal from './TextSearchModal'
import DateSearchModal, { type CreatedFilter } from './DateSearchModal'
import { getAuditLogs } from '@/app/actions/get-audit-logs'
import { deleteAuditLogs } from '@/app/actions/delete-audit-logs'

type AuditRow = {
  id: string
  table_name: string | null
  record_id: string | null
  action: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  user_id: string | null
  created_at: string
  actor: string | null
  user_name_snapshot: string | null
  user_email_snapshot: string | null
  system_info: { browser: string; os: string; os_version: string; viewport: string } | null
  users: { first_name: string | null; last_name: string | null; email: string } | null
}

type AuditForm = Record<string, never>

const EMPTY_FORM: AuditForm = {}
const PAGE_SIZE = 50

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function formatUser(row: AuditRow): string {
  if (row.user_name_snapshot || row.user_email_snapshot) {
    return row.user_name_snapshot || row.user_email_snapshot || '—'
  }
  if (row.users) {
    const name = [row.users.first_name, row.users.last_name].filter(Boolean).join(' ')
    return name || row.users.email
  }
  return row.user_id ? row.user_id.slice(0, 8) + '…' : '—'
}

function formatCurrentUser(row: AuditRow): string | null {
  if (!row.users) return null
  const name = [row.users.first_name, row.users.last_name].filter(Boolean).join(' ')
  return name || row.users.email
}

function subscribeToTimeZone() {
  return () => {}
}

function getBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

function formatCreated(value: string, timeZone: string): string {
  return new Date(value).toLocaleString(undefined, { timeZone })
}


export default function SettingsAudit() {
  const [viewingRow, setViewingRow] = useState<AuditRow | null>(null)
  const timeZone = useSyncExternalStore(subscribeToTimeZone, getBrowserTimeZone, () => 'UTC')

  const [showTextSearch, setShowTextSearch] = useState(false)
  const [textSearchTerm, setTextSearchTerm] = useState('')
  const [showCreatedFilter, setShowCreatedFilter] = useState(false)
  const [createdFilter, setCreatedFilter] = useState<CreatedFilter | null>(null)

  function resetAll() {
    setTextSearchTerm('')
    setCreatedFilter(null)
  }

  const hasAnyFilter = !!textSearchTerm || !!createdFilter

  const columns: Array<{ key: keyof AuditRow | '_user'; label: string }> = [
    { key: '_user', label: 'User' },
    { key: 'table_name', label: 'Table' },
    { key: 'action', label: 'Action' },
    { key: 'actor', label: 'Actor' },
    { key: 'record_id', label: 'Record' },
    { key: 'before', label: 'Before' },
    { key: 'after', label: 'After' },
    { key: 'created_at', label: 'Created' },
  ]

  return (
    <>
      <SettingsCrudList<AuditRow, AuditForm>
        config={{
          title: 'Audit Log',
          table: 'audit_log',
          itemLabel: 'Entry',
          emptyForm: EMPTY_FORM,
          pageClass: 'settings-page s-page-wide',
          layout: 'table',
          pagination: { pageSize: PAGE_SIZE, serverSearch: true, serverSort: true },
          subtitle: (_items, total, pageInfo) => {
            if (!total) return 'No rows found.'
            const ps = pageInfo?.pageSize ?? PAGE_SIZE
            const pg = pageInfo?.page ?? 0
            const start = pg * ps + 1
            const end = Math.min(start + _items.length - 1, total)
            if (start === end) return `Row ${start} of ${total}.`
            return `Rows ${start}–${end} of ${total}.`
          },
          externalSearchTerm: textSearchTerm,
          searchCaption: 'Search by text, date, or both',
          tableNavCaption: 'prev/next columns',
          onRowClick: (item) => setViewingRow(item),
          externalFilterKey: `${createdFilter?.from ?? ''}|${createdFilter?.to ?? ''}|${createdFilter?.before ?? ''}`,
          onResetFilters: resetAll,
          toolbarExtra: (
            <>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setShowTextSearch(true)}
              >
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

          selectionColumnWidth: 38,
          selectionColumnWidths: { ipad: 38, iphone: 38 },
          tableColumns: [
            { label: 'User',    width: '140px', platformWidths: { ipad: '140px', iphone: '140px' } },
            { label: 'Table',   width: '128px', platformWidths: { ipad: '128px', iphone: '128px' }, sortKey: 'table_name', sortValue: (r: AuditRow) => r.table_name ?? '' },
            { label: 'Action',  width: '140px', platformWidths: { ipad: '170px', iphone: '140px' }, sortKey: 'action',     sortValue: (r: AuditRow) => r.action ?? '' },
            { label: 'Actor',   width: '79px',  platformWidths: { ipad: '120px', iphone: '140px' }, sortKey: 'actor',      sortValue: (r: AuditRow) => r.actor ?? '' },
            { label: 'Record',  width: '140px', platformWidths: { ipad: '140px', iphone: '140px' } },
            { label: 'Before',  width: '140px', platformWidths: { ipad: '140px', iphone: '140px' } },
            { label: 'After',   width: '140px', platformWidths: { ipad: '140px', iphone: '140px' } },
            { label: 'Created', width: '140px', platformWidths: { ipad: '170px', iphone: '140px' }, sortKey: 'created_at', sortValue: (r: AuditRow) => new Date(r.created_at).getTime() },
          ],

          load: async (_supabase, pagination) => {
            const res = await getAuditLogs({
              page: pagination?.page,
              pageSize: pagination?.pageSize,
              search: pagination?.search,
              sortKey: pagination?.sortKey,
              sortDir: pagination?.sortDir,
              createdFrom: createdFilter?.from,
              createdTo: createdFilter?.to,
              createdBefore: createdFilter?.before,
            })
            if (res.error) throw new Error(res.error)
            return {
              items: (res.data ?? []) as AuditRow[],
              totalCount: res.count ?? 0,
            }
          },

          getId: (item) => item.id,

          bulkDelete: {
            canSelect: () => true,
            confirmMessage: (count: number) => `Permanently delete ${count} audit log entr${count > 1 ? 'ies' : 'y'}? This cannot be undone.`,
            onDelete: async (_supabase: any, items: AuditRow[]) => {
              const res = await deleteAuditLogs(items.map(i => i.id))
              return res.error ? { error: res.error } : {}
            },
          },

          renderRow: ({ item, onEdit, checkbox }) => (
            <tr
              key={item.id}
              onClick={e => onEdit(e)}
              style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
            >
              {checkbox}
              <td className="audit-td" style={{ color: 'var(--text2)' }}>
                {formatUser(item)}
              </td>
              <td className="audit-td" style={{ fontWeight: 'var(--fw-medium)' }}>
                {item.table_name ?? '—'}
              </td>
              <td className="audit-td">
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: 'var(--fs-version)',
                  textTransform: 'uppercase',
                  background: item.action === 'DELETE' ? 'var(--bg-hover)' : item.action === 'INSERT' ? 'rgba(45, 90, 45, 0.1)' : 'rgba(49, 130, 206, 0.1)',
                  color: item.action === 'DELETE' ? 'var(--error)' : item.action === 'INSERT' ? 'var(--success)' : '#3182ce',
                }}>
                  {item.action ?? '—'}
                </span>
              </td>
              <td className="audit-td" style={{ color: 'var(--muted)' }}>
                {item.actor ?? '—'}
              </td>
              <td className="audit-td" style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>
                {item.record_id ? item.record_id.slice(0, 8) + '…' : '—'}
              </td>
              <td className="audit-td" style={{ color: 'var(--muted)' }} title={formatCell(item.before)}>
                {formatCell(item.before)}
              </td>
              <td className="audit-td" style={{ color: 'var(--muted)' }} title={formatCell(item.after)}>
                {formatCell(item.after)}
              </td>
              <td className="audit-td" style={{ color: 'var(--muted)' }}>
                {formatCreated(item.created_at, timeZone)}
              </td>
            </tr>
          ),
        }}
      />

      <TextSearchModal
        open={showTextSearch}
        onClose={() => setShowTextSearch(false)}
        onApply={term => { setTextSearchTerm(term); setShowTextSearch(false) }}
        onClear={() => { setTextSearchTerm(''); setShowTextSearch(false) }}
        currentTerm={textSearchTerm}
        placeholder="Search audit log then press"
        ariaLabel="Search audit log"
      />

      <DateSearchModal
        open={showCreatedFilter}
        onClose={() => setShowCreatedFilter(false)}
        onApply={filter => { setCreatedFilter(filter); setShowCreatedFilter(false) }}
        onClear={() => { setCreatedFilter(null); setShowCreatedFilter(false) }}
        currentFilter={createdFilter}
      />

      {/* ── Audit row detail modal ── */}
      {viewingRow && (
        <>
          <div className="modal-backdrop" onClick={() => setViewingRow(null)} />
          <div
            className="modal-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-entry-dialog-title"
            style={{ maxWidth: '560px' }}
          >
            <div className="modal-header">
              <h3 id="audit-entry-dialog-title" style={{ flex: 1, margin: 0, fontSize: 'var(--fs-base)', fontWeight: 'var(--fw-semibold)' }}>
                Audit Entry
              </h3>
              <button className="close-btn" onClick={() => setViewingRow(null)} aria-label="Close"><svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div className="modal-body" style={{ padding: 'var(--sp-lg) var(--sp-xl)' }}>
              {viewingRow.system_info && (
                <div style={{
                  display: 'flex',
                  gap: 'var(--sp-md)',
                  flexWrap: 'wrap',
                  padding: 'var(--sp-sm) var(--sp-md)',
                  background: 'var(--bg)',
                  borderRadius: 'var(--r)',
                  border: '1px solid var(--border)',
                  fontSize: 'var(--fs-version)',
                  color: 'var(--muted)',
                  marginBottom: 'var(--sp-lg)',
                }}>
                  <span>{viewingRow.system_info.browser}</span>
                  <span>{viewingRow.system_info.os} {viewingRow.system_info.os_version}</span>
                  <span>{viewingRow.system_info.viewport}</span>
                </div>
              )}
              {columns.map(col => (
                <div key={col.key} style={{ marginBottom: 'var(--sp-md)' }}>
                  <label className="label" style={{ marginBottom: '4px' }}>{col.label}</label>
                  <pre style={{
                    margin: 0,
                    padding: 'var(--sp-sm) var(--sp-md)',
                    background: 'var(--bg)',
                    borderRadius: 'var(--r)',
                    border: '1px solid var(--border)',
                    fontSize: 'var(--fs-xs)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '200px',
                    overflow: 'auto',
                  }}>
                    {col.key === '_user'
                      ? (() => {
                          const historical = formatUser(viewingRow)
                          const current = formatCurrentUser(viewingRow)
                          return current && current !== historical
                            ? `${historical}\nCurrent identity: ${current}`
                            : historical
                        })()
                      : col.key === 'created_at'
                        ? `${formatCreated(viewingRow.created_at, timeZone)} (${timeZone})\n${viewingRow.created_at} (UTC)`
                      : typeof viewingRow[col.key as keyof AuditRow] === 'object' && viewingRow[col.key as keyof AuditRow] !== null
                        ? JSON.stringify(viewingRow[col.key as keyof AuditRow], null, 2)
                        : formatCell(viewingRow[col.key as keyof AuditRow])}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}
