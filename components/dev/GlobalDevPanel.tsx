'use client'

import { useEffect, useRef, useState } from 'react'
import { TABLE_TUNER_TOGGLE_EVENT } from './TableTuner'

export const DEV_PANEL_SLOT_ID = 'orb-dev-panel-dashboard-tools'

type DevPanelPosition = 'bottom-right' | 'top-right' | 'bottom-left' | 'top-left'

const DEV_PANEL_POSITION_KEY = 'orb_dev_panel_position'
const DEV_PANEL_POSITIONS: DevPanelPosition[] = ['bottom-right', 'top-right', 'bottom-left', 'top-left']

function loadDevPanelPosition(): DevPanelPosition {
  if (typeof window === 'undefined') return 'bottom-right'
  const saved = localStorage.getItem(DEV_PANEL_POSITION_KEY)
  return DEV_PANEL_POSITIONS.includes(saved as DevPanelPosition) ? saved as DevPanelPosition : 'bottom-right'
}

function GlobalDevPanelInner() {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<DevPanelPosition>(loadDevPanelPosition)
  const [hasDashboardTools, setHasDashboardTools] = useState(false)
  const [simulatedOffline, setSimulatedOffline] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('todos_dev_simulate_offline') === 'true'
  })
  const [simulatedUpdate, setSimulatedUpdate] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('todos_dev_simulate_update') === 'true'
  })
  const panelRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const slotRef = useRef<HTMLDivElement>(null)
  const lastTouchYRef = useRef(0)

  useEffect(() => {
    const slot = slotRef.current
    if (!slot) return

    const updateDashboardTools = () => setHasDashboardTools(slot.childNodes.length > 0)
    updateDashboardTools()
    const observer = new MutationObserver(updateDashboardTools)
    observer.observe(slot, { childList: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const menu = menuRef.current
    if (!panel || !menu) return

    const handleTouchStart = (event: TouchEvent) => {
      lastTouchYRef.current = event.touches[0]?.clientY ?? 0
    }

    const handleTouchMove = (event: TouchEvent) => {
      const target = event.target as Node
      const currentY = event.touches[0]?.clientY ?? lastTouchYRef.current
      const movingDown = currentY > lastTouchYRef.current
      const movingUp = currentY < lastTouchYRef.current
      lastTouchYRef.current = currentY

      if (!menu.contains(target)) {
        event.preventDefault()
        return
      }

      const canScroll = menu.scrollHeight > menu.clientHeight
      const atTop = menu.scrollTop <= 0
      const atBottom = menu.scrollTop + menu.clientHeight >= menu.scrollHeight - 1

      if (!canScroll || (atTop && movingDown) || (atBottom && movingUp)) {
        event.preventDefault()
      }
    }

    panel.addEventListener('touchstart', handleTouchStart, { passive: true })
    panel.addEventListener('touchmove', handleTouchMove, { passive: false })
    return () => {
      panel.removeEventListener('touchstart', handleTouchStart)
      panel.removeEventListener('touchmove', handleTouchMove)
    }
  }, [open])

  function cyclePosition() {
    const next = DEV_PANEL_POSITIONS[(DEV_PANEL_POSITIONS.indexOf(position) + 1) % DEV_PANEL_POSITIONS.length]
    setPosition(next)
    localStorage.setItem(DEV_PANEL_POSITION_KEY, next)
  }

  function toggleSimulateOffline() {
    const next = !simulatedOffline
    setSimulatedOffline(next)
    if (next) localStorage.setItem('todos_dev_simulate_offline', 'true')
    else localStorage.removeItem('todos_dev_simulate_offline')
    window.dispatchEvent(new Event('todos-dev-offline-change'))
  }

  function toggleSimulateUpdate() {
    const next = !simulatedUpdate
    setSimulatedUpdate(next)
    if (next) localStorage.setItem('todos_dev_simulate_update', 'true')
    else localStorage.removeItem('todos_dev_simulate_update')
    window.dispatchEvent(new Event('todos-dev-update-change'))
  }

  return (
    <div className="dev-panel" data-position={position} ref={panelRef}>
      <div className="dev-menu" hidden={!open} ref={menuRef}>
        <div id={DEV_PANEL_SLOT_ID} ref={slotRef} />
        {!hasDashboardTools && (
          <>
            <div className="dev-section">Dashboard tools</div>
            <p className="dev-note">Open Dashboard for Orb mood, role, API, transcript, and error-boundary controls.</p>
          </>
        )}

        <div className="dev-section">Authoring</div>
        <button
          type="button"
          className="dev-btn"
          onClick={() => window.dispatchEvent(new Event(TABLE_TUNER_TOGGLE_EVENT))}
        >
          Tables
        </button>

        <div className="dev-section">Connectivity</div>
        <button type="button" className="dev-btn" aria-pressed={simulatedOffline} onClick={toggleSimulateOffline}>
          Simulate Offline {simulatedOffline ? '✓' : ''}
        </button>
        <button type="button" className="dev-btn" aria-pressed={simulatedUpdate} onClick={toggleSimulateUpdate}>
          Simulate Update Available {simulatedUpdate ? '✓' : ''}
        </button>

        <div className="dev-section">Panel</div>
        <button type="button" className="dev-btn" onClick={cyclePosition}>
          Move panel
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
