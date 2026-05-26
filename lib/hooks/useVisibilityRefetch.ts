import { useEffect, useRef } from 'react'

const POLL_INTERVAL = 60_000
const MIN_REFETCH_GAP = 5_000

export function useVisibilityRefetch(refetch: () => void) {
  const ref = useRef(refetch)
  ref.current = refetch
  const lastFetch = useRef(0)

  useEffect(() => {
    function guardedRefetch() {
      const now = Date.now()
      if (now - lastFetch.current < MIN_REFETCH_GAP) return
      lastFetch.current = now
      ref.current()
    }

    function onVisible() {
      if (document.visibilityState === 'visible') guardedRefetch()
    }
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) guardedRefetch()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onPageShow)
    const interval = setInterval(guardedRefetch, POLL_INTERVAL)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onPageShow)
      clearInterval(interval)
    }
  }, [])
}
