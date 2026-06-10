'use client'

import { useState } from 'react'

type Props = {
  onClose: () => void
  selectedProductId: string | null
  selectedProductName: string | null
}

export default function PrintModal({ onClose, selectedProductId, selectedProductName }: Props) {
  const [scope, setScope] = useState<'all' | 'project'>(
    selectedProductId ? 'project' : 'all'
  )

  function handlePrint() {
    const params = new URLSearchParams()
    if (scope === 'project' && selectedProductId) {
      params.set('scope', 'project')
      params.set('id', selectedProductId)
    } else {
      params.set('scope', 'all')
    }
    window.open(`/dashboard/print?${params.toString()}`, '_blank')
    onClose()
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />

      <div role="dialog" aria-modal="true" aria-labelledby="print-title" className="modal-center">
        <div className="modal-header">
          <h2 id="print-title" style={{ fontSize: '15px', fontWeight: 700, margin: 0, flex: 1 }}>
            Print / Export PDF
          </h2>
          <button onClick={onClose} className="close-btn" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="modal-body" style={{ padding: 'var(--sp-xl)' }}>
          <p style={{ fontSize: '13px', color: 'var(--text3)', margin: '0 0 20px 0', lineHeight: 1.5 }}>
            Generate a printable backlog export. All todos are included — active (open + in progress), parked (deferred + on hold), and closed — with full details, descriptions, and resolution notes.
          </p>

          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text3)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '12px',
            }}>
              Scope
            </legend>

            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: 'var(--r)',
              cursor: 'pointer',
              background: scope === 'all' ? 'rgba(60, 110, 60, 0.06)' : 'transparent',
              border: `1px solid ${scope === 'all' ? 'rgba(60, 110, 60, 0.25)' : 'var(--border)'}`,
              marginBottom: '8px',
              transition: 'background 0.15s, border-color 0.15s',
            }}>
              <input
                type="radio"
                name="print-scope"
                value="all"
                checked={scope === 'all'}
                onChange={() => setScope('all')}
                style={{ width: '18px', height: '18px', accentColor: '#2d5a2d' }}
              />
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>
                  All Projects
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '2px' }}>
                  Every project and all their todos
                </div>
              </div>
            </label>

            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: 'var(--r)',
              cursor: selectedProductId ? 'pointer' : 'not-allowed',
              opacity: selectedProductId ? 1 : 0.5,
              background: scope === 'project' ? 'rgba(60, 110, 60, 0.06)' : 'transparent',
              border: `1px solid ${scope === 'project' ? 'rgba(60, 110, 60, 0.25)' : 'var(--border)'}`,
              transition: 'background 0.15s, border-color 0.15s',
            }}>
              <input
                type="radio"
                name="print-scope"
                value="project"
                checked={scope === 'project'}
                onChange={() => setScope('project')}
                disabled={!selectedProductId}
                style={{ width: '18px', height: '18px', accentColor: '#2d5a2d' }}
              />
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>
                  Current Project
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '2px' }}>
                  {selectedProductName
                    ? `${selectedProductName} only`
                    : 'Select a project first'}
                </div>
              </div>
            </label>
          </fieldset>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-cancel">
            Cancel
          </button>
          <button onClick={handlePrint} className="btn-primary">
            Open Print Page
          </button>
        </div>
      </div>
    </>
  )
}
