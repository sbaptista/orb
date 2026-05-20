'use client'

import { useState, useEffect } from 'react'

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('todos_dev_simulate_offline') !== 'true'
    }
    return true
  })

  useEffect(() => {
    let cancelled = false

    async function check() {
      if (typeof window !== 'undefined' && localStorage.getItem('todos_dev_simulate_offline') === 'true') {
        setIsOnline(false)
        return
      }
      try {
        // Fetch health endpoint to verify actual internet connectivity
        const res = await fetch('/api/health', { cache: 'no-store' })
        if (!cancelled) setIsOnline(res.ok)
      } catch {
        if (!cancelled) setIsOnline(false)
      }
    }

    check() // immediate check on mount

    // Fallback listeners for quick offline/online OS level notifications
    const goOnline = () => { check() }
    const goOffline = () => { setIsOnline(false) }
    const handleSimChange = () => { check() }

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    window.addEventListener('todos-dev-offline-change', handleSimChange)

    // Regular interval checking (every 10s)
    const interval = setInterval(check, 10000)

    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('todos-dev-offline-change', handleSimChange)
    }
  }, [])

  return isOnline
}
