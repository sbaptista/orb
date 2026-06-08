'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import { useToast } from '@/components/ui/Toast'
import { getAuditLogs } from '@/app/actions/get-audit-logs'
import { deleteAuditLogs } from '@/app/actions/delete-audit-logs'
import { diagnoseAudit } from '@/app/actions/diagnose-audit'
import HScrollNav from '@/components/ui/HScrollNav'

type AuditRow = Record<string, unknown>

export default function SettingsAudit() {
  const toast = useToast()
  const [auditLog, setAuditLog] = useState<AuditRow[]>([])
  const [auditLoading, setAuditLoading] = useState(true)
  const [auditError, setAuditError] = useState('')
  const [auditPage, setAuditPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [diagnostic, setDiagnostic] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [viewingRow, setViewingRow] = useState<AuditRow | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const PAGE_SIZE = 50
  const isDev = process.env.NODE_ENV === 'development'

  const load = useCallback(async () => {
    setAuditLoading(true)
    setAuditError('')
    const res = await getAuditLogs(auditPage, PAGE_SIZE)
    if (res.error) {
      setAuditError(res.error)
    } else {
      setAuditLog(res.data ?? [])
      setTotalCount(res.count ?? 0)
    }
    setAuditLoading(false)
  }, [auditPage])

  useVisibilityRefetch(load)
  useEffect(() => { load() }, [load])

  const columns = auditLog.length > 0 ? Object.keys(auditLog[0]) : []

  function formatCell(value: unknown): string {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  const allChecked = auditLog.length > 0 && auditLog.every(r => selectedIds.includes(String(r.id)))

  return (
    <div className="settings-page s-page-wide">
      <div className="s-header">
        <div>
          <h2 className="s-title">Audit Log</h2>
          {totalCount > 0 && <p className="text-sm text-muted">{totalCount} entries</p>}
        </div>
        {isDev && (
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
                load()
              }}
            >
              Diagnose
            </button>
          </div>
        )}
      </div>

      {isDev && diagnostic && (
        <pre className="diagnostic-pre">{diagnostic}</pre>
      )}

      {auditError && <p className="s-error">{auditError}</p>}

      {selectedIds.length > 0 && (
        <div className="crud-bulk-bar">
          <span className="text-sm" style={{ fontWeight: 500 }}>
            {selectedIds.length} selected
          </span>
          <button
            className="oc-tool-btn"
            onClick={async () => {
              const count = selectedIds.length
              if (!confirm(`Permanently delete ${count} audit log entr${count > 1 ? 'ies' : 'y'}? This cannot be undone.`)) return
              const res = await deleteAuditLogs(selectedIds)
              if (res.error) { toast.error(res.error); return }
              toast.success(`${count} entr${count > 1 ? 'ies' : 'y'} deleted.`)
              setSelectedIds([])
              load()
            }}
            style={{ fontSize: '12px', color: 'var(--error)', borderColor: 'var(--error)' }}
          >
            Delete
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

      {auditLoading ? (
        <div className="s-loading" style={{ padding: 0 }}>Loading…</div>
      ) : auditLog.length === 0 ? (
        <div className="s-card s-empty">No audit log entries found.</div>
      ) : (
        <HScrollNav scrollRef={scrollRef as React.RefObject<HTMLElement>} className="crud-table-scroll">
          <div className="s-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div ref={scrollRef} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="audit-table">
                <thead>
                  <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                    <th className="audit-th" style={{ width: '36px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={() => {
                          const ids = auditLog.map(r => String(r.id))
                          if (allChecked) setSelectedIds([])
                          else setSelectedIds(ids)
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    {columns.filter(c => c !== 'id').map(col => (
                      <th key={col} className="audit-th">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((row) => (
                    <tr
                      key={String(row.id)}
                      onClick={(e) => {
                        const tag = (e.target as HTMLElement).tagName
                        if (['BUTTON', 'INPUT', 'SELECT'].includes(tag)) return
                        if ((e.target as HTMLElement).closest('button, input, select')) return
                        setViewingRow(row)
                      }}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    >
                      <td className="audit-td" style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(String(row.id))}
                          onChange={() => {
                            const id = String(row.id)
                            setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      {columns.filter(c => c !== 'id').map(col => (
                        <td key={col} className="audit-td" title={formatCell(row[col])}>
                          {formatCell(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex-between" style={{ padding: 'var(--sp-sm) var(--sp-lg)', borderTop: '1px solid var(--border)' }}>
              <button
                className="btn-pager"
                onClick={() => { setAuditPage(p => Math.max(0, p - 1)); setSelectedIds([]) }}
                disabled={auditPage === 0}
              >
                ← Previous
              </button>
              <span className="text-xs text-muted">Page {auditPage + 1}</span>
              <button
                className="btn-pager"
                onClick={() => { setAuditPage(p => p + 1); setSelectedIds([]) }}
                disabled={auditLog.length < PAGE_SIZE}
              >
                Next →
              </button>
            </div>
          </div>
        </HScrollNav>
      )}

      {/* Audit row detail modal */}
      {viewingRow && (
        <>
          <div className="modal-backdrop" onClick={() => setViewingRow(null)} />
          <div className="modal-center" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 style={{ flex: 1, margin: 0, fontSize: 'var(--fs-base)', fontWeight: 600 }}>
                Audit Entry
              </h3>
              <button className="close-btn" onClick={() => setViewingRow(null)} aria-label="Close"><svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div className="modal-body" style={{ padding: 'var(--sp-lg) var(--sp-xl)' }}>
              {columns.filter(c => c !== 'id').map(col => (
                <div key={col} style={{ marginBottom: 'var(--sp-md)' }}>
                  <label className="label" style={{ marginBottom: '4px' }}>{col}</label>
                  <pre style={{
                    margin: 0,
                    padding: 'var(--sp-sm) var(--sp-md)',
                    background: 'var(--bg)',
                    borderRadius: 'var(--r)',
                    border: '1px solid var(--border)',
                    fontSize: '12px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '200px',
                    overflow: 'auto',
                  }}>
                    {typeof viewingRow[col] === 'object' && viewingRow[col] !== null
                      ? JSON.stringify(viewingRow[col], null, 2)
                      : formatCell(viewingRow[col])}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
