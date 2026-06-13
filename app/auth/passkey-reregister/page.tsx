'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { checkLoginAllowed } from '@/app/actions/auth-actions'

function ReregisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const prefillEmail = searchParams.get('email') || ''
  const [email, setEmail] = useState(prefillEmail)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [time, setTime] = useState(() => Date.now())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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
      console.error('[ReregisterForm] Failed to check cooldown:', e)
    }
  }

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setTime(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      setTimeout(() => {
        setError('An error occurred during authentication. Please try again.')
      }, 0)
    }
  }, [searchParams])

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
          console.error('[ReregisterForm] Failed to save cooldown to localStorage:', e)
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
        <h1 className="auth-title">Re-register passkey</h1>
        <p className="auth-subtitle">
          Sign in with email to set up a new passkey
        </p>
      </div>

      <div style={{ padding: '0 var(--sp-xl)', marginBottom: 'var(--sp-lg)' }}>
        <p className="text-sm" style={{ color: 'var(--text2)', lineHeight: 'var(--lh-normal)', margin: 0 }}>
          After signing in, you&apos;ll be prompted to register a new passkey automatically.
          If your browser shows the old passkey in the picker, ignore it — it no longer works.
        </p>
      </div>

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
            autoComplete="username"
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

export default function PasskeyReregisterPage() {
  return (
    <div className="auth-page">
      <div className="auth-wrap">
        <Suspense fallback={
          <div className="auth-card">
            <div className="auth-header">
              <h1 className="auth-title">Re-register passkey</h1>
              <p className="auth-subtitle">Loading…</p>
            </div>
          </div>
        }>
          <ReregisterForm />
        </Suspense>
      </div>
    </div>
  )
}
