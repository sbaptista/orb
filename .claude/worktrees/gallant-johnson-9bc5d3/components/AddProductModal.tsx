'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

type Project = { id: string; name: string; code: string | null; description: string | null }

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r)',
  padding: '10px var(--sp-md)',
  fontSize: 'var(--fs-input)',
  background: 'var(--bg)',
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color var(--transition)',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--fs-xs)',
  fontWeight: 'var(--fw-medium)',
  color: 'var(--text3)',
  marginBottom: 'var(--sp-xs)',
}

export default function AddProductModal({
  onClose,
  onCreated,
  onUpdated,
  onDeleted,
  project,
}: {
  onClose: () => void
  onCreated?: (project: Project) => void
  onUpdated?: (project: Project) => void
  onDeleted?: (id: string) => void
  project?: Project
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
    setSaving(true)
    setError('')
    const supabase = createClient()

    if (isEdit) {
      const { data, error: err } = await supabase
        .from('projects')
        .update({
          name: name.trim(),
          code: code.trim() || null,
          description: description.trim() || null,
        })
        .eq('id', project.id)
        .select('id, name, code, description')
        .single()
      setSaving(false)
      if (err) { toast.error('Failed to update project. Try again.'); return }
      if (data) { toast.success('Project updated.'); onUpdated?.(data as Project) }
    } else {
      const { data, error: err } = await supabase
        .from('projects')
        .insert({
          name: name.trim(),
          code: code.trim() || null,
          description: description.trim() || null,
          sort_order: 0,
        })
        .select('id, name, code, description')
        .single()
      setSaving(false)
      if (err) { toast.error('Failed to create project. Try again.'); return }
      if (data) { toast.success('Project created.'); onCreated?.(data as Project) }
    }
  }

  async function handleDelete() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('projects').delete().eq('id', project!.id)
    setSaving(false)
    toast.success('Project deleted.')
    onDeleted?.(project!.id)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(42, 51, 42, 0.3)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="apm-title"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 50,
          width: '100%',
          maxWidth: '400px',
          background: 'var(--bg2)',
          borderRadius: 'var(--r-xl)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          padding: 'var(--sp-2xl)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-xl)' }}>
          <h2 id="apm-title" style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text)', margin: 0 }}>
            {isEdit ? 'Edit project' : 'New project'}
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px', lineHeight: 1 }}
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
          <div>
            <label htmlFor="apm-name" style={labelStyle}>Name *</label>
            <input
              id="apm-name"
              style={inputStyle}
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="My project"
              autoFocus
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>

          <div>
            <label htmlFor="apm-code" style={labelStyle}>Code</label>
            <input
              id="apm-code"
              style={{ ...inputStyle, fontFamily: 'monospace' }}
              value={code}
              onChange={e => handleCodeChange(e.target.value)}
              placeholder="PROJ"
              maxLength={6}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>

          <div>
            <label htmlFor="apm-desc" style={labelStyle}>Description</label>
            <textarea
              id="apm-desc"
              rows={3}
              style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What this project is about"
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>

          {error && (
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--error)', margin: 0 }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: 'var(--sp-md)', alignItems: 'center', marginTop: 'var(--sp-xs)' }}>
            {isEdit && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                style={{ background: 'none', border: 'none', fontSize: 'var(--fs-sm)', color: 'var(--error)', cursor: 'pointer', padding: '8px 0', marginRight: 'auto' }}
              >
                Delete
              </button>
            )}
            {isEdit && confirmDelete && (
              <>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text3)', marginRight: 'auto' }}>Sure?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  style={{ background: 'none', border: 'none', fontSize: 'var(--fs-sm)', color: 'var(--error)', fontWeight: 'var(--fw-medium)', cursor: 'pointer', padding: '8px var(--sp-sm)' }}
                >
                  {saving ? 'Deleting…' : 'Yes, delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  style={{ background: 'none', border: 'none', fontSize: 'var(--fs-sm)', color: 'var(--text3)', cursor: 'pointer', padding: '8px var(--sp-sm)' }}
                >
                  Cancel
                </button>
              </>
            )}
            {!confirmDelete && (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  style={{ background: 'none', border: 'none', fontSize: 'var(--fs-sm)', color: 'var(--text3)', cursor: 'pointer', padding: '8px var(--sp-md)', marginLeft: isEdit ? 0 : 'auto' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    background: 'var(--success)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--r)',
                    padding: '8px var(--sp-xl)',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 'var(--fw-medium)',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                    transition: 'opacity var(--transition)',
                  }}
                >
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
