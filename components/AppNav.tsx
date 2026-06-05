'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import OrbHelp from './OrbHelp'
import PrintModal from './PrintModal'

type Props = {
  /** When provided, Print button appears and scopes to this project */
  printContext?: { productId: string | null; productName: string | null }
  /** User initial for Account button */
  userInitial?: string
  /** Full user name for Account tooltip */
  userName?: string
}

// ── SVG Icons (shared across desktop bar + mobile modal) ──

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
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
)

export default function AppNav({ printContext, userInitial = '?', userName }: Props) {
  const pathname = usePathname()
  const onDashboard = pathname === '/dashboard' || pathname === '/'
  const [showHelp, setShowHelp] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [commandsOpen, setCommandsOpen] = useState(false)

  return (
    <>
      {/* ── Desktop bar ── */}
      <nav className="appnav" aria-label="Global navigation">
        {/* Left: back to dashboard (when not on dashboard) */}
        <div className="appnav-left">
          {!onDashboard && (
            <Link href="/dashboard" className="nav-btn appnav-back" title="Dashboard" aria-label="Back to Dashboard">
              <span className="nav-btn-icon">{IconBack}</span>
              <span className="nav-btn-label">Dashboard</span>
            </Link>
          )}
        </div>

        {/* Right: global actions — desktop only */}
        <div className="appnav-right appnav-desktop">
          {printContext && (
            <button className="nav-btn" onClick={() => setShowPrint(true)} title="Print" aria-label="Print">
              <span className="nav-btn-icon">{IconPrint}</span>
              <span className="nav-btn-label">Print</span>
            </button>
          )}
          <button className="nav-btn" data-tour="help" onClick={() => setShowHelp(true)} title="Help" aria-label="Help">
            <span className="nav-btn-icon">{IconHelp}</span>
            <span className="nav-btn-label">Help</span>
          </button>
          <Link href="/settings" className="nav-btn" title="Settings" aria-label="Settings">
            <span className="nav-btn-icon">{IconSettings}</span>
            <span className="nav-btn-label">Settings</span>
          </Link>
          <Link href="/account" className="nav-btn" title={userName || 'Account'} aria-label="Account">
            <span className="nav-avatar">{userInitial}</span>
            <span className="nav-btn-label">Account</span>
          </Link>
        </div>

        {/* Mobile: commands button */}
        <div className="appnav-right appnav-mobile">
          <button className="nav-btn appnav-commands-btn" onClick={() => setCommandsOpen(true)} title="Commands" aria-label="Commands">
            <span className="nav-btn-icon">{IconCommands}</span>
            <span className="nav-btn-label">Commands</span>
          </button>
        </div>
      </nav>

      {/* ── Modals ── */}
      {showHelp && <OrbHelp onClose={() => setShowHelp(false)} />}
      {showPrint && printContext && (
        <PrintModal
          onClose={() => setShowPrint(false)}
          selectedProductId={printContext.productId}
          selectedProductName={printContext.productName}
        />
      )}

      {/* ── Mobile commands modal ── */}
      {commandsOpen && (
        <div className="modal-overlay" onClick={() => setCommandsOpen(false)}>
          <div className="modal-center" onClick={e => e.stopPropagation()} style={{ maxWidth: '320px' }}>
            <div className="modal-header">
              <h2 style={{ flex: 1, margin: 0 }}>Commands</h2>
              <button className="close-btn" onClick={() => setCommandsOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="ud-commands-list">
              {!onDashboard && (
                <Link href="/dashboard" className="ud-commands-item" onClick={() => setCommandsOpen(false)}>
                  {IconBack}
                  Dashboard
                </Link>
              )}
              {printContext && (
                <button className="ud-commands-item" onClick={() => { setShowPrint(true); setCommandsOpen(false) }}>
                  {IconPrint}
                  Print
                </button>
              )}
              <button className="ud-commands-item" onClick={() => { setShowHelp(true); setCommandsOpen(false) }}>
                {IconHelp}
                Help
              </button>
              <Link href="/settings" className="ud-commands-item" onClick={() => setCommandsOpen(false)}>
                {IconSettings}
                Settings
              </Link>
              <Link href="/account" className="ud-commands-item" onClick={() => setCommandsOpen(false)}>
                <span className="nav-avatar" style={{ width: 20, height: 20, fontSize: '11px' }}>{userInitial}</span>
                Account
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
