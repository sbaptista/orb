export interface Release {
  version: string
  date: string
  changes: string[]
}


export const CHANGELOG: Release[] = [
  {
    version: 'v0.5.60',
    date: '2026-05-26',
    changes: [
      'Unified Dashboard (Phase 1): built UnifiedDashboard component merging Orb conversation and task list into a single split-pane view with draggable divider.',
      'DragDivider component: pointer-event-based resizable split with snap points (30/70, 50/50, 70/30), localStorage persistence, and touch-friendly hit targets.',
      'Split layout: vertical stack on iPhone (drag up/down), side-by-side on desktop (drag left/right). Fractal background visible through both panes.',
      'Widened OrbConversation max-width from 420px to 600px so the Orb feels less cramped in the unified layout.',
    ]
  },
  {
    version: 'v0.5.59',
    date: '2026-05-26',
    changes: [
      'Prototype panels layout: integrated app-wide commands (List, Print, Help, Settings, Account) into the desktop topbar.',
      'Zero-Row Project Switcher: replaced the horizontal project pill bar with a project name dropdown trigger directly in the topbar, saving ~48px of vertical screen real estate.',
      'Sleek Switcher UI: implemented a searchable desktop dropdown menu and a responsive touch-first bottom drawer switcher for mobile (iPhone/iPad).',
    ]
  },
  {
    version: 'v0.5.58',
    date: '2026-05-26',
    changes: [
      'Implemented an OTP request cooldown of 60 seconds on the login page to prevent rapid re-requests.',
      'Persisted OTP cooldown state via localStorage, preventing bypasses from page refreshes, tab closures, or back-and-forth navigation.',
      'Replaced state-based countdown polling in render with dynamic time calculation based on a reactive time state to satisfy React Compiler purity and avoid cascading render warnings.',
      'Resolved pre-existing ESLint warnings in the login page (deferred searchParams error checks to avoid cascading renders, and correctly typed standard exceptions).',
    ]
  },
  {
    version: 'v0.5.57',
    date: '2026-05-25',
    changes: [
      'Emergency fix: removed surviving Realtime subscription from AmbientDashboard — postgres_changes WAL reader was consuming excessive disk IO (same root cause as ORB-132, missed in that component).',
      'Reduced background poll interval from 30s to 60s to halve query volume against the database.',
      'Ran VACUUM ANALYZE on bloated tables (projects, todos, knowledge_repo).',
    ]
  },
  {
    version: 'v0.5.56',
    date: '2026-05-25',
    changes: [
      'Prototype: /prototype route — unified command surface with task list and Orb conversation panel side by side.',
      'Desktop: 60/40 split layout — task list on the left, Orb panel with mini Orb sphere on the right.',
      'Mini Orb: breathing gradient sphere with project code arc text and active task count — restores the Orb presence in the panel.',
      'iPhone: full-width task list with a collapsible bottom panel for the Orb (slide-up sheet, 60% height).',
      'Orb panel: streaming conversation, thought indicators, auto-refetch on mutations.',
      'Project selector pill bar for switching between projects without navigation.',
    ]
  },
  {
    version: 'v0.5.54',
    date: '2026-05-25',
    changes: [
      'TodoView list mode: proper HTML table with column headers, select-all checkbox, labeled action buttons (Edit, Quick, Done) with bordered pill styling.',
      'iPhone-first responsive layout: on mobile, actions collapse below the title inside each row — no horizontal scrolling needed. On desktop, actions stay in their own column at the far right.',
      'Title clamped to 2 lines with ellipsis overflow.',
      'Removed status pills and priority from list rows — redundant with filters.',
      'Darkened table header with uppercase labels. Increased row padding for readability.',
      'Project name centered in its own row above the table.',
      'Checklist view rebuilt as a clean table — done-circle and title only, no bulk edits (use list view for bulk operations).',
      'Fixed constant screen refreshing — background poll no longer flashes loading state.',
      'Fixed Safari iOS row borders — uses box-shadow instead of border-bottom for reliable rendering.',
      'Update banner: centered button with "An application update is available" message to its right, replacing the toast notification.',
    ]
  },
  {
    version: 'v0.5.47',
    date: '2026-05-25',
    changes: [
      'Consolidated concurrent `supabase.auth.getUser()` calls in AmbientDashboard on mount to resolve lock acquisition and Navigator LockManager token collisions.',
    ]
  },
  {
    version: 'v0.5.46',
    date: '2026-05-25',
    changes: [
      'Placed the All platform pill first and distinguished it visually using bold text, a dashed border, and a symbol prefix.',
      'Implemented mutual-exclusion selection behavior: selecting All clears other platform selections; selecting any other platform deselects All.',
      'Replaced the toggle Checklist view button with a List Views toggle button that displays a dedicated single-selection views panel below the toolbar.',
    ]
  },
  {
    version: 'v0.5.45',
    date: '2026-05-25',
    changes: [
      'Moved Platforms configuration to Settings using a standardized CRUD list with todo count tracking.',
      'Hooked platform association pills into Todo view/edit panels, updating the todo_platforms join table.',
      'Added a vertical text label under the list/checklist toggle button for clear navigation on mobile/iOS.',
      'Streamlined bulk actions: eliminated the Select button, showing checkboxes permanently on the left of each row.',
      'Rendered the bulk edit bar inline at the top of the todo list card whenever items are selected.',
    ]
  },
  {
    version: 'v0.5.44',
    date: '2026-05-25',
    changes: [
      'Widen desktop search input base width to 300px so "Search projects or owners..." placeholder is fully visible without clipping before click.',
      'Render mobile search input permanently as a full-width row on iPhone above other buttons to display complete search context.',
      'Context-aware search placeholders: Owner (non-admin) placeholder changed to "Search projects..." since they only see their own projects.',
      'Eliminated collapsible completions panel (down arrow completed section) — completed items are now accessed via the status filter.',
      'Implemented database-level pagination (40 tasks per page) for all statuses to optimize DB query and render performance.',
    ]
  },
  {
    version: 'v0.5.43',
    date: '2026-05-25',
    changes: [
      'Fix mobile duplicated search bar and dual scroll toolbars by using client-side isMobile state filtering rather than rendering both and relying on CSS hidden states.',
      'Fix desktop vertical wrapping and alignment bug in TodoView by rendering search input and toolbar as flat siblings in a single flexbox row inside the topbar, aligned via a flex-grow spacer.',
    ]
  },
  {
    version: 'v0.5.42',
    date: '2026-05-25',
    changes: [
      'Separate Mac/desktop actions from mobile HScrollNav wrapping — resolves alignment bugs and search dropdown clipping on desktop.',
      'Maintain optimized horizontal scroll navigation and full-width active search dropdowns on mobile (iPhone).',
    ]
  },
  {
    version: 'v0.5.41',
    date: '2026-05-25',
    changes: [
      'Safari mobile layout fixes for iPhone in TodoView.',
      'Pin the Back link so it is outside of the horizontal scrolling action bar.',
      'Prevent checkbox select buttons from stretching into vertical ovals on multi-line items.',
      'Fix search input dropdowns for projects/owners not opening or rendering on focus by using full-width active overlay on mobile.',
    ]
  },
  {
    version: 'v0.5.38',
    date: '2026-05-25',
    changes: [
      'Settings sidebar now scrolls independently below the version/toggle header — all nav items reachable regardless of viewport height.',
      'Sidebar toggle icon replaced with the standard panel-left icon (vertical bar + three lines) — no longer confused with the back arrow.',
      'Checklist view: removed the todo ID sub-label (e.g. ORB-155) from each row for a cleaner, less cluttered list.',
    ]
  },
  {
    version: 'v0.5.37',
    date: '2026-05-25',
    changes: [
      'Dedicated Ticketing System (ORB-148): Replaced todos-in-TICKETS-project with a proper two-layer model.',
      'New tickets table: ticket_number, type, source, summary, reported_by, status (open/in_progress/closed/dismissed), linked todo_id FK, notification dedup flags.',
      'ticket_id FK added to todos — links engineer work back to the originating ticket.',
      'Status propagation: when a linked todo changes status, the ticket updates automatically and the reporter receives a push + email notification (deduplicated).',
      'Admin UI at Settings → Tickets: table of all tickets, inline Create Todo form, Dismiss with reason.',
      'Welcome email sent on new user onboarding.',
      'One-time migration: 2 historical TICKETS todos moved to tickets table; TICKETS project marked dormant.',
      'RLS: admins have full access; reporters can read their own tickets. All policies use (SELECT auth.uid()) per ORB-131 rules.',
    ]
  },
  {
    version: 'v0.5.36',
    date: '2026-05-25',
    changes: [
      'Performance: Removed Supabase Realtime postgres_changes subscription from TodoView — it was consuming 80% of all database query time (1M+ WAL reads). Tab-focus refetch via useVisibilityRefetch is sufficient for a single-user app.',
    ]
  },
  {
    version: 'v0.5.35',
    date: '2026-05-25',
    changes: [
      'Performance: Added 5 missing indexes to eliminate sequential scans driving Supabase disk I/O budget depletion (ORB-132).',
      'idx_todos_product_status_deleted: partial composite index on (product_id, status) for the standard todo fetch pattern.',
      'idx_todos_status_deleted: partial index on status for admin all-projects queries.',
      'idx_projects_created_by: partial index on created_by to speed up the RLS correlated subquery on todos (was causing 94k seq scans on projects).',
      'idx_audit_log_user_id and idx_audit_log_created_at: indexes for RLS and settings audit view ordering.',
      'Ran VACUUM ANALYZE on 7 bloated tables (system_settings was at 1200% dead rows, projects 270%, public.users 300%).',
    ]
  },
  {
    version: 'v0.5.34',
    date: '2026-05-25',
    changes: [
      'Smooth Orb Transition (ORB-156): Switching between ambient and dialogue mode now fades the orb out briefly before repositioning, then fades back in — eliminating the jarring snap caused by the transform-origin change.',
    ]
  },
  {
    version: 'v0.5.33',
    date: '2026-05-25',
    changes: [
      'Checklist Mode (ORB-155): Projects can now toggle between list view and checklist view. Checklist skin renders todos as a minimal checkbox list — tap to complete/reopen, tap the label to open the detail panel. View mode persists to the database. Toggle appears in the toolbar for all non-global project views.',
    ]
  },
  {
    version: 'v0.5.32',
    date: '2026-05-24',
    changes: [
      'Session Restoration Fix (ORB-154): Restored conversation transcript and state from sessionStorage on mount instead of clearing it, preventing the Orb from starting a new session and re-firing the greeting when navigating back and forth from the dashboard to TodoView.',
    ]
  },
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
