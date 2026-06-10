'use client'

import { useEffect, useState } from 'react'
import { VERSION } from '@/lib/version'
import { useSystemState } from '@/components/SystemStateProvider'

export default function UpdateBanner() {
  const [tick, setTick] = useState(0)
  const { version } = useSystemState()

  const isSimulated = typeof window !== 'undefined' && localStorage.getItem('todos_dev_simulate_update') === 'true'
  const updateAvailable = isSimulated || (!!version && version !== VERSION)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleSimChange = () => {
      setTick(t => t + 1)
    }

    window.addEventListener('todos-dev-update-change', handleSimChange)
    return () => {
      window.removeEventListener('todos-dev-update-change', handleSimChange)
    }
  }, [])

  const handleUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.update()
        }
      })
    }
    window.location.reload()
  }

  return (
    <div
      key={tick}
      className="update-banner"
      style={{
        height: updateAvailable ? '40px' : '0px',
        opacity: updateAvailable ? 1 : 0,
        overflow: 'hidden',
        transition: 'height 0.3s ease, opacity 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '0 24px',
        background: 'rgba(45, 90, 45, 0.05)',
        borderBottom: updateAvailable ? '1px solid rgba(45, 90, 45, 0.12)' : 'none',
        width: '100%',
        boxSizing: 'border-box',
        pointerEvents: updateAvailable ? 'auto' : 'none',
      }}
    >
      <button
        onClick={handleUpdate}
        title="New version of Orb available"
        className="btn-banner"
      >
        Update
      </button>
      <span style={{
        fontSize: 'var(--fs-xs)',
        color: 'var(--text3)',
        whiteSpace: 'nowrap',
      }}>
        An application update is available
      </span>
    </div>
  )
}
