'use client'

import React, { useState, useEffect, useRef } from 'react'

type TooltipState = {
  text: string
  visible: boolean
  x: number
  y: number
  placement: 'top' | 'bottom'
}

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    text: '',
    visible: false,
    x: 0,
    y: 0,
    placement: 'top',
  })

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const activeElementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    // Only enable tooltips on devices that support hover
    if (typeof window === 'undefined' || window.matchMedia('(hover: none)').matches) {
      return
    }

    const showTooltip = (target: HTMLElement) => {
      const text = target.getAttribute('data-tooltip')
      if (!text) return

      activeElementRef.current = target

      // Clear any existing timer
      if (timerRef.current) clearTimeout(timerRef.current)

      // 200ms delay to show tooltip
      timerRef.current = setTimeout(() => {
        if (!activeElementRef.current) return

        const rect = activeElementRef.current.getBoundingClientRect()
        
        // Centered horizontally
        const tooltipX = rect.left + rect.width / 2
        
        // Default top placement
        let tooltipY = rect.top - 8
        let placement: 'top' | 'bottom' = 'top'

        // Flip to bottom if clipping top of viewport
        if (rect.top < 32) {
          tooltipY = rect.bottom + 8
          placement = 'bottom'
        }

        setTooltip({
          text,
          visible: true,
          x: tooltipX,
          y: tooltipY,
          placement,
        })
      }, 200)
    }

    const hideTooltip = () => {
      activeElementRef.current = null
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setTooltip(prev => ({ ...prev, visible: false }))
    }

    const handlePointerOver = (e: PointerEvent) => {
      const target = (e.target as HTMLElement).closest('[data-tooltip]') as HTMLElement
      if (!target) return

      // Ignore moves between target element and its children
      const related = e.relatedTarget as HTMLElement
      if (related && related.closest('[data-tooltip]') === target) {
        return
      }

      showTooltip(target)
    }

    const handlePointerOut = (e: PointerEvent) => {
      const target = (e.target as HTMLElement).closest('[data-tooltip]') as HTMLElement
      if (!target) return

      // Ignore moves between target element and its children
      const related = e.relatedTarget as HTMLElement
      if (related && related.closest('[data-tooltip]') === target) {
        return
      }

      if (activeElementRef.current === target) {
        hideTooltip()
      }
    }

    const handleFocusIn = (e: FocusEvent) => {
      const target = (e.target as HTMLElement).closest('[data-tooltip]') as HTMLElement
      if (target) {
        showTooltip(target)
      }
    }

    const handleFocusOut = (e: FocusEvent) => {
      const target = (e.target as HTMLElement).closest('[data-tooltip]') as HTMLElement
      if (target && activeElementRef.current === target) {
        hideTooltip()
      }
    }

    // Clean up if hovered element is unmounted/removed while active
    const observer = new MutationObserver(() => {
      if (activeElementRef.current && !document.body.contains(activeElementRef.current)) {
        hideTooltip()
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    document.addEventListener('pointerover', handlePointerOver)
    document.addEventListener('pointerout', handlePointerOut)
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      observer.disconnect()
      document.removeEventListener('pointerover', handlePointerOver)
      document.removeEventListener('pointerout', handlePointerOut)
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [])

  const tooltipStyle: React.CSSProperties = {
    left: `${tooltip.x}px`,
    top: `${tooltip.y}px`,
    transform: `translate(-50%, ${tooltip.placement === 'bottom' ? '0' : '-100%'}) ${
      tooltip.visible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(2px)'
    }`,
  }

  return (
    <>
      {children}
      <div
        className={`global-tooltip ${tooltip.visible ? 'visible' : ''}`}
        style={tooltipStyle}
        role="tooltip"
      >
        {tooltip.text}
      </div>
    </>
  )
}
