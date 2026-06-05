export interface Release {
  version: string
  date: string
  changes: string[]
}

export const CHANGELOG: Release[] = [
  {
    version: 'v0.5.142',
    date: '2026-06-04',
    changes: [
      'ORB-211: Made the conversation input field more prominent by increasing default border thickness, using a higher-contrast border color, adding a subtle shadow, and implementing premium hover and focus ring glow effects in CSS.',
      'ORB-211: Added visual separation spacing between the conversation thread and the input field to clearly differentiate the message flow from the input container.',
    ]
  },
  {
    version: 'v0.5.141',
    date: '2026-06-04',
    changes: [
      'ORB-210: Updated the Pre-Alpha Testing help page in the Help sidebar to remove references to the deleted onboarding seed projects (WELCOME, ECO) and replaced them with general project task scenarios.',
    ]
  },
  {
    version: 'v0.5.140',
    date: '2026-06-04',
    changes: [
      'Conditional mediation: returning users with a passkey see it in the email field\'s autofill. Tap it, biometric fires, signed in — no email or OTP needed.',
      'Uses Supabase\'s two-step passkey API (startAuthentication + verifyAuthentication) with navigator.credentials.get({ mediation: "conditional" }).',
      'Progressive enhancement: if the browser doesn\'t support conditional mediation, the page falls back to email/OTP silently. All failure paths are silent.',
    ]
  },
  {
    version: 'v0.5.139',
    date: '2026-06-04',
    changes: [
      'Passkey registration is now mandatory: after OTP login, users are redirected to set up a passkey if their device supports it. No skip option.',
      'Removed passkey button from login page — all users start with email/OTP. Passkeys are used automatically by the OS on subsequent logins.',
      'Removed Settings > Passkeys page from navigation — passkey management is handled by the mandatory gate and the OS.',
      'Passkeys settings page is now accessible to all users (not admin-only) if accessed by direct URL.',
    ]
  },
  {
    version: 'v0.5.138',
    date: '2026-06-04',
    changes: [
      'ORB-209: Removed onboarding sample projects and tasks (WELCOME, HOME, ECO) so new users start in zero-project state.',
      'ORB-209: Configured Orb click/tap in zero-project state to open project creation modal, and disabled task "+ New" button on zero-projects with a friendly toast reminder.',
      'ORB-209: Updated Guided Tour steps and descriptions to follow the new 7-step sequence.',
    ]
  },
  {
    version: 'v0.5.137',
    date: '2026-06-04',
    changes: [
      'Clarified Comprehension Check instructions in AGENTS.md to explicitly allow read-only tool usage on the first turn to gather check answers.',
    ]
  },
  {
    version: 'v0.5.136',
    date: '2026-06-03',
    changes: [
      'Closed ORB-173 (Pre-Alpha Checklist): all 5 gates met — core loop reliable, multi-user works, infrastructure holds, first impression competent, operator can manage.',
      'Closed ORB-197 (Onboarding for Testers): driver.js guided tour shipped in v0.5.135.',
    ]
  },
  {
    version: 'v0.5.135',
    date: '2026-06-03',
    changes: [
      'ORB-197: Replaced the text-list onboarding with a driver.js guided tour — 6 observational steps that highlight real UI elements (Orb, conversation input, views, help). No step requires an action, so the tour is correct from any app state.',
      'ORB-197: Tour launch via one-line nudge in first conversation (not auto-start). Also accessible from Help panel. Mobile-aware with per-step pane switching for tabbed layout.',
      'ORB-197: WELCOME seed tasks retitled to clean, prefix-free titles.',
      'Codified the Orb eval suite as a mandatory rule in AGENTS.md — new capabilities must include matching eval cases, Tier 1 must be green before any production push.',
      'ORB-197 onboarding plan: invite-email feedback wording improvements.',
    ]
  },
  {
    version: 'v0.5.132',
    date: '2026-06-02',
    changes: [
      'Scope transparency prompt fix: restructured the SCOPE instruction as a bullet list with an explicit mandatory rule — the Orb must name the project(s) in every response that mentions task counts or summaries.',
      'Orb eval framework: new /api/orb-eval endpoint (dev-only) and scripts/orb-eval.ts test runner. Tier 1 tests verify tool call correctness (deterministic). Tier 2 tests verify behavioral properties (statistical, 3 runs, 2/3 pass). 11 initial test cases covering tool routing, scope transparency, cross-project awareness, mutation approval, and feature disclosure.',
      'Orb prompt: added backlog direct access rule (answer simple counts from static context without tool calls) and tool query transparency rule (state lookup scope before calling query tools).',
    ]
  },
  {
    version: 'v0.5.131',
    date: '2026-06-02',
    changes: [
      'ORB-206: Clean up stale invitations (accepted/declined) when sending a new user invite to prevent duplicate records and resend confusion.',
      'ORB-206: Clean up the auth.users record when a pending invitation is deleted from the system if the user has not registered yet.',
    ]
  },
  {
    version: 'v0.5.130',
    date: '2026-06-02',
    changes: [
      'ORB-206: Clean up associated invitations when a user is deleted from the system, preventing stale status conflicts when the email is reused for new invitations.',
    ]
  },
  {
    version: 'v0.5.129',
    date: '2026-06-02',
    changes: [
      'ORB-198: Provided the Orb conversational AI with precise UI navigation knowledge by dynamically loading docs/ui-catalog.md at runtime.',
      'ORB-198: Enriched docs/ui-catalog.md with exact button labels, panel toggles, mobile menu behaviors, settings updates, and corrected version badge interactivity.',
      'Enforced UI Catalog updates by introducing scripts/verify-ui-catalog.js (run in npm run lint) which fails if UI files are modified without updating the documentation.',
      'Audited database RLS policies and confirmed all 43 policies are correctly optimized; corrected the check query pattern in AGENTS.md to prevent false positives.',
    ]
  },
  {
    version: 'v0.5.128',
    date: '2026-06-02',
    changes: [
      'ORB-202: Tickets now auto-close when a todo is created from them. The reporter is notified that their feedback has been addressed.',
      'ORB-203: Decoupled query scope from mutation scope — the Orb now sees all projects in every conversation (global query), while mutations (create/update) default to the currently selected project. Removes the "All/Scope" toggle button from the Orb toolbar.',
      'ORB-203: Admins can now ask "how many open tasks in Helm?" while viewing the Orb project without toggling scope. Cross-project queries work naturally.',
    ]
  },
  {
    version: 'v0.5.127',
    date: '2026-06-02',
    changes: [
      'Fixed database project seeding failure for new users during onboarding: updated projects table check constraint (projects_view_mode_check) to allow the "kanban" view mode, preventing silent seeding failures and subsequent project search errors.',
      'Upgraded invitation link generation in invite-user and invitation-actions to robustly use HTTPS for localhost in development, resolving empty response errors caused by http:// dev links.',
      'Resolved the invitation bypass issue where invited users skip the create-account onboarding screen and land directly on the dashboard. Integrated project and task seeding directly into resolveUser via a new shared onboarding seeding utility (lib/onboarding-seeding.ts) to guarantee their default projects are seeded before they reach the dashboard.',
    ]
  },
  {
    version: 'v0.5.126',
    date: '2026-06-02',
    changes: [
      'Fixed user invitation modal error handling: added return statement to handleAdd catch block in SettingsCrudList to ensure error messages are displayed rather than closing the modal silently.',
      'Enhanced user invitation checks to be case-insensitive and trimmed to prevent duplicate registrations via casing differences.',
    ]
  },
  {
    version: 'v0.5.125',
    date: '2026-06-02',
    changes: [
      'Implemented onboarding seeding (WELCOME, HOME, ECO projects with realistic demo tasks) to demonstrate strategic planning and ambient states for pre-alpha testers.',
      'Added a 7-day survey check-in where the Orb queries active users on Ambient Orb utility, Strategic Guidance utility, and Friction/Bugs, automatically logging feedback as tickets.',
      'Added a Pre-Alpha Testing guide to the Help panel detailing testing goals and how to report bugs or suggestions.',
      'Fixed layout bugs: added vertically centered text labels under top-right nav icons on desktop, and resolved mobile layout pane isolation issues.',
      'Cleaned up ESLint unescaped entities and synchronous state update warnings in OrbHelp.',
    ]
  },
  {
    version: 'v0.5.124',
    date: '2026-06-01',
    changes: [
      'Kanban touch drag: Prevented horizontal column scrolling from reclaiming touch gestures by default-preventing early touchmove events immediately once the long-press drag gesture becomes ready.',
    ]
  },
  {
    version: 'v0.5.123',
    date: '2026-06-01',
    changes: [
      'Kanban touch drag: Disabled text selection on Kanban cards and columns to prevent accidental highlighting and magnifying glass popups during drag-and-drop actions on mobile.',
    ]
  },
  {
    version: 'v0.5.122',
    date: '2026-06-01',
    changes: [
      'Kanban touch drag: Removed temporary debug drop coordinate check alert and related tracking variables.',
    ]
  },
  {
    version: 'v0.5.121',
    date: '2026-06-01',
    changes: [
      'Kanban touch drag: Disabled HTML5 draggable behavior on touch devices to prevent mobile browser native drag hijacking.',
    ]
  },
  {
    version: 'v0.5.120',
    date: '2026-06-01',
    changes: [
      'Kanban touch drag: Configured touch-action: pan-y on Kanban cards to prevent browser horizontal scrolling from cancelling the drag gesture.',
    ]
  },
  {
    version: 'v0.5.119',
    date: '2026-06-01',
    changes: [
      'Kanban touch drag: Extended drop diagnostic alerts with viewport coordinates and column boundary boxes mapping.',
    ]
  },
  {
    version: 'v0.5.118',
    date: '2026-06-01',
    changes: [
      'Kanban touch drag: Extended drop diagnostic alerts with active column tracking history.',
    ]
  },
  {
    version: 'v0.5.117',
    date: '2026-06-01',
    changes: [
      'Kanban touch drag: Added temporary diagnostic alerts for touch drop debugging.',
    ]
  },
  {
    version: 'v0.5.116',
    date: '2026-06-01',
    changes: [
      'Kanban touch drag: Refactored touch event handling to register native document-level listeners with { passive: false } on touch start to prevent native scrolling interference.',
      'Kanban touch drag: Resolved stale closure bugs during drag-and-drop by using refs for tracking active drop targets and props status-change callback functions.',
      'Kanban touch drag: Cleaned up JSX by removing unused React synthetic touch listeners on Kanban cards.',
    ]
  },
  {
    version: 'v0.5.110',
    date: '2026-06-01',
    changes: [
      'Kanban touch drag: fixed drops failing after the first successful drag on iPhone. Root cause: iOS Safari scroll containers (-webkit-overflow-scrolling) intercepted touch events before React\'s delegated handlers could call preventDefault(), causing column positions to shift mid-drag and drop target hit-testing to fail.',
      'Touch handlers now use native document-level listeners with { passive: false } instead of React synthetic events, guaranteeing preventDefault() is respected regardless of scroll container nesting.',
      'Removed deprecated -webkit-overflow-scrolling: touch from kanban CSS (unnecessary since iOS 13+).',
      'Kanban touch drag: fixed ghost card images persisting on iPhone. Orphaned clones cleaned up on touchcancel, unmount, and before new drags.',
      'Kanban touch drag: long-press activation model (300ms hold + movement) replaces instant 10px threshold. Scrolling no longer accidentally triggers drag.',
    ]
  },
  {
    version: 'v0.5.108',
    date: '2026-06-01',
    changes: [
      'Standardized project backlog search placeholder inside TodoView to "Type to select project or user..." to keep it consistent with the main dashboard.',
      'Designed and added text labels below each icon button in the Orb conversation bottom toolbar.',
      'Refactored the Orb conversation toolbar to be a horizontally scrollable container on smaller screen viewports to prevent wrapping and layout breakage.',
    ]
  },
  {
    version: 'v0.5.107',
    date: '2026-06-01',
    changes: [
      'Standardized placeholder text sizes in search inputs and textareas to use var(--fs-sm) instead of hardcoded pixel sizes.',
      'Standardized font sizes for slash command headers and item descriptions in the Orb conversation view to use var(--fs-version) instead of hardcoded pixel sizes.',
    ]
  },
  {
    version: 'v0.5.106',
    date: '2026-06-01',
    changes: [
      'Grayed out / disabled active tab buttons on mobile viewports so user knows only the other button can be selected.',
      'Enlarged button label font sizes by 2px on mobile viewports for better readability and accessibility.',
      'Updated the project search input placeholder to always say "Type to select project or user...".',
    ]
  },
  {
    version: 'v0.5.105',
    date: '2026-06-01',
    changes: [
      'Fixed layout bug where hiding one of the panes on desktop results in the remaining pane (specifically the Orb) staying stuck at 50% width.',
    ]
  },
  {
    version: 'v0.5.104',
    date: '2026-06-01',
    changes: [
      'Eliminated mobile bottom tab switcher and repositioned tab controls to the top command bar.',
      'Adapted top header toggles on mobile to act as view switchers ("Orb" and "List") instead of pane toggles, keeping desktop layout side-by-side toggles completely unchanged.',
      'Added mobile-only CSS styles for active toggle highlights in the command bar.',
    ]
  },
  {
    version: 'v0.5.103',
    date: '2026-06-01',
    changes: [
      'Corrected mobile breakpoint threshold to < 768px (down from < 1024px) to ensure tablet/iPad views and resized desktop browser viewports remain in side-by-side split screen mode.',
      'Restored original panel toggle handlers and DragDivider layouts on desktop screens.',
    ]
  },
  {
    version: 'v0.5.102',
    date: '2026-06-01',
    changes: [
      'Implemented Adaptive Viewport layout for Unified Dashboard, enabling full-screen tab switching on viewports < 1024px and side-by-side split screen on viewports >= 1024px.',
      'Designed and added mobile-only bottom navigation bar utilizing existing SVG icons for Orb Assistant and Task Backlog.',
      'Applied CSS-driven visibility: hidden toggling on inactive mobile tabs to preserve scroll positions, cursor focus, and DOM state without unmounting.',
    ]
  },
  {
    version: 'v0.5.101',
    date: '2026-06-01',
    changes: [
      'Updated the mobile layout proposal (docs/mobile_dashboard_layout_proposal.md) to address separate screens on mobile vs. split-screen on desktop.',
    ]
  },
  {
    version: 'v0.5.100',
    date: '2026-06-01',
    changes: [
      'Added the conceptual paper "The Speed Illusion: Why AI-Assisted Software Engineering Still Takes Months" to project documentation.',
    ]
  },
  {
    version: 'v0.5.99',
    date: '2026-06-01',
    changes: [
      'Consolidated health and version polling into a unified SystemStateProvider to eliminate duplicate API requests.',
      'Reduced database connection overhead from maintenance checks by centralizing intervals.',
      'Added a 500ms trailing debounce on window focus/visibility changes to prevent back-to-back fetching.',
      'Optimized polling by relaxing the health check interval to 30s and pausing polling entirely when the document tab is hidden.',
    ]
  },
  {
    version: 'v0.5.98',
    date: '2026-06-01',
    changes: [
      'Kanban view empty column text period fix ("No tasks displayed, check filters.").',
    ]
  },
  {
    version: 'v0.5.97',
    date: '2026-06-01',
    changes: [
      'Kanban view empty column text updated to prompt checking active filters when empty ("No tasks displayed, check filters").',
    ]
  },
  {
    version: 'v0.5.96',
    date: '2026-06-01',
    changes: [
      'Mutation approval protocol: Orb now proposes mutations and waits for user confirmation before executing. Supports multi-action parsing from natural language.',
      'Capability check: Orb now discloses unsupported features (recurring tasks, dependencies, etc.) before proposing — never silently degrades a request.',
      'Fuzzy search for knowledge repo: typo-tolerant matching (edit distance ≤ 2) and word-level matching. "smirtles" now finds "smirttles".',
      'Contextual coaching: Orb weaves relevant observations into mid-conversation responses at natural moments.',
      'UI self-awareness: Orb knows what view, filters, and device the user is on.',
    ]
  },
  {
    version: 'v0.5.95',
    date: '2026-05-31',
    changes: [
      'Kanban drag-and-drop: drag tasks between columns to change status. Works on desktop (HTML5 drag) and mobile (touch drag with floating card clone).',
      'Drop target highlighting: columns glow green when a card is dragged over them. Empty columns show "Drop here" prompt.',
      'Status changes via drag trigger audit logging, ticket propagation, and distill modal on close.',
    ]
  },
  {
    version: 'v0.5.94',
    date: '2026-05-31',
    changes: [
      'Behavioral persistence: Orb now enforces cross-session behavioral rules stored in the knowledge repo (tagged orb-behavior). Agreements made during conversations survive across sessions.',
      'Dev channel message retention: processed/delivered messages purged after 7 days. Pending messages kept indefinitely. Knowledge repo is the permanent record.',
    ]
  },
  {
    version: 'v0.5.93',
    date: '2026-05-31',
    changes: [
      'Developer Channel v2: Orb can now send messages TO developer tools via send_to_developer tool — bidirectional communication complete.',
      'Orb uses send_to_developer for actionable observations: bugs spotted, schema clarifications, verification feedback, task context for implementation.',
      'Developer tools poll GET /api/dev-channel?direction=orb_to_dev to receive Orb messages.',
    ]
  },
  {
    version: 'v0.5.92',
    date: '2026-05-31',
    changes: [
      'Developer Channel: New bidirectional communication channel between external AI developer tools (Claude Code, Gemini CLI) and the Orb conversational AI.',
      'REST API endpoint POST/GET /api/dev-channel — developer tools send messages to the Orb and poll for responses, authenticated via ORB_API_SECRET.',
      'Dev messages appear inline in the Orb conversation UI with a distinct blue-tinted card style and sender label (e.g. "Claude Code (Opus 4.6)").',
      'Restricted tool mode: Orb processes developer messages with read-only tools only — no mutations without Stan\'s approval.',
      'Tab-focus polling: pending dev messages auto-load and process when the Orb UI regains focus.',
      'Knowledge repo integration: all developer-Orb exchanges auto-logged with dev-channel tags.',
    ]
  },
  {
    version: 'v0.5.91',
    date: '2026-05-30',
    changes: [
      'Disk IO fix: Replaced 60-second server-polling urgency check with client-side computation. Eliminates 4 DB queries/minute per open tab.',
      'ORB-188 Phase 1: Extracted view components from UnifiedDashboard monolith — TaskListView, TaskChecklistView, ViewSwitcher now standalone reusable components.',
      'ORB-188 Phase 2: Kanban board view — tasks displayed in columns by status (Open → In Progress → Closed → Deferred → On Hold). Click any card to edit.',
      'Views toolbar: List, Checklist, and Kanban view switching. View preference persists per project.',
      'Urgency transition messages debounced — suppresses duplicate "Orb shifted busy" notifications from transient re-render flicker.',
      'Views button in toolbar now horizontal text, consistent with Sort and Filter buttons.',
      'AmbientDashboard: removed all server urgency polling.',
    ]
  },
  {
    version: 'v0.5.90',
    date: '2026-05-30',
    changes: [
      'ORB-186 Phase 6: Changelog awareness — Orb can answer "what\'s new?" conversationally from the latest 3 releases. Changelog injected into system prompt.',
      'ORB-186 Phase 5: Feedback loop closure — recent tickets loaded into Orb context. Orb references resolved issues and avoids filing duplicates.',
      'ORB-186 Phase 4: Self-diagnostics — diagnose protocol, query_capabilities tool ("what can you do?"), ticket deduplication.',
      'ORB-186 Phase 3: Proactive guidance — context-aware greeting, observations (overdue/stale/closures/workload), respects guidance_level preference.',
      'ORB-186 Phase 2: Adaptive Orb identity — session adaptation, per-user preferences (guidance_level, verbosity, scope_reminders), get/set_preference tools.',
      'ORB-186 Phase 1: Prompt architecture — monolithic system prompt split into Principles, Domain Knowledge, and Behavioral Guidelines layers.',
      'Orb responses render markdown — headers, bold, lists, horizontal rules displayed as formatted text. Copy preserves raw markdown.',
      'Tickets: floating modal for viewing/editing ticket details. Edit button added to Actions column.',
      'Max response tokens increased from 1024 to 4096. Truncated tool calls now return a clear diagnostic error.',
      'Current date injected into system prompt. query_db guards against SQL subquery injection in filter values.',
    ]
  },
  {
    version: 'v0.5.82',
    date: '2026-05-30',
    changes: [
      'Account initial displayed in a circle (nav-avatar) across desktop nav bar and mobile commands modal.',
      'Commands label shown below icon on mobile with vertically centered layout in 44px nav bar.',
      'All icon label text unified to nav-btn-label at 11px — removed duplicate ud-toggle-label class. Single source of truth for icon label sizing.',
      'Check for Update button in Settings > What\'s New. Also available via the Orb ("is there an update?").',
      'Orb now understands urgency rules: knows that overdue due dates AND urgent priorities both trigger the urgent state independently.',
      'Knowledge Repository and Audit Log promoted to their own settings pages with sidebar entries (admin-only).',
      'Data Management page simplified — Backup & Recovery and Task Archival only.',
      'Commands modal close button moved to far right for consistency with other modals.',
      'Staging environment removed from development workflow — two-tier: localhost to production.',
    ]
  },
  {
    version: 'v0.5.81',
    date: '2026-05-30',
    changes: [
      'Table conformity rework: all settings tables now share the same design via SettingsCrudList — consistent headers, row styling, sort indicators, and bulk actions.',
      'Floating modal for all Add/Edit forms — replaces inline row editing across Priorities, Statuses, Platforms, Projects, Knowledge, and Users.',
      'Migrated Users and Invitations to SettingsCrudList — reduced ~1000 lines to consistent config-driven components.',
      'Clickable table rows: tapping any row opens the edit modal (buttons and checkboxes excluded from triggering).',
      'Horizontal scroll arrows on desktop (flanking the table) and mobile (above the table) for all settings tables, Tickets, and Audit Log.',
      'Bulk actions: Tickets now support bulk dismiss with checkboxes. Audit Log now supports bulk delete scoped to the current page.',
      'Audit Log: click any row to view full entry details in a modal. Checkbox select-all resets on page change.',
      'Responsive grid: two-column form layouts collapse to single column on iPhone.',
    ]
  },
  {
    version: 'v0.5.80',
    date: '2026-05-29',
    changes: [
      'Passkey UI is now hidden on non-production domains (localhost, staging) where the WebAuthn RP ID is not configured. Prevents users from hitting an "invalid domain" error when attempting passkey sign-in or registration.',
      'Login page, OTP verification flow, passkey setup prompt, settings sidebar, and passkey settings page all respect the domain check.',
    ]
  },
  {
    version: 'v0.5.79',
    date: '2026-05-29',
    changes: [
      'UnifiedDashboard is now the main dashboard: split-pane Orb + task list with draggable divider replaces the previous ambient-only view. Vertical stack on iPhone, side-by-side on desktop.',
      'Global navigation bar (AppNav): Print, Help, Settings, and Account are now accessible from every page — dashboard, settings, and account. Mobile uses a compact commands button; desktop shows icon buttons in a slim bar.',
      'Orphaned old views: AmbientDashboard and standalone TodoView routes remain available but are no longer the default.',
    ]
  },
  {
    version: 'v0.5.78',
    date: '2026-05-28',
    changes: [
      'Eliminated background polling: removed 60-second interval timer that generated ~15-20 database queries per minute while idle. Data now refreshes only on tab-focus and page-show (wake from sleep). Dramatically reduces Supabase Disk IO usage.',
      'Purged 285 stale auth.flow_state rows (oldest from April) and vacuumed bloated tables.',
    ]
  },
  {
    version: 'v0.5.77',
    date: '2026-05-28',
    changes: [
      'Passkey authentication (admin-only): sign in with Face ID, Touch ID, or device biometric instead of email codes. Passkey-first button on login page, Settings > Passkeys for management, post-OTP enrollment prompt.',
      'Mobile list view (iPhone): todo actions (Edit, Done) now display on the same line as the title instead of wrapping below. Title clamped to 1 line with ellipsis.',
      'Staging environment: orb-staging-azure.vercel.app deploys from staging branch for pre-production testing on any device.',
    ]
  },
  {
    version: 'v0.5.76',
    date: '2026-05-28',
    changes: [
      'Added route loading indicator (app/loading.tsx): breathing orb animation centered on screen during route transitions and initial page load. Uses inline styles for instant render before stylesheets load.',
    ]
  },
  {
    version: 'v0.5.75',
    date: '2026-05-28',
    changes: [
      'Removed quick edit (InlineEditPopover) from list view — full edit modal is the sole edit path.',
      'Fixed OTP cooldown warning flashing briefly during login by deferring cooldown calculation until after hydration, suppressing during loading state, and returning early on success before setLoading(false).',
      'Fixed false-positive maintenance lockout on wake from sleep — middleware, /api/version, and MaintenanceOverlay no longer assume maintenance when network requests fail.',
      'Middleware auth resilience: getUser() retries once after 500ms on failure. Transient auth errors skip login redirect instead of forcing re-authentication.',
    ]
  },
  {
    version: 'v0.5.74',
    date: '2026-05-28',
    changes: [
      'Prototype command bar: Orb toggle now uses the favicon orb icon (radial gradient circle), List toggle uses the grid-table icon from DashboardView. Toggle labels (Show/Hide Orb, Show/Hide List) now visible on all screen sizes.',
      'New todo form now matches the full edit modal — added Description and URLs fields, wired into the database insert.',
      'Edit modal: Description field moved from hidden Details toggle to always-visible, directly below Title.',
      'Next.js dev indicator hidden in production only (preserved in dev for debugging).',
      'Error boundaries: added app/error.tsx (route-level) and app/global-error.tsx (root-level) with Try Again and Refresh buttons.',
      'Error handling audit: added .catch() to all fire-and-forget async calls (push notifications, audit logging, notification dispatch), fixed unchecked Supabase DELETE/SELECT errors in push API and manage-project, fixed unsafe nested await in get-user-detail, added .catch() to all clipboard operations.',
      'DEV panel: added Error Boundaries section with Throw Client Error button for testing error boundaries.',
    ]
  },
  {
    version: 'v0.5.73',
    date: '2026-05-27',
    changes: [
      'Fixed todo list rows not extending full width on iPhone — Actions column header was missing tv-th-actions class, leaving a hidden empty column.',
      'Swapped List toggle and Commands button positions — List is now far right in the command bar.',
      'Project search resilience: retries 2× on empty results, falls back to server-provided projects, shows error with Refresh link, and auto-creates a ticket.',
      'Added close button (×) to the Views bar for discoverability.',
      'List card goes edge-to-edge inside unified dashboard (no border-radius or borders).',
    ]
  },
  {
    version: 'v0.5.72',
    date: '2026-05-27',
    changes: [
      'iPhone command bar redesign: panel toggles (Show/Hide Orb, Show/Hide List) now visible on mobile with centered labels below icons.',
      'Replaced small ⋮ dropdown with a "Commands" button (grid icon + label) that opens a full modal-center floating modal containing Print, Help, Settings, Account.',
      'Project search input centered and wider on mobile (flex: 1 fills available space between toggles).',
      'All mobile command bar button labels (toggles, commands) unified at 10px to match desktop nav-btn-label sizing.',
    ]
  },
  {
    version: 'v0.5.71',
    date: '2026-05-27',
    changes: [
      'Fixed iPhone command bar wrapping: items were stacking vertically instead of staying in a single row. Added flex-wrap: nowrap and restructured for mobile.',
      'Mobile "more" menu: Print, Help, Settings, Account hidden behind a ⋮ menu button on iPhone. Desktop shows them inline as before.',
      'Removed panel toggle buttons on mobile — sidebar toggles are a desktop concept that does not apply to vertical stacking.',
      'Project search input fills available width on mobile instead of being cramped at 120px.',
      'UI Component Catalog: created docs/ui-catalog.md documenting all existing patterns. AGENTS.md updated to enforce catalog-first building.',
    ]
  },
  {
    version: 'v0.5.70',
    date: '2026-05-27',
    changes: [
      'iPhone mobile layout fixes: capped and separated mobile and desktop split-pane size saving in localStorage (using unique key per viewport size).',
      'Hided text labels on panel toggle buttons on mobile screen widths to prevent overcrowding/wrapping.',
      'Designed a responsive thread spacer (.oc-thread-spacer) that shrinks to 60px on mobile to give messages more room.',
      'Compacted command bar padding and gap spacing on mobile viewports.',
      'Restricted search input width on mobile to 120px (140px on focus) to prevent row overflow.',
      'Implemented bottom safe area insets (home indicator bar clearance) on mobile for both conversation panel and task lists.',
    ]
  },
  {
    version: 'v0.5.69',
    date: '2026-05-27',
    changes: [
      'Prototype dashboard: replaced dynamic split-pane toggle icons with static VS Code-style sidebar SVGs.',
      'Added dynamic vertical "Show Orb" / "Hide Orb" and "Show List" / "Hide List" text labels under the layout toggle buttons.',
    ]
  },
  {
    version: 'v0.5.68',
    date: '2026-05-27',
    changes: [
      'Updated AGENTS.md instructions to allow the AI to propose and execute git commit and push commands upon requesting user permission, instead of requiring manual execution.',
    ]
  },
  {
    version: 'v0.5.67',
    date: '2026-05-27',
    changes: [
      'Allowed Super Admins and Admins to insert, update, and delete todos across all projects, and to update and delete projects of other users in Postgres RLS policies.',
      'Ensures both the conversational Orb update_todo tool and the web dashboard UI can successfully edit, close, and delete tasks in other users\' projects without RLS permission constraints.',
    ]
  },
  {
    version: 'v0.5.66',
    date: '2026-05-27',
    changes: [
      'Explicit database grants migration: tightened table permissions — anon gets SELECT only on lookup tables (priorities, statuses, roles, system_settings), authenticated and service_role get CRUD on all user data tables.',
      'Future-proofed with ALTER DEFAULT PRIVILEGES so any new table created via psql automatically gets correct grants without manual intervention.',
      'Prepares for Supabase breaking change (Oct 30, 2026) where new public tables will no longer auto-expose to the Data API.',
    ]
  },
  {
    version: 'v0.5.65',
    date: '2026-05-27',
    changes: [
      'Wrapped all client-side Supabase database queries executing inside useEffect blocks (in AmbientDashboard, UnifiedDashboard, and TodoView) in try/catch and .catch() blocks.',
      'Prevents unhandled runtime errors and uncaught promise rejections from failing network calls on wake-up, ensuring the app handles offline transitions smoothly rather than displaying Next.js developer crash overlays.',
    ]
  },
  {
    version: 'v0.5.64',
    date: '2026-05-27',
    changes: [
      'Added visibilitychange and focus event listeners to the useOnlineStatus hook to trigger immediate connection verification when waking up or focusing the tab.',
      'Prevents stale online status state during sleep/wake transitions, ensuring the custom offline screen displays immediately before browser-level requests occur.',
    ]
  },
  {
    version: 'v0.5.63',
    date: '2026-05-27',
    changes: [
      'Added client-side try/catch wrappers to Server Actions (getUrgencySnapshot, orbGreeting, and notifyIfEscalated) in background loops, mount effects, and click/bulk action handlers.',
      'Prevents unhandled promise rejections when network drops during sleep or wake, allowing the custom OfflinePage overlay to show and recover gracefully.',
      'Fixed a pre-existing React Hook order violation in OfflinePage.tsx by moving the conditional isOnline check after all hook declarations, preventing client-side crashes during offline transitions.',
    ]
  },
  {
    version: 'v0.5.61',
    date: '2026-05-26',
    changes: [
      'Removed project strip from Orb conversation — project selection is now in the command bar search dropdown.',
      'Panel toggle buttons: sidebar icons on command bar edges to show/hide Orb or List pane independently.',
      'Floating edit modal: converted TodoPanel from slide-in panel to centered modal (modal-center).',
      'Admin project search: admins see all projects with owner names in the dropdown; users see only theirs.',
      'Fixed project name font in command bar to use the app font (font-ui) instead of display font.',
    ]
  },
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
