export interface Release {
  version: string
  date: string
  changes: string[]
}

export const CHANGELOG: Release[] = [
  {
    version: 'v0.5.234',
    date: '2026-06-16',
    changes: [
      'Moved Search by Date button inline next to the Reset button for a tighter toolbar layout.',
      'Date range labels now show mm/dd/yy only (removed time component) for a cleaner, more compact display.',
      'Added en-dash separator between stacked date range labels.',
      'Fixed scroll navigation arrows not detecting table overflow after toolbar layout changes.',
    ]
  },
  {
    version: 'v0.5.233',
    date: '2026-06-16',
    changes: [
      'Audit Log search now requires explicit submit (Enter key or send button) instead of firing on every keystroke, dramatically reducing server calls.',
      'Text search and date filter work simultaneously — removed the Search by... mode switcher that forced choosing one or the other.',
      'Added a Reset button that clears all active filters (text and date) in one click.',
      'Removed frozen columns from the Audit Log table for a cleaner scrolling experience.',
      'Fixed horizontal scroll navigation arrows not detecting table overflow on the Audit Log page.',
      'Refactored CrudList data loading to use a stable load function with a single request key, eliminating cascading reloads from state changes.',
      'Corrected Orb send button tooltip from "Send (Shift+Enter)" to "Send (Enter)".',
    ]
  },
  {
    version: 'v0.5.232',
    date: '2026-06-14',
    changes: [
      'Added a development-only Table Tuning mode available to every rendered table, so column widths can be set visually by dragging instead of reasoning about pixel values.',
      'Added spreadsheet-style Freeze through and Unfreeze controls, local draft persistence, a visible frozen-column divider, and configuration export with viewport and scroll measurements.',
      'Table Tuning now detects Mac, iPad, and iPhone and stores independent width and frozen-column presets for each platform.',
      'Applied the approved Audit Log Mac table preset: 38/128/140/140/79/140/140/140/140px with no frozen columns on Mac.',
      'Standardized circular navigation controls with strict 44×44 bounds that remain circular in iOS Safari, plus clear hover and pressed feedback.',
      'Moved Audit Log Created filtering beside text search with explicit captions for text-field search and create-date search, and removed the duplicate timezone helper text from the toolbar.',
      'Added a compact standard green Search by... dropdown for Audit Log: Text fields mode shows only the text field, while Created date mode hides and clears text search, shows the Created filter button, and opens the date filter modal.',
      'Moved the Audit Log User column to the first data position and made it the single frozen data column on every platform.',
      'Moved table column navigation to the far right of the table toolbar as a borderless prev/next columns group with compact 40px circular arrow buttons and tooltips; pagination controls continue using the shared circular pattern.',
      'Restyled the New Task create modal to use the canonical centered modal system with clearer labels, grouped metadata, and a calmer footer.',
      'Polished the Audit Log Created date-time filter modal with canonical body padding, top-right close alignment, and clearer local-time copy.',
      'Strengthened the UI catalog and agent instructions with a Lego-style assembly protocol: pick the catalog family, inspect a canonical implementation, reuse the structure, ask when multiple patterns fit, and ask whether to add a missing catalog pattern before creating one.',
      'Audit text search now covers Table, Action, historical User identity, Actor, Record, Before, and After through a maintained trigram index and database search function, with no hidden result caps, literal punctuation handling, and accurate pagination counts.',
      'Added a dedicated timezone-aware Created filter with On, At or before, At or after, and Between conditions. Timestamps display in the browser timezone, while audit details retain canonical UTC.',
      'Audit entries now snapshot user name and email at event time, preserving historical identity when a user later changes either value.',
      'Audit loading failures now remain visible errors instead of being mistaken for empty search results.',
    ]
  },
  {
    version: 'v0.5.231',
    date: '2026-06-14',
    changes: [
      'ORB-256: Export conversation as markdown — downloads a .md file with speaker headings and thoughts as blockquotes. Uses native save dialog on Chrome/Edge, standard download on Safari.',
      'Renamed existing clipboard "Export" to "Copy" in the More menu to distinguish from the new file export.',
    ]
  },
  {
    version: 'v0.5.230',
    date: '2026-06-14',
    changes: [
      'Added Passkeys section to Help page — how they work, managing them, and troubleshooting stale browser credentials.',
      'Split Learn More passkey dialog into two paragraphs for readability.',
      'Fix: dismissing the passkey registration prompt no longer shows an error.',
    ]
  },
  {
    version: 'v0.5.229',
    date: '2026-06-14',
    changes: [
      'Fix: dismissing the passkey registration prompt no longer shows an error — NotAllowedError is now treated as a silent cancellation.',
    ]
  },
  {
    version: 'v0.5.228',
    date: '2026-06-14',
    changes: [
      'Account page polish: split Name, Email, and Passkeys into separate cards. Sign Out button on Account header line with green outlined styling.',
      'Modal consistency: Change Name and Learn More dialogs now match Change Email padding and structure exactly.',
      'Mural opacity: added semi-opaque backdrop to account page so mural bleeds through subtly on iPad and iPhone.',
      'Increased global border prominence (0.15 → 0.25) for better card definition.',
    ]
  },
  {
    version: 'v0.5.227',
    date: '2026-06-14',
    changes: [
      'ORB-263: Redesigned Account details as clear Name and Email rows with matching Change name and Change email dialogs, removing the ambiguous always-visible fields and Save button.',
      'Moved Sign Out beside the Account heading and added the calm mural background to the page.',
      'Replaced the passkey explanation card with a Learn more button and focused explanation dialog; passkey actions now adapt cleanly across desktop, iPad, and iPhone.',
    ]
  },
  {
    version: 'v0.5.226',
    date: '2026-06-14',
    changes: [
      'Developer-channel messages now appear promptly as blue conversation cards through a dedicated visible-tab poll, without using Supabase Realtime.',
      'The channel checks on mount, window focus, visibility return, BFCache restore, and every 15 seconds while visible; the existing in-flight guard prevents duplicate processing.',
    ]
  },
  {
    version: 'v0.5.225',
    date: '2026-06-14',
    changes: [
      'ORB-247: Prevented overlapping Orb submissions from prematurely hiding the processing indicator, re-enabling input, or replacing the red Stop button while a request is still running.',
      'Orb conversation stop and completion state is now scoped to each request, so a stopped stream cannot interfere with a newer request while it finishes unwinding.',
    ]
  },
  {
    version: 'v0.5.224',
    date: '2026-06-13',
    changes: [
      'ORB-262: Simplified email change flow — no sign-out or OTP needed. Session refreshes in place and user is taken directly to passkey registration.',
      'ORB-262: Setup-passkey page shows contextual messaging when arriving from an email change.',
    ]
  },
  {
    version: 'v0.5.223',
    date: '2026-06-13',
    changes: [
      'ORB-262: Instant email change via admin API — no confirmation email, passkeys deleted server-side, users/invitations synced automatically.',
      'ORB-262: Simplified email change modal — calls server action, signs out, redirects to guided passkey re-registration.',
      'Fixed Supabase MFA deleteFactor param name (factorId → id) in email change and auth callback.',
    ]
  },
  {
    version: 'v0.5.222',
    date: '2026-06-13',
    changes: [
      'ORB-262: Migrated passkey management from Settings to the Account page — passkeys belong to the user, not the system.',
      'ORB-262: Email change modal — guided flow with validation, current email displayed read-only, passkeys auto-deleted on change, user guided through full re-registration.',
      'ORB-262: Added "Account" page title.',
      'ORB-260: Split compound Data page into separate Backup and Archive sidebar entries — each page does one thing.',
      'ORB-260: Removed breadcrumb system (SettingsTopbar, Breadcrumbs, BreadcrumbOverridesProvider) — sidebar is now the sole Settings navigation.',
      'ORB-260: Added inline back links on admin detail sub-pages (user detail, project todos).',
    ]
  },
  {
    version: 'v0.5.219',
    date: '2026-06-13',
    changes: [
      'ORB-261: Passkey delete now signs user out and redirects to an explanation page, preventing stale browser credentials from causing confusion.',
      'ORB-261: Dedicated email-only re-registration login page — no passkey button, no conditional mediation, clear context that this is part of passkey re-registration.',
      'ORB-261: Email is pre-filled through the entire re-registration flow (delete → removed page → email login).',
      'ORB-261: Passkey delete UI uses warning (amber) styling instead of danger (red) for buttons and explanatory text.',
      'ORB-261: Fixed last-passkey delete warning to explain re-registration path instead of implying email-only forever.',
      'Removed 30-second polling from SystemStateProvider — health and version checks now only fire on mount, tab focus, visibility change, and online events.',
      'Added 60-second in-memory cache to /api/version route to reduce redundant Supabase queries.',
    ]
  },
  {
    version: 'v0.5.215',
    date: '2026-06-12',
    changes: [
      'ORB-258: Removed fixed-position version label from all pages; version now lives only in the Settings sidebar.',
      'ORB-259: Unified topbar — every page now uses the same AppNav component with a consistent Menu (Settings, Help, Print) and "Dashboard" back link.',
      'Menu items are grayed out on the page you are currently viewing.',
      'Deleted dead code: UnifiedView.tsx and AmbientDashboard.tsx (neither was routed).',
      'Orb toolbar More menu now anchors correctly on all platforms (left on iPhone, right on desktop/iPad).',
    ]
  },
  {
    version: 'v0.5.214',
    date: '2026-06-12',
    changes: [
      'ORB-248: Prev and Next input history buttons are now inline on the Orb toolbar on desktop and iPad, reducing two taps to one for high-frequency navigation.',
      'Prev and Next remain behind More on iPhone where horizontal space is constrained.',
      'AppNav top bar: replaced the "More" grid icon with a gear icon and "Menu" label to distinguish it from the Orb toolbar More button.',
    ]
  },
  {
    version: 'v0.5.213',
    date: '2026-06-12',
    changes: [
      'ORB-249: Bumped all settings table text from --fs-xs to --fs-sm so table content matches the rest of the app.',
      'Mobile card titles bumped from --fs-sm to --fs-base; card code, date, and meta bumped from --fs-xs to --fs-sm.',
    ]
  },
  {
    version: 'v0.5.212',
    date: '2026-06-12',
    changes: [
      'Orb now distinguishes unknown facts from ambiguous visual referents instead of searching source code to guess which repeated control a user means.',
      'Under-specified UI references such as "the kebab", "that button", or "this menu" trigger one concise location-based clarification before repository inspection.',
      'Added a behavioral eval requiring the ambiguous List-pane kebab question to ask which control the user means without calling a tool.',
    ]
  },
  {
    version: 'v0.5.211',
    date: '2026-06-12',
    changes: [
      'Fixed intermittent Orb conversations remaining visually stuck on Processing after a stream or tool loop ended.',
      'The Stop control now remains available whenever any Orb response is still marked as streaming, even if parent submission state has already cleared.',
      'Stop and final cleanup now settle orphaned streaming messages across both dashboard variants.',
      'Conversational model turns time out after 60 seconds, repository production requests after 15 seconds, and exhausted tool loops return an explicit retry message instead of ending silently.',
    ]
  },
  {
    version: 'v0.5.210',
    date: '2026-06-12',
    changes: [
      'ORB-252: Orb can inspect allowlisted source files with list, search, and ranged read operations.',
      'Localhost Orb can inspect both the live working tree and the source bundled with the current Vercel production deployment; production Orb reads its current deployed bundle.',
      'Repository inspection is restricted to Admin, Super Admin, and the new Developer role without granting Developer access to admin-only settings or data.',
      'Repository paths, file types, file sizes, and result sizes are constrained to prevent traversal, configuration/secret reads, and oversized responses.',
    ]
  },
  {
    version: 'v0.5.209',
    date: '2026-06-12',
    changes: [
      'ORB-255: Knowledge Repository filtering now searches the full dataset before pagination, including title, content, project, and tags.',
      'Audit Log now has global filtering by table, action, actor, or full record ID.',
      'Sortable columns on both paginated pages now sort the complete result set instead of only the visible page.',
      'Search is debounced, filtered counts are accurate, criteria changes return to page one, and stale responses cannot replace newer results.',
    ]
  },
  {
    version: 'v0.5.208',
    date: '2026-06-12',
    changes: [
      'ORB-246: Fixed markdown tables not rendering in Orb conversation view — added remark-gfm plugin to react-markdown.',
      'Added table styles for Orb messages: collapsed borders, header background, alternating row stripes.',
      'GFM extensions now active: tables, strikethrough, autolinks, and task list checkboxes.',
    ]
  },
  {
    version: 'v0.5.207',
    date: '2026-06-12',
    changes: [
      'ORB-244: Removed Priorities, Statuses, and Platforms from the settings menu — these are not user-changeable.',
      'Removed the Platforms pill selector from the todo edit panel and new todo form.',
      'Deleted SettingsPriorities, SettingsStatuses, SettingsPlatforms components and their page routes.',
    ]
  },
  {
    version: 'v0.5.206',
    date: '2026-06-12',
    changes: [
      'ORB-243: Aligned all touch-tier font sizes with the phone tier so iPad and iPhone render identically — --fs-version 13px, --fs-xs 14px, --fs-sm 17px, --fs-base 16px, --fs-input 17px, --fs-lg 20px, --fs-xl 24px.',
    ]
  },
  {
    version: 'v0.5.204',
    date: '2026-06-12',
    changes: [
      'ORB-238: Simplified the Orb conversation command toolbar so Mac, iPad, and iPhone all use the same compact More overflow model for secondary actions.',
      'Removed the viewport-specific desktop inline command group from the Orb input toolbar, leaving Cmds, Voice, Send/Stop, and More as the consistent command surface.',
    ]
  },
  {
    version: 'v0.5.203',
    date: '2026-06-11',
    changes: [
      'Build fix: Corrected FilterKebab event typing so React keyboard events and document-level DOM KeyboardEvent handlers no longer conflict during production type checking.',
    ]
  },
  {
    version: 'v0.5.202',
    date: '2026-06-11',
    changes: [
      'Accessibility hardening (ORB-239): Added named dialog semantics to the project switcher, Commands modal, Distill Knowledge modal, Settings CRUD modal, and Audit Entry modal.',
      'Form accessibility: Associated visible labels with previously weakly-named form controls in query results editing, category settings, and generic settings filters.',
      'Destructive actions: Added descriptive confirmation text wiring for todo delete, bulk todo delete, query-result delete, and settings delete confirmation flows.',
      'Filter keyboard behavior: Updated FilterKebab to use a menu/menuitemradio pattern with Arrow, Home, End, Escape, Enter, and Space keyboard support.',
    ]
  },
  {
    version: 'v0.5.201',
    date: '2026-06-11',
    changes: [
      'Interaction polish pass (ORB-196): Replaced bare loading text with animated SkeletonRows across main dashboard views and settings screens.',
      'Empty states: Added Orb-illustrated empty states to task views and query results so blank screens feel intentional.',
      'Filter presentation: Replaced native status/priority filter selects in UnifiedDashboard and TodoView with styled FilterKebab menus and close controls.',
      'Modal conformity: Standardized modal footers around btn-cancel, btn-primary, and btn-danger patterns.',
      'Copy cleanup: Standardized user-facing language to "Ask Orb" and added a clearer SearchModal header with close control.',
      'Resize handle visibility (ORB-241): Made the split-pane divider easier to discover, added active drag feedback, separator semantics, and a 40px coarse-pointer gutter for touch devices.',
      'Project switcher clarity (ORB-242): Renamed the top command bar "Search" action to "Change Project", updated its icon, and changed the project-switcher dialog title to "Change Project".',
    ]
  },
  {
    version: 'v0.5.193',
    date: '2026-06-10',
    changes: [
      'Unified toolbar (ORB-196): Merged AppNav + CommandBar two-bar chrome (~92px) into a single unified toolbar (~48px). Same layout on all screens — no desktop/mobile split.',
      'Toolbar layout: [Orb] ··· [Search][+Project] | [More][Account] ··· [List]. Spacers maintain balanced positioning at all viewport widths.',
      'Search modal: New reusable SearchModal component — auto-focus, keyboard navigation (↑↓ Enter Esc), filtered results, frosted overlay with slide-in animation.',
      'Orb/List edge buttons: Accent-colored paired toggles. Desktop labels show "Show"/"Hide" based on pane state. Mobile: grayed when current tab, active when tappable.',
      'Commands modal: Print, Help, and Settings grouped under More button. Account is standalone.',
      'Modal footer fix: Added gap between Cancel and Create buttons to prevent overlap on narrow viewports.',
    ]
  },
  {
    version: 'v0.5.192',
    date: '2026-06-10',
    changes: [
      'Text-a-Palooza (ORB-237): Complete CSS variable uniformity sweep across 40 files.',
      'Font sizes: All 51 hardcoded pixel sizes in globals.css + ~80 inline component sizes replaced with --fs-* variables. Three-tier responsive scaling: desktop, tablet (touch), phone.',
      'Font weights: Added --fw-light (300), --fw-semibold (600). Replaced ~115 hardcoded weights across CSS and components with --fw-* variables.',
      'Font families: Defined --font-mono variable. Replaced all bare "monospace" references (7 CSS + 13 components) with var(--font-mono).',
      'Line height: Added --lh-none (1) through --lh-loose (1.8). Replaced ~48 hardcoded values across CSS and components.',
      'Letter spacing: Added --ls-tight (-0.02em) through --ls-widest (0.12em). Replaced ~40 hardcoded values across CSS and components.',
      'Opacity: Added --opacity-disabled (0.7) and --opacity-muted (0.55). Normalized all 11 disabled states (previously ranging 0.3–0.7) to a uniform 0.7. Replaced ~27 hardcoded values.',
      'Tablet touch tier: iPad now gets intermediate font bumps via @media (hover: none) and (pointer: coarse) — was previously getting desktop-only sizes.',
      'Broadcast localStorage cleanup: Stale broadcast_dismissed_* keys purged when broadcast changes.',
    ]
  },
  {
    version: 'v0.5.191',
    date: '2026-06-10',
    changes: [
      'Fix mobile More kebab dropdown (ORB-236): matched Cmds button pattern — onMouseDown preventDefault + onClick with textarea refocus. Stripped failed workarounds (handleTouchOrClick, onTouchStart, document listeners, delayed blur).',
      'More menu beautified: green-bordered box matching slash menu style, group headers (Input/Transcript), label + description per item, monospace labels, 0.7 disabled opacity.',
    ]
  },
  {
    version: 'v0.5.190',
    date: '2026-06-10',
    changes: [
      'Attempted fix for mobile More kebab: replaced backdrop with document-level click-outside hook. Did not resolve the issue.',
    ]
  },
  {
    version: 'v0.5.189',
    date: '2026-06-09',
    changes: [
      'Attempted fix for mobile More kebab: delayed blur handling and handleTouchOrClick utility. Did not resolve the issue.',
    ]
  },
  {
    version: 'v0.5.188',
    date: '2026-06-09',
    changes: [
      'Broadcast message types: info (green), warning (amber), urgent (red). Full-color solid banners with white text, replacing translucent style.',
      'Broadcast admin UI: Styled toggle buttons for type selection, Enter-to-send, delete-based clear (fixes previous upsert-null failure).',
      'Help converted from modal overlay to /help route. Inherits root layout banners automatically. Back button uses router.back().',
      'Mobile toolbar declutter (ORB-235): Cmds + Voice + Send/Stop always visible. Secondary actions (Prev, Next, Copy, Log, Clear) in a More kebab overflow menu on touch devices.',
      'Orb input border permanently visible (opacity 0.28 → 0.55). Placeholder changed to "Type / or ask the Orb anything...".',
      'Body flex column layout: banners stack above pages naturally. dash-main and sl-page use flex:1 instead of height:100dvh.',
      'Broadcast banner font size corrected to var(--fs-sm). Word wrap enabled (removed nowrap/overflow clipping).',
      'Known issue: More kebab button does not activate on iPhone/iPad — handed off to Antigravity (WIP.md).',
    ]
  },
  {
    version: 'v0.5.187',
    date: '2026-06-09',
    changes: [
      'Broadcast messages: Admin can send a banner message visible to all users from Settings > Maintenance. Users can dismiss individually; new broadcasts reset dismissal.',
      'BroadcastBanner component: Blue-tinted strip below maintenance banner, dismiss persisted in localStorage keyed by broadcast ID.',
      'API billing error handling: Added "usage limits" detection to Orb error handler. Friendly user message + urgent admin email with specific reason and Anthropic console link.',
      'Send/stop button restyle: oc-action-circle base class (32×32 circular), oc-send-btn (green), oc-stop-btn (red). iOS Safari deformation fix with explicit dimension constraints.',
      'Exported getResend and ICON_URL from lib/email.ts for reuse in orb-converse.ts urgent email.',
    ]
  },
  {
    version: 'v0.5.186',
    date: '2026-06-09',
    changes: [
      'Button-paloza (ORB-235): Audited all buttons across the app and brought non-conforming ones into conformity with established CSS classes.',
      'DashboardProducts: Replaced all Tailwind utility button classes (bg-zinc, text-red, hover:text-zinc) with standard btn-primary, btn-cancel, btn-outline, btn-danger-confirm, btn-row-action classes.',
      'PrintModal: Replaced inline-styled buttons and phantom pf-btn-secondary class with btn-cancel and btn-primary. Footer uses modal-footer pattern.',
      'DeclineForm: Replaced fully inline-styled decline button with auth-submit class.',
      'MaintenanceBanner & UpdateBanner: Replaced inline-styled banner buttons (with JS hover handlers) with new btn-banner CSS class. Warning variant: btn-banner--warning.',
      'SettingsPasskeys: Removed inline fontSize/padding overrides, using btn-sm modifier. Delete button now uses btn-danger-confirm instead of btn-cancel with inline color override.',
      'SettingsTickets: Removed inline size overrides on mobile card action buttons, using btn-sm modifier.',
      'New CSS: oc-action-circle (32×32px circular button base), oc-stop-btn (red stop icon — was inline-only), oc-send-btn restyled as circle. Send and stop buttons now share consistent circular shape.',
      'New CSS: btn-banner (small uppercase pill for floating banners), btn-banner--warning (amber variant), btn-sm (compact size modifier for any button class).',
      'UnifiedDashboard: Cleaned up inline style overrides on retry link and Load More button.',
    ]
  },
  {
    version: 'v0.5.185',
    date: '2026-06-09',
    changes: [
      'Zero-project empty state: List pane shows "No projects yet." with a Create Project button instead of stuck "Loading..." spinner.',
      'Project CRUD from list pane: "+ Project" button in command bar (right of search). Kebab menu next to project title with Edit Project and Delete Project (two-step confirm, danger color).',
      'Project search dropdown scoped by role: non-admins use server-provided projects (no cross-user query), eliminating false-positive error logging for users with zero projects.',
      'New projects immediately appear in both the list pane and the project search dropdown.',
      'UI catalog rule: Kebab = action overflow on an item. Gear = navigation to a settings page.',
    ]
  },
  {
    version: 'v0.5.184',
    date: '2026-06-08',
    changes: [
      'Table headings: Green background (--btn-primary-bg) with white text, centered. Matches dashboard button styling. Applied to all tables including Audit Log and Friction.',
      'Standardized action columns: New .action-cell and .action-link CSS classes. 2 actions = both as links, 3+ = primary link + kebab. Action td uses stopPropagation so clicking empty space does not trigger row edit. Applied to Priorities, Platforms, Statuses, Projects, Users, Knowledge, Tickets, Invitations, Friction.',
      'Removed Order column and reordering arrows from Platforms and Statuses tables.',
      'Invitations: Replaced btn-primary/oc-tool-btn action buttons with action-link + kebab pattern (Resend link, Decline Link + Delete in kebab).',
      'Audit Log: Rewritten to use SettingsCrudList with server-side pagination, column resize, bulk delete, and detail modal. No longer a standalone component.',
      'SettingsCrudList: Added pagination support (config.pagination), headerExtra slot, and onRowClick override.',
      'iPad touch stability: touch-action on table and resize handles, overscroll-behavior-x: contain on scroll container.',
    ]
  },
  {
    version: 'v0.5.183',
    date: '2026-06-08',
    changes: [
      'Tickets overflow menu: Replaced inline action buttons with vertical kebab dropdown. Edit stays visible, Create todo/Dismiss/Delete in overflow menu. Actions column shrunk from 18% to 10%, left-aligned, Edit and kebab spaced apart.',
      'New .btn-overflow CSS class: 44px min hit target, 28px vertical kebab, hover state. Reusable standard for overflow menus.',
      'Column width reset: Invalidated stale localStorage widths (v2 key prefix). Added "Reset columns" link next to subtitle when custom widths are active.',
    ]
  },
  {
    version: 'v0.5.179',
    date: '2026-06-08',
    changes: [
      'Simplify Priorities settings: Removed the Order column and reordering arrows. Priorities are now a fixed sequential list (1-4). Renumbered existing priorities to close the gap from a deleted entry (1,2,4,5 → 1,2,3,4). The ON UPDATE CASCADE FK ensures all todos were updated automatically. Redistrubuted column widths across the remaining 4 columns.',
    ]
  },
  {
    version: 'v0.5.178',
    date: '2026-06-08',
    changes: [
      'Fix single-column resize (ORB-223): Only the dragged column now changes width during resize. Other columns stay at their exact pixel widths via min-width/max-width locking. Table width tracks the actual sum of column widths — shrinks when columns are narrower, grows when wider. When columns exceed the viewport, horizontal scroll activates and nav arrows appear. Fixed TypeScript errors in spacer cell logic.',
    ]
  },
  {
    version: 'v0.5.176',
    date: '2026-06-08',
    changes: [
      'Table Column Resizing Clamps and Ellipsis (ORB-233): Clamped the minimum column width to 60px to prevent columns from being collapsed out of view. Added text-overflow ellipsis to table header labels to prevent wrapping and layout shift when columns are resized to be small. Removed the hardcoded max-width: 280px constraint from audit cells to allow text in wider columns to fully expand. Added minWidth: \'100%\' to the table to eliminate empty right-side gaps when column widths are narrow. Integrated localStorage state persistence for column widths and refactored measurements to occur exclusively on drag start rather than header click, ensuring header clicks for sorting remain responsive without locking widths prematurely.',
    ]
  },
  {
    version: 'v0.5.175',
    date: '2026-06-08',
    changes: [
      'Assisted Ticket Lifecycle Progression Bugfixes (ORB-190): Fixed mapping of linked_todo in the settings tickets load query to correctly populate the Linked todo column, show the Todo Closed warning badge, and hide the Create todo action when a linked todo is in progress.',
      'Email Message Override Saving: Fixed the Edit Ticket modal to correctly save custom email message overrides into the resolution_notes database column.',
      'Bi-directional Link Resetting: Configured updateTicket and updateTicketStatus to bi-directionally sever the connection between a ticket and its associated todo (by setting todo_id and ticket_id to null) when the status is changed back to Open.',
      'Table Column Resizing: Omitted the column resize handle on the last column (Actions) of SettingsCrudList to prevent layout instability.',
    ]
  },
  {
    version: 'v0.5.174',
    date: '2026-06-08',
    changes: [
      'Assisted Ticket Lifecycle Progression (ORB-190): When a linked todo is closed, the system now prompts the developer/admin to decide the ticket\'s status and review reporter notifications rather than closing the ticket automatically.',
      'Warning badges and alert banners: Added a visual amber warning badge (Todo Closed) in the tickets list rows and mobile card views, and an alert banner at the top of the Edit Modal form when a linked todo is completed.',
      'Conversational Orb context and prompts: Updated backlog query to fetch and format linked tickets (e.g. [Linked: TICKETS-N]), return linked_ticket status updates from update_todo, and inject a custom verification prompt instructing the Orb to prompt the user to transition the ticket.',
    ]
  },
  {
    version: 'v0.5.173',
    date: '2026-06-08',
    changes: [
      'Service error UX: Human-readable error messages for API failures (overloaded, rate limit, billing, network) replace opaque "System error." Amber card styling for service errors. Admin email + auto-ticket on billing/credit exhaustion. DEV panel: simulate billing and overloaded errors, toggle anchored at bottom.',
      'Server-enforced mutation verification (ORB-225): Try/catch per tool handler, _verification signals in mutation tool results, tightened prompt, code-fabrication eval case.',
    ]
  },
  {
    version: 'v0.5.171',
    date: '2026-06-07',
    changes: [
      'Two-Turn Mutation Verification: Rewrote ORB_MUTATION_VERIFICATION protocol prompt in lib/orb-prompt.ts to explicitly structure all database mutations and ticket creations as strict two-turn processes, ensuring the first turn only proposes the action using future tense and prohibits any past-tense success claims or guessed ID codes.',
    ]
  },
  {
    version: 'v0.5.170',
    date: '2026-06-07',
    changes: [
      'Refine Ticket Code Verification: Updated ORB_MUTATION_VERIFICATION protocol prompt in lib/orb-prompt.ts to explicitly mandate that the Orb report the generated ticket code (e.g. TICKETS-xxx) in its second-turn confirmation response for both proactive and user-requested ticket creations.',
    ]
  },
  {
    version: 'v0.5.169',
    date: '2026-06-07',
    changes: [
      'Fix Ticket Code Propagation: Modified the create_ticket tool result handler inside app/actions/orb-converse.ts to return the generated ticket code (e.g., TICKETS-xxx) in the tool output object and streamed thought updates, enabling the Orb to successfully state the specific ticket code to the user after verification.',
    ]
  },
  {
    version: 'v0.5.168',
    date: '2026-06-07',
    changes: [
      'Verify Tickets and Mutation Success (ORB-225): Appended ORB_MUTATION_VERIFICATION guidelines to the system prompt in both app/actions/orb-converse.ts and app/api/orb-eval/route.ts. This protocol prohibits the Orb from claiming success or reporting code/ID values before mutation tools run (first turn), and mandates verifying the tool results and explicitly reporting failures on error (second turn).',
      'Added Mutation Verification Eval Cases: Appended Tier 2 regression cases (mutation-no-premature-success and ticket-no-premature-success) to scripts/eval-cases.ts to verify the Orb does not output premature success claims or cite codes in the initial tool execution turn.',
    ]
  },
  {
    version: 'v0.5.167',
    date: '2026-06-07',
    changes: [
      'Fix Ticket Edit Modal Todo Pollution: Decoupled editing state from create-todo state in SettingsTickets. Defined a new editingTicketId state variable specifically for tracking the ticket being modified inside the Edit modal, preventing the row from rendering the inline "Create todo" form upon opening or closing the Edit modal.',
      'Add onClose Callback Support: Extended SettingsCrudList component configuration (CrudConfig) with an onClose callback, invoked inside closeModal, to clean up editing state in parent views cleanly.',
    ]
  },
  {
    version: 'v0.5.166',
    date: '2026-06-07',
    changes: [
      'Standardize Edit Modals (ORB-222): Unified all edit modals to use modal-center with width modifiers (modal-sm, modal-lg, modal-compose). Close button enlarged to 28px/44px hit target. Form fields now use --fs-input on phone for consistent legibility.',
      'New compose modal pattern (modal-compose): 920px two-column layout for form + live preview, stacks on narrow viewports. Used by SettingsTickets edit form.',
      'Migrated AddProductModal (apm-*) and DistillModal (dm-*) to standard modal-center. Removed all custom modal CSS classes.',
      'Deleted dead prototype code: SettingsCrudListV2, SettingsTicketsPrototype, /settings/tickets-prototype route.',
      'Stripped all inline fontSize overrides from SettingsTickets edit form — now uses pf-* classes throughout.',
    ]
  },
  {
    version: 'v0.5.165',
    date: '2026-06-07',
    changes: [
      'Judgment-Driven Resolution (ORB-205): Added ORB_RESOLUTION_LAWS prompt block enforcing three epistemic laws — Resolve Before Escalating, Name Your Uncertainty, No Lazy Escalation. The Orb must now search with its tools before presenting options for factual questions, and only escalate to the user when genuine intent ambiguity remains.',
      'Added eval cases: resolve-duplicate-searches-first (Tier 1) and no-lazy-escalation-on-lookup (Tier 2) to catch regressions.',
    ]
  },
  {
    version: 'v0.5.164',
    date: '2026-06-07',
    changes: [
      'Admin Zero-Task Project Display Fix: Conditionally disabled the created_by owner filter on visibleProjectsQuery inside dashboard pages (dashboard, prototype) and components (AmbientDashboard, UnifiedDashboard) if the user is an admin. This ensures that switching to another user\'s project (which may have 0 tasks) properly resolves the project metadata and displays the name on the Orb face and list headers.',
    ]
  },
  {
    version: 'v0.5.163',
    date: '2026-06-07',
    changes: [
      'Orb Face Project Name Clamping (ORB-223): Updated the Orb face to render the uppercase project name instead of its code, dynamically clamping the string based on DM Sans 11px font metrics to ensure it fits within half the circumference (182px).',
    ]
  },
  {
    version: 'v0.5.162',
    date: '2026-06-06',
    changes: [
      'Dev Button Standardization: Updated the DEV button (.btn-dev) to use the standard primary button CSS variables for its background, border, hover, and active states.',
    ]
  },
  {
    version: 'v0.5.161',
    date: '2026-06-06',
    changes: [
      'Button Color Calibration: Adjusted standard button variables to be slightly lighter (#408040 default, #2d5a2d hover, and #204020 active) for improved overall visual balance and readability across the app.',
    ]
  },
  {
    version: 'v0.5.160',
    date: '2026-06-06',
    changes: [
      'Task List Toolbar Buttons Standardization: Changed Sort, Filter, and Views from outline style to standard solid green buttons (using --btn-primary-bg) by default, and dark green (using --btn-primary-active-bg) when active/pressed, with a permanent white background for the Filter badge for high legibility.',
    ]
  },
  {
    version: 'v0.5.159',
    date: '2026-06-06',
    changes: [
      'Task List Toolbar Buttons Restyling: Standardized Sort, Filter, Views, and New buttons using standard primary button CSS variables. Redesigned Filter badge (.tv-badge) to invert colors (white background, green text) when the Filter button is active (pressed) for clean visual contrast.',
    ]
  },
  {
    version: 'v0.5.158',
    date: '2026-06-06',
    changes: [
      'Button CSS Variables Refactor: Introduced global --btn-primary variables (--btn-primary-bg, --btn-primary-hover-bg, --btn-primary-active-bg) in globals.css root so that both primary buttons (.btn-primary) and conversation toolbar buttons (.oc-tool-btn) share the same design-system tokens for consistent propagation.',
    ]
  },
  {
    version: 'v0.5.157',
    date: '2026-06-06',
    changes: [
      'Orb Conversation Toolbar Buttons styling: Lightened the default unhovered background and border color to #387038 to provide clearer visual contrast with the hover and active states.',
    ]
  },
  {
    version: 'v0.5.156',
    date: '2026-06-06',
    changes: [
      'Orb Conversation Toolbar Buttons styling: Updated button states (non-hovered, hovered, active, disabled) to a darker forest green theme to match the Enable Push Notifications button aesthetic.',
    ]
  },
  {
    version: 'v0.5.155',
    date: '2026-06-06',
    changes: [
      'Responsive CRUD tables (ORB-221): scope filters with >5 options now render as a dropdown instead of pills, reducing visual clutter on all viewports.',
      'Mobile card layout: Tickets page renders as tappable cards on iPhone (<768px) instead of a cramped horizontal-scroll table.',
      'Header word-wrap: table column headers wrap text instead of truncating, keeping all columns visible without horizontal scroll.',
      'Added "Filters" label above scope pills and dropdowns for clarity.',
      'Dev server gotcha: expanded AGENTS.md to explicitly prohibit AI tools from starting, stopping, or killing the dev server.',
    ]
  },
  {
    version: 'v0.5.154',
    date: '2026-06-06',
    changes: [
      'Fix column resizing: merged duplicate .audit-table CSS rules so table-layout: fixed takes effect, enabling drag-to-resize column widths.',
      'Fix column resizing: changed border-collapse to separate so position: relative works on th elements (required for the resize handle).',
      'Column resize is now desktop-only: hidden on touch devices via pointer: fine media query. Touch devices keep sensible fixed-width columns with horizontal scroll.',
      'Added visible hover indicator on resize handle (vertical bar appears on hover).',
    ]
  },
  {
    version: 'v0.5.153',
    date: '2026-06-06',
    changes: [
      'Tickets Crud Migration: Refactored the tickets dashboard page to use the generic SettingsCrudList component layout.',
      'Interactive Column Resizing: Implemented interactive click-and-drag handles on table headers in SettingsCrudList to support custom column stretching.',
      'Reporter Bugfix: Restored reporter details mappings inside the database load result converter.',
    ]
  },
  {
    version: 'v0.5.151',
    date: '2026-06-06',
    changes: [
      'Ticket Filters: Added status filter tabs (Active, All, Open, In Progress, Pending, Awaiting Input, Pending Release, Pending Verification, On Hold, Deferred, Closed, Dismissed) on the Tickets dashboard page.',
      'Ticket Deletion Actions: Added individual delete actions with inline prompt confirmations and bulk delete buttons to support ticket removal.',
      'Email Explanation Formatting: Formatted email dismiss/decline reason notifications with a clear "Explanation:" section header.',
    ]
  },
  {
    version: 'v0.5.149',
    date: '2026-06-06',
    changes: [
      'Tickets Manual Progression: Decoupled ticket states from todo actions so closing a todo does not automatically close its linked ticket.',
      'Multiple Ticket States: Added support for pending, awaiting input, pending release, pending verification, on hold, and deferred ticket statuses.',
      'Manual Email Preview and overrides: Added a live-updating email notification preview in the ticket edit modal, allowing admins to view the dynamically generated email and customize it prior to sending.',
    ]
  },
  {
    version: 'v0.5.148',
    date: '2026-06-05',
    changes: [
      'Tickets Edit Rework: Changed the Edit Ticket modal summary field from a single-line input to a multiline textarea to accommodate longer feedback.',
      'Tickets Detail Bugfix: Fixed a bug where getTickets selected fields omitted the detail and conversation_snippet columns, preventing details from showing in the UI.',
      'Tickets UI Layout: Placed Status and Type select dropdowns side-by-side in a two-column grid, giving the multiline Summary field full width at the top.',
    ]
  },
  {
    version: 'v0.5.147',
    date: '2026-06-05',
    changes: [
      'ORB-213: Reporter now receives an acknowledgment email when they submit feedback via the Orb ("We received your feedback").',
      'ORB-213: Fixed createTodoFromTicket to move ticket to in_progress (not closed) — reporter gets "We\'re working on your feedback" at the right time.',
      'ORB-213: Resolution email now includes the version number when a linked todo is closed ("This change is included in version vX.X.X").',
      'ORB-213: New declined email sent to reporter when a ticket is dismissed with a reason. Dismissing without a reason is silent (no notification).',
      'Eval suite reliability: Added retry with exponential backoff and 300ms cool-off delay between runs to prevent socket exhaustion on full suite runs.',
    ]
  },
  {
    version: 'v0.5.146',
    date: '2026-06-05',
    changes: [
      'ORB-176: Implemented custom global TooltipProvider with a fast 200ms trigger delay to replace slow native browser tooltips.',
      'ORB-176: Updated desktop navigation AppNav buttons (Dashboard, Print, Help, Settings, Account, Commands) to use the new custom tooltip pattern.',
      'ORB-176: Added .global-tooltip styling in globals.css matching the project\'s visual aesthetic and documented the new pattern in ui-catalog.md.',
    ]
  },
  {
    version: 'v0.5.145',
    date: '2026-06-05',
    changes: [
      'ORB-212: Restricted strategic guidance and workload task recommendations (answering "what should I do next?" or "what should I work on?") to only recommend active tasks from projects owned/created by the current user.',
      'ORB-212: Expanded current user query in buildContext and eval router to fetch first and last names, ensuring proper attribution in user lookup maps.',
      'ORB-212: Added a Tier 2 evaluation case strategic-guidance-scoping to ensure that strategic recommendations exclude other users\' projects.',
    ]
  },
  {
    version: 'v0.5.144',
    date: '2026-06-04',
    changes: [
      'ORB-208: Excluded Claude Code worktree directories (.claude/**) from ESLint scanning to prevent duplicate error reports.',
      'ORB-208: Discarded typescript no-explicit-any checking globally to maintain clean build diagnostics.',
      'ORB-208: Fixed React Compiler and React Hook render-time warnings (memoization dependencies and ref modifications) in useVisibilityRefetch and HScrollNav.',
      'ORB-208: Resolved unescaped quotes inside JSX layout text across multiple settings views.',
    ]
  },
  {
    version: 'v0.5.143',
    date: '2026-06-04',
    changes: [
      'ORB-207: Filtered proactive observations (such as overdue and stale task highlights in the greeting prompt) to only analyze and surface tasks belonging to projects owned/created by the current user.',
    ]
  },
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
