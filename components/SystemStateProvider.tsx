'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

type BroadcastType = 'info' | 'warning' | 'urgent'

interface Broadcast {
  message: string
  id: string
  type: BroadcastType
}

interface SystemState {
  isOnline: boolean
  version: string
  maintenance: boolean
  lockedOut: boolean
  broadcast: Broadcast | null
  refresh: () => void
}

const SystemStateContext = createContext<SystemState | undefined>(undefined)

export function SystemStateProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [version, setVersion] = useState<string>('')
  const [maintenance, setMaintenance] = useState<boolean>(false)
  const [lockedOut, setLockedOut] = useState<boolean>(false)
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null)

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const checkHealth = useCallback(async () => {
    if (typeof window !== 'undefined' && localStorage.getItem('todos_dev_simulate_offline') === 'true') {
      setIsOnline(false)
      return
    }

    try {
      const res = await fetch('/api/health', { cache: 'no-store' })
      setIsOnline(res.ok)
    } catch {
      setIsOnline(false)
    }
  }, [])

  const checkMaintenance = useCallback(async () => {
    // If we are offline, don't attempt to query version to save server resources
    if (typeof window !== 'undefined' && localStorage.getItem('todos_dev_simulate_offline') === 'true') {
      return
    }

    try {
      const res = await fetch('/api/version', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()

      setVersion(data.version || '')
      setMaintenance(!!data.maintenance)
      setLockedOut(!!data.lockedOut)
      setBroadcast(data.broadcast ?? null)
    } catch (err) {
      console.error('[SystemStateProvider] Failed to fetch server version/maintenance status:', err)
    }
  }, [])

  // Consolidated triggers with a 500ms trailing debounce to avoid double fetches on focus/visibility change
  const triggerChecks = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    debounceTimeoutRef.current = setTimeout(() => {
      checkHealth()
      checkMaintenance()
    }, 500)
  }, [checkHealth, checkMaintenance])

  // Run initial check on mount (deferred to avoid synchronous setState inside effect body)
  useEffect(() => {
    const timer = setTimeout(() => {
      checkHealth()
      checkMaintenance()
    }, 0)
    return () => clearTimeout(timer)
  }, [checkHealth, checkMaintenance])

  // Periodic polling check (30s) - only runs when tab is active/visible
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        checkHealth()
        checkMaintenance()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [checkHealth, checkMaintenance])

  // Focus and visibility listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        triggerChecks()
      }
    }
    const handleFocus = () => {
      triggerChecks()
    }
    const handleOnline = () => {
      checkHealth()
      checkMaintenance()
    }
    const handleOffline = () => {
      setIsOnline(false)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus)
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus)
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [triggerChecks, checkHealth, checkMaintenance])

  // DEV panel event listeners for simulations
  useEffect(() => {
    const handleOfflineSimChange = () => {
      checkHealth()
    }
    const handleUpdateSimChange = () => {
      checkMaintenance()
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('todos-dev-offline-change', handleOfflineSimChange)
      window.addEventListener('todos-dev-update-change', handleUpdateSimChange)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('todos-dev-offline-change', handleOfflineSimChange)
        window.removeEventListener('todos-dev-update-change', handleUpdateSimChange)
      }
    }
  }, [checkHealth, checkMaintenance])

  const value = React.useMemo(() => ({
    isOnline,
    version,
    maintenance,
    lockedOut,
    broadcast,
    refresh: () => {
      checkHealth()
      checkMaintenance()
    }
  }), [isOnline, version, maintenance, lockedOut, broadcast, checkHealth, checkMaintenance])

  return (
    <SystemStateContext.Provider value={value}>
      {children}
    </SystemStateContext.Provider>
  )
}

export function useSystemState() {
  const context = useContext(SystemStateContext)
  if (context === undefined) {
    throw new Error('useSystemState must be used within a SystemStateProvider')
  }
  return context
}
