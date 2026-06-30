'use client'

import { useSystemState } from '@/components/SystemStateProvider'

export default function UpdateBanner() {
  const { updateAvailable, updateReason, isApplyingUpdate, applyUpdate } = useSystemState()
  const message = updateReason === 'dev-restart'
    ? 'Dev only: reconnect to the restarted local server'
    : 'A fresh version of Orb is available'

  return (
    <div
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
        onClick={applyUpdate}
        disabled={isApplyingUpdate}
        title={updateReason === 'dev-restart' ? 'Local dev server restarted' : 'New version of Orb available'}
        className="btn-banner"
      >
        {isApplyingUpdate ? 'Updating' : updateReason === 'dev-restart' ? 'Reconnect' : 'Update'}
      </button>
      <span style={{
        fontSize: 'var(--fs-xs)',
        color: 'var(--text3)',
        whiteSpace: 'nowrap',
      }}>
        {message}
      </span>
    </div>
  )
}
