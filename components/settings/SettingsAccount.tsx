'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SettingsAccount() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
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
      setLoading(false)
    }
    load()
  }, [supabase])

  async function handleSave() {
    setSaving(true)
    setError('')
    setSaved(false)
    const { error: err } = await supabase
      .from('users')
      .update({ first_name: firstName.trim(), last_name: lastName.trim() })
      .eq('id', userId)
    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) return <div className="p-8 text-sm text-zinc-400">Loading…</div>

  return (
    <div className="p-6 max-w-lg">
      <h2 className="text-lg font-semibold mb-6">Account</h2>

      <div className="bg-white rounded-lg border border-zinc-200 p-5 mb-4">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">First Name</label>
              <input
                className="w-full border border-zinc-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Last Name</label>
              <input
                className="w-full border border-zinc-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Email</label>
            <input
              className="w-full border border-zinc-100 rounded px-3 py-2 text-sm bg-zinc-50 text-zinc-400 cursor-not-allowed"
              value={email}
              readOnly
            />
            <p className="text-xs text-zinc-400 mt-1">Email cannot be changed here.</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm bg-zinc-900 text-white px-4 py-1.5 rounded hover:bg-zinc-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {saved && <span className="text-sm text-green-600">Saved.</span>}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 p-5">
        <h3 className="text-sm font-medium text-zinc-700 mb-1">Sign Out</h3>
        <p className="text-xs text-zinc-400 mb-3">You will be redirected to the login page.</p>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="text-sm border border-zinc-200 px-3 py-1.5 rounded text-zinc-600 hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-50"
        >
          {loggingOut ? 'Signing out…' : 'Sign Out'}
        </button>
      </div>
    </div>
  )
}
