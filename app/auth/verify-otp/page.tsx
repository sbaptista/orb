'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import OrbVersionLabel from '@/components/ui/OrbVersionLabel'

function VerifyOtpContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!navigator.onLine) {
      setError('You appear to be offline. Check your connection and try again.')
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()

      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      })

      if (error) {
        setError(error.message)
        setLoading(false)
      } else {
        router.push('/dashboard')
      }
    } catch (err: any) {
      if (!navigator.onLine || err?.message?.includes('fetch')) {
        setError('You appear to be offline. Check your connection and try again.')
      } else {
        setError(err?.message || 'Something went wrong. Please try again.')
      }
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">Check your email</h1>
            <p className="auth-subtitle">
              Enter the 8-digit code sent to<br />
              <span style={{ fontWeight: 'var(--fw-medium)', color: 'var(--text2)' }}>{email}</span>
            </p>
          </div>

          <form onSubmit={handleVerify} className="auth-form">
            <div className="auth-field">
              <label htmlFor="otp" className="auth-label">Verification code</label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                required
                placeholder="12345678"
                className="auth-otp-input"
              />
            </div>

            <button type="submit" disabled={loading || otp.length !== 8} className="auth-submit">
              {loading ? 'Verifying…' : 'Verify'}
            </button>
          </form>

          {error && (
            <div className="auth-error">
              <p className="text-sm text-error" style={{ margin: 0 }}>{error}</p>
            </div>
          )}
        </div>

        <button onClick={() => router.push('/auth/login')} className="auth-back">
          ← Back to login
        </button>
      </div>

      <div className="auth-version">
        <OrbVersionLabel className="auth-version-text" />
      </div>
    </div>
  )
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={
      <div className="auth-page">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
      </div>
    }>
      <VerifyOtpContent />
    </Suspense>
  )
}
