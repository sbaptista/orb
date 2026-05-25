export interface Release {
  version: string
  date: string
  changes: string[]
}

export const CHANGELOG: Release[] = [
  {
    version: 'v0.5.31',
    date: '2026-05-24',
    changes: [
      'New query_db tool: Orb can now execute read-only database queries via Supabase query builder, eliminating hallucination caused by post-processing large result sets with missing server-side filters.',
      'Supports 8 allowed tables (todos, projects, knowledge_repo, audit_log, statuses, priorities, categories, groups) with declarative JSON filters, ordering, and joins.',
      'Security: table allowlist, column name validation, RLS-scoped for regular users, admin bypass for admins, 200-row cap with truncation flag, auto-filters soft-deleted rows.',
      'Query routing: system prompt now guides Orb to use query_todos for simple lookups and query_db for complex/structural questions (URLs, date ranges, cross-table).',
      'Removed has_urls, has_group, has_category from query_todos — superseded by query_db.',
    ]
  },
  {
    version: 'v0.5.30',
    date: '2026-05-24',
    changes: [
      'UI Alignment Fix (ORB-150): Shifted the top-right navigation bar (.dash-nav) to the left dynamically when the conversation is active (data-mode="dialogue") to prevent it from overlapping with the scaled-down Orb. Added a matching smooth transition curve.',
    ]
  },
  {
    version: 'v0.5.29',
    date: '2026-05-24',
    changes: [
      'Manual Maintenance Mode (ORB-141): Implemented a manual toggle in settings to enable system maintenance.',
      'Ethereal visuals: Designed the Undergoing Maintenance page featuring shooting meteors, a starfield, and the calm pulsing Moonlight Orb with the centered ORB wordmark.',
      'Bypass and Lockouts: Non-admin users are locked out from logging in or using the dashboard when maintenance is active. Admins (role_id 1 or 3) are allowed to bypass the lockout to verify migrations and updates.',
      'Active Sessions Handling: Active sessions show a fullscreen blocking overlay dynamically without logging users out or destroying their session state.',
      'Database integration: Created system_settings database table with composite RLS policies for global configuration.',
      'Optimized checks: Implemented in-memory caching (15-second TTL) in Next.js middleware to check maintenance state without impacting performance.',
      'Audit Trail integration: Added audit trail logging when maintenance mode is enabled or disabled.',
      'Admin notification: Added a top warning banner for logged-in admins to notify them when maintenance mode is active, with a direct shortcut to settings.',
    ]
  },
  {
    version: 'v0.5.28',
    date: '2026-05-24',
    changes: [
      'Fixed PWA navigation: moved back links further to the right in standalone mode on iPad/iPhone (avoiding overlap with window control traffic lights).',
      'Handled safe area insets: updated .tv-topbar padding to support left safe area insets dynamically.',
      'AI search improvements: updated query_todos tool to return all statuses by default and include task owners, category, group, and attached URLs count in the search results.',
      'AI query strategy: injected query strategy rules in system prompts to ensure consistent backlog scoping and verification.',
      'Enriched knowledge context: knowledge repo items shown in the assistant system prompt now link back to their originating tasks where applicable.',
    ]
  },
  {
    version: 'v0.5.24',
    date: '2026-05-24',
    changes: [
      'AI context audit: Orb now maps project owners to user names — can answer "who owns this project?" and match users to their projects.',
      'Todos now include group, category, and URL count in AI context for richer answers.',
      'Priority urgency flags visible to AI — Orb knows which priority levels trigger the urgent state.',
      'Knowledge repo tags and audit log actor field now included in AI context.',
    ]
  },
  {
    version: 'v0.5.23',
    date: '2026-05-24',
    changes: [
      'Eliminated the tickets system — feedback (bugs, suggestions, capability gaps, workflow friction) is now stored as todos in a dedicated Tickets project instead of a separate tickets table. Simplifies the data model and makes feedback visible alongside regular project work.',
      'Removed Settings → Tickets page and sidebar link. Friction log "Create Todo" now generates todos directly.',
      'Expanded AI context (ORB-146): Orb now sees categories, groups, roles, platforms, friction logs, invitations, and users. Truncated data shows "X of Y" counts for transparency.',
      'Removed the inline query results mini-list from conversation responses — all task data is now presented conversationally for consistent, deterministic output.',
    ]
  },
  {
    version: 'v0.5.22',
    date: '2026-05-23',
    changes: [
      'Project codes are now unique per user instead of globally unique — multiple users can create projects with common codes like TEST or WORK without naming collisions (ORB-144).',
      'REST API now supports X-User-Id and X-User-Email headers to scope project lookups when codes are shared across users.',
      'Orb AI project operations (update, delete, dormancy, move) now resolve projects within the current user\'s scope.',
    ]
  },
  {
    version: 'v0.5.21',
    date: '2026-05-23',
    changes: [
      'Conversational project name referencing: updated the conversational Orb system prompt to enforce referring to projects by their display names (e.g. "Orb") rather than system codes (e.g. "ORB") in responses to the user, while preserving tool parameters requirements.',
    ]
  },
  {
    version: 'v0.5.20',
    date: '2026-05-23',
    changes: [
      'Optional project code with auto-generation: project code is now optional when creating a project. If omitted, a unique uppercase alphanumeric code is automatically generated from the project name, resolving code conflicts by appending a unique counter (ORB-143).',
    ]
  },
  {
    version: 'v0.5.19',
    date: '2026-05-23',
    changes: [
      'Smart project default for ticket conversion: ticket todo generation now defaults to the ORB project if available in the projects list (preventing auto-creating tickets in the first alphabetically sorted project).',
    ]
  },
  {
    version: 'v0.5.18',
    date: '2026-05-23',
    changes: [
      'Admin project search: admins can now search and navigate to any user\'s project from the TodoView topbar (ORB-138).',
      'Login speed improvements: OTP reduced from 8 to 6 digits, added "Signing in…" feedback after verification, optimized TodoView to only fetch active todos by default — closed todos load on demand (ORB-139).',
      'Dashboard nav labels: all icon buttons now show visible text labels (List, Print, Help, Settings, Account). Tooltips restored (ORB-140).',
    ]
  },
  {
    version: 'v0.5.17',
    date: '2026-05-23',
    changes: [
      'New: Print / Export PDF — generate a complete printable backlog export from the dashboard. Supports All Projects or Current Project scope. Includes all todos (active, parked, closed) with full descriptions, resolution notes, and dates.',
      'Fixed: Creating a project then immediately adding a todo in the same Orb conversation turn no longer fails with "product not found" (ORB-136).',
    ]
  },
  {
    version: 'v0.5.16',
    date: '2026-05-22',
    changes: [
      'Fixed settings topbar overlap with iPad Stage Manager window controls (safe-area left inset).',
      'Added viewport-fit: cover for proper safe-area support on all devices.',
      'Auth resilience: stale sessions now show a toast and redirect to login instead of failing silently.',
    ]
  },
  {
    version: 'v0.5.15',
    date: '2026-05-22',
    changes: [
      'Replaced three-dot quick-edit trigger with a lightning bolt icon for clarity.',
      'Added pencil icon button to open the full detail panel — row tap action is now visually discoverable.',
      'All row action buttons (edit, quick edit, close) are now always visible instead of hover-only.',
      'Strengthened the close/done toggle visibility — thicker border and tooltip added.',
      'Fixed RLS initplan policies across all tables to reduce Supabase disk I/O usage.',
    ]
  },
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
