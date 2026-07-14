'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import CollapsibleSidebar from '@/components/CollapsibleSidebar'
import { launchOrbTour } from './OrbTour'

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
            <li className="help-li">&quot;Add a note to review the API docs, high priority&quot;</li>
            <li className="help-li">&quot;Remind me to follow up on the proposal&quot;</li>
            <li className="help-li">&quot;[Project] needs a login page due Friday at 5pm&quot;</li>
          </ul>
        </div>

        <div className="help-section">
          <h2 className="help-h2">Query</h2>
          <ul className="help-ul">
            <li className="help-li">&quot;What&apos;s most urgent right now?&quot;</li>
            <li className="help-li">&quot;Show me all active [project] todos&quot;</li>
            <li className="help-li">&quot;What did I say about the auth work?&quot;</li>
          </ul>
        </div>

        <div className="help-section">
          <h2 className="help-h2">Update</h2>
          <ul className="help-ul">
            <li className="help-li">&quot;Mark [project]-14 as done&quot;</li>
            <li className="help-li">&quot;Set the accessibility task to in progress&quot;</li>
            <li className="help-li">&quot;Move [project]-10 to deferred&quot;</li>
            <li className="help-li">&quot;Set due date for [project]-12 to tomorrow at 3pm&quot;</li>
          </ul>
        </div>

        <div className="help-section">
          <h2 className="help-h2">Delete</h2>
          <ul className="help-ul">
            <li className="help-li">&quot;Delete the invoice todo&quot;</li>
            <li className="help-li">&quot;Delete [project]-14&quot;</li>
          </ul>
        </div>

        <div className="help-section">
          <h2 className="help-h2">
            Archive{' '}
            <span className="text-xs text-muted" style={{ fontWeight: 'var(--fw-normal)', letterSpacing: 'var(--ls-body)' }}>coming soon</span>
          </h2>
          <ul className="help-ul">
            <li className="help-li text-muted">&quot;Archive everything closed in [project]&quot;</li>
            <li className="help-li text-muted">&quot;Archive [project]-8&quot;</li>
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
            <li className="help-li">&quot;How do I use the keyboard?&quot;</li>
            <li className="help-li">&quot;What does URGENT mean?&quot;</li>
            <li className="help-li">&quot;What projects do I have?&quot;</li>
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
            ['⌘ Shift O', 'Toggle voice conversation'],
            ['Shift Return', 'Save and close the current modal'],
            ['?', 'Open this help page'],
            ['Escape', 'Close panel — prompts to save if you have unsaved changes'],
          ] as [string, string][]).map(([key, desc]) => (
            <div key={key} className="help-key-row">
              <span className="help-key-cell">{key}</span>
              <span className="help-desc-cell">{desc}</span>
            </div>
          ))}
        </div>

        <p className="help-p text-sm text-muted" style={{ marginTop: '20px' }}>
          You can also ask Orb: &quot;How do I use the keyboard?&quot; and it will explain.
        </p>
      </div>
    ),
  },
  {
    id: 'passkeys',
    label: 'Passkeys',
    icon: '🔑',
    content: (
      <div>
        <p className="help-p">
          Passkeys are a simpler and safer way to sign in without using passwords. Instead of typing a password, you unlock your phone or computer with Face ID, a fingerprint, or a PIN, and your device proves to the website that it&apos;s really you.
        </p>
        <p className="help-p">
          The website never gets your secret sign-in key, which makes passkeys harder to steal, fake, or use in a phishing attack.
        </p>

        <div className="help-section">
          <h2 className="help-h2">How they work in Orb</h2>
          <ul className="help-ul">
            <li className="help-li">Each device needs its own passkey — register one on your Mac, iPad, and iPhone separately.</li>
            <li className="help-li">After signing in with a verification code, you&apos;ll be prompted to register a passkey automatically.</li>
            <li className="help-li">On future visits, sign-in is instant — just approve the biometric prompt.</li>
          </ul>
        </div>

        <div className="help-section">
          <h2 className="help-h2">Managing passkeys</h2>
          <ul className="help-ul">
            <li className="help-li">View, rename, and delete your passkeys from the <strong>Account</strong> page.</li>
            <li className="help-li">If you delete a passkey, you&apos;ll be signed out and guided through re-registration.</li>
            <li className="help-li">If you change your email address, your passkeys are removed automatically and you&apos;ll register new ones.</li>
          </ul>
        </div>

        <div className="help-section">
          <h2 className="help-h2">Troubleshooting</h2>
          <ul className="help-ul">
            <li className="help-li">If your browser shows an old passkey in the sign-in picker after deletion, ignore it — it no longer works. You can remove it from your device&apos;s Passwords settings.</li>
            <li className="help-li">Passkeys require Safari 16+, Chrome 108+, or Edge 108+.</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'voice',
    label: 'Voice',
    icon: '🎙',
    content: (
      <div>
        <p className="help-p">Talk to the Orb out loud. Everything you can type, you can say.</p>

        <div className="help-section">
          <h2 className="help-h2">Starting a voice conversation</h2>
          <ul className="help-ul">
            <li className="help-li"><strong>Tap the Orb</strong> — the mic activates and the Orb shifts to a listening state.</li>
            <li className="help-li"><strong>More menu → Talk to Orb</strong> — same thing, from the input toolbar.</li>
            <li className="help-li"><strong>⌘ Shift O</strong> — keyboard shortcut (when the text field is not focused).</li>
          </ul>
          <p className="help-p text-sm text-muted">
            The <strong>Dictate</strong> toolbar button is different: it only inserts spoken words into the text field.
          </p>
        </div>

        <div className="help-section">
          <h2 className="help-h2">How it flows</h2>
          <p className="help-p">
            Once voice mode is active, conversation flows naturally. Speak, pause, and the Orb responds — no buttons needed between turns. The mic re-activates automatically after the Orb finishes speaking.
          </p>
        </div>

        <div className="help-section">
          <h2 className="help-h2">Voice controls</h2>
          <p className="help-p">A voice bar replaces the text input with three buttons:</p>
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <div className="help-key-row">
              <span className="help-key-cell" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--btn-primary-bg)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                Continue
              </span>
              <span className="help-desc-cell">Resume listening after you&apos;ve interrupted the Orb</span>
            </div>
            <div className="help-key-row">
              <span className="help-key-cell" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#c00', borderRadius: '1.5px', flexShrink: 0 }} />
                Stop
              </span>
              <span className="help-desc-cell">Interrupt the Orb while it&apos;s speaking</span>
            </div>
            <div className="help-key-row">
              <span className="help-key-cell" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                End
              </span>
              <span className="help-desc-cell">Exit voice mode and return to text input</span>
            </div>
          </div>
        </div>

        <div className="help-section">
          <h2 className="help-h2">Voice settings</h2>
          <p className="help-p">
            Choose the Orb&apos;s voice and speaking rate in <strong>Settings → Voice</strong>. You can also ask the Orb conversationally: <em>&quot;What voices do you have?&quot;</em> or <em>&quot;Switch to Daniel.&quot;</em>
          </p>
        </div>

        <div className="help-section">
          <h2 className="help-h2">Ending a conversation</h2>
          <ul className="help-ul">
            <li className="help-li">Tap the <strong>End</strong> button in the voice bar.</li>
            <li className="help-li">Press <strong>⌘ Shift O</strong> again.</li>
            <li className="help-li">Say something like <em>&quot;That&apos;s enough&quot;</em> or <em>&quot;Let&apos;s stop&quot;</em> — the Orb understands exit phrases.</li>
          </ul>
        </div>

        <p className="help-p text-sm text-muted" style={{ marginTop: '20px', marginBottom: 0 }}>
          Orb supports Safari, Chrome, and Edge. Voice uses native browser speech recognition where available. Firefox support is temporarily experimental while a multi-turn microphone reliability issue is investigated. If microphone access is blocked, the voice panel shows browser-specific steps to allow it and reload Orb. Voice quality may still vary by browser, device, microphone, and selected voice.
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
                <span className="help-key-cell" style={{ fontFamily: 'var(--font-ui)', letterSpacing: 'var(--ls-caps)' }}>{state}</span>
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
                <span className="help-key-cell" style={{ fontFamily: 'var(--font-ui)', letterSpacing: 'var(--ls-caps)' }}>{group}</span>
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
    id: 'testing',
    label: 'Alpha Testing',
    icon: '🧪',
    content: (
      <div>
        <p className="help-p">
          Thank you for participating in the Orb alpha! Your feedback helps us shape the strategic features and usability of the app.
        </p>

        <div className="help-section">
          <h2 className="help-h2">Testing Goals</h2>
          <p className="help-p">
            During this phase, we are specifically focused on validating two core value propositions:
          </p>
          <ul className="help-ul">
            <li className="help-li"><strong>Ambient Workload Reflection:</strong> Does the glowing Orb&rsquo;s visual presence (colors, speed, pulse) successfully keep you aware of workload pressure without you having to micromanage list views?</li>
            <li className="help-li"><strong>Strategic AI Assistance:</strong> Does talking to the Orb for planning (asking what to do next, parsing complex task entries) provide more value than standard checkboxes?</li>
          </ul>
        </div>

        <div className="help-section">
          <h2 className="help-h2">Things to Try</h2>
          <ul className="help-ul">
            <li className="help-li">Create a project and add tasks with different priorities to observe how the Orb&rsquo;s color and status change as you complete or update them.</li>
            <li className="help-li">Ask Orb: <em>&quot;What should I do next?&quot;</em> or <em>&quot;Why is the Orb urgent?&quot;</em> to test strategic reasoning on your own project&apos;s tasks.</li>
            <li className="help-li">Switch a project to <strong>Kanban view</strong> and try drag-and-drop on mobile touch screens or desktop trackpads.</li>
          </ul>
        </div>

        <div className="help-section">
          <h2 className="help-h2">Report Bugs &amp; Suggestions</h2>
          <p className="help-p">
            You don&apos;t need a bug tracker form. Just tell the Orb during conversation:
          </p>
          <ul className="help-ul">
            <li className="help-li"><em>&quot;Report a bug: Kanban board does not slide on iOS Safari&quot;</em></li>
            <li className="help-li"><em>&quot;Suggestion: Add custom color options for projects&quot;</em></li>
          </ul>
          <p className="help-p text-sm text-muted" style={{ marginTop: '8px' }}>
            The Orb will silently log these as tickets directly for the developer.
          </p>
        </div>

        <div className="help-section" style={{ borderLeft: '3px solid var(--accent)', paddingLeft: '10px' }}>
          <h2 className="help-h2">Privacy &amp; Observability</h2>
          <p className="help-p text-sm">
            To optimize the AI&apos;s prompts and debug issues, **task names and conversation logs are visible to the developer (Stan)**. Please do not input highly sensitive, confidential, or personal information during the alpha phase.
          </p>
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
          The orb is also conversational. Type plain English and it handles the rest — create a todo, ask what&apos;s most pressing, update a priority, mark something done. You don&apos;t navigate menus or fill out forms. You just talk to it.
        </p>
        <p className="help-p" style={{ marginBottom: 0 }}>
          Under the hood, the orb is powered by AI. It understands context and intent, not just keywords. &quot;What&apos;s the most important thing right now?&quot; reasons over your full backlog across all projects to answer.
        </p>
      </div>
    ),
  },
]

export default function OrbHelp() {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState('ask')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const matches = window.matchMedia('(hover: none) and (pointer: coarse)').matches
    Promise.resolve().then(() => setIsMobile(matches))
  }, [])

  const selected = TOPICS.find(t => t.id === selectedId)

  return (
    <div className="help-page">
      <div className="panel-topbar" style={{ position: 'relative' }}>
        <span className="panel-title">Help</span>
        <button
          onClick={() => { router.push('/dashboard'); setTimeout(() => launchOrbTour(), 200) }}
          className="help-tour-btn"
          aria-label="Take the guided tour"
          style={{ marginLeft: 'auto' }}
        >
          Take the tour
        </button>
      </div>

      <div className="panel-body" style={{ flexDirection: isMobile ? 'column' : 'row', marginTop: 0 }}>

        {isMobile ? (
          <nav className="help-mobile-nav">
            {TOPICS.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                aria-current={selectedId === t.id ? 'page' : undefined}
                className="help-mobile-pill"
              >
                <span style={{ fontSize: 'var(--fs-sm)', opacity: 'var(--opacity-muted)' as any }}>{t.icon}</span>
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

      </div>
    </div>
  )
}
