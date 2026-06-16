'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SkeletonRows from '@/components/ui/SkeletonRows'
import { useToast } from '@/components/ui/Toast'
import { isPasskeyAvailable } from '@/lib/passkey'
import SettingsPasskeys from '@/components/settings/SettingsPasskeys'
import ChangeEmailModal from '@/components/settings/ChangeEmailModal'
import ChangeNameModal from '@/components/settings/ChangeNameModal'
import { logAudit } from '@/app/actions/log-audit'
import { collectSystemInfo } from '@/lib/system-info'

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
  const [showNameModal, setShowNameModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)

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
        }
      } catch {
        console.warn('Auth check skipped due to lock contention')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase])

  async function handleNameChange(nextFirstName: string, nextLastName: string) {
    setSaving(true)

    const { error: nameErr } = await supabase
      .from('users')
      .update({
        first_name: nextFirstName.trim(),
        last_name: nextLastName.trim(),
      })
      .eq('id', userId)

    if (nameErr) {
      setSaving(false)
      toast.error('Failed to change name. Try again.')
      return
    }

    setFirstName(nextFirstName.trim())
    setLastName(nextLastName.trim())
    setShowNameModal(false)
    logAudit({ action: 'user_name_change', table_name: 'users', record_id: userId, before: { first_name: firstName, last_name: lastName }, after: { first_name: nextFirstName.trim(), last_name: nextLastName.trim() }, system_info: collectSystemInfo() })
    toast.success('Name changed.')
    setSaving(false)
  }

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) return <div className="s-loading"><SkeletonRows rows={3} /></div>

  const displayName = [firstName, lastName].filter(Boolean).join(' ') || 'No name added'

  return (
    <div className="settings-page s-page account-page">
      <div className="s-header mb-2xl">
        <h2 className="s-title">Account</h2>
        <button
          className="btn-sign-out"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? 'Signing out…' : 'Sign Out'}
        </button>
      </div>

      <div className="s-card mb-md">
        <div className="account-profile-row">
          <div className="account-profile-copy">
            <p className="account-profile-label">Name</p>
            <p className="account-profile-value">{displayName}</p>
          </div>
          <button type="button" className="btn-primary" onClick={() => setShowNameModal(true)}>
            Change name
          </button>
        </div>
      </div>

      <div className="s-card mb-md">
        <div className="account-profile-row">
          <div className="account-profile-copy">
            <p className="account-profile-label">Email</p>
            <p className="account-profile-value">{email}</p>
          </div>
          <button type="button" className="btn-primary" onClick={() => setShowEmailModal(true)}>
            Change email
          </button>
        </div>
      </div>

      {isPasskeyAvailable() && (
        <div className="mb-md">
          <SettingsPasskeys />
        </div>
      )}

      {showNameModal && (
        <ChangeNameModal
          firstName={firstName}
          lastName={lastName}
          saving={saving}
          onClose={() => setShowNameModal(false)}
          onSubmit={handleNameChange}
        />
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
