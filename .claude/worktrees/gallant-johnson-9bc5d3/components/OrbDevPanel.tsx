'use client'

import { useState } from 'react'

import type { ConversationMessage } from './OrbConversation'

export type MoodOverride = 'calm' | 'active' | 'urgent' | null
export type Speech = { text: string; autoFade?: number } | null

type Props = {
  override: MoodOverride
  onChange: (m: MoodOverride) => void
  onSpeak: (s: Speech) => void
  onSubmit: (text: string) => void
  dryRun: boolean
  onDryRunChange: (v: boolean) => void
  messages: ConversationMessage[]
}

const SPEECH_PRESETS: Record<string, Speech> = {
  short: { text: '3 urgent items open' },
  twoLine: { text: '3 urgent items, 2 on Helm.\nThe migration was flagged this morning.' },
  ack: { text: 'Added — TODOS-25', autoFade: 3000 },
  overflow: {
    text: 'Five urgent items across three products.\nHelm has the most pressure: migration plus two compliance flags.\nTODOS has one stuck on auth. Want me to open the list?',
  },
}

function OrbDevPanelInner({ override, onChange, onSpeak, onSubmit, dryRun, onDryRunChange, messages }: Props) {
  const [open, setOpen] = useState(false)

  const btnStyle = (active: boolean): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    padding: '6px 10px',
    background: active ? 'var(--pill-active-bg)' : 'var(--bg2)',
    border: `1px solid ${active ? 'var(--pill-active-border)' : 'var(--border2, var(--border))'}`,
    borderRadius: '4px',
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    fontWeight: 600,
    color: active ? 'var(--pill-active-color)' : 'var(--text)',
    cursor: 'pointer',
    textAlign: 'left',
    letterSpacing: '0.04em',
  })

  const copyTranscript = () => {
    const text = messages.map(m => `${m.type.toUpperCase()}: ${m.text}`).join('\n\n')
    navigator.clipboard.writeText(text).then(() => {
        alert('Transcript copied to clipboard!')
    }).catch(err => {
        alert('Failed to copy: ' + err)
    })
  }

  return (
    <div style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 10000 }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'block',
          marginLeft: 'auto',
          padding: '4px 10px',
          background: 'var(--action, var(--pill-active-color))',
          color: 'var(--action-text, #fff)',
          border: 'none',
          borderRadius: '4px',
          fontFamily: 'var(--font-ui)',
          fontSize: '11px',
          fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: '0.05em',
        }}
      >
        DEV
      </button>

      {open && (
        <div style={{
          marginTop: '6px',
          padding: '10px',
          background: 'var(--bg)',
          border: '1px solid var(--border2, var(--border))',
          borderRadius: '6px',
          boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.12))',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          minWidth: '160px',
          maxHeight: '70vh',
          overflowY: 'auto',
        }}>
          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            padding: '0 2px 2px',
          }}>
            Orb mood
          </div>
          <button type="button" style={btnStyle(override === null)} onClick={() => onChange(null)}>
            Auto (from data)
          </button>
          <button type="button" style={btnStyle(override === 'calm')} onClick={() => onChange('calm')}>
            Calm
          </button>
          <button type="button" style={btnStyle(override === 'active')} onClick={() => onChange('active')}>
            Active
          </button>
          <button type="button" style={btnStyle(override === 'urgent')} onClick={() => onChange('urgent')}>
            Urgent
          </button>

          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            padding: '8px 2px 2px',
          }}>
            Speak
          </div>
          <button type="button" style={btnStyle(false)} onClick={() => onSpeak(SPEECH_PRESETS.short)}>
            Short
          </button>
          <button type="button" style={btnStyle(false)} onClick={() => onSpeak(SPEECH_PRESETS.twoLine)}>
            Two-line
          </button>
          <button type="button" style={btnStyle(false)} onClick={() => onSpeak(SPEECH_PRESETS.ack)}>
            Ack (auto-fade 3s)
          </button>
          <button type="button" style={btnStyle(false)} onClick={() => onSpeak(SPEECH_PRESETS.overflow)}>
            Overflow (3+ lines)
          </button>
          <button type="button" style={btnStyle(false)} onClick={() => onSpeak(null)}>
            Clear
          </button>

          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            padding: '8px 2px 2px',
          }}>
            Test: orb tools
          </div>
          <button type="button" style={btnStyle(false)} onClick={() => onSubmit('Add a todo titled "DEV test" with description "This is a test description"')}>
            create w/ description
          </button>
          <button type="button" style={btnStyle(false)} onClick={() => onSubmit('Create a todo for product XXXINVALID titled "error test"')}>
            create → bad product
          </button>
          <button type="button" style={btnStyle(false)} onClick={() => onSubmit('Mark TODOS-99999 as done')}>
            update → bad task code
          </button>

          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            padding: '8px 2px 2px',
          }}>
            Claude API
          </div>
          <button type="button" style={btnStyle(dryRun)} onClick={() => onDryRunChange(!dryRun)}>
            Dry run {dryRun ? '✓' : ''}
          </button>
          <button type="button" style={btnStyle(false)} onClick={copyTranscript}>
            Copy Transcript ({messages.length})
          </button>
        </div>
      )}
    </div>
  )
}

export function OrbDevPanel(props: Props) {
  if (process.env.NODE_ENV !== 'development') return null
  return <OrbDevPanelInner {...props} />
}
