'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single()
        router.push(existingUser ? '/dashboard' : '/auth/create-account')
      }
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '0 var(--sp-lg)',
    }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>

        <div style={{
          background: 'var(--bg2)',
          borderRadius: 'var(--r-xl)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-md)',
          padding: 'var(--sp-3xl)',
        }}>
          <div style={{ marginBottom: 'var(--sp-3xl)', textAlign: 'center' }}>
            <h1 style={{
              fontSize: 'var(--fs-xl)',
              fontWeight: 'var(--fw-bold)',
              color: 'var(--text)',
              margin: 0,
            }}>
              Check your email
            </h1>
            <p style={{
              marginTop: 'var(--sp-sm)',
              fontSize: 'var(--fs-sm)',
              color: 'var(--text3)',
              lineHeight: 1.5,
            }}>
              Enter the 8-digit code sent to<br />
              <span style={{ fontWeight: 'var(--fw-medium)', color: 'var(--text2)' }}>{email}</span>
            </p>
          </div>

          <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xl)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xs)' }}>
              <label
                htmlFor="otp"
                style={{
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 'var(--fw-medium)',
                  color: 'var(--text2)',
                }}
              >
                Verification code
              </label>
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
                style={{
                  width: '100%',
                  padding: '12px var(--sp-md)',
                  borderRadius: 'var(--r)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: '24px',
                  fontWeight: 'var(--fw-medium)',
                  textAlign: 'center',
                  letterSpacing: '0.3em',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color var(--transition)',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 8}
              style={{
                width: '100%',
                background: 'var(--success)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--r)',
                padding: '12px',
                fontSize: 'var(--fs-base)',
                fontWeight: 'var(--fw-medium)',
                cursor: loading || otp.length !== 8 ? 'not-allowed' : 'pointer',
                opacity: loading || otp.length !== 8 ? 0.6 : 1,
                transition: 'opacity var(--transition)',
              }}
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>
          </form>

          {error && (
            <div style={{
              marginTop: 'var(--sp-lg)',
              padding: 'var(--sp-md)',
              borderRadius: 'var(--r)',
              background: 'rgba(139, 32, 32, 0.07)',
              border: '1px solid rgba(139, 32, 32, 0.2)',
            }}>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--error)', margin: 0 }}>{error}</p>
            </div>
          )}
        </div>

        <button
          onClick={() => router.push('/auth/login')}
          style={{
            display: 'block',
            margin: 'var(--sp-xl) auto 0',
            background: 'none',
            border: 'none',
            fontSize: 'var(--fs-sm)',
            color: 'var(--muted)',
            cursor: 'pointer',
            padding: '4px 0',
          }}
        >
          ← Back to login
        </button>

        <p style={{
          marginTop: 'var(--sp-lg)',
          textAlign: 'center',
          fontSize: 'var(--fs-version)',
          color: 'var(--muted)',
        }}>
          TODOS v0.2.15
        </p>

      </div>
    </div>
  )
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
      }}>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>Loading…</p>
      </div>
    }>
      <VerifyOtpContent />
    </Suspense>
  )
}
