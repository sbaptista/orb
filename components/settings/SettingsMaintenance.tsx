'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { logAudit } from '@/app/actions/log-audit'

export default function SettingsMaintenance() {
  const supabase = createClient()
  const toast = useToast()
  const [userId, setUserId] = useState('')
  const [maintenanceActive, setMaintenanceActive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const origMaintenanceActive = useRef(false)

  useEffect(() => {
    async function load() {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser()
        let user = userData.user
        if (userError?.message?.includes('Lock')) {
          const { data: sessionData } = await supabase.auth.getSession()
          user = sessionData.session?.user ?? null
        }

        if (!user) return
        
        const { data: dbUser } = await supabase
          .from('users')
          .select('role_id')
          .eq('id', user.id)
          .single()

        const isAdmin = dbUser && [1, 3].includes(dbUser.role_id)
        if (!isAdmin) {
          window.location.href = '/dashboard'
          return
        }

        setUserId(user.id)


        const { data: setting } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'maintenance_mode')
          .maybeSingle()

        if (setting) {
          const active = setting.value === true
          setMaintenanceActive(active)
          origMaintenanceActive.current = active
        }
      } catch (err) {
        console.error('Failed to load maintenance settings:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase])

  async function handleSave() {
    setSaving(true)
    const targetState = maintenanceActive

    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'maintenance_mode',
          value: targetState,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        })

      if (error) {
        toast.error('Failed to update maintenance settings.')
        setSaving(false)
        return
      }

      // Log to audit log
      await logAudit({
        action: targetState ? 'maintenance_enable' : 'maintenance_disable',
        table_name: 'system_settings',
        before: { active: origMaintenanceActive.current },
        after: { active: targetState },
        user_id: userId,
      })

      origMaintenanceActive.current = targetState
      toast.success(targetState ? 'Maintenance Mode enabled.' : 'Maintenance Mode disabled.')
    } catch (err) {
      console.error('Error saving settings:', err)
      toast.error('An unexpected error occurred.')
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = maintenanceActive !== origMaintenanceActive.current

  if (loading) return <div className="s-loading">Loading…</div>

  return (
    <div className="s-page">
      <div className="s-header">
        <h1 className="s-title">Maintenance Mode</h1>
      </div>

      <div className="s-card flex-col gap-lg">
        <div className="flex-col gap-sm">
          <h2 className="s-card-title">System Lockdown</h2>
          <p className="s-card-desc" style={{ marginBottom: 'var(--sp-md)' }}>
            When enabled, normal users will be locked out of the application and redirected to the Undergoing Maintenance screen. Admins will still be able to bypass the lockout to test migrations and updates.
          </p>

          <label className="flex-center gap-md" style={{ cursor: 'pointer', padding: '10px 0' }}>
            <input
              type="checkbox"
              className="checkbox"
              checked={maintenanceActive}
              onChange={e => setMaintenanceActive(e.target.checked)}
            />
            <span className="text-base" style={{ fontWeight: 'var(--fw-medium)' }}>
              Enable Undergoing Maintenance Mode
            </span>
          </label>
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
