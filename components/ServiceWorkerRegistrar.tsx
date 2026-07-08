'use client'

import { useEffect } from 'react'

function shouldRegisterServiceWorker(): boolean {
  if (!('serviceWorker' in navigator)) return false
  if (process.env.NODE_ENV !== 'development') return true
  return ['localhost', '127.0.0.1'].includes(window.location.hostname)
}

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!shouldRegisterServiceWorker()) return
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[sw] Registration skipped/failed:', err)
    })
  }, [])

  return null
}
