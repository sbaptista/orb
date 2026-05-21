'use client'

import { useEffect, useState, useRef } from 'react'
import { useToast } from '@/components/ui/Toast'
import { VERSION } from '@/lib/version'

export default function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const toast = useToast()
  const toastShownRef = useRef(false)

  const checkVersion = async () => {
    // Check DEV simulation toggle
    const isSimulated = typeof window !== 'undefined' && localStorage.getItem('todos_dev_simulate_update') === 'true'
    
    if (isSimulated) {
      setUpdateAvailable(true)
      if (!toastShownRef.current) {
        toast.neutral('A new version of Orb is available.')
        toastShownRef.current = true
      }
      return
    }

    try {
      const res = await fetch('/api/version')
      if (!res.ok) return
      const data = await res.json()
      
      if (data.version && data.version !== VERSION) {
        setUpdateAvailable(true)
        if (!toastShownRef.current) {
          toast.neutral('A new version of Orb is available.')
          toastShownRef.current = true
        }
      } else {
        setUpdateAvailable(false)
      }
    } catch (err) {
      console.error('[version-check] Failed to fetch server version:', err)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Run check on mount
    checkVersion()

    // Listen to visibility/focus changes
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkVersion()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Listen to DEV panel simulation events
    window.addEventListener('todos-dev-update-change', checkVersion)

    // Poll every 5 minutes
    const interval = setInterval(checkVersion, 5 * 60 * 1000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('todos-dev-update-change', checkVersion)
      clearInterval(interval)
    }
  }, [])

  const handleUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
          registration.update()
        }
      })
    }
    window.location.reload()
  }

  return (
    <div
      className="update-banner"
      style={{
        height: updateAvailable ? '40px' : '0px',
        opacity: updateAvailable ? 1 : 0,
        overflow: 'hidden',
        transition: 'height 0.3s ease, opacity 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: updateAvailable ? '0 24px' : '0 24px',
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
    </div>
  )
}
