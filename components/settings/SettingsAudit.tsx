'use client'

import { useState } from 'react'
import SettingsCrudList from './SettingsCrudList'
import { getAuditLogs } from '@/app/actions/get-audit-logs'
import { deleteAuditLogs } from '@/app/actions/delete-audit-logs'
import { diagnoseAudit } from '@/app/actions/diagnose-audit'

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
}

type AuditForm = Record<string, never>

const EMPTY_FORM: AuditForm = {}
const PAGE_SIZE = 50

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default function SettingsAudit() {
  const [viewingRow, setViewingRow] = useState<AuditRow | null>(null)
  const [diagnostic, setDiagnostic] = useState<string | null>(null)
  const isDev = process.env.NODE_ENV === 'development'

  const columns: Array<{ key: keyof AuditRow; label: string }> = [
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
          subtitle: (items, total) => total ? `${items.length} of ${total} entr${total !== 1 ? 'ies' : 'y'}` : `${items.length} entr${items.length !== 1 ? 'ies' : 'y'}`,
          searchPlaceholder: 'Filter by table, action, actor, or full record ID…',
          onRowClick: (item) => setViewingRow(item),
          headerExtra: isDev ? (
            <div className="flex-row gap-sm">
              {diagnostic && (
                <button className="btn-dev" onClick={() => navigator.clipboard.writeText(diagnostic)}>
                  Copy
                </button>
              )}
              <button
                className="btn-dev"
                onClick={async () => {
                  setDiagnostic('Running…')
                  const r = await diagnoseAudit()
                  setDiagnostic(JSON.stringify(r, null, 2))
                }}
              >
                Diagnose
              </button>
            </div>
          ) : undefined,

          tableColumns: [
            { label: 'Table',   width: '12%', sortKey: 'table_name', sortValue: (r: AuditRow) => r.table_name ?? '' },
            { label: 'Action',  width: '10%', sortKey: 'action',     sortValue: (r: AuditRow) => r.action ?? '' },
            { label: 'Actor',   width: '12%', sortKey: 'actor',      sortValue: (r: AuditRow) => r.actor ?? '' },
            { label: 'Record',  width: '14%' },
            { label: 'Before',  width: '18%' },
            { label: 'After',   width: '18%' },
            { label: 'Created', width: '16%', sortKey: 'created_at', sortValue: (r: AuditRow) => new Date(r.created_at).getTime() },
          ],

          load: async (_supabase, pagination) => {
            const res = await getAuditLogs({
              page: pagination?.page,
              pageSize: pagination?.pageSize,
              search: pagination?.search,
              sortKey: pagination?.sortKey,
              sortDir: pagination?.sortDir,
            })
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
              <td className="audit-td" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text2)' }}>
                {item.actor ?? '—'}
              </td>
              <td className="audit-td" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-version)', color: 'var(--muted)' }}>
                {item.record_id ? item.record_id.slice(0, 8) + '…' : '—'}
              </td>
              <td className="audit-td" style={{ fontSize: 'var(--fs-version)', color: 'var(--muted)' }} title={formatCell(item.before)}>
                {formatCell(item.before)}
              </td>
              <td className="audit-td" style={{ fontSize: 'var(--fs-version)', color: 'var(--muted)' }} title={formatCell(item.after)}>
                {formatCell(item.after)}
              </td>
              <td className="audit-td" style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>
                {new Date(item.created_at).toLocaleString()}
              </td>
            </tr>
          ),
        }}
      />

      {isDev && diagnostic && (
        <div className="settings-page s-page-wide" style={{ paddingTop: 0 }}>
          <pre className="diagnostic-pre">{diagnostic}</pre>
        </div>
      )}

      {/* Audit row detail modal */}
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
                    {typeof viewingRow[col.key] === 'object' && viewingRow[col.key] !== null
                      ? JSON.stringify(viewingRow[col.key], null, 2)
                      : formatCell(viewingRow[col.key])}
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
