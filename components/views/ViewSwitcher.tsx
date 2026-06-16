'use client'

export type ViewMode = 'list' | 'checklist' | 'kanban'

type ViewSwitcherProps = {
  current: ViewMode
  onSwitch: (mode: ViewMode) => void
  onClose: () => void
}

const VIEW_OPTIONS: { mode: ViewMode; label: string }[] = [
  { mode: 'list', label: 'List' },
  { mode: 'checklist', label: 'Checklist' },
  { mode: 'kanban', label: 'Kanban' },
]

export default function ViewSwitcher({ current, onSwitch, onClose }: ViewSwitcherProps) {
  return (
    <div className="tv-filterbar" style={{ borderTop: 'none', display: 'flex', alignItems: 'center', gap: 'var(--sp-md)' }}>
      <span className="text-xs text-muted" style={{ fontWeight: 'var(--fw-semibold)' }}>VIEWS:</span>
      {VIEW_OPTIONS.map(({ mode, label }) => (
        <button
          key={mode}
          className="tv-toolbar-btn"
          aria-pressed={current === mode}
          onClick={() => onSwitch(mode)}
          style={{ fontSize: 'var(--fs-xs)', padding: '4px 8px' }}
        >
          {label}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <button className="nav-circle-btn" onClick={onClose} aria-label="Close views" data-tooltip="Close views">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  )
}
