'use client'

import { useState, useEffect } from 'react'
import CollapsibleSidebar from '@/components/CollapsibleSidebar'

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
            <li style={s.li}>"[Project] needs a login page"</li>
          </ul>
        </div>

        <div style={s.section}>
          <h2 style={s.h2}>Query</h2>
          <ul style={{ padding: '0 0 0 20px', margin: 0 }}>
            <li style={s.li}>"What's most urgent right now?"</li>
            <li style={s.li}>"Show me all open [project] todos"</li>
            <li style={s.li}>"What did I say about the auth work?"</li>
          </ul>
        </div>

        <div style={s.section}>
          <h2 style={s.h2}>Update</h2>
          <ul style={{ padding: '0 0 0 20px', margin: 0 }}>
            <li style={s.li}>"Mark [project]-14 as done"</li>
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
            <li style={{ ...s.li, color: 'var(--muted)' }}>"Remove all done items from [project]"</li>
          </ul>
        </div>

        <div style={s.section}>
          <h2 style={s.h2}>
            Archive{' '}
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 400, color: 'var(--muted)', letterSpacing: '0.04em' }}>coming soon</span>
          </h2>
          <ul style={{ padding: '0 0 0 20px', margin: 0 }}>
            <li style={{ ...s.li, color: 'var(--muted)' }}>"Archive everything closed in [project]"</li>
            <li style={{ ...s.li, color: 'var(--muted)' }}>"Archive [project]-8"</li>
          </ul>
        </div>

        <div style={s.section}>
          <h2 style={s.h2}>List</h2>
          <p style={{ ...s.p, margin: 0 }}>Tap or click the orb to open the full todo list for the selected project.</p>
        </div>

        <div style={s.section}>
          <h2 style={s.h2}>Navigation</h2>
          <ul style={{ padding: '0 0 0 20px', margin: 0 }}>
            <li style={s.li}>"Switch to [project]" or <span style={s.mono}>/switch [project]</span></li>
            <li style={s.li}>"Open settings" or <span style={s.mono}>/settings</span></li>
            <li style={s.li}>Edit current project: <span style={s.mono}>/edit</span></li>
            <li style={s.li}>Edit a specific project: <span style={s.mono}>/edit [project]</span></li>
          </ul>
          <p style={{ ...s.p, marginTop: '10px', marginBottom: 0, fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>
            Type <span style={s.mono}>/</span> in the input field to see all available commands.
          </p>
        </div>


        <div style={s.section}>
          <h2 style={s.h2}>Ask anything</h2>
          <ul style={{ padding: '0 0 0 20px', margin: 0 }}>
            <li style={s.li}>"How do I use the keyboard?"</li>
            <li style={s.li}>"What does URGENT mean?"</li>
            <li style={s.li}>"What projects do I have?"</li>
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
            ['← / →', 'Switch between projects on the orb screen'],
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
        <p style={s.p}>The orb reflects your current workload for the selected project.</p>

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
            <li style={s.li}>The number in the center is your open todo count for the selected project.</li>
            <li style={s.li}>Tap or click the orb to open the full todo list.</li>
            <li style={s.li}>The project pills at the bottom switch which backlog you are viewing.</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'about',
    label: 'About',
    icon: '◌',
    content: (
      <div>
        <p style={s.p}>
          TODOS is a personal project issue tracker built around a single idea: your work should have a presence, not just a list.
        </p>
        <p style={s.p}>
          Most todo apps put you in charge of the list. TODOS puts the orb in charge of your attention. The orb reads your open work across all your projects and reflects it back — calm when things are light, active when the backlog builds, urgent when something needs your attention now. Color, motion, glow, and animation all carry the same signal independently, so nothing gets lost.
        </p>
        <p style={s.p}>
          The orb is also conversational. Type plain English and it handles the rest — create a todo, ask what's most pressing, update a priority, mark something done. You don't navigate menus or fill out forms. You just talk to it.
        </p>
        <p style={{ ...s.p, marginBottom: 0 }}>
          Under the hood, the orb is powered by AI. It understands context and intent, not just keywords. "What's the most important thing right now?" reasons over your full backlog across all projects to answer.
        </p>
      </div>
    ),
  },
]

export default function OrbHelp({ onClose }: { onClose: () => void }) {
  const [selectedId, setSelectedId] = useState('ask')

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
      {/* Full-width top bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '52px',
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-md)',
        padding: '0 var(--sp-2xl)',
        zIndex: 1,
      }}>
        <button
          onClick={onClose}
          autoFocus
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--muted)',
            cursor: 'pointer',
            padding: '6px 0',
            fontSize: 'var(--fs-sm)',
            fontFamily: 'var(--font-ui)',
            whiteSpace: 'nowrap',
          }}
          aria-label="Close help"
        >
          ← back
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text2)' }}>
          Help
        </span>
      </div>

      {/* Sidebar + content below the top bar */}
      <div style={{ display: 'flex', flex: 1, marginTop: '52px', overflow: 'hidden' }}>

        <CollapsibleSidebar
          items={TOPICS.map(t => ({ id: t.id, label: t.label, icon: t.icon, active: selectedId === t.id, onClick: () => setSelectedId(t.id) }))}
        />

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'auto' }}>
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

      </div> {/* end sidebar+content row */}
    </div>
  )
}
