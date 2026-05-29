'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isPasskeyAvailable, registerPasskey } from '@/lib/passkey'
import OrbVersionLabel from '@/components/ui/OrbVersionLabel'

export default function SetupPasskeyPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function checkSession() {
      // If passkeys can't work on this domain, skip straight to dashboard
      if (!isPasskeyAvailable()) {
        router.push('/dashboard')
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      setLoading(false)
    }
    checkSession()
  }, [supabase, router])

  async function handleRegister() {
    setRegistering(true)
    setError('')

    const result = await registerPasskey(supabase)

    if (result.ok) {
      setSuccess(true)
      // Brief delay so the user sees the success state
      setTimeout(() => router.push('/dashboard'), 800)
      return
    }

    setRegistering(false)

    if (result.error === 'cancelled') {
      return
    }

    setError(result.error || 'Failed to register passkey. You can set one up later in Settings.')
  }

  function handleSkip() {
    try {
      localStorage.setItem('passkey_prompt_skipped', 'true')
    } catch {
      // localStorage unavailable — skip silently
    }
    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className="auth-page">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">Set up a passkey</h1>
            <p className="auth-subtitle">
              Use Face ID, Touch ID, or your device&apos;s biometric to sign in instantly next time. No codes needed.
            </p>
          </div>

          <div className="auth-form">
            {success ? (
              <div style={{
                padding: 'var(--sp-md) var(--sp-lg)',
                background: '#e8f0e8',
                borderRadius: 'var(--r)',
                fontSize: 'var(--fs-sm)',
                color: '#2d5a2d',
                textAlign: 'center',
                fontWeight: 500,
              }}>
                Passkey registered. Signing you in…
              </div>
            ) : (
              <button
                type="button"
                onClick={handleRegister}
                disabled={registering}
                className="auth-submit"
              >
                {registering ? 'Registering…' : 'Register Passkey'}
              </button>
            )}
          </div>

          {error && (
            <div className="auth-error">
              <p className="text-sm text-error" style={{ margin: 0 }}>{error}</p>
            </div>
          )}
        </div>

        {!success && (
          <button onClick={handleSkip} className="auth-back">
            Skip for now
          </button>
        )}
      </div>

      <div className="auth-version">
        <OrbVersionLabel className="auth-version-text" />
      </div>
    </div>
  )
}
