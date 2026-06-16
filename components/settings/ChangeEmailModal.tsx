'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isPasskeyAvailable } from '@/lib/passkey'
import { changeEmail } from '@/app/actions/change-email'

export default function ChangeEmailModal({
  currentEmail,
  onClose,
}: {
  currentEmail: string
  onClose: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [newEmail, setNewEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const trimmed = newEmail.trim().toLowerCase()
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
  const isSameEmail = trimmed === currentEmail.toLowerCase()
  const hasPasskeys = isPasskeyAvailable()
  const canProceed = isValid && !isSameEmail && !saving

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canProceed) return

    setSaving(true)
    setError('')

    const result = await changeEmail(trimmed)
    if (!result.ok) {
      setError(result.error || 'Failed to change email.')
      setSaving(false)
      return
    }

    // Refresh session to pick up the new email
    await supabase.auth.refreshSession()

    if (hasPasskeys) {
      // Passkeys were deleted server-side — PasskeyGate will prompt re-registration
      router.push('/auth/setup-passkey?from=email-change')
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />

      <div role="dialog" aria-modal="true" aria-labelledby="change-email-title" className="modal-center modal-sm">
        <div className="modal-header" style={{ justifyContent: 'space-between' }}>
          <h2 id="change-email-title" style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)' }}>
            Change Email
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
              Your email will be changed to <strong>{trimmed}</strong>.
              {hasPasskeys && <> Your passkey will be removed and you&apos;ll be prompted to register a new one immediately.</>}
            </div>
          )}

          {error && <p className="text-sm text-error" style={{ margin: 0 }}>{error}</p>}

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" disabled={!canProceed} className="btn-primary">
              {saving ? 'Changing…' : 'Change email'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
