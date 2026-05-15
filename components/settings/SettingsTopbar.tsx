'use client'

import Breadcrumbs from '@/components/ui/Breadcrumbs'

export default function SettingsTopbar() {
  return (
    <div className="sl-topbar" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
      <Breadcrumbs />
    </div>
  )
}
