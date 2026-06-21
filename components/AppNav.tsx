'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import PrintModal from './PrintModal'

type Props = {
  printContext?: { productId: string | null; productName: string | null }
  userInitial?: string
  userName?: string
  /** Dashboard-only: Orb toggle button element */
  orbToggle?: React.ReactNode
  /** Dashboard-only: List toggle button element */
  listToggle?: React.ReactNode
  /** Dashboard-only: callback to open project search modal */
  onSearchProjects?: () => void
  /** Dashboard-only: callback to open add project modal */
  onAddProject?: () => void
}

// ── SVG Icons ──

const IconChangeProject = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="7" height="7" rx="1.5"/>
    <rect x="14" y="13" width="7" height="7" rx="1.5"/>
    <path d="M14 5h3.5A2.5 2.5 0 0 1 20 7.5V10"/>
    <path d="M10 19H6.5A2.5 2.5 0 0 1 4 16.5V14"/>
    <path d="M17 7l3 3 3-3"/>
    <path d="M7 17l-3-3-3 3"/>
  </svg>
)
const IconPlus = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const IconPrint = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
  </svg>
)
const IconHelp = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const IconSettings = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)
const IconBack = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)
const IconCommands = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
)

export default function AppNav({ printContext, userInitial = '?', userName, orbToggle, listToggle, onSearchProjects, onAddProject }: Props) {
  const pathname = usePathname()
  const onDashboard = pathname === '/dashboard' || pathname === '/'
  const onSettings = pathname.startsWith('/settings')
  const onHelp = pathname === '/help'
  const [showPrint, setShowPrint] = useState(false)
  const [commandsOpen, setCommandsOpen] = useState(false)

  return (
    <>
      <nav className="appnav" aria-label="Global navigation">
        {/* ── Left edge: Orb toggle (dashboard, desktop only) or Back (other pages) ── */}
        {onDashboard && orbToggle ? (
          <span className="appnav-desktop-only">{orbToggle}</span>
        ) : !onDashboard ? (
          <Link href="/dashboard" className="appnav-btn appnav-back" data-tooltip="Dashboard" aria-label="Back to Dashboard">
            <span className="appnav-btn-icon">{IconBack}</span>
            <span className="appnav-btn-label">Dashboard</span>
          </Link>
        ) : null}

        {/* ── Spacer (left) ── */}
        <div className="appnav-spacer" />

        {/* ── Center-left group: Change Project + New Project ── */}
        {onDashboard && (
          <div className="appnav-group">
            <button className="appnav-btn" onClick={onSearchProjects} data-tooltip="Change project" aria-label="Change project">
              <span className="appnav-btn-icon">{IconChangeProject}</span>
              <span className="appnav-btn-label">Change Project</span>
            </button>
            <button className="appnav-btn" onClick={onAddProject} data-tooltip="Create a new project" aria-label="New project">
              <span className="appnav-btn-icon">{IconPlus}</span>
              <span className="appnav-btn-label">Project</span>
            </button>
          </div>
        )}

        {/* ── Center-right group: Commands + Account ── */}
        <div className="appnav-group">
          <button className="appnav-btn" data-tour="commands" onClick={() => setCommandsOpen(true)} data-tooltip="Commands" aria-label="Commands">
            <span className="appnav-btn-icon">{IconSettings}</span>
            <span className="appnav-btn-label">Menu</span>
          </button>
          <Link href="/account" className="appnav-btn" data-tooltip={userName || 'Account'} aria-label="Account">
            <span className="appnav-btn-icon"><span className="nav-avatar">{userInitial}</span></span>
            <span className="appnav-btn-label">Account</span>
          </Link>
        </div>

        {/* ── Spacer (right) ── */}
        <div className="appnav-spacer" />

        {/* ── Right edge: List toggle (dashboard, desktop only) ── */}
        {onDashboard && listToggle ? (
          <span className="appnav-desktop-only">{listToggle}</span>
        ) : null}
      </nav>

      {/* ── Mobile Orb/List bar (dashboard only, iPhone) ── */}
      {onDashboard && (orbToggle || listToggle) && (
        <div className="appnav-mobile-panes" aria-label="Pane switcher">
          {orbToggle}
          <div className="appnav-spacer" />
          {listToggle}
        </div>
      )}

      {/* ── Print modal ── */}
      {showPrint && printContext && (
        <PrintModal
          onClose={() => setShowPrint(false)}
          selectedProductId={printContext.productId}
          selectedProductName={printContext.productName}
        />
      )}

      {/* ── Commands modal ── */}
      {commandsOpen && (
        <div className="modal-overlay" onClick={() => setCommandsOpen(false)}>
          <div
            className="modal-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="commands-dialog-title"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '320px' }}
          >
            <div className="modal-header">
              <h2 id="commands-dialog-title" style={{ flex: 1, margin: 0 }}>Commands</h2>
              <button className="close-btn" onClick={() => setCommandsOpen(false)} aria-label="Close"><svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div className="ud-commands-list">
              {onSettings ? (
                <span className="ud-commands-item ud-commands-current" aria-disabled="true">
                  {IconSettings}
                  Settings
                </span>
              ) : (
                <Link href="/settings" className="ud-commands-item" onClick={() => setCommandsOpen(false)}>
                  {IconSettings}
                  Settings
                </Link>
              )}
              {onHelp ? (
                <span className="ud-commands-item ud-commands-current" aria-disabled="true">
                  {IconHelp}
                  Help
                </span>
              ) : (
                <Link href="/help" className="ud-commands-item" onClick={() => setCommandsOpen(false)}>
                  {IconHelp}
                  Help
                </Link>
              )}
              {printContext && (
                <button className="ud-commands-item" onClick={() => { setShowPrint(true); setCommandsOpen(false) }}>
                  {IconPrint}
                  Print
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
