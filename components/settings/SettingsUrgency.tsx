'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import SkeletonRows from '@/components/ui/SkeletonRows'

export default function SettingsUrgency() {
  const supabase = createClient()
  const toast = useToast()
  const [userId, setUserId] = useState('')
  const [urgencyThreshold, setUrgencyThreshold] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const origUrgencyThreshold = useRef(0)

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

        const { data: profile } = await supabase
          .from('users')
          .select('urgency_threshold_hours')
          .eq('id', user.id)
          .single()

        if (profile) {
          setUrgencyThreshold(profile.urgency_threshold_hours ?? 0)
          origUrgencyThreshold.current = profile.urgency_threshold_hours ?? 0
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

    const { error } = await supabase
      .from('users')
      .update({
        urgency_threshold_hours: Number(urgencyThreshold),
      })
      .eq('id', userId)

    if (error) {
      setSaving(false)
      toast.error('Failed to save settings. Try again.')
      return
    }

    origUrgencyThreshold.current = Number(urgencyThreshold)
    toast.success('Urgency Threshold saved.')
    setSaving(false)
  }

  const hasChanges = Number(urgencyThreshold) !== origUrgencyThreshold.current

  if (loading) return <div className="s-loading"><SkeletonRows rows={3} /></div>

  return (
    <div className="s-page">
      <div className="s-header">
        <h1 className="s-title">Urgency Threshold</h1>
      </div>

      <div className="s-card flex-col gap-lg">
        <div>
          <label className="label">Urgency Mood Threshold</label>
          <select
            className="w-full"
            value={urgencyThreshold}
            onChange={e => setUrgencyThreshold(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '10px var(--sp-md)',
              borderRadius: 'var(--r)',
              border: '1px solid var(--border)',
              background: `var(--bg) url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23547054' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E") no-repeat right 12px center`,
              backgroundSize: '20px',
              color: 'var(--text)',
              fontSize: 'var(--fs-input)',
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none',
              WebkitAppearance: 'none',
              paddingRight: '40px',
            }}
          >
            <option value={0}>Immediately when overdue</option>
            <option value={2}>2 hours before due date</option>
            <option value={12}>12 hours before due date</option>
            <option value={24}>24 hours before due date (Early Warning)</option>
          </select>
          <p className="text-xs text-muted" style={{ margin: 'var(--sp-xs) 0 0' }}>
            Controls when to trigger an URGENT warning. The Orb will change mood to URGENT and you are sent an email notification.
          </p>
        </div>

        <div className="flex-center gap-md mt-md">
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
  )
}
