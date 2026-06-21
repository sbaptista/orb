'use client'

import { useEffect } from 'react'

let activeLocks = 0

/** Locks Orb's settings scroll surface while a modal is open. */
export function useModalScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return

    activeLocks += 1
    document.documentElement.dataset.settingsModalOpen = 'true'

    return () => {
      activeLocks = Math.max(0, activeLocks - 1)
      if (activeLocks === 0) delete document.documentElement.dataset.settingsModalOpen
    }
  }, [locked])
}
