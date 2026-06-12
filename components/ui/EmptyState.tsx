'use client'

type Variant = 'no-tasks' | 'all-clear' | 'no-results' | 'no-projects' | 'no-match'

type Props = {
  variant: Variant
  message?: string
  action?: { label: string; onClick: () => void }
}

const OrbMini = ({ size = 48 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <defs>
      <radialGradient id="emptyOrbGrad" cx="36%" cy="30%" r="60%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="45%" stopColor="#d4e4d4" />
        <stop offset="100%" stopColor="#6a9a7a" />
      </radialGradient>
    </defs>
    <circle cx="24" cy="24" r="20" fill="url(#emptyOrbGrad)" />
    <ellipse cx="18" cy="17" rx="7" ry="5" fill="rgba(255,255,255,0.5)" />
  </svg>
)

const illustrations: Record<Variant, React.ReactNode> = {
  'no-tasks': (
    <div className="empty-state-orb-wrap">
      <OrbMini size={56} />
    </div>
  ),
  'all-clear': (
    <div className="empty-state-orb-wrap">
      <OrbMini size={56} />
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden style={{ marginTop: '-4px' }}>
        <path d="M8 16l5.5 5.5L24 10" stroke="var(--pill-active-color)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      </svg>
    </div>
  ),
  'no-results': (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="28" cy="28" r="14" stroke="var(--muted)" strokeWidth="1.5" opacity="0.4" />
      <line x1="38" y1="38" x2="48" y2="48" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <line x1="22" y1="28" x2="34" y2="28" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
    </svg>
  ),
  'no-projects': (
    <div className="empty-state-orb-wrap">
      <OrbMini size={56} />
    </div>
  ),
  'no-match': (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="24" cy="24" r="16" stroke="var(--border)" strokeWidth="1.5" opacity="0.4" />
      <line x1="18" y1="24" x2="30" y2="24" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
  ),
}

const defaultMessages: Record<Variant, string> = {
  'no-tasks': 'No tasks yet. Ask Orb to help you plan, or add one manually.',
  'all-clear': 'All clear — nothing active right now.',
  'no-results': 'No todos match these filters.',
  'no-projects': 'No projects yet. Create one to get started.',
  'no-match': 'No results found.',
}

export default function EmptyState({ variant, message, action }: Props) {
  const isCompact = variant === 'no-match' || variant === 'no-results'

  return (
    <div className={`empty-state ${isCompact ? 'empty-state--compact' : ''}`}>
      <div className="empty-state-illustration">
        {illustrations[variant]}
      </div>
      <p className="empty-state-message">
        {message ?? defaultMessages[variant]}
      </p>
      {action && (
        <button className="btn-primary" onClick={action.onClick} style={{ marginTop: 'var(--sp-sm)' }}>
          {action.label}
        </button>
      )}
    </div>
  )
}
