'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import type { ConversationMessage } from './OrbConversation'
import { DEV_PANEL_SLOT_ID } from './dev/GlobalDevPanel'

export class DevTestError extends Error {
  constructor() { super('DEV: Error boundary test'); this.name = 'DevTestError' }
}

export type MoodOverride = 'calm' | 'busy' | 'urgent' | null
export type RoleOverride = 'Super Admin' | 'Admin' | 'Owner' | null
export type Speech = { text: string; autoFade?: number } | null

export type SimulateError = 'billing' | 'overloaded' | null

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
  onErrorTest?: () => void
  simulateError: SimulateError
  onSimulateErrorChange: (v: SimulateError) => void
  realtimeSpikeStatus: string
  realtimeSpikeError?: string | null
  onRealtimeSpikeToggle: () => void
  onRealtimeCopyTrace: () => void
  onRealtimeSimulateError: () => void
}

const SPEECH_PRESETS: Record<string, Speech> = {
  short: { text: '3 urgent items open' },
  twoLine: { text: '3 urgent items, 2 on Helm.\nThe migration was flagged this morning.' },
  ack: { text: 'Added — TODOS-25', autoFade: 3000 },
  overflow: {
    text: 'Five urgent items across three products.\nHelm has the most pressure: migration plus two compliance flags.\nTODOS has one stuck on auth. Want me to open the list?',
  },
}

function OrbDevPanelInner({ override, onChange, roleOverride, onRoleOverrideChange, onSpeak, onSubmit, dryRun, onDryRunChange, messages, onForceQuiet, onErrorTest, simulateError, onSimulateErrorChange, realtimeSpikeStatus, realtimeSpikeError, onRealtimeSpikeToggle, onRealtimeCopyTrace, onRealtimeSimulateError }: Props) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  const copyTranscript = () => {
    const text = messages.map(m => `${m.type.toUpperCase()}: ${m.text}`).join('\n\n')
    navigator.clipboard.writeText(text).then(() => {
        alert('Transcript copied to clipboard!')
    }).catch(err => {
        alert('Failed to copy: ' + err)
    })
  }

  useEffect(() => {
    const findSlot = () => setSlot(document.getElementById(DEV_PANEL_SLOT_ID))
    findSlot()
    const observer = new MutationObserver(findSlot)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  if (!slot) return null

  return createPortal(
    <>
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

          <div className="dev-section">Error boundaries</div>
          <button type="button" className="dev-btn" onClick={() => onErrorTest?.()}>
            Throw client error
          </button>

          <div className="dev-section">Claude API</div>
          <button type="button" className="dev-btn" aria-pressed={dryRun} onClick={() => onDryRunChange(!dryRun)}>
            Dry run {dryRun ? '✓' : ''}
          </button>
          <button type="button" className="dev-btn" onClick={copyTranscript}>
            Copy Transcript ({messages.length})
          </button>

          <div className="dev-section">Realtime voice spike</div>
          <button type="button" className="dev-btn" aria-pressed={realtimeSpikeStatus !== 'off' && realtimeSpikeStatus !== 'error'} onClick={onRealtimeSpikeToggle}>
            {realtimeSpikeStatus === 'off' || realtimeSpikeStatus === 'error' ? 'Start' : 'Stop'} · {realtimeSpikeStatus}
          </button>
          <button type="button" className="dev-btn" onClick={onRealtimeCopyTrace}>
            Copy Realtime trace
          </button>
          <button type="button" className="dev-btn" onClick={onRealtimeSimulateError}>
            Simulate voice error
          </button>
          {realtimeSpikeError && <div className="dev-note">{realtimeSpikeError}</div>}

          <div className="dev-section">Simulate API errors</div>
          <button type="button" className="dev-btn" aria-pressed={simulateError === 'billing'} onClick={() => onSimulateErrorChange(simulateError === 'billing' ? null : 'billing')}>
            Billing / credits {simulateError === 'billing' ? '✓' : ''}
          </button>
          <button type="button" className="dev-btn" aria-pressed={simulateError === 'overloaded'} onClick={() => onSimulateErrorChange(simulateError === 'overloaded' ? null : 'overloaded')}>
            Overloaded {simulateError === 'overloaded' ? '✓' : ''}
          </button>
    </>,
    slot,
  )
}

export function OrbDevPanel(props: Props) {
  if (process.env.NODE_ENV !== 'development') return null
  return <OrbDevPanelInner {...props} />
}
