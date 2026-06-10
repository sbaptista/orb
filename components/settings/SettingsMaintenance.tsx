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
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastType, setBroadcastType] = useState<'info' | 'warning' | 'urgent'>('info')
  const [activeBroadcast, setActiveBroadcast] = useState<{ message: string; id: string; type: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingBroadcast, setSavingBroadcast] = useState(false)
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

        const { data: broadcastSetting } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'broadcast_message')
          .maybeSingle()

        if (broadcastSetting?.value && typeof broadcastSetting.value === 'object' && broadcastSetting.value.message) {
          setActiveBroadcast({ message: broadcastSetting.value.message, id: broadcastSetting.value.id, type: broadcastSetting.value.type || 'info' })
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

  async function handleSendBroadcast() {
    if (!broadcastMessage.trim()) return
    setSavingBroadcast(true)
    try {
      const id = Date.now().toString()
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'broadcast_message',
          value: { message: broadcastMessage.trim(), id, type: broadcastType },
          updated_at: new Date().toISOString(),
          updated_by: userId,
        })

      if (error) { toast.error('Failed to send broadcast.'); return }

      await logAudit({
        action: 'broadcast_send',
        table_name: 'system_settings',
        before: activeBroadcast ? { message: activeBroadcast.message } : null,
        after: { message: broadcastMessage.trim(), type: broadcastType },
        user_id: userId,
      })

      setActiveBroadcast({ message: broadcastMessage.trim(), id, type: broadcastType })
      setBroadcastMessage('')
      toast.success('Broadcast sent.')
    } catch (err) {
      console.error('Error sending broadcast:', err)
      toast.error('An unexpected error occurred.')
    } finally {
      setSavingBroadcast(false)
    }
  }

  async function handleClearBroadcast() {
    setSavingBroadcast(true)
    try {
      const { error } = await supabase
        .from('system_settings')
        .delete()
        .eq('key', 'broadcast_message')

      if (error) { toast.error('Failed to clear broadcast.'); return }

      await logAudit({
        action: 'broadcast_clear',
        table_name: 'system_settings',
        before: activeBroadcast ? { message: activeBroadcast.message } : null,
        after: null,
        user_id: userId,
      })

      setActiveBroadcast(null)
      toast.success('Broadcast cleared.')
    } catch (err) {
      console.error('Error clearing broadcast:', err)
      toast.error('An unexpected error occurred.')
    } finally {
      setSavingBroadcast(false)
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
      <div className="s-card flex-col gap-lg" style={{ marginTop: 'var(--sp-lg)' }}>
        <div className="flex-col gap-sm">
          <h2 className="s-card-title">Broadcast Message</h2>
          <p className="s-card-desc" style={{ marginBottom: 'var(--sp-md)' }}>
            Send a message that appears as a banner for all users. Users can dismiss it individually.
          </p>

          {activeBroadcast && (
            <div style={{
              padding: '10px 14px',
              background: activeBroadcast.type === 'urgent' ? 'rgba(139, 32, 32, 0.08)'
                : activeBroadcast.type === 'warning' ? 'rgba(122, 80, 16, 0.08)'
                : 'rgba(45, 90, 135, 0.06)',
              borderRadius: '6px',
              border: `1px solid ${activeBroadcast.type === 'urgent' ? 'rgba(139, 32, 32, 0.18)'
                : activeBroadcast.type === 'warning' ? 'rgba(122, 80, 16, 0.18)'
                : 'rgba(45, 90, 135, 0.12)'}`,
              fontSize: '13px',
              color: 'var(--text2)',
              marginBottom: 'var(--sp-sm)',
            }}>
              <strong style={{ color: 'var(--text1)' }}>Active ({activeBroadcast.type}):</strong> {activeBroadcast.message}
            </div>
          )}

          <div className="flex-center gap-sm">
            {(['info', 'warning', 'urgent'] as const).map(t => {
              const selected = broadcastType === t
              const colors = {
                info:    { bg: 'rgba(45, 90, 135, 0.10)', border: 'rgba(45, 90, 135, 0.25)', color: 'var(--text2)' },
                warning: { bg: 'rgba(122, 80, 16, 0.12)', border: 'rgba(122, 80, 16, 0.30)', color: 'var(--warning)' },
                urgent:  { bg: 'rgba(139, 32, 32, 0.12)', border: 'rgba(139, 32, 32, 0.30)', color: 'var(--error)' },
              }[t]
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setBroadcastType(t)}
                  style={{
                    background: selected ? colors.bg : 'transparent',
                    border: `1.5px solid ${selected ? colors.border : 'var(--border)'}`,
                    borderRadius: '6px',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: 'var(--fw-medium)' as any,
                    color: selected ? colors.color : 'var(--text3)',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    transition: 'all 0.15s',
                  }}
                >
                  {t === 'info' ? 'Information' : t}
                </button>
              )
            })}
          </div>

          <input
            type="text"
            className="s-input"
            placeholder="Type a broadcast message…"
            value={broadcastMessage}
            onChange={e => setBroadcastMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && broadcastMessage.trim() && !savingBroadcast) handleSendBroadcast() }}
            maxLength={200}
          />
        </div>

        <div className="flex-center gap-md mt-md">
          <button
            className="btn-primary"
            onClick={handleSendBroadcast}
            disabled={savingBroadcast || !broadcastMessage.trim()}
          >
            {savingBroadcast ? 'Sending…' : 'Send Broadcast'}
          </button>
          {activeBroadcast && (
            <button
              className="btn-cancel"
              onClick={handleClearBroadcast}
              disabled={savingBroadcast}
            >
              Clear Broadcast
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
