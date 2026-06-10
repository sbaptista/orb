'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { createProject, updateProject, deleteProject } from '@/app/actions/manage-project'

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
  const [code, setCode]             = useState(project?.code ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [codeAutoSync, setCodeAutoSync] = useState(!isEdit)
  const [saving, setSaving]         = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError]           = useState('')

  function handleNameChange(value: string) {
    setName(value)
    if (codeAutoSync) setCode(value.slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, ''))
  }

  function handleCodeChange(value: string) {
    setCodeAutoSync(false)
    setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    if (!code.trim()) { setError('Code is required'); return }
    setSaving(true)
    setError('')

    try {
      if (isEdit) {
        const result = await updateProject(project.id, {
          name: name.trim(),
          code: code.trim() || null,
          description: description.trim() || null,
        })
        setSaving(false)
        if (result.error) { console.error('[AddProductModal] update error:', result.error); setSaving(false); setError(result.error); return }
        if (result.project) { toast.success('Project updated.'); onUpdated?.(result.project as Project) }
      } else {
        const result = await createProject({
          name: name.trim(),
          code: code.trim() || null,
          description: description.trim() || null,
          ownerId,
        })
        setSaving(false)
        if (result.error) { console.error('[AddProductModal] create error:', result.error); setSaving(false); setError(result.error); return }
        if (result.project) { toast.success('Project created.'); onCreated?.(result.project as Project) }
      }
    } catch (caught) {
      setSaving(false)
      console.error('[AddProductModal] thrown error:', caught)
      toast.error('Failed to create project. Try again.')
    }
  }

  async function handleDelete() {
    setSaving(true)
    const result = await deleteProject(project!.id)
    setSaving(false)
    if (result.error) { toast.error('Failed to delete project.'); return }
    toast.success('Project deleted.')
    onDeleted?.(project!.id)
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
              onChange={e => handleNameChange(e.target.value)}
              placeholder="My project"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="apm-code" className="pf-label" style={{ marginBottom: 'var(--sp-xs)' }}>Code</label>
            <input
              id="apm-code"
              className="pf-input"
              style={{ fontFamily: 'var(--font-mono)' }}
              value={code}
              onChange={e => handleCodeChange(e.target.value)}
              placeholder="PROJ"
              maxLength={6}
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
              <button type="button" onClick={() => setConfirmDelete(true)} className="text-btn text-error">
                Delete
              </button>
            )}
            {isEdit && confirmDelete && (
              <>
                <span className="text-sm" style={{ color: 'var(--text3)', marginRight: 'auto' }}>Sure?</span>
                <button type="button" onClick={handleDelete} disabled={saving} className="text-btn text-error" style={{ fontWeight: 'var(--fw-medium)' }}>
                  {saving ? 'Deleting…' : 'Yes, delete'}
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="text-btn">
                  Cancel
                </button>
              </>
            )}
            {!confirmDelete && (
              <>
                <button type="button" onClick={onClose} className="text-btn" style={{ marginLeft: isEdit ? 0 : 'auto' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="save-btn">
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
