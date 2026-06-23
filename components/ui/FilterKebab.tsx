'use client'

import { useState, useRef, useEffect, type KeyboardEvent as ReactKeyboardEvent } from 'react'

type Option = { value: string; label: string }

type Props = {
  value: string
  options: Option[]
  onChange: (value: string) => void
  ariaLabel?: string
  /** Override the trigger label. Useful for "More…" style kebabs that show extra options. */
  triggerLabel?: string
  /** Tooltip shown on hover over the trigger button. */
  tooltip?: string
}

export default function FilterKebab({ value, options, onChange, ariaLabel, triggerLabel, tooltip }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const current = options.find(o => o.value === value)
  const selectedIndex = Math.max(0, options.findIndex(o => o.value === value))

  function focusItem(index: number) {
    itemRefs.current[index]?.focus()
  }

  function openAndFocus(index = selectedIndex) {
    setOpen(true)
    requestAnimationFrame(() => focusItem(index))
  }

  function handleTriggerKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openAndFocus(selectedIndex)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      openAndFocus(options.length - 1)
    }
  }

  function handleMenuKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const activeIndex = itemRefs.current.findIndex(item => item === document.activeElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>('.filter-kebab-trigger')?.focus())
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusItem((activeIndex + 1) % options.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusItem((activeIndex - 1 + options.length) % options.length)
    } else if (e.key === 'Home') {
      e.preventDefault()
      focusItem(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      focusItem(options.length - 1)
    }
  }

  return (
    <div className="filter-kebab" ref={ref}>
      <button
        className="filter-kebab-trigger"
        onClick={() => setOpen(o => !o)}
        onKeyDown={handleTriggerKeyDown}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        title={tooltip}
        data-tooltip={tooltip}
      >
        <span className="filter-kebab-label">{triggerLabel ?? current?.label ?? value}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="filter-kebab-menu" role="menu" aria-label={ariaLabel} onKeyDown={handleMenuKeyDown}>
          {options.map(o => (
            <button
              key={o.value}
              ref={el => {
                itemRefs.current[options.findIndex(item => item.value === o.value)] = el
              }}
              className={`filter-kebab-item${o.value === value ? ' filter-kebab-item--active' : ''}`}
              role="menuitemradio"
              aria-checked={o.value === value}
              onClick={() => { onChange(o.value); setOpen(false) }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
