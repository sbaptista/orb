'use client'

import { useState, useEffect } from 'react'

export function SendIcon({ size = 14, strokeWidth = 2.5 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  )
}

export default function TextSearchModal({
  open,
  onClose,
  onApply,
  onClear,
  currentTerm,
  placeholder = 'Search then press',
  ariaLabel = 'Search',
}: {
  open: boolean
  onClose: () => void
  onApply: (term: string) => void
  onClear: () => void
  currentTerm: string
  placeholder?: string
  ariaLabel?: string
}) {
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (open) setDraft(currentTerm)
  }, [open, currentTerm])

  if (!open) return null

  function apply() {
    const term = draft.trim()
    onApply(term)
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
        <form onSubmit={e => { e.preventDefault(); apply() }}>
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
                onChange={e => setDraft(e.target.value)}
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
