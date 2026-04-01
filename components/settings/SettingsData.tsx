'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

type AuditRow = Record<string, unknown>

export default function SettingsData() {
  const supabase = useMemo(() => createClient(), [])
  const [exporting, setExporting] = useState(false)
  const [auditLog, setAuditLog] = useState<AuditRow[]>([])
  const [auditLoading, setAuditLoading] = useState(true)
  const [auditError, setAuditError] = useState('')
  const [auditPage, setAuditPage] = useState(0)
  const PAGE_SIZE = 50

  useEffect(() => {
    async function loadAudit() {
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
    }
    loadAudit()
  }, [supabase, auditPage])

  async function handleExport() {
    setExporting(true)
    const [products, groups, categories, platforms, todos, todoPlatforms] = await Promise.all([
      supabase.from('products').select('*').order('sort_order'),
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

  // Derive columns from first audit row
  const auditColumns = auditLog.length > 0 ? Object.keys(auditLog[0]) : []

  function formatCell(value: unknown): string {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-lg font-semibold mb-6">Data</h2>

      {/* Export section */}
      <div className="bg-white rounded-lg border border-zinc-200 p-5 mb-8">
        <h3 className="text-sm font-medium text-zinc-700 mb-1">Export Data</h3>
        <p className="text-xs text-zinc-400 mb-4">
          Download all your products, groups, categories, platforms, and todos as a single JSON file.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="text-sm border border-zinc-200 px-3 py-1.5 rounded text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 transition-colors disabled:opacity-50"
        >
          {exporting ? 'Preparing…' : 'Download JSON'}
        </button>
      </div>

      {/* Audit log section */}
      <div>
        <h3 className="text-sm font-medium text-zinc-700 mb-3">Audit Log</h3>

        {auditError && (
          <p className="text-sm text-red-600 mb-3">{auditError}</p>
        )}

        {auditLoading ? (
          <div className="text-sm text-zinc-400">Loading…</div>
        ) : auditLog.length === 0 ? (
          <div className="bg-white rounded-lg border border-zinc-200 px-4 py-8 text-center text-sm text-zinc-400">
            No audit log entries found.
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    {auditColumns.map(col => (
                      <th
                        key={col}
                        className="text-left px-3 py-2 font-medium text-zinc-500 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {auditLog.map((row, i) => (
                    <tr key={i} className="hover:bg-zinc-50">
                      {auditColumns.map(col => (
                        <td
                          key={col}
                          className="px-3 py-2 text-zinc-700 max-w-xs truncate"
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

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-100">
              <button
                onClick={() => setAuditPage(p => Math.max(0, p - 1))}
                disabled={auditPage === 0}
                className="text-xs text-zinc-500 hover:text-zinc-800 disabled:opacity-30"
              >
                ← Previous
              </button>
              <span className="text-xs text-zinc-400">
                Page {auditPage + 1}
              </span>
              <button
                onClick={() => setAuditPage(p => p + 1)}
                disabled={auditLog.length < PAGE_SIZE}
                className="text-xs text-zinc-500 hover:text-zinc-800 disabled:opacity-30"
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
