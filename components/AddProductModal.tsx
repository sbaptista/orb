'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { createProject, updateProject, deleteProject } from '@/app/actions/manage-project'
import { startInteraction } from '@/lib/performance/telemetry'

type Project = { id: string; name: string; code: string | null; description: string | null; created_by: string }

export default function AddProductModal({
  onClose,
  onCreated,
  onUpdated,
  onDeleted,
  project,
  ownerId,
}: {
  onClose: () => void
  onCreated?: (project: Project) => void
  onUpdated?: (project: Project) => void
  onDeleted?: (id: string) => void
  project?: Project
  ownerId?: string | null
}) {
  const isEdit = !!project
  const toast = useToast()
  const [name, setName]             = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [saving, setSaving]         = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError]           = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const measurement = startInteraction({
      focus: 'dashboard-clicks',
      flow: 'dashboard-projects',
      interaction: isEdit ? 'project_update' : 'project_create',
      surface: 'dashboard',
      immediateFlush: true,
      metadata: { projectId: project?.id ?? null, ownerId: ownerId ?? null },
    })
    if (!name.trim()) { setError('Name is required'); measurement.end(false, 'validation_failed'); return }
    setSaving(true)
    setError('')

    try {
      if (isEdit) {
        const result = await updateProject(project.id, {
          name: name.trim(),
          description: description.trim() || null,
        })
        measurement.mark('server_action_completed')
        setSaving(false)
        if (result.error) { console.error('[AddProductModal] update error:', result.error); setSaving(false); setError(result.error); measurement.end(false, 'project_update_failed', { error: result.error }); return }
        if (result.project) { toast.success('Project updated.'); onUpdated?.(result.project as Project); measurement.end(true, null, { projectId: result.project.id }) }
        else measurement.end(false, 'project_update_no_data')
      } else {
        const result = await createProject({
          name: name.trim(),
          description: description.trim() || null,
          ownerId,
        })
        measurement.mark('server_action_completed')
        setSaving(false)
        if (result.error) { console.error('[AddProductModal] create error:', result.error); setSaving(false); setError(result.error); measurement.end(false, 'project_create_failed', { error: result.error }); return }
        if (result.project) { toast.success('Project created.'); onCreated?.(result.project as Project); measurement.end(true, null, { projectId: result.project.id }) }
        else measurement.end(false, 'project_create_no_data')
      }
    } catch (caught) {
      setSaving(false)
      console.error('[AddProductModal] thrown error:', caught)
      toast.error('Failed to create project. Try again.')
      measurement.end(false, isEdit ? 'project_update_failed' : 'project_create_failed', { error: caught instanceof Error ? caught.message : String(caught) })
    }
  }

  async function handleDelete() {
    const measurement = startInteraction({
      focus: 'dashboard-clicks',
      flow: 'dashboard-projects',
      interaction: 'project_delete',
      surface: 'dashboard',
      immediateFlush: true,
      metadata: { projectId: project?.id ?? null },
    })
    setSaving(true)
    const result = await deleteProject(project!.id)
    measurement.mark('server_action_completed')
    setSaving(false)
    if (result.error) { toast.error('Failed to delete project.'); measurement.end(false, 'project_delete_failed', { error: result.error }); return }
    toast.success('Project deleted.')
    onDeleted?.(project!.id)
    measurement.end(true)
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />

      <div role="dialog" aria-modal="true" aria-labelledby="add-project-title" className="modal-center modal-sm">
        <div className="modal-header" style={{ justifyContent: 'space-between' }}>
          <h2 id="add-project-title" style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)' }}>
            {isEdit ? 'Edit project' : 'New project'}
          </h2>
          <button onClick={onClose} className="close-btn" aria-label="Close"><svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body" style={{ padding: 'var(--sp-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
          <div>
            <label htmlFor="apm-name" className="pf-label" style={{ marginBottom: 'var(--sp-xs)' }}>Name *</label>
            <input
              id="apm-name"
              className="pf-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My project"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="apm-desc" className="pf-label" style={{ marginBottom: 'var(--sp-xs)' }}>Description</label>
            <textarea
              id="apm-desc"
              rows={3}
              className="pf-textarea"
              style={{ resize: 'none' }}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What this project is about"
            />
          </div>

          {error && <p className="text-sm text-error" style={{ margin: 0 }}>{error}</p>}

          <div className="modal-footer">
            {isEdit && !confirmDelete && (
              <button type="button" onClick={() => setConfirmDelete(true)} className="btn-danger" style={{ marginRight: 'auto' }}>
                Delete
              </button>
            )}
            {isEdit && confirmDelete && (
              <>
                <span className="text-sm text-error" style={{ marginRight: 'auto' }}>Sure?</span>
                <button type="button" onClick={() => setConfirmDelete(false)} className="btn-cancel">
                  Cancel
                </button>
                <button type="button" onClick={handleDelete} disabled={saving} className="btn-danger">
                  {saving ? 'Deleting…' : 'Yes, delete'}
                </button>
              </>
            )}
            {!confirmDelete && (
              <>
                <button type="button" onClick={onClose} className="btn-cancel">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save' : 'Create')}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </>
  )
}
