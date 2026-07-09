'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { startInteraction, markPerformanceNavigation } from '@/lib/performance/telemetry'
import MuralCanvas from '@/components/MuralCanvas'

function VerifyOtpContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    const perf = startInteraction({ focus: 'auth', flow: 'login', interaction: 'otp_verify', surface: 'auth-verify-otp' })
    setLoading(true)
    setError('')

    if (!navigator.onLine) {
      setError('You appear to be offline. Check your connection and try again.')
      setLoading(false)
      perf.end(false, 'offline')
      return
    }

    try {
      const supabase = createClient()

      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      })
      perf.mark('otp_verified')

      if (error) {
        setError(error.message)
        setLoading(false)
        perf.end(false, 'otp_verify_error')
      } else {
        setVerified(true)
        perf.end(true)
        markPerformanceNavigation('/dashboard') // ORB-312: measure auth-success → dashboard-ready
        router.push('/dashboard')
      }
    } catch (err: any) {
      if (!navigator.onLine || err?.message?.includes('fetch')) {
        setError('You appear to be offline. Check your connection and try again.')
        perf.end(false, 'network_error')
      } else {
        setError(err?.message || 'Something went wrong. Please try again.')
        perf.end(false, 'unexpected_error')
      }
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <MuralCanvas urgency="calm" />
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">Check your email</h1>
            <p className="auth-subtitle">
              Enter the 6-digit code sent to<br />
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
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                required
                placeholder="123456"
                className="auth-otp-input"
              />
            </div>

            <button type="submit" disabled={loading || verified || otp.length !== 6} className="auth-submit">
              {verified ? 'Signing in…' : loading ? 'Verifying…' : 'Verify'}
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
