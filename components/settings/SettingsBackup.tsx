'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { importData } from '@/app/actions/import-data'

export default function SettingsBackup() {
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)

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

  return (
    <div className="settings-page s-page-wide">
      <h2 className="s-title mb-2xl">Backup & Recovery</h2>

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
  )
}
