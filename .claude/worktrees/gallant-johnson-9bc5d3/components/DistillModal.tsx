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

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: 'var(--sp-lg)',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--fs-xs)',
    fontWeight: 600,
    color: 'var(--text3)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--fs-sm)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r)',
    padding: '10px 12px',
    color: 'var(--text)',
    outline: 'none',
  }

  return (
    <>
      <div 
        style={{ position: 'fixed', inset: 0, background: 'rgba(42,51,42,0.4)', zIndex: 100 }} 
        onClick={onClose}
      />
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '500px',
        maxWidth: '90vw',
        background: 'var(--bg2)',
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)',
        boxShadow: '0 12px 48px rgba(0,0,0,0.2)',
        padding: 'var(--sp-2xl)',
        zIndex: 101,
        fontFamily: 'var(--font-ui)',
      }}>
        <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--text)', margin: '0 0 var(--sp-xs)' }}>
          Distill Knowledge
        </h3>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', margin: '0 0 var(--sp-xl)' }}>
          {note ?? 'Extract a lesson or decision from this task to preserve it in the Knowledge Repository.'}
        </p>

        <div style={fieldStyle}>
          <label style={labelStyle}>Insight Title</label>
          <input 
            style={inputStyle}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="E.g., Design choice for streaming..."
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>The Insight</label>
          <textarea 
            style={{ ...inputStyle, minHeight: '120px', resize: 'vertical', lineHeight: 1.5 }}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="What was the key lesson or decision?"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-md)', marginTop: 'var(--sp-xl)' }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 'var(--fs-sm)',
              color: 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            Skip for now
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !content.trim()}
            style={{
              background: 'var(--pill-active-bg)',
              border: '1px solid var(--pill-active-border)',
              borderRadius: 'var(--r)',
              padding: '8px 20px',
              fontSize: 'var(--fs-sm)',
              fontWeight: 500,
              color: 'var(--pill-active-color)',
              cursor: (saving || !content.trim()) ? 'not-allowed' : 'pointer',
              opacity: (saving || !content.trim()) ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save to Knowledge'}
          </button>
        </div>
      </div>
    </>
  )
}
