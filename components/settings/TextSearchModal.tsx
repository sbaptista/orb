'use client'

import { useState } from 'react'
import { useModalScrollLock } from '@/lib/hooks/useModalScrollLock'

type TextSearchMatchMode = 'all' | 'any'

export function SendIcon({ size = 14, strokeWidth = 2.5 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  )
}

type TextSearchModalProps = {
  open: boolean
  onClose: () => void
  onApply: (term: string, matchMode?: TextSearchMatchMode) => void
  onClear: () => void
  currentTerm: string
  currentMatchMode?: TextSearchMatchMode
  placeholder?: string
  ariaLabel?: string
}

export default function TextSearchModal(props: TextSearchModalProps) {
  useModalScrollLock(props.open)
  if (!props.open) return null

  return <TextSearchDialog {...props} />
}

function TextSearchDialog({
  onClose,
  onApply,
  onClear,
  currentTerm,
  currentMatchMode,
  placeholder = 'Search then press',
  ariaLabel = 'Search',
}: TextSearchModalProps) {
  const [draft, setDraft] = useState(currentTerm)
  const [draftMatchMode, setDraftMatchMode] = useState<TextSearchMatchMode>(currentMatchMode ?? 'all')

  function apply() {
    onApply(draft.trim(), currentMatchMode ? draftMatchMode : undefined)
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div
        className="modal-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="text-search-modal-title"
        style={{ maxWidth: '520px' }}
      >
        <form onSubmit={event => { event.preventDefault(); apply() }}>
          <div className="modal-header" style={{ justifyContent: 'space-between' }}>
            <h3 id="text-search-modal-title" style={{ margin: 0, fontSize: 'var(--fs-base)', fontWeight: 'var(--fw-semibold)' }}>
              Search by Text
            </h3>
            <button type="button" className="close-btn" onClick={onClose} aria-label="Close"><svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div className="modal-body" style={{ padding: 'var(--sp-xl)' }}>
            <div className="crud-search-wrap" style={{ width: '100%', flex: 'unset' }}>
              <input
                type="text"
                value={draft}
                onChange={event => setDraft(event.target.value)}
                placeholder=""
                aria-label={ariaLabel}
                className="crud-search-input"
                autoFocus
              />
              {!draft && (
                <span className="crud-search-placeholder" aria-hidden="true">
                  {placeholder}
                  <span className="crud-search-placeholder-icon">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </span>
                  or
                  <span className="crud-search-placeholder-return">⏎</span>
                </span>
              )}
            </div>
            {currentMatchMode && (
              <fieldset style={{ border: 0, padding: 0, margin: 'var(--sp-lg) 0 0' }}>
                <legend className="label" style={{ marginBottom: 'var(--sp-sm)' }}>Match</legend>
                <div className="flex-row" style={{ gap: 'var(--sp-sm)', flexWrap: 'wrap' }}>
                  {([
                    ['all', 'All terms'],
                    ['any', 'Any term'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`pill ${draftMatchMode === value ? 'pill-active' : ''}`}
                      aria-pressed={draftMatchMode === value}
                      onClick={() => setDraftMatchMode(value)}
                      style={{ minHeight: '44px' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p style={{ margin: 'var(--sp-sm) 0 0', color: 'var(--muted)', fontSize: 'var(--fs-sm)', lineHeight: 'var(--lh-normal)' }}>
                  Separate terms with spaces. AND and OR are searched as ordinary words.
                </p>
              </fieldset>
            )}
          </div>
          <div className="modal-footer">
            {currentTerm && <button type="button" className="text-btn" style={{ marginRight: 'auto' }} onClick={onClear}>Clear</button>}
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="oc-action-circle crud-search-submit"
              disabled={!draft.trim()}
              aria-label="Search"
            >
              <SendIcon />
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
