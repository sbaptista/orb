'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { completeOnboarding } from '@/app/actions/complete-onboarding'

export default function CreateAccountPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await completeOnboarding(
      firstName.trim(),
      lastName.trim()
    )

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="auth-page">
      <div className="auth-wrap" style={{ maxWidth: '400px' }}>
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">Create your account</h1>
            <p className="auth-subtitle">Just a couple more details to get started.</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label htmlFor="firstName" className="auth-label">First name</label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="auth-input"
              />
            </div>
            <div className="auth-field">
              <label htmlFor="lastName" className="auth-label">Last name</label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="auth-input"
              />
            </div>

            <button type="submit" disabled={loading} className="auth-submit">
              {loading ? 'Saving…' : 'Continue'}
            </button>
          </form>

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
