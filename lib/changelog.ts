export interface Release {
  version: string
  date: string
  changes: string[]
}

export const CHANGELOG: Release[] = [
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
