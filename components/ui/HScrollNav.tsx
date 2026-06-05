'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

interface HScrollNavProps {
  children: React.ReactNode
  /** Extra CSS class on the outer cs-nav-wrap. Use for per-callsite theming. */
  className?: string
  /** Pixels scrolled per arrow tap. Default: 120. */
  scrollStep?: number
  /**
   * Provide this when the parent holds a ref directly on the scrollable child element.
   * HScrollNav will use this ref for scroll detection and arrow visibility.
   * The children are rendered as-is (the parent is responsible for attaching the ref).
   *
   * Omit this to let HScrollNav create its own internal scrollable wrapper div
   * and manage the ref itself.
   */
  scrollRef?: React.RefObject<HTMLElement>
}

export default function HScrollNav({
  children,
  className,
  scrollStep = 120,
  scrollRef,
}: HScrollNavProps) {
  const internalRef = useRef<HTMLDivElement>(null)

  // When scrollRef is provided, use it. Otherwise use our internal div ref.
  const activeRef = (scrollRef ?? internalRef) as React.RefObject<HTMLElement>

  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    const el = activeRef.current
    if (!el) return

    const checkScroll = () => {
      setCanScrollLeft(el.scrollLeft > 2)
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
    }

    checkScroll()
    el.addEventListener('scroll', checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      ro.disconnect()
    }
  }, [activeRef])

  const scroll = (dir: -1 | 1) => {
    activeRef.current?.scrollBy({ left: dir * scrollStep, behavior: 'smooth' })
  }

  return (
    <div
      className={`cs-nav-wrap${className ? ` ${className}` : ''}`}
      data-scroll-left={canScrollLeft || undefined}
      data-scroll-right={canScrollRight || undefined}
    >
      {canScrollLeft && (
        <button
          className="cs-scroll-arrow cs-scroll-arrow-left"
          onClick={() => scroll(-1)}
          aria-label="Scroll left"
        >
          ‹
        </button>
      )}

      {scrollRef ? (
        // External ref mode: parent owns the scrollable element; render children as-is.
        children
      ) : (
        // Internal ref mode: we create the scrollable container.
        <div
          ref={internalRef}
          style={{
            flex: 1,
            display: 'flex',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          {children}
        </div>
      )}

      {canScrollRight && (
        <button
          className="cs-scroll-arrow cs-scroll-arrow-right"
          onClick={() => scroll(1)}
          aria-label="Scroll right"
        >
          ›
        </button>
      )}
    </div>
  )
}
