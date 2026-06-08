'use client'

import { useState } from 'react'
import { saveKnowledge } from '@/app/actions/save-knowledge'
import { useToast } from '@/components/ui/Toast'

type Props = {
  todoId: string | null
  productId: string
  initialTitle: string
  initialContent: string
  note?: string
  onClose: () => void
  onSaved: () => void
}

export default function DistillModal({
  todoId,
  productId,
  initialTitle,
  initialContent,
  note,
  onClose,
  onSaved,
}: Props) {
  const toast = useToast()
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!content.trim()) return
    setSaving(true)

    const res = await saveKnowledge({
      product_id: productId,
      origin_todo_id: todoId,
      title: title || 'Unnamed Insight',
      content: content,
    })

    setSaving(false)
    if (res.error) {
      toast.error('Failed to save knowledge. Try again.')
    } else {
      toast.success('Knowledge saved.')
      onSaved()
    }
  }

  return (
    <>
      <div className="modal-backdrop" style={{ zIndex: 100 }} onClick={onClose} />

      <div className="modal-center" style={{ zIndex: 101 }}>
        <div className="modal-header" style={{ justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--text)' }}>Distill Knowledge</h3>
            <p style={{ margin: 0, marginTop: 'var(--sp-xs)', fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>
              {note ?? 'Extract a lesson or decision from this task to preserve it in the Knowledge Repository.'}
            </p>
          </div>
          <button onClick={onClose} className="close-btn" aria-label="Close"><svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>

        <div className="modal-body" style={{ padding: 'var(--sp-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
          <div className="pf-field">
            <label className="pf-label">Insight Title</label>
            <input
              className="pf-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="E.g., Design choice for streaming..."
            />
          </div>

          <div className="pf-field">
            <label className="pf-label">The Insight</label>
            <textarea
              className="pf-textarea"
              style={{ minHeight: '120px' }}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="What was the key lesson or decision?"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="text-btn">Skip for now</button>
          <button onClick={handleSave} disabled={saving || !content.trim()} className="save-btn">
            {saving ? 'Saving...' : 'Save to Knowledge'}
          </button>
        </div>
      </div>
    </>
  )
}
