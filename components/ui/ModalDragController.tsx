'use client'

import { useEffect } from 'react'

const VIEWPORT_MARGIN = 8
const INTERACTIVE_SELECTOR = 'button, a, input, textarea, select, [role="button"], [contenteditable="true"]'

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

/** Adds viewport-clamped pointer dragging to the shared centered modal families. */
export default function ModalDragController() {
  useEffect(() => {
    let modal: HTMLElement | null = null
    let pointerId: number | null = null
    let offsetX = 0
    let offsetY = 0

    function moveTo(clientX: number, clientY: number) {
      if (!modal) return
      const rect = modal.getBoundingClientRect()
      const left = clamp(clientX - offsetX, VIEWPORT_MARGIN, window.innerWidth - rect.width - VIEWPORT_MARGIN)
      const top = clamp(clientY - offsetY, VIEWPORT_MARGIN, window.innerHeight - rect.height - VIEWPORT_MARGIN)
      modal.style.left = `${left}px`
      modal.style.top = `${top}px`
      modal.style.transform = 'none'
    }

    function finishDrag() {
      if (!modal) return
      modal.classList.remove('modal--dragging')
      modal = null
      pointerId = null
    }

    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0 || !event.isPrimary) return
      const target = event.target instanceof Element ? event.target : null
      const header = target?.closest<HTMLElement>('.modal-header, .search-modal-header')
      const candidate = header?.closest<HTMLElement>('.modal-center, .search-modal')
      if (!header || !candidate || target?.closest(INTERACTIVE_SELECTOR)) return

      const rect = candidate.getBoundingClientRect()
      modal = candidate
      pointerId = event.pointerId
      offsetX = event.clientX - rect.left
      offsetY = event.clientY - rect.top
      candidate.style.left = `${rect.left}px`
      candidate.style.top = `${rect.top}px`
      candidate.style.position = 'fixed'
      candidate.style.transform = 'none'
      candidate.classList.add('modal--dragging')
      header.setPointerCapture?.(event.pointerId)
      event.preventDefault()
    }

    function onPointerMove(event: PointerEvent) {
      if (!modal || event.pointerId !== pointerId) return
      moveTo(event.clientX, event.clientY)
      event.preventDefault()
    }

    function onPointerUp(event: PointerEvent) {
      if (event.pointerId === pointerId) finishDrag()
    }

    function onResize() {
      if (!modal) return
      const rect = modal.getBoundingClientRect()
      moveTo(rect.left + offsetX, rect.top + offsetY)
    }

    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return null
}
