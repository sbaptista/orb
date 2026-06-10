'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useSystemState } from '@/components/SystemStateProvider'

export default function MaintenanceBanner() {
  const router = useRouter()
  const pathname = usePathname()
  const { maintenance, lockedOut } = useSystemState()

  // Show banner if maintenance is active but the user is not locked out (i.e. is an admin)
  const visible = maintenance && !lockedOut

  // Don't render the banner on the standalone maintenance page
  if (pathname === '/maintenance') {
    return null
  }

  return (
    <div
      className="maintenance-banner"
      style={{
        height: visible ? '40px' : '0px',
        opacity: visible ? 1 : 0,
        overflow: 'hidden',
        transition: 'height 0.3s ease, opacity 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: visible ? '0 24px' : '0 24px',
        background: 'rgba(122, 80, 16, 0.05)',
        borderBottom: visible ? '1px solid rgba(122, 80, 16, 0.12)' : 'none',
        width: '100%',
        boxSizing: 'border-box',
        pointerEvents: visible ? 'auto' : 'none',
        fontFamily: 'var(--font-ui), sans-serif',
        fontSize: 'var(--fs-sm)',
        color: 'var(--warning)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'var(--fw-medium)' }}>
        <span>🛠</span>
        <span>Maintenance Mode is active. Normal users are locked out.</span>
      </div>
      
      {pathname !== '/settings/maintenance' && (
        <button
          onClick={() => router.push('/settings/maintenance')}
          title="Manage maintenance mode settings"
          className="btn-banner btn-banner--warning"
        >
          Settings
        </button>
      )}
    </div>
  )
}
