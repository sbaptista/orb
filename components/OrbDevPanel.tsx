'use client'

import { useState } from 'react'

import type { ConversationMessage } from './OrbConversation'

export type MoodOverride = 'calm' | 'busy' | 'urgent' | null
export type RoleOverride = 'Super Admin' | 'Admin' | 'Owner' | null
export type Speech = { text: string; autoFade?: number } | null

type Props = {
  override: MoodOverride
  onChange: (m: MoodOverride) => void
  roleOverride: RoleOverride
  onRoleOverrideChange: (r: RoleOverride) => void
  onSpeak: (s: Speech) => void
  onSubmit: (text: string) => void
  dryRun: boolean
  onDryRunChange: (v: boolean) => void
  messages: ConversationMessage[]
  onForceQuiet?: () => void
}

const SPEECH_PRESETS: Record<string, Speech> = {
  short: { text: '3 urgent items open' },
  twoLine: { text: '3 urgent items, 2 on Helm.\nThe migration was flagged this morning.' },
  ack: { text: 'Added — TODOS-25', autoFade: 3000 },
  overflow: {
    text: 'Five urgent items across three products.\nHelm has the most pressure: migration plus two compliance flags.\nTODOS has one stuck on auth. Want me to open the list?',
  },
}

function OrbDevPanelInner({ override, onChange, roleOverride, onRoleOverrideChange, onSpeak, onSubmit, dryRun, onDryRunChange, messages, onForceQuiet }: Props) {
  const [open, setOpen] = useState(false)
  const [simulatedOffline, setSimulatedOffline] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('todos_dev_simulate_offline') === 'true'
    }
    return false
  })

  const toggleSimulateOffline = () => {
    const nextVal = !simulatedOffline
    setSimulatedOffline(nextVal)
    if (nextVal) {
      localStorage.setItem('todos_dev_simulate_offline', 'true')
    } else {
      localStorage.removeItem('todos_dev_simulate_offline')
    }
    window.dispatchEvent(new Event('todos-dev-offline-change'))
  }

  const copyTranscript = () => {
    const text = messages.map(m => `${m.type.toUpperCase()}: ${m.text}`).join('\n\n')
    navigator.clipboard.writeText(text).then(() => {
        alert('Transcript copied to clipboard!')
    }).catch(err => {
        alert('Failed to copy: ' + err)
    })
  }

  return (
    <div className="dev-panel">
      <button type="button" onClick={() => setOpen(v => !v)} className="dev-toggle">
        DEV
      </button>

      {open && (
        <div className="dev-menu">
          <div className="dev-section">Orb mood</div>
          <button type="button" className="dev-btn" aria-pressed={override === null} onClick={() => onChange(null)}>
            Auto (from data)
          </button>
          <button type="button" className="dev-btn" aria-pressed={override === 'calm'} onClick={() => onChange('calm')}>
            Calm
          </button>
          <button type="button" className="dev-btn" aria-pressed={override === 'busy'} onClick={() => onChange('busy')}>
            Busy
          </button>
          <button type="button" className="dev-btn" aria-pressed={override === 'urgent'} onClick={() => onChange('urgent')}>
            Urgent
          </button>

          <div className="dev-section">Speak & State</div>
          <button type="button" className="dev-btn" onClick={() => onForceQuiet?.()}>
            Force Quiet State (Ambient)
          </button>
          <button type="button" className="dev-btn" onClick={() => onSpeak(SPEECH_PRESETS.short)}>
            Short
          </button>
          <button type="button" className="dev-btn" onClick={() => onSpeak(SPEECH_PRESETS.twoLine)}>
            Two-line
          </button>
          <button type="button" className="dev-btn" onClick={() => onSpeak(SPEECH_PRESETS.ack)}>
            Ack (auto-fade 3s)
          </button>
          <button type="button" className="dev-btn" onClick={() => onSpeak(SPEECH_PRESETS.overflow)}>
            Overflow (3+ lines)
          </button>
          <button type="button" className="dev-btn" onClick={() => onSpeak(null)}>
            Clear
          </button>

          <div className="dev-section">Test: orb tools</div>
          <button type="button" className="dev-btn" onClick={() => onSubmit('Add a todo titled "DEV test" with description "This is a test description"')}>
            create w/ description
          </button>
          <button type="button" className="dev-btn" onClick={() => onSubmit('Create a todo for product XXXINVALID titled "error test"')}>
            create → bad product
          </button>
          <button type="button" className="dev-btn" onClick={() => onSubmit('Mark TODOS-99999 as done')}>
            update → bad task code
          </button>

          <div className="dev-section">Role simulation</div>
          <button type="button" className="dev-btn" aria-pressed={roleOverride === null} onClick={() => onRoleOverrideChange(null)}>
            Auto (real role)
          </button>
          <button type="button" className="dev-btn" aria-pressed={roleOverride === 'Super Admin'} onClick={() => onRoleOverrideChange('Super Admin')}>
            Super Admin
          </button>
          <button type="button" className="dev-btn" aria-pressed={roleOverride === 'Admin'} onClick={() => onRoleOverrideChange('Admin')}>
            Admin
          </button>
          <button type="button" className="dev-btn" aria-pressed={roleOverride === 'Owner'} onClick={() => onRoleOverrideChange('Owner')}>
            Owner (read-only)
          </button>

          <div className="dev-section">Connectivity</div>
          <button type="button" className="dev-btn" aria-pressed={simulatedOffline} onClick={toggleSimulateOffline}>
            Simulate Offline {simulatedOffline ? '✓' : ''}
          </button>

          <div className="dev-section">Claude API</div>
          <button type="button" className="dev-btn" aria-pressed={dryRun} onClick={() => onDryRunChange(!dryRun)}>
            Dry run {dryRun ? '✓' : ''}
          </button>
          <button type="button" className="dev-btn" onClick={copyTranscript}>
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
