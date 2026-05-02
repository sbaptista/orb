'use client'

import { useState, useEffect } from 'react'

type Topic = {
  id: string
  label: string
  icon: string
  content: React.ReactNode
}

const s = {
  h2: {
    fontSize: 'var(--fs-base)',
    fontWeight: 600,
    color: 'var(--text2)',
    margin: '0 0 10px',
    letterSpacing: '0.03em',
  } as React.CSSProperties,

  p: {
    fontSize: 'var(--fs-base)',
    color: 'var(--text2)',
    lineHeight: 1.6,
    margin: '0 0 16px',
  } as React.CSSProperties,

  li: {
    fontSize: 'var(--fs-sm)',
    color: 'var(--text2)',
    lineHeight: 1.6,
    marginBottom: '6px',
  } as React.CSSProperties,

  mono: {
    fontFamily: 'monospace',
    fontSize: 'var(--fs-xs)',
    background: 'var(--bg3)',
    padding: '1px 6px',
    borderRadius: '4px',
    color: 'var(--text)',
  } as React.CSSProperties,

  section: {
    marginBottom: '28px',
  } as React.CSSProperties,

  keyRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '16px',
    padding: '9px 0',
    borderBottom: '1px solid var(--border)',
  } as React.CSSProperties,

  keyCell: {
    fontFamily: 'monospace',
    fontSize: 'var(--fs-xs)',
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '2px 8px',
    color: 'var(--text)',
    whiteSpace: 'nowrap' as const,
    minWidth: '120px',
    flexShrink: 0,
  } as React.CSSProperties,

  descCell: {
    fontSize: 'var(--fs-sm)',
    color: 'var(--text2)',
  } as React.CSSProperties,
}

const TOPICS: Topic[] = [
  {
    id: 'ask',
    label: 'What can I do?',
    icon: '◎',
    content: (
      <div>
        <p style={s.p}>Type plain English. The orb handles the rest.</p>

        <div style={s.section}>
          <h2 style={s.h2}>Create</h2>
          <ul style={{ padding: '0 0 0 20px', margin: 0 }}>
            <li style={s.li}>"Add a note to review the API docs, high priority"</li>
            <li style={s.li}>"Remind me to follow up on the proposal"</li>
            <li style={s.li}>"HELM needs a login page"</li>
          </ul>
        </div>

        <div style={s.section}>
          <h2 style={s.h2}>Query</h2>
          <ul style={{ padding: '0 0 0 20px', margin: 0 }}>
            <li style={s.li}>"What's most urgent right now?"</li>
            <li style={s.li}>"Show me all open HELM todos"</li>
            <li style={s.li}>"What did I say about the auth work?"</li>
          </ul>
        </div>

        <div style={s.section}>
          <h2 style={s.h2}>Update</h2>
          <ul style={{ padding: '0 0 0 20px', margin: 0 }}>
            <li style={s.li}>"Mark TODOS-14 as done"</li>
            <li style={s.li}>"Move the invoice todo to high priority"</li>
            <li style={s.li}>"Set the accessibility task to in progress"</li>
          </ul>
        </div>

        <div style={s.section}>
          <h2 style={s.h2}>
            Delete{' '}
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 400, color: 'var(--muted)', letterSpacing: '0.04em' }}>coming soon</span>
          </h2>
          <ul style={{ padding: '0 0 0 20px', margin: 0 }}>
            <li style={{ ...s.li, color: 'var(--muted)' }}>"Delete the invoice todo"</li>
            <li style={{ ...s.li, color: 'var(--muted)' }}>"Remove all done items from HELM"</li>
          </ul>
        </div>

        <div style={s.section}>
          <h2 style={s.h2}>
            Archive{' '}
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 400, color: 'var(--muted)', letterSpacing: '0.04em' }}>coming soon</span>
          </h2>
          <ul style={{ padding: '0 0 0 20px', margin: 0 }}>
            <li style={{ ...s.li, color: 'var(--muted)' }}>"Archive everything closed in TODOS"</li>
            <li style={{ ...s.li, color: 'var(--muted)' }}>"Archive TODOS-8"</li>
          </ul>
        </div>

        <div style={s.section}>
          <h2 style={s.h2}>List</h2>
          <p style={{ ...s.p, margin: 0 }}>Tap or click the orb to open the full todo list for the selected product.</p>
        </div>

        <div style={s.section}>
          <h2 style={s.h2}>Ask anything</h2>
          <ul style={{ padding: '0 0 0 20px', margin: 0 }}>
            <li style={s.li}>"How do I use the keyboard?"</li>
            <li style={s.li}>"What does URGENT mean?"</li>
            <li style={s.li}>"What products do I have?"</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'keyboard',
    label: 'Keyboard shortcuts',
    icon: '⌨',
    content: (
      <div>
        <p style={s.p}>Full keyboard navigation is supported throughout the app.</p>

        <div style={{ borderTop: '1px solid var(--border)' }}>
          {([
            ['Tab', 'Move between interactive elements'],
            ['Enter / Space', 'Activate the focused element'],
            ['← / →', 'Switch between products on the orb screen'],
            ['?', 'Open this help page'],
            ['Escape', 'Close any open panel or overlay'],
          ] as [string, string][]).map(([key, desc]) => (
            <div key={key} style={s.keyRow}>
              <span style={s.keyCell}>{key}</span>
              <span style={s.descCell}>{desc}</span>
            </div>
          ))}
        </div>

        <p style={{ ...s.p, marginTop: '20px', fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>
          You can also ask the orb: "How do I use the keyboard?" and it will explain.
        </p>
      </div>
    ),
  },
  {
    id: 'orb',
    label: 'About the orb',
    icon: '●',
    content: (
      <div>
        <p style={s.p}>The orb reflects your current workload for the selected product.</p>

        <div style={s.section}>
          <h2 style={s.h2}>States</h2>
          <div style={{ borderTop: '1px solid var(--border)' }}>
            {([
              ['CALM', 'All open items are low priority or the backlog is light'],
              ['ACTIVE', 'More than 5 open items'],
              ['URGENT', 'One or more P1 (urgent priority) items are open'],
            ] as [string, string][]).map(([state, desc]) => (
              <div key={state} style={s.keyRow}>
                <span style={{ ...s.keyCell, fontFamily: 'var(--font-ui)', letterSpacing: '0.06em' }}>{state}</span>
                <span style={s.descCell}>{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={s.section}>
          <h2 style={s.h2}>Signals</h2>
          <p style={s.p}>
            Urgency is communicated through multiple signals simultaneously — color, glow size, animation speed, and solar flares in urgent mode. Any one signal can be removed (or disabled via <span style={s.mono}>prefers-reduced-motion</span>) without losing the information.
          </p>
        </div>

        <div style={s.section}>
          <h2 style={s.h2}>Navigation</h2>
          <ul style={{ padding: '0 0 0 20px', margin: 0 }}>
            <li style={s.li}>The number in the center is your open todo count for the selected product.</li>
            <li style={s.li}>Tap or click the orb to open the full todo list.</li>
            <li style={s.li}>The product pills at the bottom switch which backlog you are viewing.</li>
          </ul>
        </div>
      </div>
    ),
  },
]

export default function OrbHelp({ onClose }: { onClose: () => void }) {
  const [selectedId, setSelectedId] = useState('ask')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const selected = TOPICS.find(t => t.id === selectedId)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Help"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'var(--bg)',
        display: 'flex',
        fontFamily: 'var(--font-ui)',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? '220px' : '48px',
        transition: 'width 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        background: 'var(--bg2)',
      }}>
        {/* Sidebar header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarOpen ? 'space-between' : 'center',
          padding: '14px 12px',
          borderBottom: '1px solid var(--border)',
          minHeight: '52px',
        }}>
          {sidebarOpen && (
            <span style={{
              fontSize: 'var(--fs-xs)',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text3)',
              whiteSpace: 'nowrap',
            }}>
              Help
            </span>
          )}
          <button
            onClick={() => setSidebarOpen(s => !s)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px', display: 'flex', alignItems: 'center', lineHeight: 1 }}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              {sidebarOpen
                ? <><line x1="3" y1="8" x2="13" y2="8"/><path d="M8 3l-5 5 5 5"/></>
                : <><line x1="3" y1="8" x2="13" y2="8"/><path d="M8 3l5 5-5 5"/></>
              }
            </svg>
          </button>
        </div>

        {/* Topic list */}
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {TOPICS.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: selectedId === t.id ? 'var(--pill-active-bg)' : 'transparent',
                border: 'none',
                borderLeft: `2px solid ${selectedId === t.id ? 'var(--pill-active-color)' : 'transparent'}`,
                padding: sidebarOpen ? '10px 16px' : '12px 0',
                color: selectedId === t.id ? 'var(--pill-active-color)' : 'var(--text2)',
                fontSize: 'var(--fs-sm)',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                gap: '10px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                transition: 'background var(--transition), color var(--transition)',
              }}
              aria-current={selectedId === t.id ? 'page' : undefined}
            >
              <span style={{ fontSize: '15px', flexShrink: 0, opacity: 0.7 }}>{t.icon}</span>
              {sidebarOpen && t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 var(--sp-2xl)',
          height: '52px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            autoFocus
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              padding: '6px 10px',
              fontSize: 'var(--fs-sm)',
              fontFamily: 'var(--font-ui)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: 'var(--r)',
            }}
            aria-label="Close help"
          >
            Close
            <span style={{ fontSize: 'var(--fs-xs)', opacity: 0.6 }}>Esc</span>
          </button>
        </div>

        {/* Topic content */}
        {selected && (
          <div style={{ padding: 'var(--sp-3xl) var(--sp-2xl)', maxWidth: '620px' }}>
            <h1 style={{
              fontSize: 'var(--fs-xl)',
              fontWeight: 600,
              color: 'var(--text)',
              margin: '0 0 var(--sp-2xl)',
              lineHeight: 1.2,
            }}>
              {selected.label}
            </h1>
            {selected.content}
          </div>
        )}
      </div>
    </div>
  )
}
