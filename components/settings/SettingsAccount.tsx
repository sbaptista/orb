'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

export default function SettingsAccount() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const toast = useToast()

  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const origFirstName = useRef('')
  const origLastName = useRef('')

  useEffect(() => {
    async function load() {
      try {
        let user
        const { data: userData, error: userError } = await supabase.auth.getUser()
        
        if (userError?.message?.includes('Lock')) {
          // Fallback if another request is already refreshing the token
          const { data: sessionData } = await supabase.auth.getSession()
          user = sessionData.session?.user
        } else {
          user = userData.user
        }

        if (!user) return
        setUserId(user.id)
        setEmail(user.email ?? '')
        setNewEmail(user.email ?? '')
        
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
      } catch (err) {
        console.warn('Auth check skipped due to lock contention')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase])

  async function handleSave() {
    setSaving(true)
    setError('')

    const { error: nameErr } = await supabase
      .from('users')
      .update({ first_name: firstName.trim(), last_name: lastName.trim() })
      .eq('id', userId)
    if (nameErr) { setSaving(false); toast.error('Failed to save. Try again.'); return }

    const emailChanged = newEmail.trim() !== email
    if (emailChanged) {
      const { error: emailErr } = await supabase.auth.updateUser({ email: newEmail.trim() })
      if (emailErr) {
        setError(emailErr.message)
        setSaving(false)
        return
      }
      setEmail(newEmail.trim())
      toast.success(`Confirmation sent to ${newEmail.trim()}.`)
    } else {
      toast.success('Account saved.')
    }

    setSaving(false)
  }

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const hasChanges =
    firstName.trim() !== origFirstName.current ||
    lastName.trim() !== origLastName.current ||
    newEmail.trim() !== email

  if (loading) return (
    <div style={{ padding: 'var(--sp-3xl)', fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>
      Loading…
    </div>
  )

  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r)',
    padding: '10px var(--sp-md)',
    fontSize: 'var(--fs-input)',
    background: 'var(--bg)',
    color: 'var(--text)',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color var(--transition)',
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg2)',
    borderRadius: 'var(--r-lg)',
    border: '1px solid var(--border)',
    padding: 'var(--sp-xl)',
    marginBottom: 'var(--sp-md)',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 'var(--fs-xs)',
    fontWeight: 'var(--fw-medium)',
    color: 'var(--text3)',
    marginBottom: 'var(--sp-xs)',
  }

  return (
    <div className="settings-page" style={{ padding: 'var(--sp-2xl)', maxWidth: '480px' }}>
      <h2 style={{
        fontSize: 'var(--fs-lg)',
        fontWeight: 'var(--fw-bold)',
        color: 'var(--text)',
        margin: '0 0 var(--sp-2xl)',
      }}>
        Account
      </h2>

      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
          <div className="settings-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-md)' }}>
            <div>
              <label style={labelStyle}>First Name</label>
              <input
                style={inputStyle}
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>
            <div>
              <label style={labelStyle}>Last Name</label>
              <input
                style={inputStyle}
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Email</label>
            <input
              style={inputStyle}
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', margin: 'var(--sp-xs) 0 0' }}>
              A confirmation email will be sent to the new address.
            </p>
          </div>

          {error && (
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--error)', margin: 0 }}>{error}</p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)' }}>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              style={{
                background: 'var(--success)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--r)',
                padding: '8px var(--sp-lg)',
                fontSize: 'var(--fs-sm)',
                fontWeight: 'var(--fw-medium)',
                cursor: saving || !hasChanges ? 'not-allowed' : 'pointer',
                opacity: saving || !hasChanges ? 0.6 : 1,
                transition: 'opacity var(--transition)',
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{
          fontSize: 'var(--fs-sm)',
          fontWeight: 'var(--fw-medium)',
          color: 'var(--text2)',
          margin: '0 0 var(--sp-xs)',
        }}>
          Sign Out
        </h3>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', margin: '0 0 var(--sp-md)' }}>
          You will be redirected to the login page.
        </p>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r)',
            padding: '8px var(--sp-md)',
            fontSize: 'var(--fs-sm)',
            color: 'var(--text2)',
            cursor: loggingOut ? 'not-allowed' : 'pointer',
            opacity: loggingOut ? 0.6 : 1,
            transition: 'all var(--transition)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'rgba(139,32,32,0.4)'
            e.currentTarget.style.color = 'var(--error)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.color = 'var(--text2)'
          }}
        >
          {loggingOut ? 'Signing out…' : 'Sign Out'}
        </button>
      </div>
    </div>
  )
}
