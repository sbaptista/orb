'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

type UnsavedChangesContextType = {
  dirty: boolean
  setDirty: (v: boolean) => void
  confirmNavigation: (proceed: () => void) => void
  pendingNavigation: (() => void) | null
  confirmPending: () => void
  cancelPending: () => void
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType>({
  dirty: false,
  setDirty: () => {},
  confirmNavigation: (proceed) => proceed(),
  pendingNavigation: null,
  confirmPending: () => {},
  cancelPending: () => {},
})

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null)

  const confirmNavigation = useCallback((proceed: () => void) => {
    if (!dirty) { proceed(); return }
    setPendingNavigation(() => proceed)
  }, [dirty])

  const confirmPending = useCallback(() => {
    if (pendingNavigation) {
      setDirty(false)
      pendingNavigation()
      setPendingNavigation(null)
    }
  }, [pendingNavigation])

  const cancelPending = useCallback(() => {
    setPendingNavigation(null)
  }, [])

  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  return (
    <UnsavedChangesContext.Provider value={{ dirty, setDirty, confirmNavigation, pendingNavigation, confirmPending, cancelPending }}>
      {children}
      {pendingNavigation && (
        <div style={{
          position: 'fixed', bottom: 'var(--sp-xl)', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
          padding: 'var(--sp-md) var(--sp-lg)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: 'var(--sp-md)', zIndex: 9999,
          fontSize: 'var(--fs-sm)',
        }}>
          <span style={{ color: 'var(--text)' }}>You have unsaved changes.</span>
          <button className="btn-primary" onClick={confirmPending} style={{ padding: '4px 12px', fontSize: 'var(--fs-xs)' }}>
            Leave
          </button>
          <button className="btn-cancel" onClick={cancelPending} style={{ padding: '4px 12px', fontSize: 'var(--fs-xs)' }}>
            Stay
          </button>
        </div>
      )}
    </UnsavedChangesContext.Provider>
  )
}

export function useUnsavedChanges() {
  return useContext(UnsavedChangesContext)
}
