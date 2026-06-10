'use client'

import { useState, useEffect } from 'react'
import { useSystemState } from '@/components/SystemStateProvider'

const BANNER_STYLES = {
  info: {
    background: 'var(--success)',
    color: '#ffffff',
    pillBg: 'rgba(255, 255, 255, 0.18)',
  },
  warning: {
    background: 'var(--warning)',
    color: '#ffffff',
    pillBg: 'rgba(255, 255, 255, 0.18)',
  },
  urgent: {
    background: 'var(--error)',
    color: '#ffffff',
    pillBg: 'rgba(255, 255, 255, 0.18)',
  },
} as const

export default function BroadcastBanner() {
  const { broadcast } = useSystemState()
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    const PREFIX = 'broadcast_dismissed_'
    if (!broadcast) { setDismissed(true); return }
    const currentKey = `${PREFIX}${broadcast.id}`
    setDismissed(localStorage.getItem(currentKey) === 'true')
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIX) && k !== currentKey) localStorage.removeItem(k)
    }
  }, [broadcast])

  if (!broadcast || dismissed) return null

  const handleDismiss = () => {
    localStorage.setItem(`broadcast_dismissed_${broadcast.id}`, 'true')
    setDismissed(true)
  }

  const style = BANNER_STYLES[broadcast.type] || BANNER_STYLES.info

  return (
    <div
      style={{
        minHeight: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '6px 16px',
        width: '100%',
        boxSizing: 'border-box',
        background: style.background,
        color: style.color,
        flexShrink: 0,
      }}
    >
      <span style={{
        fontSize: 'var(--fs-sm)',
        color: style.color,
        fontWeight: 'var(--fw-medium)' as any,
        lineHeight: 'var(--lh-snug)',
        textAlign: 'center',
      }}>
        {broadcast.message}
      </span>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: style.color,
          opacity: 0.8,
          width: '32px',
          height: '32px',
          minWidth: '32px',
          minHeight: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          borderRadius: 'var(--r)',
          padding: 0,
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" style={{ width: '18px', height: '18px', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round' }}>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}
