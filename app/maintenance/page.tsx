import type { Metadata } from 'next'
import MaintenancePage from '@/components/ui/MaintenancePage'

export const metadata: Metadata = {
  title: 'Undergoing Maintenance | Orb',
}

export default function StandaloneMaintenancePage() {
  return <MaintenancePage isOverlay={false} />
}
