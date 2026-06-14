'use client'

import { useState } from 'react'

export default function ChangeNameModal({
  firstName,
  lastName,
  saving,
  onClose,
  onSubmit,
}: {
  firstName: string
  lastName: string
  saving: boolean
  onClose: () => void
  onSubmit: (firstName: string, lastName: string) => Promise<void>
}) {
  const [nextFirstName, setNextFirstName] = useState(firstName)
  const [nextLastName, setNextLastName] = useState(lastName)

  const hasChanges =
    nextFirstName.trim() !== firstName.trim() ||
    nextLastName.trim() !== lastName.trim()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasChanges || saving) return
    await onSubmit(nextFirstName, nextLastName)
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="change-name-title" className="modal-center modal-sm">
        <div className="modal-header" style={{ justifyContent: 'space-between' }}>
          <h2 id="change-name-title" style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)' }}>
            Change Name
          </h2>
          <button onClick={onClose} className="close-btn" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body" style={{ padding: 'var(--sp-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
          <div>
            <label htmlFor="account-first-name" className="pf-label" style={{ marginBottom: 'var(--sp-xs)' }}>First name</label>
            <input
              id="account-first-name"
              className="pf-input"
              value={nextFirstName}
              onChange={e => setNextFirstName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="account-last-name" className="pf-label" style={{ marginBottom: 'var(--sp-xs)' }}>Last name</label>
            <input
              id="account-last-name"
              className="pf-input"
              value={nextLastName}
              onChange={e => setNextLastName(e.target.value)}
            />
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
            <button type="submit" disabled={!hasChanges || saving} className="btn-primary">
              {saving ? 'Changing…' : 'Change name'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
