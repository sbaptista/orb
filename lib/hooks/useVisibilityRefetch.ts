import { useEffect, useRef } from 'react'

const POLL_INTERVAL = 30_000

// Refetches when the user returns to the tab/app, and every 30s as a fallback.
// visibilitychange covers desktop; pageshow covers iOS bfcache restore;
// focus covers WKWebView foreground events; interval catches anything missed.
export function useVisibilityRefetch(refetch: () => void) {
  const ref = useRef(refetch)
  ref.current = refetch

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') ref.current()
    }
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted || document.visibilityState === 'visible') ref.current()
    }
    function onFocus() {
      ref.current()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('focus', onFocus)
    const interval = setInterval(() => ref.current(), POLL_INTERVAL)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('focus', onFocus)
      clearInterval(interval)
    }
  }, [])
}
