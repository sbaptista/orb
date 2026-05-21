export interface Release {
  version: string
  date: string
  changes: string[]
}

export const CHANGELOG: Release[] = [
  {
    version: 'v0.5.14',
    date: '2026-05-21',
    changes: [
      'Added inline task metadata editing in list view — right-click or tap the three-dot icon to quick-edit status, priority, and due date without opening the detail panel.',
      'Auto-saves each field change immediately with audit logging and urgency checks.',
      'Responsive popover positioning: anchored to the row on desktop, bottom sheet on narrow screens (iPhone).',
      'Touch-friendly: three-dot trigger always visible on touch devices, 36px minimum hit targets on chips.',
    ]
  },
  {
    version: 'v0.5.13',
    date: '2026-05-21',
    changes: [
      'Relocated all toast notifications to the top of the viewport globally, sliding down from top-center.'
    ]
  },
  {
    version: 'v0.5.12',
    date: '2026-05-21',
    changes: [
      'Implemented auto-refreshing version update banner with notification toast.',
      'Added the "What\'s New" settings screen to show release history.',
      'Integrated manual version update simulation to the developer panel.',
      'Removed obsolete offline banner, consolidating offline checks directly into the breathing Julia fractal page.'
    ]
  },
  {
    version: 'v0.5.11',
    date: '2026-05-21',
    changes: [
      'Aligned urgency notification thresholds with custom user database-backed values.',
      'Added periodic re-evaluation for time-based due dates in the dashboard (every 60s).',
      'Refactored server action urgency escalation checks.'
    ]
  },
  {
    version: 'v0.5.10',
    date: '2026-05-18',
    changes: [
      'Implemented dashboard service worker registration and push client.',
      'Fixed state rendering transitions for offline indicators.'
    ]
  }
]
