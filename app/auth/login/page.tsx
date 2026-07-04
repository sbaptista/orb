'use client'

import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { checkLoginAllowed } from '@/app/actions/auth-actions'
import { devLogin } from '@/app/actions/dev-login'
import { isPasskeyAvailable, isConditionalMediationSupported, authenticateWithPasskey, authenticateWithConditionalMediation } from '@/lib/passkey'
import { startInteraction } from '@/lib/performance/telemetry'

const DEV_USERS = process.env.NODE_ENV === 'development' ? [
  { label: 'Stan', email: 'stan.baptista@gmail.com' },
  { label: 'Otto Owner', email: 'stan.baptista+otto-owner@gmail.com' },
  { label: 'Adele Admin', email: 'stan.baptista+admin@gmail.com' },
] as const : []

function LoginForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [time, setTime] = useState(() => Date.now())
  const [mounted, setMounted] = useState(false)
  const [passkeyAvailable, setPasskeyAvailable] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [devLoading, setDevLoading] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const perf = startInteraction({ focus: 'auth', flow: 'login', interaction: 'login_mount', surface: 'auth-login' })
    const id = window.setTimeout(() => {
      setMounted(true)
      setPasskeyAvailable(isPasskeyAvailable())
      perf.mark('passkey_availability_checked')
      perf.end(true)
    }, 0)

    return () => window.clearTimeout(id)
  }, [])

  // ── Conditional mediation: background passkey autofill ──
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    abortRef.current = controller

    async function startConditionalMediation() {
      const perf = startInteraction({ focus: 'auth', flow: 'login', interaction: 'conditional_passkey', surface: 'auth-login' })
      const supported = await isConditionalMediationSupported()
      perf.mark('support_checked')
      if (!supported || cancelled) {
        perf.end(true, null, { supported })
        return
      }

      const result = await authenticateWithConditionalMediation(supabase, controller)
      perf.mark('conditional_mediation_completed')

      if (cancelled) return
      if (result.ok) {
        perf.end(true)
        router.push('/dashboard')
        return
      }
      perf.end(false, result.error ?? 'conditional_passkey_failed')
      // All failures are silent — aborted, cancelled, no credentials, errors.
      // User continues with email/OTP normally.
    }

    startConditionalMediation()

    return () => {
      cancelled = true
      controller.abort()
      abortRef.current = null
    }
  }, [supabase, router])

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
    const perf = startInteraction({ focus: 'auth', flow: 'login', interaction: 'passkey_click', surface: 'auth-login' })
    abortRef.current?.abort()
    setPasskeyLoading(true)
    setError('')

    const result = await authenticateWithPasskey(supabase, stage => perf.mark(stage))
    perf.mark('passkey_auth_completed')

    if (result.ok) {
      perf.end(true)
      router.push('/dashboard')
      return
    }

    setPasskeyLoading(false)
    perf.end(false, result.error ?? 'passkey_failed')

    if (result.error === 'cancelled') return

    if (result.error === 'no_credentials') {
      setError('No passkey found for this device. Sign in with email below.')
      return
    }

    const msg = result.error || ''
    if (msg.includes('verification failed') || msg.includes('invalid') || msg.includes('not found')) {
      setError('This passkey is no longer valid. Please sign in with email and re-register your passkey in Settings.')
      return
    }

    setError(msg || 'Passkey authentication failed. Try signing in with email.')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const perf = startInteraction({ focus: 'auth', flow: 'login', interaction: 'otp_request', surface: 'auth-login' })
    // Abort any pending conditional mediation — user chose OTP path
    abortRef.current?.abort()
    setLoading(true)
    setError('')

    if (!navigator.onLine) {
      setError('You appear to be offline. Check your connection and try again.')
      setLoading(false)
      perf.end(false, 'offline')
      return
    }

    try {
      const check = await checkLoginAllowed(email)
      perf.mark('login_allowed_checked')
      if (!check.allowed) {
        setError(
          'Orb is by invitation only at this stage. If you have an invitation, please check your inbox for the registration link or ask Stan for access.'
        )
        setLoading(false)
        perf.end(false, check.reason ?? 'not_allowed')
        return
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      })
      perf.mark('otp_requested')

      if (otpError) {
        setError(otpError.message)
        perf.end(false, 'otp_error')
      } else {
        try {
          localStorage.setItem('last_otp_email', email)
          localStorage.setItem('last_otp_time', Date.now().toString())
        } catch (e) {
          console.error('[LoginForm] Failed to save cooldown to localStorage:', e)
        }
        perf.end(true)
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
        perf.end(false, 'network_error')
      } else {
        setError(errMsg || 'Something went wrong. Please try again.')
        perf.end(false, 'unexpected_error')
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
          <button
            type="button"
            className="auth-submit"
            onClick={handlePasskeyLogin}
            disabled={passkeyLoading}
          >
            {passkeyLoading ? 'Authenticating…' : 'Sign in with passkey'}
          </button>
          <div className="auth-divider">
            <span>or</span>
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
            autoComplete="username webauthn"
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

      {DEV_USERS.length > 0 && (
        <>
          <div className="auth-divider"><span>dev bypass</span></div>
          <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
            {DEV_USERS.map(u => (
              <button
                key={u.email}
                type="button"
                className="auth-dev-bypass"
                disabled={devLoading !== null}
                onClick={async () => {
                  abortRef.current?.abort()
                  setDevLoading(u.email)
                  setError('')
                  const result = await devLogin(u.email)
                  if (result.ok) {
                    router.push('/dashboard')
                  } else {
                    setError(result.error || 'Dev login failed')
                    setDevLoading(null)
                  }
                }}
              >
                {devLoading === u.email ? '…' : u.label}
              </button>
            ))}
          </div>
        </>
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
    </div>
  )
}
