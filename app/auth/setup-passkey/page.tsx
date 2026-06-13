'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isPasskeyAvailable, registerPasskey } from '@/lib/passkey'

function SetupPasskeyContent() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromEmailChange = searchParams.get('from') === 'email-change'
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function checkSession() {
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
      setTimeout(() => router.push('/dashboard'), 800)
      return
    }

    setRegistering(false)

    if (result.error === 'cancelled') {
      return
    }

    setError(result.error || 'Failed to register passkey. Please try again.')
  }

  if (loading) {
    return (
      <div className="auth-page">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading&hellip;</p>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">{fromEmailChange ? 'Register a new passkey' : 'Set up a passkey'}</h1>
            <p className="auth-subtitle">
              {fromEmailChange
                ? 'Your email was changed and your old passkey was removed. Register a new passkey to continue signing in securely.'
                : "Use Face ID, Touch ID, or your device’s biometric to sign in instantly next time. No codes needed."}
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
                fontWeight: 'var(--fw-medium)',
              }}>
                Passkey registered. Signing you in&hellip;
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

      </div>
    </div>
  )
}

export default function SetupPasskeyPage() {
  return (
    <Suspense fallback={
      <div className="auth-page">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading&hellip;</p>
      </div>
    }>
      <SetupPasskeyContent />
    </Suspense>
  )
}
