'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isPasskeyAvailable, listPasskeys, removePasskey } from '@/lib/passkey'

export default function ChangeEmailModal({
  currentEmail,
  onClose,
  onChanged,
}: {
  currentEmail: string
  onClose: () => void
  onChanged?: (newEmail: string) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [newEmail, setNewEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const trimmed = newEmail.trim().toLowerCase()
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
  const isSameEmail = trimmed === currentEmail.toLowerCase()
  const canProceed = isValid && !isSameEmail && !saving

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canProceed) return

    setSaving(true)
    setError('')

    const { error: emailErr } = await supabase.auth.updateUser({ email: trimmed })
    if (emailErr) {
      setError(emailErr.message)
      setSaving(false)
      return
    }

    if (isPasskeyAvailable()) {
      const passkeyResult = await listPasskeys(supabase)
      if (passkeyResult.ok && passkeyResult.data && passkeyResult.data.length > 0) {
        for (const pk of passkeyResult.data) {
          await removePasskey(supabase, pk.id)
        }
        await supabase.auth.signOut()
        router.push(`/auth/passkey-removed?email=${encodeURIComponent(currentEmail)}`)
        return
      }
    }

    onChanged?.(trimmed)
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />

      <div role="dialog" aria-modal="true" aria-labelledby="change-email-title" className="modal-center modal-sm">
        <div className="modal-header" style={{ justifyContent: 'space-between' }}>
          <h2 id="change-email-title" style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)' }}>
            Change email address
          </h2>
          <button onClick={onClose} className="close-btn" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body" style={{ padding: 'var(--sp-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
          <div>
            <label className="pf-label" style={{ marginBottom: 'var(--sp-xs)' }}>Current email</label>
            <input
              className="pf-input"
              value={currentEmail}
              readOnly
              style={{ opacity: 0.6, cursor: 'default' }}
            />
          </div>

          <div>
            <label htmlFor="new-email" className="pf-label" style={{ marginBottom: 'var(--sp-xs)' }}>New email</label>
            <input
              id="new-email"
              type="email"
              className="pf-input"
              value={newEmail}
              onChange={e => { setNewEmail(e.target.value); setError('') }}
              placeholder="new@example.com"
              autoFocus
            />
          </div>

          {trimmed && !isValid && (
            <p className="text-sm text-error" style={{ margin: 0 }}>
              Please enter a valid email address.
            </p>
          )}

          {isSameEmail && trimmed && (
            <p className="text-sm text-error" style={{ margin: 0 }}>
              New email must be different from your current email.
            </p>
          )}

          {canProceed && (
            <div style={{
              padding: 'var(--sp-md) var(--sp-lg)',
              background: 'var(--bg-hover)',
              borderRadius: 'var(--r)',
              fontSize: 'var(--fs-sm)',
              color: 'var(--text2)',
              lineHeight: 'var(--lh-normal)',
            }}>
              A confirmation will be sent to <strong>{trimmed}</strong>. Your passkey will be removed and you&apos;ll be signed out. Sign back in with <strong>{currentEmail}</strong>, then confirm the new email from your inbox. Once confirmed, you&apos;ll be guided to register a new passkey.
            </div>
          )}

          {error && <p className="text-sm text-error" style={{ margin: 0 }}>{error}</p>}

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" disabled={!canProceed} className="btn-primary">
              {saving ? 'Processing…' : 'Proceed'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
