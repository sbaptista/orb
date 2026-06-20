'use client'

import { useRef, useCallback } from 'react'

type Options = {
  onSingleTap: () => void
  onDoubleTap: () => void
  delay?: number
}

export function useDoubleTap({ onSingleTap, onDoubleTap, delay = 300 }: Options) {
  const lastTapRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTap = useCallback(() => {
    const now = Date.now()
    const elapsed = now - lastTapRef.current
    lastTapRef.current = now

    if (elapsed < delay && timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
      onDoubleTap()
    } else {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        onSingleTap()
      }, delay)
    }
  }, [onSingleTap, onDoubleTap, delay])

  return handleTap
}
