'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  clearPasskeySetupDeferred,
  deferPasskeySetup,
  isPasskeyAvailable,
  listPasskeys,
  registerPasskey,
  type PasskeyFailureCode,
} from '@/lib/passkey'
import { markPerformanceNavigation, startInteraction } from '@/lib/performance/telemetry'
import MuralCanvas from '@/components/MuralCanvas'

type Recovery = {
  title: string
  message: string
  steps: string[]
  requiresEmailSignIn?: boolean
}

function recoveryFor(code: PasskeyFailureCode): Recovery {
  switch (code) {
    case 'network_error':
      return {
        title: 'Orb could not finish passkey setup',
        message: 'Your email sign-in is still active.',
        steps: ['Check your internet connection.', 'Then choose Try again.'],
      }
    case 'session_expired':
      return {
        title: 'Your secure sign-in expired',
        message: 'No account information was lost.',
        steps: ['Return to email sign-in.', 'Request a new verification code, then try passkey setup again.'],
        requiresEmailSignIn: true,
      }
    case 'unsupported':
      return {
        title: 'This browser could not create a passkey',
        message: 'You can continue using Orb with email verification.',
        steps: ['Try again in Safari, Chrome, or Edge on this device.', 'Or continue to Orb and add a passkey later from Account.'],
      }
    case 'security_error':
      return {
        title: 'Your device blocked passkey setup',
        message: 'Orb could not complete the secure device check.',
        steps: ['Make sure your device passcode, Face ID, or Touch ID is enabled.', 'Then try again, or continue and add a passkey later from Account.'],
      }
    case 'already_registered':
      return {
        title: 'A passkey may already be registered',
        message: 'Orb will check again when you continue.',
        steps: ['Choose Continue to Orb.', 'You can review your passkeys later from Account.'],
      }
    default:
      return {
        title: 'Passkey setup did not finish',
        message: 'Your email sign-in is still active, and you are not locked out.',
        steps: ['Choose Try again once.', 'If it still does not work, continue to Orb and add a passkey later from Account.'],
      }
  }
}

function SetupPasskeyContent() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromEmailChange = searchParams.get('from') === 'email-change'
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState('')
  const [failureCode, setFailureCode] = useState<PasskeyFailureCode | null>(null)
  const [success, setSuccess] = useState(false)
  const [userId, setUserId] = useState('')

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
      setUserId(user.id)
      setLoading(false)
    }
    checkSession()
  }, [supabase, router])

  async function handleRegister() {
    const perf = startInteraction({
      focus: 'auth',
      flow: 'passkey-enrollment',
      interaction: 'register',
      surface: 'auth-setup-passkey',
      immediateFlush: true,
    })
    setRegistering(true)
    setError('')
    setFailureCode(null)

    const result = await registerPasskey(supabase, stage => perf.mark(stage))

    if (result.ok) {
      if (userId) clearPasskeySetupDeferred(userId)
      perf.end(true)
      setSuccess(true)
      setTimeout(() => {
        markPerformanceNavigation('/dashboard')
        router.replace('/dashboard')
      }, 800)
      return
    }

    setRegistering(false)

    if (result.failureCode === 'cancelled') {
      perf.end(false, 'cancelled', { stage: result.stage })
      return
    }

    perf.mark('checking_for_committed_passkey')
    const existing = await listPasskeys(supabase)
    if (existing.ok && existing.data && existing.data.length > 0) {
      if (userId) clearPasskeySetupDeferred(userId)
      perf.mark('committed_passkey_found')
      perf.end(true, null, { outcome: 'reconciled_after_error', originalFailureCode: result.failureCode, stage: result.stage })
      setSuccess(true)
      setTimeout(() => {
        markPerformanceNavigation('/dashboard')
        router.replace('/dashboard')
      }, 800)
      return
    }

    const code = result.failureCode ?? 'unknown_error'
    perf.end(false, code, { stage: result.stage, reconciliation: existing.ok ? 'no_passkey' : 'check_failed' })
    setFailureCode(code)
    setError(result.error || 'Passkey registration failed')
  }

  function handleContinue() {
    const perf = startInteraction({
      focus: 'auth',
      flow: 'passkey-enrollment',
      interaction: 'continue_without_passkey',
      surface: 'auth-setup-passkey',
      immediateFlush: true,
    })
    if (userId) deferPasskeySetup(userId)
    markPerformanceNavigation('/dashboard')
    perf.end(true, null, { recoveryFrom: failureCode })
    router.replace('/dashboard')
  }

  async function handleReturnToEmail() {
    const perf = startInteraction({
      focus: 'auth',
      flow: 'passkey-enrollment',
      interaction: 'return_to_email',
      surface: 'auth-setup-passkey',
      immediateFlush: true,
    })
    await supabase.auth.signOut()
    perf.end(true, null, { recoveryFrom: failureCode })
    router.replace('/auth/login')
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
      <MuralCanvas urgency="calm" />
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
                {registering ? 'Registering…' : failureCode ? 'Try again' : 'Register Passkey'}
              </button>
            )}
          </div>

          {error && failureCode && (
            <div className="auth-error" role="alert">
              <p className="text-sm text-error" style={{ margin: 0, fontWeight: 'var(--fw-medium)' }}>
                {recoveryFor(failureCode).title}
              </p>
              <p className="text-sm text-error" style={{ margin: 'var(--sp-sm) 0 0' }}>
                {recoveryFor(failureCode).message}
              </p>
              <ol className="text-sm text-error" style={{ margin: 'var(--sp-sm) 0 0', paddingLeft: 'var(--sp-lg)' }}>
                {recoveryFor(failureCode).steps.map(step => <li key={step}>{step}</li>)}
              </ol>
            </div>
          )}
        </div>

        {failureCode && (
          <button
            type="button"
            onClick={recoveryFor(failureCode).requiresEmailSignIn ? handleReturnToEmail : handleContinue}
            className="auth-back"
          >
            {recoveryFor(failureCode).requiresEmailSignIn
              ? 'Return to email sign-in'
              : 'Continue to Orb — add a passkey later from Account'}
          </button>
        )}
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
