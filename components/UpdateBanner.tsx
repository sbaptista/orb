'use client'

import { useEffect, useState } from 'react'
import { VERSION } from '@/lib/version'
import { useSystemState } from '@/components/SystemStateProvider'

export default function UpdateBanner() {
  const [tick, setTick] = useState(0)
  const { version } = useSystemState()

  const isSimulated = typeof window !== 'undefined' && localStorage.getItem('todos_dev_simulate_update') === 'true'
  const updateAvailable = isSimulated || (!!version && version !== VERSION)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleSimChange = () => {
      setTick(t => t + 1)
    }

    window.addEventListener('todos-dev-update-change', handleSimChange)
    return () => {
      window.removeEventListener('todos-dev-update-change', handleSimChange)
    }
  }, [])

  const handleUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.update()
        }
      })
    }
    window.location.reload()
  }

  return (
    <div
      key={tick}
      className="update-banner"
      style={{
        height: updateAvailable ? '40px' : '0px',
        opacity: updateAvailable ? 1 : 0,
        overflow: 'hidden',
        transition: 'height 0.3s ease, opacity 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '0 24px',
        background: 'rgba(45, 90, 45, 0.05)',
        borderBottom: updateAvailable ? '1px solid rgba(45, 90, 45, 0.12)' : 'none',
        width: '100%',
        boxSizing: 'border-box',
        pointerEvents: updateAvailable ? 'auto' : 'none',
      }}
    >
      <button
        onClick={handleUpdate}
        title="New version of Orb available"
        style={{
          background: 'var(--success)',
          color: '#ffffff',
          border: 'none',
          borderRadius: '12px',
          padding: '4px 14px',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          boxShadow: '0 2px 6px rgba(45, 90, 45, 0.15)',
          transition: 'transform 0.2s ease, background 0.2s ease',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.04)'
          e.currentTarget.style.background = '#224422'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.background = 'var(--success)'
        }}
      >
        Update
      </button>
      <span style={{
        fontSize: '12px',
        color: 'var(--text3)',
        whiteSpace: 'nowrap',
      }}>
        An application update is available
      </span>
    </div>
  )
}
