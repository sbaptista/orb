'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const isDev = process.env.NODE_ENV === 'development'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    if (isDev && email === 'dev@dev.local') {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: process.env.NEXT_PUBLIC_DEV_EMAIL!,
        password: process.env.NEXT_PUBLIC_DEV_PASSWORD!,
      })
      if (signInError) {
        setError(`Dev login failed: ${signInError.message}`)
        setLoading(false)
        return
      }
      if (data.user) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', data.user.id)
          .single()
        router.push(existingUser ? '/dashboard' : '/auth/create-account')
      }
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
      router.push(`/auth/verify-otp?email=${encodeURIComponent(email)}`)
    }

    setLoading(false)
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
              TODOS
            </h1>
            <p style={{
              marginTop: 'var(--sp-sm)',
              fontSize: 'var(--fs-sm)',
              color: 'var(--text3)',
            }}>
              Enter your email to receive a verification code
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xl)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xs)' }}>
              <label
                htmlFor="email"
                style={{
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 'var(--fw-medium)',
                  color: 'var(--text2)',
                }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={{
                  width: '100%',
                  padding: '10px var(--sp-md)',
                  borderRadius: 'var(--r)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 'var(--fs-input)',
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
              disabled={loading}
              style={{
                width: '100%',
                background: 'var(--success)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--r)',
                padding: '12px',
                fontSize: 'var(--fs-base)',
                fontWeight: 'var(--fw-medium)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'opacity var(--transition), background var(--transition)',
              }}
            >
              {loading ? 'Sending…' : 'Send verification code'}
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

          {isDev && (
            <div style={{
              marginTop: 'var(--sp-md)',
              padding: 'var(--sp-md)',
              borderRadius: 'var(--r)',
              background: 'rgba(122, 80, 16, 0.07)',
              border: '1px solid rgba(122, 80, 16, 0.2)',
            }}>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--warning)', margin: 0, textAlign: 'center' }}>
                <strong>Dev mode:</strong> Use email{' '}
                <code style={{
                  background: 'rgba(122, 80, 16, 0.1)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                }}>
                  dev@dev.local
                </code>{' '}
                to bypass email sending
              </p>
            </div>
          )}
        </div>

        <p style={{
          marginTop: 'var(--sp-xl)',
          textAlign: 'center',
          fontSize: 'var(--fs-version)',
          color: 'var(--muted)',
        }}>
          TODOS v0.2.14
        </p>

      </div>
    </div>
  )
}
