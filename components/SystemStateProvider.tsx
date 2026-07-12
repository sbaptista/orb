'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { VERSION } from '@/lib/version'
import { clearVersionVolatileState, LAST_APPLIED_VERSION_KEY } from '@/lib/client-state'

type BroadcastType = 'info' | 'warning' | 'urgent'

interface Broadcast {
  message: string
  id: string
  type: BroadcastType
}

interface SystemState {
  isOnline: boolean
  version: string
  clientVersion: string
  updateAvailable: boolean
  updateReason: 'version' | 'dev-restart' | 'simulated' | null
  isApplyingUpdate: boolean
  lastCheckedAt: number | null
  maintenance: boolean
  lockedOut: boolean
  broadcast: Broadcast | null
  refresh: () => void
  applyUpdate: () => Promise<void>
}

const SystemStateContext = createContext<SystemState | undefined>(undefined)
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development'
const VERSION_CHECK_INTERVAL_MS = IS_DEVELOPMENT ? 5_000 : 30_000

export function SystemStateProvider({ children }: { children: React.ReactNode }) {
  const [clientVersion] = useState<string>(() => VERSION)
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [version, setVersion] = useState<string>('')
  const [simulatedUpdate, setSimulatedUpdate] = useState<boolean>(false)
  const [reloadRecommended, setReloadRecommended] = useState<boolean>(false)
  const [isApplyingUpdate, setIsApplyingUpdate] = useState<boolean>(false)
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null)
  const [maintenance, setMaintenance] = useState<boolean>(false)
  const [lockedOut, setLockedOut] = useState<boolean>(false)
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null)

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const serverBootIdRef = useRef<string | null>(null)

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
      const res = await fetch(`/api/version?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache' },
      })
      if (!res.ok) return
      const data = await res.json()

      setVersion(data.version || '')
      if (IS_DEVELOPMENT && data.serverBootId) {
        if (!serverBootIdRef.current) {
          serverBootIdRef.current = data.serverBootId
        } else if (serverBootIdRef.current !== data.serverBootId) {
          setReloadRecommended(true)
        }
      }
      setMaintenance(!!data.maintenance)
      setLockedOut(!!data.lockedOut)
      setBroadcast(data.broadcast ?? null)
      setLastCheckedAt(Date.now())
    } catch (err) {
      console.error('[SystemStateProvider] Failed to fetch server version/maintenance status:', err)
    }
  }, [])

  const updateReason: SystemState['updateReason'] = simulatedUpdate
    ? 'simulated'
    : reloadRecommended
      ? 'dev-restart'
      : (!!version && version !== clientVersion)
        ? 'version'
        : null
  const updateAvailable = updateReason !== null

  const applyUpdate = useCallback(async () => {
    if (isApplyingUpdate) return
    setIsApplyingUpdate(true)

    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map(async (registration) => {
          registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
          await registration.update()
          registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
        }))
      }

      clearVersionVolatileState()
      try {
        localStorage.setItem(LAST_APPLIED_VERSION_KEY, version || clientVersion)
      } catch {}

      window.location.reload()
    } catch (err) {
      console.error('[SystemStateProvider] Failed to apply update:', err)
      setIsApplyingUpdate(false)
    }
  }, [clientVersion, isApplyingUpdate, version])

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

  // Long-lived tabs should discover a new deployment without requiring a focus change.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        triggerChecks()
      }
    }, VERSION_CHECK_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [triggerChecks])


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
      setSimulatedUpdate(localStorage.getItem('todos_dev_simulate_update') === 'true')
      checkMaintenance()
    }

    if (typeof window !== 'undefined') {
      const timer = window.setTimeout(() => {
        setSimulatedUpdate(localStorage.getItem('todos_dev_simulate_update') === 'true')
      }, 0)
      window.addEventListener('todos-dev-offline-change', handleOfflineSimChange)
      window.addEventListener('todos-dev-update-change', handleUpdateSimChange)
      return () => {
        window.clearTimeout(timer)
        window.removeEventListener('todos-dev-offline-change', handleOfflineSimChange)
        window.removeEventListener('todos-dev-update-change', handleUpdateSimChange)
      }
    }

    return undefined
  }, [checkHealth, checkMaintenance])

  const value = React.useMemo(() => ({
    isOnline,
    version,
    clientVersion,
    updateAvailable,
    updateReason,
    isApplyingUpdate,
    lastCheckedAt,
    maintenance,
    lockedOut,
    broadcast,
    refresh: () => {
      checkHealth()
      checkMaintenance()
    },
    applyUpdate,
  }), [isOnline, version, clientVersion, updateAvailable, updateReason, isApplyingUpdate, lastCheckedAt, maintenance, lockedOut, broadcast, checkHealth, checkMaintenance, applyUpdate])

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
