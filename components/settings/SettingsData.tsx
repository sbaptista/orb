'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVisibilityRefetch } from '@/lib/hooks/useVisibilityRefetch'

type AuditRow = Record<string, unknown>

export default function SettingsData() {
  const supabase = useMemo(() => createClient(), [])
  const [exporting, setExporting] = useState(false)
  const [auditLog, setAuditLog] = useState<AuditRow[]>([])
  const [auditLoading, setAuditLoading] = useState(true)
  const [auditError, setAuditError] = useState('')
  const [auditPage, setAuditPage] = useState(0)
  const PAGE_SIZE = 50

  const loadAudit = useCallback(async () => {
    setAuditLoading(true)
    setAuditError('')
    const from = auditPage * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to)
    if (error) {
      setAuditError(error.message)
    } else {
      setAuditLog(data ?? [])
    }
    setAuditLoading(false)
  }, [supabase, auditPage])

  useVisibilityRefetch(loadAudit)
  useEffect(() => { loadAudit() }, [loadAudit])

  async function handleExport() {
    setExporting(true)
    const [products, groups, categories, platforms, todos, todoPlatforms] = await Promise.all([
      supabase.from('projects').select('*').order('sort_order'),
      supabase.from('groups').select('*').order('sort_order'),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('platforms').select('*').order('sort_order'),
      supabase.from('todos').select('*').order('created_at'),
      supabase.from('todo_platforms').select('*'),
    ])

    const payload = {
      exported_at: new Date().toISOString(),
      products: products.data ?? [],
      groups: groups.data ?? [],
      categories: categories.data ?? [],
      platforms: platforms.data ?? [],
      todos: todos.data ?? [],
      todo_platforms: todoPlatforms.data ?? [],
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
        Data
      </h2>

      {/* Export section */}
      <div style={{ ...cardStyle, marginBottom: 'var(--sp-3xl)' }}>
        <h3 style={{
          fontSize: 'var(--fs-sm)',
          fontWeight: 'var(--fw-medium)',
          color: 'var(--text2)',
          margin: '0 0 var(--sp-xs)',
        }}>
          Export Data
        </h3>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', margin: '0 0 var(--sp-lg)' }}>
          Download all your products, groups, categories, platforms, and todos as a single JSON file.
        </p>
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
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--border-focus)'
            e.currentTarget.style.color = 'var(--text)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.color = 'var(--text2)'
          }}
        >
          {exporting ? 'Preparing…' : 'Download JSON'}
        </button>
      </div>

      {/* Audit log section */}
      <div>
        <h3 style={{
          fontSize: 'var(--fs-sm)',
          fontWeight: 'var(--fw-medium)',
          color: 'var(--text2)',
          margin: '0 0 var(--sp-md)',
        }}>
          Audit Log
        </h3>

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
