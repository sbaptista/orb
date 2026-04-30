'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Product = { id: string; name: string; code: string | null; icon: string | null }

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
}: {
  onClose: () => void
  onCreated: (product: Product) => void
}) {
  const [name, setName]           = useState('')
  const [code, setCode]           = useState('')
  const [icon, setIcon]           = useState('')
  const [codeAutoSync, setCodeAutoSync] = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

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
    const { data, error: err } = await supabase
      .from('products')
      .insert({
        name: name.trim(),
        code: code.trim() || null,
        icon: icon.trim() || null,
        sort_order: 0,
      })
      .select('id, name, code, icon')
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) onCreated(data as Product)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(42, 51, 42, 0.3)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div style={{
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
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-xl)' }}>
          <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text)', margin: 0 }}>
            New product
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
            <label style={labelStyle}>Name *</label>
            <input
              style={inputStyle}
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="My project"
              autoFocus
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-md)' }}>
            <div>
              <label style={labelStyle}>Code</label>
              <input
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
              <label style={labelStyle}>Icon (emoji)</label>
              <input
                style={inputStyle}
                value={icon}
                onChange={e => setIcon(e.target.value)}
                placeholder="📦"
                maxLength={2}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', margin: 'var(--sp-xs) 0 0' }}>
                ⌃⌘Space to pick
              </p>
            </div>
          </div>

          {error && (
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--error)', margin: 0 }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: 'var(--sp-md)', justifyContent: 'flex-end', marginTop: 'var(--sp-xs)' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', fontSize: 'var(--fs-sm)', color: 'var(--text3)', cursor: 'pointer', padding: '8px var(--sp-md)' }}
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
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
