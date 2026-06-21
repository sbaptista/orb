'use client'

import { useState, useEffect, useId, useSyncExternalStore } from 'react'
import { SendIcon } from './TextSearchModal'
import { useModalScrollLock } from '@/lib/hooks/useModalScrollLock'

export type CreatedFilter = {
  label: string
  label2?: string
  from: string | null
  to: string | null
  before: string | null
}

export function shortDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const y = String(d.getFullYear()).slice(-2)
  return `${m}/${day}/${y}`
}

export function shortDateTime(d: Date): string {
  return `${shortDate(d)} ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

function subscribeToTimeZone() {
  return () => {}
}
function getBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export default function DateSearchModal({
  open,
  onClose,
  onApply,
  onClear,
  currentFilter,
}: {
  open: boolean
  onClose: () => void
  onApply: (filter: CreatedFilter) => void
  onClear: () => void
  currentFilter: CreatedFilter | null
}) {
  useModalScrollLock(open)
  const [mode, setMode] = useState<'on' | 'before' | 'after' | 'between'>('on')
  const [dateValue, setDateValue] = useState('')
  const [fromDraft, setFromDraft] = useState('')
  const [toDraft, setToDraft] = useState('')
  const timeZone = useSyncExternalStore(subscribeToTimeZone, getBrowserTimeZone, () => 'UTC')

  const modeId = useId()
  const dateId = useId()
  const fromId = useId()
  const toId = useId()

  useEffect(() => {
    if (open) {
      setMode('on')
      setDateValue('')
      setFromDraft('')
      setToDraft('')
    }
  }, [open])

  if (!open) return null

  const canApply = mode === 'on'
    ? !!dateValue
    : mode === 'before'
      ? !!toDraft
      : mode === 'after'
        ? !!fromDraft
        : !!fromDraft && !!toDraft && new Date(fromDraft) <= new Date(toDraft)

  function apply() {
    if (mode === 'on') {
      if (!dateValue) return
      const start = new Date(`${dateValue}T00:00:00`)
      const end = new Date(start)
      end.setDate(end.getDate() + 1)
      onApply({
        label: shortDate(start),
        from: start.toISOString(),
        to: null,
        before: end.toISOString(),
      })
    } else if (mode === 'before') {
      if (!toDraft) return
      const end = new Date(toDraft)
      onApply({
        label: `≤ ${shortDate(end)}`,
        from: null,
        to: end.toISOString(),
        before: null,
      })
    } else if (mode === 'after') {
      if (!fromDraft) return
      const start = new Date(fromDraft)
      onApply({
        label: `≥ ${shortDate(start)}`,
        from: start.toISOString(),
        to: null,
        before: null,
      })
    } else {
      if (!fromDraft || !toDraft) return
      const start = new Date(fromDraft)
      const end = new Date(toDraft)
      if (start > end) return
      onApply({
        label: shortDate(start),
        label2: shortDate(end),
        from: start.toISOString(),
        to: end.toISOString(),
        before: null,
      })
    }
    onClose()
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div
        className="modal-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="date-search-modal-title"
        style={{ maxWidth: '520px' }}
      >
        <form onSubmit={e => { e.preventDefault(); apply() }}>
          <div className="modal-header" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 id="date-search-modal-title" style={{ margin: 0, fontSize: 'var(--fs-base)', fontWeight: 'var(--fw-semibold)' }}>
                Search by Date
              </h3>
              <p className="text-xs text-muted" style={{ margin: '2px 0 0' }}>
                All times local ({timeZone || 'your browser timezone'}).
              </p>
            </div>
            <button type="button" className="close-btn" onClick={onClose} aria-label="Close"><svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div className="modal-body" style={{ padding: 'var(--sp-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
            <div className="pf-field">
              <label htmlFor={modeId} className="pf-label">Condition</label>
              <select
                id={modeId}
                className="pf-select"
                value={mode}
                onChange={e => setMode(e.target.value as typeof mode)}
              >
                <option value="on">On date</option>
                <option value="before">At or before date and time</option>
                <option value="after">At or after date and time</option>
                <option value="between">Between dates and times</option>
              </select>
            </div>

            {mode === 'on' ? (
              <div className="pf-field">
                <label htmlFor={dateId} className="pf-label">Date</label>
                <input id={dateId} type="date" className="pf-input" value={dateValue} onChange={e => setDateValue(e.target.value)} />
              </div>
            ) : (
              <>
                {(mode === 'after' || mode === 'between') && (
                  <div className="pf-field">
                    <label htmlFor={fromId} className="pf-label">{mode === 'between' ? 'From' : 'Date and time'}</label>
                    <input id={fromId} type="datetime-local" className="pf-input" value={fromDraft} onChange={e => setFromDraft(e.target.value)} />
                  </div>
                )}
                {(mode === 'before' || mode === 'between') && (
                  <div className="pf-field">
                    <label htmlFor={toId} className="pf-label">{mode === 'between' ? 'To' : 'Date and time'}</label>
                    <input id={toId} type="datetime-local" className="pf-input" value={toDraft} onChange={e => setToDraft(e.target.value)} />
                  </div>
                )}
              </>
            )}
          </div>
          <div className="modal-footer">
            {currentFilter && <button type="button" className="text-btn" style={{ marginRight: 'auto' }} onClick={onClear}>Clear</button>}
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="oc-action-circle crud-search-submit"
              disabled={!canApply}
              aria-label="Apply date filter"
            >
              <SendIcon />
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
