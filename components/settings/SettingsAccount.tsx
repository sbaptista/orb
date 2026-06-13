'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SkeletonRows from '@/components/ui/SkeletonRows'
import { useToast } from '@/components/ui/Toast'
import { isPasskeyAvailable } from '@/lib/passkey'
import SettingsPasskeys from '@/components/settings/SettingsPasskeys'
import ChangeEmailModal from '@/components/settings/ChangeEmailModal'

export default function SettingsAccount() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const toast = useToast()

  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const origFirstName = useRef('')
  const origLastName = useRef('')

  useEffect(() => {
    async function load() {
      try {
        let user
        const { data: userData, error: userError } = await supabase.auth.getUser()

        if (userError?.message?.includes('Lock')) {
          const { data: sessionData } = await supabase.auth.getSession()
          user = sessionData.session?.user
        } else {
          user = userData.user
        }

        if (!user) return
        setUserId(user.id)
        setEmail(user.email ?? '')

        const { data: profile } = await supabase
          .from('users')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single()

        if (profile) {
          setFirstName(profile.first_name ?? '')
          setLastName(profile.last_name ?? '')
          origFirstName.current = profile.first_name ?? ''
          origLastName.current = profile.last_name ?? ''
        }
      } catch {
        console.warn('Auth check skipped due to lock contention')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase])

  async function handleSave() {
    setSaving(true)

    const { error: nameErr } = await supabase
      .from('users')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      })
      .eq('id', userId)

    if (nameErr) {
      setSaving(false)
      toast.error('Failed to save. Try again.')
      return
    }

    origFirstName.current = firstName.trim()
    origLastName.current = lastName.trim()
    toast.success('Account saved.')
    setSaving(false)
  }

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const hasChanges =
    firstName.trim() !== origFirstName.current ||
    lastName.trim() !== origLastName.current

  if (loading) return <div className="s-loading"><SkeletonRows rows={3} /></div>

  return (
    <div className="settings-page s-page" style={{ maxWidth: '480px' }}>
      <h2 className="s-title mb-2xl">Account</h2>

      <div className="s-card mb-md">
        <div className="flex-col gap-lg">
          <div className="settings-grid-2col grid-2col">
            <div>
              <label className="label">First Name</label>
              <input
                className="input"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input
                className="input"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Email</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)' }}>
              <span className="text-sm" style={{ color: 'var(--text)', flex: 1 }}>{email}</span>
              <button
                type="button"
                className="btn-cancel btn-sm"
                onClick={() => setShowEmailModal(true)}
              >
                Change
              </button>
            </div>
          </div>

          <div className="flex-center gap-md">
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={saving || !hasChanges}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="s-card mb-md">
        <h3 className="text-sm" style={{ fontWeight: 'var(--fw-medium)', color: 'var(--text2)', margin: '0 0 var(--sp-xs)' }}>
          Sign Out
        </h3>
        <p className="text-xs text-muted mb-md" style={{ margin: 0 }}>
          You will be redirected to the login page.
        </p>
        <button
          className="btn-sign-out"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? 'Signing out…' : 'Sign Out'}
        </button>
      </div>

      {isPasskeyAvailable() && (
        <div style={{ marginTop: 'var(--sp-2xl)' }}>
          <SettingsPasskeys />
        </div>
      )}

      {showEmailModal && (
        <ChangeEmailModal
          currentEmail={email}
          onClose={() => setShowEmailModal(false)}
        />
      )}
    </div>
  )
}
