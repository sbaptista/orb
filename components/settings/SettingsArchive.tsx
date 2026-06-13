'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { prepareArchive, purgeArchivedTasks } from '@/app/actions/archive-data'
import DistillModal from '@/components/DistillModal'

export default function SettingsArchive() {
  const toast = useToast()
  const [working, setWorking] = useState(false)
  const [distillQueue, setDistillQueue] = useState<any[]>([])
  const [distillIndex, setDistillIndex] = useState(0)

  async function handleArchive() {
    if (!confirm('This will download all closed tasks older than 30 days as a JSON file and then PERMANENTLY delete them from the database. Proceed?')) return

    setWorking(true)
    const result = await prepareArchive()

    if (!result.success || !result.data || result.data.length === 0) {
      toast.neutral(result.error || 'No aged tasks found to archive.')
      setWorking(false)
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

    setWorking(false)
  }

  return (
    <div className="settings-page s-page-wide">
      <h2 className="s-title mb-2xl">Task Archival</h2>

      <div className="s-card">
        <div className="s-card-row settings-card-row">
          <div className="flex-1">
            <h4 className="s-card-title">Archive & Purge</h4>
            <p className="s-card-desc">
              Bulk export and purge closed tasks older than 30 days. Keeps the live database lean and fast.
            </p>
          </div>
          <button
            className="btn-outline shrink-0"
            onClick={handleArchive}
            disabled={working}
          >
            {working ? 'Working…' : 'Archive & Purge'}
          </button>
        </div>
      </div>

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
