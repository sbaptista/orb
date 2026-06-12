'use client'

import { useState, useEffect, useRef, useCallback, useId } from 'react'

export type SearchItem = {
  id: string
  label: string
  detail?: string
  active?: boolean
}

type Props = {
  items: SearchItem[]
  onSelect: (id: string) => void
  onClose: () => void
  placeholder?: string
  title?: string
  emptyMessage?: string
  errorMessage?: string
}

export default function SearchModal({ items, onSelect, onClose, placeholder = 'Search…', title = 'Search', emptyMessage = 'No results', errorMessage }: Props) {
  const titleId = useId()
  const [query, setQuery] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? items.filter(item => {
        const q = query.trim().toLowerCase()
        return item.label.toLowerCase().includes(q) || item.detail?.toLowerCase().includes(q)
      })
    : items

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => { setHighlightIndex(0) }, [query])

  useEffect(() => {
    const el = listRef.current?.children[highlightIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightIndex])

  const handleSelect = useCallback((id: string) => {
    onSelect(id)
    onClose()
  }, [onSelect, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[highlightIndex]) {
      e.preventDefault()
      handleSelect(filtered[highlightIndex].id)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [filtered, highlightIndex, handleSelect, onClose])

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div
        className="search-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="search-modal-header">
          <span id={titleId} className="search-modal-title">{title}</span>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="search-modal-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-modal-icon">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="search-modal-input"
            placeholder={placeholder}
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label={placeholder}
          />
          {query && (
            <button type="button" className="search-modal-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>

        <div ref={listRef} className="search-modal-list">
          {errorMessage && (
            <div className="search-modal-empty" style={{ color: 'var(--error)' }}>
              {errorMessage}
            </div>
          )}
          {filtered.length === 0 && !errorMessage ? (
            <div className="search-modal-empty">{emptyMessage}</div>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className="search-modal-item"
                data-active={item.active ? '' : undefined}
                data-highlighted={i === highlightIndex ? '' : undefined}
                onClick={() => handleSelect(item.id)}
                onMouseEnter={() => setHighlightIndex(i)}
              >
                <span className="search-modal-item-label">{item.label}</span>
                {item.detail && <span className="search-modal-item-detail">{item.detail}</span>}
              </button>
            ))
          )}
        </div>

        <div className="search-modal-footer">
          <span className="search-modal-hint"><kbd>↑↓</kbd> navigate</span>
          <span className="search-modal-hint"><kbd>↵</kbd> select</span>
          <span className="search-modal-hint"><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
