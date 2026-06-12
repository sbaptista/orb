'use client'

import { useCallback, useRef, useState } from 'react'

type Props = {
  direction: 'horizontal' | 'vertical'
  onResize: (delta: number) => void
  onResizeEnd: () => void
}

export default function DragDivider({ direction, onResize, onResizeEnd }: Props) {
  const startPos = useRef(0)
  const pointerId = useRef<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    pointerId.current = e.pointerId
    setIsDragging(true)
    startPos.current = direction === 'vertical' ? e.clientY : e.clientX
  }, [direction])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (pointerId.current === null) return
    const current = direction === 'vertical' ? e.clientY : e.clientX
    const delta = current - startPos.current
    startPos.current = current
    onResize(delta)
  }, [direction, onResize])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (pointerId.current === null) return
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(pointerId.current)
    } catch {
      // Pointer capture may already be released by the browser.
    }
    pointerId.current = null
    setIsDragging(false)
    onResizeEnd()
  }, [onResizeEnd])

  return (
    <div
      className={`ud-divider ${direction === 'vertical' ? 'ud-divider--vertical' : 'ud-divider--horizontal'}`}
      role="separator"
      aria-orientation={direction === 'vertical' ? 'horizontal' : 'vertical'}
      aria-label="Resize Orb and List panes"
      data-dragging={isDragging ? 'true' : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="ud-divider-handle" />
    </div>
  )
}
