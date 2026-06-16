'use client'

import { useState } from 'react'
import { TABLE_TUNER_TOGGLE_EVENT } from './TableTuner'

export const DEV_PANEL_SLOT_ID = 'orb-dev-panel-dashboard-tools'

function GlobalDevPanelInner() {
  const [open, setOpen] = useState(false)

  return (
    <div className="dev-panel">
      <div className="dev-menu" hidden={!open}>
        <div id={DEV_PANEL_SLOT_ID} />

        <div className="dev-section">Authoring</div>
        <button
          type="button"
          className="dev-btn"
          onClick={() => window.dispatchEvent(new Event(TABLE_TUNER_TOGGLE_EVENT))}
        >
          Tables
        </button>
      </div>

      <button type="button" onClick={() => setOpen(value => !value)} className="dev-toggle">
        DEV {open ? '▼' : '▲'}
      </button>
    </div>
  )
}

export default function GlobalDevPanel() {
  if (process.env.NODE_ENV !== 'development') return null
  return <GlobalDevPanelInner />
}
