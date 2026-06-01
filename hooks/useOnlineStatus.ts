'use client'

import { useSystemState } from '@/components/SystemStateProvider'

export function useOnlineStatus(): boolean {
  return useSystemState().isOnline
}
