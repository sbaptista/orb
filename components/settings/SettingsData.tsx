'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { prepareArchive, purgeArchivedTasks } from '@/app/actions/archive-data'
import { importData } from '@/app/actions/import-data'
import DistillModal from '@/components/DistillModal'

export default function SettingsData() {
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [distillQueue, setDistillQueue] = useState<any[]>([])
  const [distillIndex, setDistillIndex] = useState(0)

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
      else toast.success('Data restored successfully.')
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
      <div>
        <h3 className="s-section-title">Data Lifecycle</h3>
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
    </div>
  )
}
