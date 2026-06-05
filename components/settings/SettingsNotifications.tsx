'use client'

import { useState, useEffect } from 'react'
import {
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  getExistingSubscription,
} from '@/lib/push-client'

type PushState = 'loading' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'

export default function SettingsNotifications() {
  const [pushState, setPushState] = useState<PushState>('loading')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function check() {
      if (!isPushSupported()) {
        setPushState('unsupported')
        return
      }

      if (Notification.permission === 'denied') {
        setPushState('denied')
        return
      }

      const sub = await getExistingSubscription()
      setPushState(sub ? 'subscribed' : 'unsubscribed')
    }
    check()
  }, [])

  async function handleSubscribe() {
    setSaving(true)
    setMessage('')
    const result = await subscribeToPush()
    if (result.ok) {
      setPushState('subscribed')
      setMessage('Push notifications enabled.')
    } else {
      if (result.error === 'Permission denied') {
        setPushState('denied')
      }
      setMessage(result.error ?? 'Failed to subscribe.')
    }
    setSaving(false)
  }

  async function handleUnsubscribe() {
    setSaving(true)
    setMessage('')
    const result = await unsubscribeFromPush()
    if (result.ok) {
      setPushState('unsubscribed')
      setMessage('Push notifications disabled.')
    } else {
      setMessage(result.error ?? 'Failed to unsubscribe.')
    }
    setSaving(false)
  }

  return (
    <div className="settings-page">
      <h2 className="s-title mb-2xl">Notifications</h2>

      <div className="s-card" style={{ padding: 'var(--sp-xl)' }}>
        <h3 style={{ margin: '0 0 var(--sp-sm)', fontSize: 'var(--fs-base)', fontWeight: 500 }}>
          Push Notifications
        </h3>
        <p className="text-sm text-muted" style={{ margin: '0 0 var(--sp-lg)', lineHeight: 1.5 }}>
          Get notified when your orb state changes — calm to busy, busy to urgent — or when a due date is approaching. Works on Mac, iPad, and iPhone.
        </p>

        {pushState === 'loading' && (
          <p className="text-sm text-muted">Checking notification status…</p>
        )}

        {pushState === 'unsupported' && (
          <div style={{
            padding: 'var(--sp-md) var(--sp-lg)',
            background: 'var(--bg-hover)',
            borderRadius: 'var(--r)',
            fontSize: 'var(--fs-sm)',
            color: 'var(--muted)',
          }}>
            Push notifications are not supported in this browser. Try Safari 17.1+, Chrome, or Edge.
          </div>
        )}

        {pushState === 'denied' && (
          <div style={{
            padding: 'var(--sp-md) var(--sp-lg)',
            background: 'var(--bg-hover)',
            borderRadius: 'var(--r)',
            fontSize: 'var(--fs-sm)',
            color: 'var(--error)',
          }}>
            Notification permission was denied. To enable, update this site&apos;s permissions in your browser settings.
          </div>
        )}

        {pushState === 'unsubscribed' && (
          <button
            className="btn-primary"
            onClick={handleSubscribe}
            disabled={saving}
          >
            {saving ? 'Enabling…' : 'Enable Push Notifications'}
          </button>
        )}

        {pushState === 'subscribed' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)' }}>
            <span style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 600,
              background: '#e8f0e8',
              color: '#2d5a2d',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              Active
            </span>
            <button
              className="btn-cancel"
              onClick={handleUnsubscribe}
              disabled={saving}
              style={{ fontSize: 'var(--fs-sm)' }}
            >
              {saving ? 'Disabling…' : 'Disable'}
            </button>
          </div>
        )}

        {message && (
          <p className="text-sm" style={{ marginTop: 'var(--sp-md)', color: message.includes('Failed') || message.includes('denied') ? 'var(--error)' : 'var(--muted)' }}>
            {message}
          </p>
        )}
      </div>

      <div className="s-card" style={{ padding: 'var(--sp-xl)', marginTop: 'var(--sp-xl)' }}>
        <h3 style={{ margin: '0 0 var(--sp-sm)', fontSize: 'var(--fs-base)', fontWeight: 500 }}>
          What triggers a notification
        </h3>
        <ul style={{ margin: 0, paddingLeft: 'var(--sp-xl)', fontSize: 'var(--fs-sm)', color: 'var(--text2)', lineHeight: 1.8 }}>
          <li>Orb state changes to <strong>urgent</strong> (new urgent-priority task or approaching due date)</li>
          <li>A due date is approaching (within your urgency threshold)</li>
          <li>A task becomes overdue</li>
        </ul>
      </div>
    </div>
  )
}
