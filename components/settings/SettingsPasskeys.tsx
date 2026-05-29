'use client'

import { useState, useEffect, useMemo } from 'react'
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
  const [pageState, setPageState] = useState<PageState>('loading')
  const [passkeys, setPasskeys] = useState<PasskeyEntry[]>([])
  const [registering, setRegistering] = useState(false)
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
      setDeletingId(null)
      setMessage('Passkey removed.')
      await loadPasskeys()
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
    <div className="settings-page" style={{ maxWidth: '480px' }}>
      <h2 className="s-title mb-2xl">Passkeys</h2>

      {/* Main card */}
      <div className="s-card" style={{ padding: 'var(--sp-xl)' }}>
        <h3 style={{ margin: '0 0 var(--sp-sm)', fontSize: 'var(--fs-base)', fontWeight: 500 }}>
          Your Passkeys
        </h3>
        <p className="text-sm text-muted" style={{ margin: '0 0 var(--sp-lg)', lineHeight: 1.5 }}>
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
                      <button className="btn-primary" onClick={() => handleRename(passkey.id)} disabled={renameSaving} style={{ fontSize: '12px', padding: '4px 10px' }}>
                        {renameSaving ? '…' : 'Save'}
                      </button>
                      <button className="btn-cancel" onClick={() => { setRenamingId(null); setRenameValue('') }} style={{ fontSize: '12px', padding: '4px 10px' }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <p style={{ margin: 0, fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text)' }}>
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
                    <button className="btn-cancel" onClick={() => startRename(passkey)} style={{ fontSize: '12px', padding: '4px 10px' }}>
                      Rename
                    </button>
                    {deletingId === passkey.id ? (
                      <div style={{ display: 'flex', gap: 'var(--sp-xs)', alignItems: 'center' }}>
                        <button className="btn-sign-out" onClick={() => handleDelete(passkey.id)} disabled={deleteLoading} style={{ fontSize: '12px', padding: '4px 10px' }}>
                          {deleteLoading ? '…' : 'Confirm'}
                        </button>
                        <button className="btn-cancel" onClick={() => setDeletingId(null)} style={{ fontSize: '12px', padding: '4px 10px' }}>
                          No
                        </button>
                      </div>
                    ) : (
                      <button className="btn-cancel" onClick={() => startDelete(passkey.id)} style={{ fontSize: '12px', padding: '4px 10px', color: 'var(--error)' }}>
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
            background: 'rgba(239,68,68,0.06)',
            borderRadius: 'var(--r)',
            border: '1px solid rgba(239,68,68,0.15)',
            fontSize: 'var(--fs-sm)',
            color: 'var(--error)',
            marginBottom: 'var(--sp-md)',
          }}>
            This is your only passkey. Removing it means you&apos;ll sign in with email verification codes only.
          </div>
        )}

        {pageState !== 'loading' && pageState !== 'unsupported' && pageState !== 'wrong-domain' && (
          <button
            className="btn-primary"
            onClick={handleRegister}
            disabled={registering}
          >
            {registering ? 'Registering…' : 'Register New Passkey'}
          </button>
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

      {/* Info card */}
      <div className="s-card" style={{ padding: 'var(--sp-xl)', marginTop: 'var(--sp-xl)' }}>
        <h3 style={{ margin: '0 0 var(--sp-sm)', fontSize: 'var(--fs-base)', fontWeight: 500 }}>
          How passkeys work
        </h3>
        <ul style={{ margin: 0, paddingLeft: 'var(--sp-xl)', fontSize: 'var(--fs-sm)', color: 'var(--text2)', lineHeight: 1.8 }}>
          <li>Passkeys use your device&apos;s biometric (Face ID, Touch ID, Windows Hello) instead of a password</li>
          <li>They&apos;re stored securely on your device and synced via iCloud Keychain or your platform&apos;s credential manager</li>
          <li>Each device needs its own passkey, or use a synced keychain across Apple devices</li>
          <li>Email verification codes always work as a fallback</li>
        </ul>
      </div>
    </div>
  )
}
