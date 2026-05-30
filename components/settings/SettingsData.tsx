'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import { useToast } from '@/components/ui/Toast'
import { prepareArchive, purgeArchivedTasks } from '@/app/actions/archive-data'
import { importData } from '@/app/actions/import-data'
import { getAuditLogs } from '@/app/actions/get-audit-logs'
import { deleteAuditLogs } from '@/app/actions/delete-audit-logs'
import { diagnoseAudit } from '@/app/actions/diagnose-audit'
import DistillModal from '@/components/DistillModal'
import HScrollNav from '@/components/ui/HScrollNav'

type AuditRow = Record<string, unknown>

export default function SettingsData() {
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [distillQueue, setDistillQueue] = useState<any[]>([])
  const [distillIndex, setDistillIndex] = useState(0)
  const [auditLog, setAuditLog] = useState<AuditRow[]>([])
  const [auditLoading, setAuditLoading] = useState(true)
  const [auditError, setAuditError] = useState('')
  const [auditPage, setAuditPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [diagnostic, setDiagnostic] = useState<string | null>(null)
  const [auditSelectedIds, setAuditSelectedIds] = useState<string[]>([])
  const [viewingRow, setViewingRow] = useState<AuditRow | null>(null)
  const auditScrollRef = useRef<HTMLDivElement>(null)
  const PAGE_SIZE = 50
  const isDev = process.env.NODE_ENV === 'development'

  const loadAudit = useCallback(async () => {
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

  useVisibilityRefetch(loadAudit)
  useEffect(() => { loadAudit() }, [loadAudit])

  async function handleExport() {
    setExporting(true)
    const [products, groups, categories, platforms, todos, todoPlatforms, knowledge] = await Promise.all([
      supabase.from('projects').select('*').order('sort_order'),
      supabase.from('groups').select('*').order('sort_order'),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('platforms').select('*').order('sort_order'),
      supabase.from('todos').select('*').order('created_at'),
      supabase.from('todo_platforms').select('*'),
      supabase.from('knowledge_repo').select('*').order('created_at'),
    ])

    const payload = {
      exported_at: new Date().toISOString(),
      products: products.data ?? [],
      groups: groups.data ?? [],
      categories: categories.data ?? [],
      platforms: platforms.data ?? [],
      todos: todos.data ?? [],
      todo_platforms: todoPlatforms.data ?? [],
      knowledge_repo: knowledge.data ?? [],
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `todos-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!confirm('This will restore data from the archive. Existing records with matching IDs will be updated (upsert). Proceed?')) return

    setImporting(true)
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      const res = await importData(payload)
      if (res.error) toast.error(`Import failed: ${res.error}`)
      else {
        toast.success('Data restored successfully.')
        loadAudit()
      }
    } catch (err: any) {
      toast.error(`Invalid file: ${err.message}`)
    } finally {
      setImporting(false)
      if (e.target) e.target.value = ''
    }
  }

  async function handleArchive() {
    if (!confirm('This will download all closed tasks older than 30 days as a JSON file and then PERMANENTLY delete them from the database. Proceed?')) return

    setExporting(true)
    const result = await prepareArchive()

    if (!result.success || !result.data || result.data.length === 0) {
      toast.neutral(result.error || 'No aged tasks found to archive.')
      setExporting(false)
      return
    }

    const archivePayload = { archived_at: new Date().toISOString(), todos: result.data }
    const blob = new Blob([JSON.stringify(archivePayload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `todos-archive-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    if (confirm(`Archive downloaded (${result.count} tasks). Permanently delete these records from Supabase now?`)) {
      const purgeResult = await purgeArchivedTasks(result.data.map((t: any) => t.id))
      if (purgeResult.success) {
        toast.success('Archival complete. Database purged.')
        const candidates = result.data.filter((t: any) => t.resolution_notes?.trim())
        if (candidates.length > 0) {
          setDistillQueue(candidates)
          setDistillIndex(0)
        }
      } else {
        toast.error('Archive saved, but purge failed: ' + purgeResult.error)
      }
    } else {
      toast.neutral('Archive saved. Database was NOT purged.')
    }

    setExporting(false)
    loadAudit()
  }

  const auditColumns = auditLog.length > 0 ? Object.keys(auditLog[0]) : []

  function formatCell(value: unknown): string {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  return (
    <div className="settings-page s-page-wide">
      <h2 className="s-title mb-2xl">Data Management</h2>

      {/* 1. Backup & Recovery */}
      <div className="mb-3xl">
        <h3 className="s-section-title">Backup & Recovery</h3>
        <div className="s-card">
          <div className="s-card-row settings-card-row">
            <div className="flex-1">
              <h4 className="s-card-title">System Archive</h4>
              <p className="s-card-desc">
                Portability layer for your entire workspace. Export includes all projects, tasks, and knowledge entries. Import restores or merges from any exported file.
              </p>
            </div>
            <div className="settings-card-actions flex-row gap-md shrink-0">
              <button
                className="btn-outline"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? 'Exporting…' : 'Export Full'}
              </button>

              <label className="btn-outline" style={{
                display: 'inline-block',
                cursor: importing ? 'not-allowed' : 'pointer',
                opacity: importing ? 0.6 : 1,
              }}>
                {importing ? 'Importing…' : 'Import Archive'}
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  disabled={importing}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Data Lifecycle */}
      <div className="mb-3xl">
        <h3 className="s-section-title">Data Lifecycle</h3>
        <div className="flex-col gap-lg">
          <div className="s-card">
            <div className="s-card-row settings-card-row">
              <div className="flex-1">
                <h4 className="s-card-title">Task Archival</h4>
                <p className="s-card-desc">
                  Bulk export and purge closed tasks older than 30 days. Keeps the live database lean and fast.
                </p>
              </div>
              <button
                className="btn-outline shrink-0"
                onClick={handleArchive}
                disabled={exporting}
              >
                {exporting ? 'Working…' : 'Archive & Purge'}
              </button>
            </div>
          </div>

          <div className="s-card">
            <div className="s-card-row settings-card-row">
              <div className="flex-1">
                <h4 className="s-card-title">Knowledge Repository</h4>
                <p className="s-card-desc">
                  Manage, search, and archive curated insights and historical decisions.
                </p>
              </div>
              <button
                className="btn-outline shrink-0"
                onClick={() => window.location.href = '/settings/knowledge'}
              >
                Manage Repo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Distillation queue */}
      {distillQueue.length > 0 && distillIndex < distillQueue.length && (() => {
        const todo = distillQueue[distillIndex]
        const position = distillQueue.length > 1 ? `${distillIndex + 1} of ${distillQueue.length} — ` : ''
        const advance = () => setDistillIndex(i => i + 1)
        return (
          <DistillModal
            key={todo.id}
            todoId={null}
            productId={todo.product_id}
            initialTitle={todo.title}
            initialContent={todo.resolution_notes || ''}
            note={`${position}Archived task — distill any insight worth keeping.`}
            onClose={advance}
            onSaved={advance}
          />
        )
      })()}

      {/* 3. Audit Log */}
      <div>
        <div className="flex-between mb-md">
          <h3 className="text-sm" style={{ fontWeight: 'var(--fw-medium)', color: 'var(--text2)', margin: 0 }}>
            Audit Log
            {totalCount > 0 && <span className="text-muted" style={{ fontWeight: 400 }}> · {totalCount} total</span>}
          </h3>
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
                  loadAudit()
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

        {auditSelectedIds.length > 0 && (
          <div className="crud-bulk-bar">
            <span className="text-sm" style={{ fontWeight: 500 }}>
              {auditSelectedIds.length} selected
            </span>
            <button
              className="oc-tool-btn"
              onClick={async () => {
                const count = auditSelectedIds.length
                if (!confirm(`Permanently delete ${count} audit log entr${count > 1 ? 'ies' : 'y'}? This cannot be undone.`)) return
                const res = await deleteAuditLogs(auditSelectedIds)
                if (res.error) { toast.error(res.error); return }
                toast.success(`${count} entr${count > 1 ? 'ies' : 'y'} deleted.`)
                setAuditSelectedIds([])
                loadAudit()
              }}
              style={{ fontSize: '12px', color: 'var(--error)', borderColor: 'var(--error)' }}
            >
              Delete
            </button>
            <button
              className="text-btn text-sm"
              onClick={() => setAuditSelectedIds([])}
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
          <HScrollNav scrollRef={auditScrollRef as React.RefObject<HTMLElement>} className="crud-table-scroll">
            <div className="s-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div ref={auditScrollRef} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table className="audit-table">
                  <thead>
                    <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                      <th className="audit-th" style={{ width: '36px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={auditLog.length > 0 && auditLog.every(r => auditSelectedIds.includes(String(r.id)))}
                          onChange={() => {
                            const ids = auditLog.map(r => String(r.id))
                            if (ids.every(id => auditSelectedIds.includes(id))) setAuditSelectedIds([])
                            else setAuditSelectedIds(ids)
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                      </th>
                      {auditColumns.filter(c => c !== 'id').map(col => (
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
                            checked={auditSelectedIds.includes(String(row.id))}
                            onChange={() => {
                              const id = String(row.id)
                              setAuditSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        {auditColumns.filter(c => c !== 'id').map(col => (
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
                  onClick={() => { setAuditPage(p => Math.max(0, p - 1)); setAuditSelectedIds([]) }}
                  disabled={auditPage === 0}
                >
                  ← Previous
                </button>
                <span className="text-xs text-muted">Page {auditPage + 1}</span>
                <button
                  className="btn-pager"
                  onClick={() => { setAuditPage(p => p + 1); setAuditSelectedIds([]) }}
                  disabled={auditLog.length < PAGE_SIZE}
                >
                  Next →
                </button>
              </div>
            </div>
          </HScrollNav>
        )}
      </div>

      {/* Audit row detail modal */}
      {viewingRow && (
        <>
          <div className="modal-backdrop" onClick={() => setViewingRow(null)} />
          <div className="modal-center" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 style={{ flex: 1, margin: 0, fontSize: 'var(--fs-base)', fontWeight: 600 }}>
                Audit Entry
              </h3>
              <button className="close-btn" onClick={() => setViewingRow(null)} aria-label="Close">×</button>
            </div>
            <div className="modal-body" style={{ padding: 'var(--sp-lg) var(--sp-xl)' }}>
              {auditColumns.filter(c => c !== 'id').map(col => (
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
