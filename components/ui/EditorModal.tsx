'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useModalScrollLock } from '@/lib/hooks/useModalScrollLock'

type EditorModalProps = {
  title: string
  titleId: string
  children: ReactNode
  className?: string
  isDirty: boolean
  isSaving?: boolean
  saveLabel?: string
  saveDisabled?: boolean
  onSave: (closeAfterSave: boolean) => Promise<boolean> | boolean
  onClose: () => void
  headerStart?: ReactNode
  footerStart?: ReactNode
  destructiveConfirmation?: {
    description: ReactNode
    onCancel: () => void
    onConfirm: () => void
    confirming?: boolean
  }
  lockSettingsScroll?: boolean
}

/** Canonical behavioral shell for editor-style centered modals. */
export default function EditorModal({
  title,
  titleId,
  children,
  className = '',
  isDirty,
  isSaving = false,
  saveLabel = 'Save',
  saveDisabled = false,
  onSave,
  onClose,
  headerStart,
  footerStart,
  destructiveConfirmation,
  lockSettingsScroll = false,
}: EditorModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const promptRef = useRef<HTMLDivElement>(null)
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const busy = isSaving || submitting

  useModalScrollLock(lockSettingsScroll)

  const requestClose = useCallback(() => {
    if (busy) return
    if (isDirty) {
      setShowDiscardPrompt(true)
      return
    }
    onClose()
  }, [busy, isDirty, onClose])

  const save = useCallback(async (closeAfterSave: boolean) => {
    if (busy || !isDirty || saveDisabled) return false
    setSubmitting(true)
    try {
      const saved = await onSave(closeAfterSave)
      if (saved && closeAfterSave) setShowDiscardPrompt(false)
      return saved
    } finally {
      setSubmitting(false)
    }
  }, [busy, isDirty, onSave, saveDisabled])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const preferred = dialog.querySelector<HTMLElement>('[autofocus], input:not([type="hidden"]), textarea, select')
      ?? dialog.querySelector<HTMLElement>('button')
    ;(preferred ?? dialog).focus()
  }, [])

  useEffect(() => {
    if (!showDiscardPrompt) return
    promptRef.current?.querySelector<HTMLElement>('button')?.focus()
  }, [showDiscardPrompt])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return
      const target = event.target instanceof Node ? event.target : null
      const inDialog = !!target && dialogRef.current?.contains(target)
      const inPrompt = !!target && promptRef.current?.contains(target)
      if (!inDialog && !inPrompt) return

      if (showDiscardPrompt) {
        if (event.key === 'Escape') {
          event.preventDefault()
          setShowDiscardPrompt(false)
        }
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        requestClose()
      } else if (event.key === 'Enter' && event.shiftKey && !event.metaKey && !event.ctrlKey) {
        event.preventDefault()
        void save(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [requestClose, save, showDiscardPrompt])

  return (
    <>
      <div className="modal-backdrop" onClick={requestClose} />
      <div
        ref={dialogRef}
        className={`modal-center ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-header" style={{ justifyContent: 'space-between' }}>
          {headerStart}
          <h3 id={titleId} style={{ flex: 1, margin: 0, fontSize: 'var(--fs-base)', fontWeight: 'var(--fw-semibold)' }}>
            {title}
          </h3>
          <button type="button" className="close-btn" onClick={requestClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {children}
        {destructiveConfirmation ? (
          <div className="modal-footer">
            <span className="text-sm text-error" style={{ marginRight: 'auto' }}>{destructiveConfirmation.description}</span>
            <button type="button" className="btn-cancel" onClick={destructiveConfirmation.onCancel}>Cancel</button>
            <button type="button" className="btn-danger" onClick={destructiveConfirmation.onConfirm} disabled={destructiveConfirmation.confirming}>
              {destructiveConfirmation.confirming ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        ) : (
          <div className="modal-footer">
            {footerStart}
            <button type="button" className="btn-cancel" onClick={requestClose} disabled={busy}>Cancel</button>
            <button type="button" className="btn-primary" onClick={() => void save(false)} disabled={busy || saveDisabled || !isDirty}>
              {busy ? 'Saving...' : saveLabel}
            </button>
          </div>
        )}
      </div>

      {showDiscardPrompt && (
        <>
          <div className="modal-backdrop" style={{ zIndex: 60 }} onClick={() => setShowDiscardPrompt(false)} />
          <div ref={promptRef} className="modal-center" role="alertdialog" aria-modal="true" aria-label="Unsaved changes" style={{ zIndex: 61, maxWidth: '340px' }}>
            <div className="modal-body" style={{ padding: 'var(--sp-xl)', textAlign: 'center' }}>
              <p style={{ margin: '0 0 var(--sp-lg)', color: 'var(--text)' }}>You have unsaved changes.</p>
              <div className="flex-row" style={{ gap: 'var(--sp-md)', justifyContent: 'center' }}>
                <button type="button" className="btn-cancel" onClick={() => setShowDiscardPrompt(false)}>Keep Editing</button>
                <button type="button" className="btn-danger" onClick={onClose}>Discard</button>
                <button type="button" className="btn-primary" onClick={() => void save(true)} disabled={busy}>Save</button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
