'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  isPasskeySupported,
  isPasskeyAvailable,
  registerPasskey,
  listPasskeys,
  renamePasskey,
  removePasskey,
  type PasskeyEntry,
} from '@/lib/passkey'

type PageState = 'loading' | 'unsupported' | 'wrong-domain' | 'empty' | 'has-passkeys'

export default function SettingsPasskeys() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [pageState, setPageState] = useState<PageState>('loading')
  const [passkeys, setPasskeys] = useState<PasskeyEntry[]>([])
  const [registering, setRegistering] = useState(false)
  const [showLearnMore, setShowLearnMore] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    if (!isPasskeyAvailable()) {
      setPageState(isPasskeySupported() ? 'wrong-domain' : 'unsupported')
      return
    }
    loadPasskeys()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadPasskeys() {
    const result = await listPasskeys(supabase)
    if (result.ok && result.data) {
      setPasskeys(result.data)
      setPageState(result.data.length > 0 ? 'has-passkeys' : 'empty')
    } else {
      setPasskeys([])
      setPageState('empty')
      if (result.error) setError(result.error)
    }
  }

  async function handleRegister() {
    setRegistering(true)
    setError('')
    setMessage('')

    const result = await registerPasskey(supabase)

    if (result.ok) {
      setMessage('Passkey registered.')
      await loadPasskeys()
    } else if (result.error === 'cancelled') {
      // User cancelled — do nothing
    } else {
      setError(result.error || 'Failed to register passkey.')
    }

    setRegistering(false)
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) return
    setRenameSaving(true)
    setError('')

    const result = await renamePasskey(supabase, id, renameValue.trim())

    if (result.ok) {
      setPasskeys(prev => prev.map(p => p.id === id ? { ...p, friendly_name: renameValue.trim() } : p))
      setRenamingId(null)
      setRenameValue('')
    } else {
      setError(result.error || 'Failed to rename passkey.')
    }

    setRenameSaving(false)
  }

  async function handleDelete(id: string) {
    setDeleteLoading(true)
    setError('')

    const result = await removePasskey(supabase, id)

    if (result.ok) {
      const { data: { user } } = await supabase.auth.getUser()
      const email = user?.email || ''
      await supabase.auth.signOut()
      router.push(`/auth/passkey-removed?email=${encodeURIComponent(email)}`)
      return
    } else {
      setError(result.error || 'Failed to remove passkey.')
    }

    setDeleteLoading(false)
  }

  function startRename(passkey: PasskeyEntry) {
    setRenamingId(passkey.id)
    setRenameValue(passkey.friendly_name || '')
    setDeletingId(null)
  }

  function startDelete(id: string) {
    setDeletingId(id)
    setRenamingId(null)
  }

  const isLastPasskey = passkeys.length === 1

  return (
    <>
      <div className="s-card" style={{ padding: 'var(--sp-xl)' }}>
        <h3 style={{ margin: '0 0 var(--sp-sm)', fontSize: 'var(--fs-base)', fontWeight: 'var(--fw-medium)' }}>
          Your Passkeys
        </h3>
        <p className="text-sm text-muted" style={{ margin: '0 0 var(--sp-lg)', lineHeight: 'var(--lh-normal)' }}>
          Use Face ID, Touch ID, or your device&apos;s biometric to sign in instantly. Each device needs its own passkey.
        </p>

        {pageState === 'loading' && (
          <p className="text-sm text-muted">Loading passkeys…</p>
        )}

        {pageState === 'unsupported' && (
          <div style={{
            padding: 'var(--sp-md) var(--sp-lg)',
            background: 'var(--bg-hover)',
            borderRadius: 'var(--r)',
            fontSize: 'var(--fs-sm)',
            color: 'var(--muted)',
          }}>
            Passkeys are not supported in this browser. Try Safari 16+, Chrome 108+, or Edge 108+.
          </div>
        )}

        {pageState === 'wrong-domain' && (
          <div style={{
            padding: 'var(--sp-md) var(--sp-lg)',
            background: 'var(--bg-hover)',
            borderRadius: 'var(--r)',
            fontSize: 'var(--fs-sm)',
            color: 'var(--muted)',
          }}>
            Passkeys are only available on the production site. They cannot be registered or used on this domain.
          </div>
        )}

        {pageState === 'empty' && (
          <div style={{
            padding: 'var(--sp-md) var(--sp-lg)',
            background: 'var(--bg-hover)',
            borderRadius: 'var(--r)',
            fontSize: 'var(--fs-sm)',
            color: 'var(--muted)',
            marginBottom: 'var(--sp-lg)',
          }}>
            No passkeys registered yet. Register one to enable biometric sign-in.
          </div>
        )}

        {pageState === 'has-passkeys' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)', marginBottom: 'var(--sp-lg)' }}>
            {passkeys.map(passkey => (
              <div
                key={passkey.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-md)',
                  padding: 'var(--sp-md) var(--sp-lg)',
                  background: 'var(--bg-hover)',
                  borderRadius: 'var(--r)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  {renamingId === passkey.id ? (
                    <div style={{ display: 'flex', gap: 'var(--sp-sm)', alignItems: 'center' }}>
                      <input
                        className="input"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRename(passkey.id); if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') } }}
                        autoFocus
                        style={{ fontSize: 'var(--fs-sm)', padding: '4px 8px' }}
                        placeholder="Passkey name"
                      />
                      <button className="btn-primary btn-sm" onClick={() => handleRename(passkey.id)} disabled={renameSaving}>
                        {renameSaving ? '…' : 'Save'}
                      </button>
                      <button className="btn-cancel btn-sm" onClick={() => { setRenamingId(null); setRenameValue('') }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <p style={{ margin: 0, fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--text)' }}>
                        {passkey.friendly_name || 'Unnamed passkey'}
                      </p>
                      <p className="text-xs text-muted" style={{ margin: '2px 0 0' }}>
                        Registered {new Date(passkey.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </>
                  )}
                </div>

                {renamingId !== passkey.id && (
                  <div style={{ display: 'flex', gap: 'var(--sp-sm)', flexShrink: 0 }}>
                    <button className="btn-cancel btn-sm" onClick={() => startRename(passkey)}>
                      Rename
                    </button>
                    {deletingId === passkey.id ? (
                      <div style={{ display: 'flex', gap: 'var(--sp-xs)', alignItems: 'center' }}>
                        <button className="btn-cancel btn-sm" style={{ color: 'var(--warning)', fontWeight: 'var(--fw-medium)' }} onClick={() => handleDelete(passkey.id)} disabled={deleteLoading}>
                          {deleteLoading ? '…' : 'Confirm'}
                        </button>
                        <button className="btn-cancel btn-sm" onClick={() => setDeletingId(null)}>
                          No
                        </button>
                      </div>
                    ) : (
                      <button className="btn-cancel btn-sm" style={{ color: 'var(--warning)' }} onClick={() => startDelete(passkey.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Delete-last-passkey warning */}
        {deletingId && isLastPasskey && (
          <div style={{
            padding: 'var(--sp-md) var(--sp-lg)',
            background: 'rgba(122,80,16,0.06)',
            borderRadius: 'var(--r)',
            border: '1px solid rgba(122,80,16,0.15)',
            fontSize: 'var(--fs-sm)',
            color: 'var(--warning)',
            marginBottom: 'var(--sp-md)',
          }}>
            This is your only passkey. You&apos;ll be signed out and can re-register a new passkey after signing back in with email.
          </div>
        )}

        {pageState !== 'loading' && pageState !== 'unsupported' && pageState !== 'wrong-domain' && (
          <div className="account-passkey-actions">
            <button
              className="btn-primary"
              onClick={handleRegister}
              disabled={registering}
            >
              {registering ? 'Registering…' : 'Register New Passkey'}
            </button>
            <button className="btn-primary" onClick={() => setShowLearnMore(true)}>
              Learn more
            </button>
          </div>
        )}

        {message && (
          <p className="text-sm" style={{ marginTop: 'var(--sp-md)', color: 'var(--muted)' }}>
            {message}
          </p>
        )}

        {error && (
          <p className="text-sm" style={{ marginTop: 'var(--sp-md)', color: 'var(--error)' }}>
            {error}
          </p>
        )}
      </div>

      {showLearnMore && (
        <>
          <div className="modal-backdrop" onClick={() => setShowLearnMore(false)} />
          <div role="dialog" aria-modal="true" aria-labelledby="passkey-learn-more-title" className="modal-center modal-sm">
            <div className="modal-header" style={{ justifyContent: 'space-between' }}>
              <h2 id="passkey-learn-more-title" style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)' }}>
                About Passkeys
              </h2>
              <button onClick={() => setShowLearnMore(false)} className="close-btn" aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body" style={{ padding: 'var(--sp-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
              <p className="account-dialog-copy">
                Passkeys are a simpler and safer way to sign in without using passwords. Instead of typing a password, you unlock your phone or computer with Face ID, a fingerprint, or a PIN, and your device proves to the website that it&apos;s really you. The website never gets your secret sign-in key, which makes passkeys harder to steal, fake, or use in a phishing attack.
              </p>
              <div className="modal-footer">
                <button className="btn-primary" onClick={() => setShowLearnMore(false)}>OK</button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
