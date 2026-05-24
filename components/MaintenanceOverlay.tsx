'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import MaintenancePage from '@/components/ui/MaintenancePage'

export default function MaintenanceOverlay() {
  const [lockedOut, setLockedOut] = useState(false)
  const pathname = usePathname()
  const initialCheckedRef = useRef(false)

  const checkMaintenance = async () => {
    // Avoid double checking or checking on the maintenance page itself
    if (pathname === '/maintenance') {
      setLockedOut(false)
      return
    }

    try {
      const res = await fetch('/api/version')
      if (!res.ok) return
      const data = await res.json()
      
      setLockedOut(!!data.lockedOut)
    } catch (err) {
      console.error('[maintenance-check] Failed to check status:', err)
      // Fallback: If network query fails, check online status.
      // If we are online, it could mean the backend database is down, so lock out.
      // If we are offline, the OfflinePage handles it, so we don't lock out.
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        setLockedOut(true)
      }
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

    // Poll every 30 seconds for quick reactive lockout when maintenance starts
    const interval = setInterval(checkMaintenance, 30 * 1000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', checkMaintenance)
      clearInterval(interval)
    }
  }, [pathname])

  // Don't render the overlay on the standalone maintenance page
  if (pathname === '/maintenance') {
    return null
  }

  if (!lockedOut) {
    return null
  }

  return <MaintenancePage isOverlay={true} />
}
