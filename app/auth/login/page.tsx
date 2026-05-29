'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import OrbVersionLabel from '@/components/ui/OrbVersionLabel'
import { checkLoginAllowed } from '@/app/actions/auth-actions'
import { isPasskeyAvailable, authenticateWithPasskey } from '@/lib/passkey'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [error, setError] = useState('')
  const [passkeyInfo, setPasskeyInfo] = useState('')
  const [time, setTime] = useState(() => Date.now())
  const [mounted, setMounted] = useState(false)
  const [passkeyAvailable, setPasskeyAvailable] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    setMounted(true)
    setPasskeyAvailable(isPasskeyAvailable())
  }, [])

  // Calculate remaining cooldown dynamically during render (only after hydration)
  const trimmedEmail = email.trim().toLowerCase()
  let cooldown = 0
  if (mounted && !loading && trimmedEmail) {
    try {
      const lastEmail = localStorage.getItem('last_otp_email')
      const lastTimeStr = localStorage.getItem('last_otp_time')
      if (lastEmail && lastTimeStr && lastEmail.trim().toLowerCase() === trimmedEmail) {
        const lastTime = parseInt(lastTimeStr, 10)
        if (!isNaN(lastTime)) {
          const elapsed = Math.floor((time - lastTime) / 1000)
          const remaining = 60 - elapsed
          if (remaining > 0) {
            cooldown = remaining
          }
        }
      }
    } catch (e) {
      console.error('[LoginForm] Failed to check cooldown:', e)
    }
  }

  // Force re-render every second when a cooldown is active to update the countdown
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setTime(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam === 'not_invited') {
      setTimeout(() => {
        setError(
          'Orb is by invitation only at this stage. If you have an invitation, please check your inbox for the registration link or ask Stan for access.'
        )
      }, 0)
    } else if (errorParam) {
      setTimeout(() => {
        setError('An error occurred during authentication. Please try again.')
      }, 0)
    }
  }, [searchParams])

  async function handlePasskeyLogin() {
    setPasskeyLoading(true)
    setError('')
    setPasskeyInfo('')

    const supabase = createClient()
    const result = await authenticateWithPasskey(supabase)

    if (result.ok) {
      router.push('/dashboard')
      return
    }

    setPasskeyLoading(false)

    if (result.error === 'cancelled') {
      // User cancelled — silently return to idle
      return
    }

    if (result.error === 'no_credentials') {
      setPasskeyInfo('No passkey found for this device. Sign in with email below.')
      return
    }

    setError(result.error || 'Passkey authentication failed. Try signing in with email.')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!navigator.onLine) {
      setError('You appear to be offline. Check your connection and try again.')
      setLoading(false)
      return
    }

    try {
      const check = await checkLoginAllowed(email)
      if (!check.allowed) {
        setError(
          'Orb is by invitation only at this stage. If you have an invitation, please check your inbox for the registration link or ask Stan for access.'
        )
        setLoading(false)
        return
      }

      const supabase = createClient()
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      })

      if (otpError) {
        setError(otpError.message)
      } else {
        try {
          localStorage.setItem('last_otp_email', email)
          localStorage.setItem('last_otp_time', Date.now().toString())
        } catch (e) {
          console.error('[LoginForm] Failed to save cooldown to localStorage:', e)
        }
        router.push(`/auth/verify-otp?email=${encodeURIComponent(email)}`)
        return
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error
        ? err.message
        : (err && typeof err === 'object' && 'message' in err)
          ? String((err as Record<string, unknown>).message)
          : String(err)
      if (!navigator.onLine || errMsg.includes('fetch')) {
        setError('You appear to be offline. Check your connection and try again.')
      } else {
        setError(errMsg || 'Something went wrong. Please try again.')
      }
    }

    setLoading(false)
  }

  return (
    <div className="auth-card">
      <div className="auth-header">
        <h1 className="auth-title">Orb</h1>
        <p className="auth-subtitle">
          {passkeyAvailable ? 'Sign in with your passkey or email' : 'Enter your email to receive a verification code'}
        </p>
      </div>

      {passkeyAvailable && (
        <>
          <div className="auth-form">
            <button
              type="button"
              onClick={handlePasskeyLogin}
              disabled={passkeyLoading}
              className="auth-submit"
            >
              {passkeyLoading ? 'Authenticating…' : 'Sign in with passkey'}
            </button>
          </div>

          {passkeyInfo && (
            <div className="auth-info">
              <p className="text-sm" style={{ margin: 0, color: 'var(--muted)' }}>{passkeyInfo}</p>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 'var(--sp-lg) 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span className="text-xs text-muted">or</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-field">
          <label htmlFor="email" className="auth-label">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="auth-input"
          />
        </div>

        {cooldown > 0 && (
          <div className="auth-info">
            <p className="text-sm" style={{ margin: 0, color: 'var(--warning)' }}>
              A verification code was recently requested. Please check your inbox (including spam) or wait {cooldown}s before requesting a new one.
            </p>
          </div>
        )}

        <button type="submit" disabled={loading || cooldown > 0} className="auth-submit">
          {loading ? 'Sending…' : cooldown > 0 ? `Send verification code (${cooldown}s)` : 'Send verification code'}
        </button>
      </form>

      {error && (
        <div className="auth-error">
          <p className="text-sm text-error" style={{ margin: 0 }}>{error}</p>
        </div>
      )}
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="auth-page">
      <div className="auth-wrap">
        <Suspense fallback={
          <div className="auth-card">
            <div className="auth-header">
              <h1 className="auth-title">Orb</h1>
              <p className="auth-subtitle">Loading login page...</p>
            </div>
          </div>
        }>
          <LoginForm />
        </Suspense>
      </div>

      <div className="auth-version">
        <OrbVersionLabel className="auth-version-text" />
      </div>
    </div>
  )
}
