'use client'

import { useState, useEffect } from 'react'
import CollapsibleSidebar from '@/components/CollapsibleSidebar'

type Topic = {
  id: string
  label: string
  icon: string
  content: React.ReactNode
}

const TOPICS: Topic[] = [
  {
    id: 'ask',
    label: 'What can I do?',
    icon: '◎',
    content: (
      <div>
        <p className="help-p">Type plain English. The orb handles the rest.</p>

        <div className="help-section">
          <h2 className="help-h2">Create</h2>
          <ul className="help-ul">
            <li className="help-li">"Add a note to review the API docs, high priority"</li>
            <li className="help-li">"Remind me to follow up on the proposal"</li>
            <li className="help-li">"[Project] needs a login page due Friday at 5pm"</li>
          </ul>
        </div>

        <div className="help-section">
          <h2 className="help-h2">Query</h2>
          <ul className="help-ul">
            <li className="help-li">"What's most urgent right now?"</li>
            <li className="help-li">"Show me all active [project] todos"</li>
            <li className="help-li">"What did I say about the auth work?"</li>
          </ul>
        </div>

        <div className="help-section">
          <h2 className="help-h2">Update</h2>
          <ul className="help-ul">
            <li className="help-li">"Mark [project]-14 as done"</li>
            <li className="help-li">"Set the accessibility task to in progress"</li>
            <li className="help-li">"Move [project]-10 to deferred"</li>
            <li className="help-li">"Set due date for [project]-12 to tomorrow at 3pm"</li>
          </ul>
        </div>

        <div className="help-section">
          <h2 className="help-h2">Delete</h2>
          <ul className="help-ul">
            <li className="help-li">"Delete the invoice todo"</li>
            <li className="help-li">"Delete [project]-14"</li>
          </ul>
        </div>

        <div className="help-section">
          <h2 className="help-h2">
            Archive{' '}
            <span className="text-xs text-muted" style={{ fontWeight: 400, letterSpacing: '0.04em' }}>coming soon</span>
          </h2>
          <ul className="help-ul">
            <li className="help-li text-muted">"Archive everything closed in [project]"</li>
            <li className="help-li text-muted">"Archive [project]-8"</li>
          </ul>
        </div>

        <div className="help-section">
          <h2 className="help-h2">List &amp; Checklist</h2>
          <p className="help-p">Tap or click the orb to open the full todo list for the selected project.</p>
          <p className="help-p" style={{ margin: 0 }}>
            Each project can also be switched to <strong>Checklist mode</strong> using the
            {' '}<span className="help-mono">☑</span> button in the toolbar. Checklist mode shows
            all items in a minimal checkbox layout — tap the circle to complete or reopen, tap the
            title to open the detail panel. The mode is saved per project and persists across sessions.
          </p>
        </div>

        <div className="help-section">
          <h2 className="help-h2">Slash commands</h2>
          <ul className="help-ul">
            <li className="help-li"><span className="help-mono">/add [task]</span> — create a todo</li>
            <li className="help-li"><span className="help-mono">/close [task]</span> — mark a todo as done</li>
            <li className="help-li"><span className="help-mono">/create [name]</span> — create a project</li>
            <li className="help-li"><span className="help-mono">/drop [project]</span> — delete a project</li>
            <li className="help-li"><span className="help-mono">/edit [project]</span> — edit a project</li>
            <li className="help-li"><span className="help-mono">/switch [project]</span> — switch projects</li>
            <li className="help-li"><span className="help-mono">/clear</span> — clear the conversation</li>
            <li className="help-li"><span className="help-mono">/settings</span> — open settings</li>
          </ul>
          <p className="help-p text-sm text-muted" style={{ marginTop: '10px', marginBottom: 0 }}>
            Type <span className="help-mono">/</span> in the input field to see all available commands.
          </p>
        </div>


        <div className="help-section">
          <h2 className="help-h2">Ask anything</h2>
          <ul className="help-ul">
            <li className="help-li">"How do I use the keyboard?"</li>
            <li className="help-li">"What does URGENT mean?"</li>
            <li className="help-li">"What projects do I have?"</li>
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
        <p className="help-p">Full keyboard navigation is supported throughout the app.</p>

        <div style={{ borderTop: '1px solid var(--border)' }}>
          {([
            ['Tab', 'Move between interactive elements'],
            ['Enter / Space', 'Activate the focused element'],
            ['← / →', 'Switch between projects on the orb screen'],
            ['?', 'Open this help page'],
            ['Escape', 'Close any open panel or overlay'],
          ] as [string, string][]).map(([key, desc]) => (
            <div key={key} className="help-key-row">
              <span className="help-key-cell">{key}</span>
              <span className="help-desc-cell">{desc}</span>
            </div>
          ))}
        </div>

        <p className="help-p text-sm text-muted" style={{ marginTop: '20px' }}>
          You can also ask the orb: "How do I use the keyboard?" and it will explain.
        </p>
      </div>
    ),
  },
  {
    id: 'orb',
    label: 'The Orb',
    icon: '●',
    content: (
      <div>
        <p className="help-p">The orb reflects your current workload for the selected project.</p>

        <div className="help-section">
          <h2 className="help-h2">States</h2>
          <div style={{ borderTop: '1px solid var(--border)' }}>
            {([
              ['CALM', 'All active items are low priority or the backlog is light'],
              ['BUSY', 'More than 5 active items (Open + In Progress)'],
              ['URGENT', 'One or more P1 (urgent priority) items are active'],
            ] as [string, string][]).map(([state, desc]) => (
              <div key={state} className="help-key-row">
                <span className="help-key-cell" style={{ fontFamily: 'var(--font-ui)', letterSpacing: '0.06em' }}>{state}</span>
                <span className="help-desc-cell">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="help-section">
          <h2 className="help-h2">Counting</h2>
          <div style={{ borderTop: '1px solid var(--border)' }}>
            {([
              ['ACTIVE', 'Open + In Progress — the number on the orb and the default view'],
              ['PARKED', 'Deferred + On Hold — tracked but not counted as active'],
              ['CLOSED', 'Done — hidden by default'],
            ] as [string, string][]).map(([group, desc]) => (
              <div key={group} className="help-key-row">
                <span className="help-key-cell" style={{ fontFamily: 'var(--font-ui)', letterSpacing: '0.06em' }}>{group}</span>
                <span className="help-desc-cell">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="help-section">
          <h2 className="help-h2">Signals</h2>
          <p className="help-p">
            State is communicated through multiple signals simultaneously — color, glow size, animation speed, and solar flares in urgent mode. Any one signal can be removed (or disabled via <span className="help-mono">prefers-reduced-motion</span>) without losing the information.
          </p>
        </div>

        <div className="help-section">
          <h2 className="help-h2">Navigation</h2>
          <ul className="help-ul">
            <li className="help-li">The number in the center is your active todo count for the selected project.</li>
            <li className="help-li">Tap or click the orb to open the full todo list.</li>
            <li className="help-li">The project pills at the bottom switch which backlog you are viewing.</li>
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
        <p className="help-p">
          Orb is a personal project issue tracker built around a single idea: your work should have a presence, not just a list.
        </p>
        <p className="help-p">
          Most todo apps put you in charge of the list. Orb puts the orb in charge of your attention. The orb reads your active work across all your projects and reflects it back — calm when things are light, busy when the backlog builds, urgent when something needs your attention now. Color, motion, glow, and animation all carry the same signal independently, so nothing gets lost.
        </p>
        <p className="help-p">
          The orb is also conversational. Type plain English and it handles the rest — create a todo, ask what's most pressing, update a priority, mark something done. You don't navigate menus or fill out forms. You just talk to it.
        </p>
        <p className="help-p" style={{ marginBottom: 0 }}>
          Under the hood, the orb is powered by AI. It understands context and intent, not just keywords. "What's the most important thing right now?" reasons over your full backlog across all projects to answer.
        </p>
      </div>
    ),
  },
]

export default function OrbHelp({ onClose }: { onClose: () => void }) {
  const [selectedId, setSelectedId] = useState('ask')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(window.matchMedia('(hover: none) and (pointer: coarse)').matches)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const selected = TOPICS.find(t => t.id === selectedId)

  return (
    <div role="dialog" aria-modal="true" aria-label="Help" className="panel-overlay">
      {/* Full-width top bar */}
      <div className="panel-topbar">
        <button onClick={onClose} autoFocus className="panel-back" aria-label="Close help">
          ← back
        </button>
        <span className="panel-title">Help</span>
      </div>

      {/* Sidebar + content below the top bar */}
      <div className="panel-body" style={{ flexDirection: isMobile ? 'column' : 'row' }}>

        {isMobile ? (
          <nav className="help-mobile-nav">
            {TOPICS.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                aria-current={selectedId === t.id ? 'page' : undefined}
                className="help-mobile-pill"
              >
                <span style={{ fontSize: '13px', opacity: 0.7 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>
        ) : (
          <CollapsibleSidebar
            items={TOPICS.map(t => ({ id: t.id, label: t.label, icon: t.icon, active: selectedId === t.id, onClick: () => setSelectedId(t.id) }))}
          />
        )}

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {selected && (
          <div style={{ padding: isMobile ? 'var(--sp-xl) var(--sp-lg)' : 'var(--sp-3xl) var(--sp-2xl)', maxWidth: '620px' }}>
            <h1 className="help-h1">{selected.label}</h1>
            {selected.content}
          </div>
        )}
      </div>

      </div> {/* end sidebar+content row */}
    </div>
  )
}
