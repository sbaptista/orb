'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function PasskeyRemovedContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''

  function handleContinue() {
    const url = email
      ? `/auth/passkey-reregister?email=${encodeURIComponent(email)}`
      : '/auth/passkey-reregister'
    router.push(url)
  }

  return (
    <div className="auth-card">
      <div className="auth-header">
        <h1 className="auth-title">Passkey removed</h1>
        <p className="auth-subtitle">
          Your passkey has been deleted and you&apos;ve been signed out.
        </p>
      </div>

      <div className="auth-form">
        <p className="text-sm" style={{ color: 'var(--text2)', lineHeight: 'var(--lh-normal)', margin: '0 0 var(--sp-lg)' }}>
          Sign in with email to register a new passkey — you&apos;ll be prompted automatically. If your browser still shows the old passkey in the sign-in picker, ignore it — it will no longer work.
        </p>

        <button
          type="button"
          className="auth-submit"
          onClick={handleContinue}
        >
          Sign in with email
        </button>
      </div>
    </div>
  )
}

export default function PasskeyRemovedPage() {
  return (
    <div className="auth-page">
      <div className="auth-wrap">
        <Suspense fallback={
          <div className="auth-card">
            <div className="auth-header">
              <h1 className="auth-title">Passkey removed</h1>
              <p className="auth-subtitle">Loading…</p>
            </div>
          </div>
        }>
          <PasskeyRemovedContent />
        </Suspense>
      </div>
    </div>
  )
}
