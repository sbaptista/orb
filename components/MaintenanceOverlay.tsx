'use client'

import { usePathname } from 'next/navigation'
import MaintenancePage from '@/components/ui/MaintenancePage'
import { useSystemState } from '@/components/SystemStateProvider'

export default function MaintenanceOverlay() {
  const pathname = usePathname()
  const { lockedOut } = useSystemState()

  // Don't render the overlay on the standalone maintenance page
  if (pathname === '/maintenance') {
    return null
  }

  if (!lockedOut) {
    return null
  }

  return <MaintenancePage isOverlay={true} />
}
