'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export default function MaintenanceBanner() {
  const [visible, setVisible] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const checkMaintenance = async () => {
    try {
      const res = await fetch('/api/version')
      if (!res.ok) return
      const data = await res.json()
      
      // Show banner if maintenance is active but the user is not locked out (i.e. is an admin)
      if (data.maintenance && !data.lockedOut) {
        setVisible(true)
      } else {
        setVisible(false)
      }
    } catch (err) {
      console.error('[maint-banner-check] Failed to check status:', err)
      setVisible(false)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Run check on mount
    checkMaintenance()

    // Listen to visibility/focus changes
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkMaintenance()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Listen to focus changes
    window.addEventListener('focus', checkMaintenance)

    // Poll every 30 seconds for quick updates
    const interval = setInterval(checkMaintenance, 30 * 1000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', checkMaintenance)
      clearInterval(interval)
    }
  }, [pathname])

  // Don't render the banner on the standalone maintenance page
  if (pathname === '/maintenance') {
    return null
  }

  return (
    <div
      className="maintenance-banner"
      style={{
        height: visible ? '40px' : '0px',
        opacity: visible ? 1 : 0,
        overflow: 'hidden',
        transition: 'height 0.3s ease, opacity 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: visible ? '0 24px' : '0 24px',
        background: 'rgba(122, 80, 16, 0.05)',
        borderBottom: visible ? '1px solid rgba(122, 80, 16, 0.12)' : 'none',
        width: '100%',
        boxSizing: 'border-box',
        pointerEvents: visible ? 'auto' : 'none',
        fontFamily: 'var(--font-ui), sans-serif',
        fontSize: 'var(--fs-sm)',
        color: 'var(--warning)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'var(--fw-medium)' }}>
        <span>🛠</span>
        <span>Maintenance Mode is active. Normal users are locked out.</span>
      </div>
      
      {pathname !== '/settings/maintenance' && (
        <button
          onClick={() => router.push('/settings/maintenance')}
          title="Manage maintenance mode settings"
          style={{
            background: 'var(--warning)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            padding: '4px 14px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            boxShadow: '0 2px 6px rgba(122, 80, 16, 0.15)',
            transition: 'transform 0.2s ease, background 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.04)'
            e.currentTarget.style.background = '#5c3c0c'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.background = 'var(--warning)'
          }}
        >
          Settings
        </button>
      )}
    </div>
  )
}
