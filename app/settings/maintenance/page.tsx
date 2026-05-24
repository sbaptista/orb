import SettingsMaintenance from '@/components/settings/SettingsMaintenance'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Maintenance Settings | Orb',
}

export default function MaintenanceSettingsPage() {
  return <SettingsMaintenance />
}
