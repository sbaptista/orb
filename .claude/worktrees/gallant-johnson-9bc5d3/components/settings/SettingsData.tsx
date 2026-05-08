'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'
import { useToast } from '@/components/ui/Toast'
import { prepareArchive, purgeArchivedTasks } from '@/app/actions/archive-data'
import { importData } from '@/app/actions/import-data'
import { getAuditLogs } from '@/app/actions/get-audit-logs'
import { diagnoseAudit } from '@/app/actions/diagnose-audit'
import DistillModal from '@/components/DistillModal'

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

    // 1. Download wrapped archive file
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

    // 2. Confirm Purge
    if (confirm(`Archive downloaded (${result.count} tasks). Permanently delete these records from Supabase now?`)) {
      const purgeResult = await purgeArchivedTasks(result.data.map((t: any) => t.id))
      if (purgeResult.success) {
        toast.success('Archival complete. Database purged.')
        // 3. Offer knowledge distillation for tasks that have resolution notes
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

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg2)',
    borderRadius: 'var(--r-lg)',
    border: '1px solid var(--border)',
    padding: 'var(--sp-xl)',
  }

  return (
    <div style={{ padding: 'var(--sp-2xl)', maxWidth: '960px' }}>
      <h2 style={{
        fontSize: 'var(--fs-lg)',
        fontWeight: 'var(--fw-bold)',
        color: 'var(--text)',
        margin: '0 0 var(--sp-2xl)',
      }}>
        Data Management
      </h2>

      {/* 1. Backup & Recovery */}
      <div style={{ marginBottom: 'var(--sp-3xl)' }}>
        <h3 style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--sp-md)' }}>
          Backup & Recovery
        </h3>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sp-xl)' }}>
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text)', margin: '0 0 var(--sp-xs)' }}>
                System Archive
              </h4>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', margin: 0 }}>
                Portability layer for your entire workspace. Export includes all projects, tasks, and knowledge entries. Import restores or merges from any exported file.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-md)', flexShrink: 0 }}>
              <button
                onClick={handleExport}
                disabled={exporting}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r)',
                  padding: '8px var(--sp-md)',
                  fontSize: 'var(--fs-sm)',
                  color: 'var(--text2)',
                  cursor: exporting ? 'not-allowed' : 'pointer',
                  opacity: exporting ? 0.6 : 1,
                  transition: 'all var(--transition)',
                }}
              >
                {exporting ? 'Exporting…' : 'Export Full'}
              </button>

              <label style={{
                display: 'inline-block',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r)',
                padding: '8px var(--sp-md)',
                fontSize: 'var(--fs-sm)',
                color: 'var(--text2)',
                cursor: importing ? 'not-allowed' : 'pointer',
                opacity: importing ? 0.6 : 1,
                transition: 'all var(--transition)',
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
      <div style={{ marginBottom: 'var(--sp-3xl)' }}>
        <h3 style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--sp-md)' }}>
          Data Lifecycle
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
          {/* Todos Archival */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sp-xl)' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text)', margin: '0 0 var(--sp-xs)' }}>
                  Task Archival
                </h4>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', margin: 0 }}>
                  Bulk export and purge closed tasks older than 30 days. Keeps the live database lean and fast.
                </p>
              </div>
              <button
                onClick={handleArchive}
                disabled={exporting}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r)',
                  padding: '8px var(--sp-md)',
                  fontSize: 'var(--fs-sm)',
                  color: 'var(--text2)',
                  cursor: exporting ? 'not-allowed' : 'pointer',
                  opacity: exporting ? 0.6 : 1,
                  transition: 'all var(--transition)',
                  flexShrink: 0,
                }}
              >
                {exporting ? 'Working…' : 'Archive & Purge'}
              </button>
            </div>
          </div>

          {/* Knowledge Repo Link */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sp-xl)' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text)', margin: '0 0 var(--sp-xs)' }}>
                  Knowledge Repository
                </h4>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', margin: 0 }}>
                  Manage, search, and archive curated insights and historical decisions.
                </p>
              </div>
              <button
                onClick={() => window.location.href = '/settings/knowledge'}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r)',
                  padding: '8px var(--sp-md)',
                  fontSize: 'var(--fs-sm)',
                  color: 'var(--text2)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Manage Repo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Distillation queue — fires after Archive & Purge for todos with resolution notes */}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 var(--sp-md)' }}>
          <h3 style={{
            fontSize: 'var(--fs-sm)',
            fontWeight: 'var(--fw-medium)',
            color: 'var(--text2)',
            margin: 0,
          }}>
            Audit Log
          </h3>
          {isDev && (
            <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
              {diagnostic && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(diagnostic)
                  }}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r)',
                    padding: '4px 10px',
                    fontSize: 'var(--fs-xs)',
                    color: 'var(--text3)',
                    cursor: 'pointer',
                  }}
                >
                  Copy
                </button>
              )}
              <button
                onClick={async () => {
                  setDiagnostic('Running…')
                  const r = await diagnoseAudit()
                  setDiagnostic(JSON.stringify(r, null, 2))
                  loadAudit()
                }}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r)',
                  padding: '4px 10px',
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text3)',
                  cursor: 'pointer',
                }}
              >
                Diagnose
              </button>
            </div>
          )}
        </div>

        {isDev && diagnostic && (
          <pre style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r)',
            padding: 'var(--sp-md)',
            fontSize: 'var(--fs-xs)',
            color: 'var(--text2)',
            margin: '0 0 var(--sp-md)',
            overflow: 'auto',
            maxHeight: '400px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            userSelect: 'text',
            WebkitUserSelect: 'text',
            fontFamily: 'var(--font-mono, monospace)',
          }}>
            {diagnostic}
          </pre>
        )}

        {auditError && (
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--error)', marginBottom: 'var(--sp-md)' }}>
            {auditError}
          </p>
        )}

        {auditLoading ? (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>Loading…</div>
        ) : auditLog.length === 0 ? (
          <div style={{
            ...cardStyle,
            textAlign: 'center',
            padding: 'var(--sp-3xl)',
            fontSize: 'var(--fs-sm)',
            color: 'var(--muted)',
          }}>
            No audit log entries found.
          </div>
        ) : (
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 'var(--fs-xs)', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                    {auditColumns.map(col => (
                      <th
                        key={col}
                        style={{
                          textAlign: 'left',
                          padding: '8px var(--sp-md)',
                          fontWeight: 'var(--fw-medium)',
                          color: 'var(--text3)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((row, i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      {auditColumns.map(col => (
                        <td
                          key={col}
                          style={{
                            padding: '8px var(--sp-md)',
                            color: 'var(--text2)',
                            maxWidth: '280px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={formatCell(row[col])}
                        >
                          {formatCell(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--sp-sm) var(--sp-lg)',
              borderTop: '1px solid var(--border)',
            }}>
              <button
                onClick={() => setAuditPage(p => Math.max(0, p - 1))}
                disabled={auditPage === 0}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text3)',
                  cursor: auditPage === 0 ? 'not-allowed' : 'pointer',
                  opacity: auditPage === 0 ? 0.3 : 1,
                }}
              >
                ← Previous
              </button>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>
                Page {auditPage + 1}
              </span>
              <button
                onClick={() => setAuditPage(p => p + 1)}
                disabled={auditLog.length < PAGE_SIZE}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text3)',
                  cursor: auditLog.length < PAGE_SIZE ? 'not-allowed' : 'pointer',
                  opacity: auditLog.length < PAGE_SIZE ? 0.3 : 1,
                }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
