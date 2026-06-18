# UI Component Catalog

> **Read this before building any UI.** Every AI agent must check this catalog at session start.  
> If a pattern exists here, use it. If none fits, tell Stan the catalog may be incomplete and ask whether he wants a new pattern added before creating it.
> Source of truth for CSS: `app/globals.css`. Source of truth for components: `components/`.

---

## How To Use This Catalog

Treat UI as assembly from established parts:
- Identify the family first: modal, table, button, form field, navigation, card, empty state, etc.
- Pick the canonical pattern below and inspect its listed component files before editing.
- Reuse the documented classes and structure directly.
- If two viable patterns fit, ask Stan which model he wants.
- If no pattern fits, say the catalog may be incomplete and ask Stan whether he wants a new pattern added to the catalog.
- If Stan says yes, add the pattern to this catalog in the same change as the implementation; if he says no, do not create a parallel component family.

---

## Page Layouts

### Unified Dashboard (`ud-*`)
**Status:** Active main dashboard.  
**Files:** `components/UnifiedDashboard.tsx`, `components/DragDivider.tsx`  
**CSS prefix:** `ud-`

The main app layout. Two equal-citizen panes (Orb + List) with a draggable divider:
- **MacBook:** Side-by-side (row), divider drags left/right
- **iPad:** Side-by-side in wider layouts, with a 40px touch-friendly divider gutter and visible drag affordance
- **iPhone:** Orb/List tab switching on narrow screens; divider is hidden
- **Zero-Project State:** When no projects are loaded, clicking the Orb opens the project creation modal. The "+ New" todo button is disabled and triggers a friendly toast message requesting the user to create a project first.
- Full-bleed `MuralCanvas` fractal at z:0 behind everything

| Class | Purpose |
|---|---|
| `ud-split` | Flex container for both panes + divider. `flex-direction: column` on mobile, `row` on desktop |
| `ud-orb-pane` | Left/top pane — transparent background, houses `OrbConversation` |
| `ud-list-pane` | Right/bottom pane — frosted glass background, houses list toolbar + table |
| `ud-list-toolbar` | Toolbar row inside list pane (sort, filter, view toggle, + New) |
| `ud-list-title` | Project name heading inside list toolbar |
| `ud-list-content` | Scrollable content area inside list pane |
| `ud-divider` / `ud-divider--vertical` / `ud-divider--horizontal` | Drag handle between panes; 40px gutter on coarse pointers |
| `ud-divider-handle` | The visible pill inside the divider, with hover/drag feedback |

On the dashboard, AppNav renders dashboard-specific controls as children (merged bar):
- **Orb toggle** (left)
- **Project search** (flex: 0 1 320px) — search-based dropdown for selecting projects
- **+ Project button** — immediately right of search, opens AddProductModal (hidden on mobile, available via Commands modal)
- **Spacer** (flex: 1)
- **List toggle** — before the global nav buttons
- **Global nav** (Print, Help, Settings, Account) — right side

Inside the `ud-list-toolbar`, the controls are laid out as follows:
- **Project Title:** The active project's name is on the left.
- **Kebab (⋮):** Immediately right of the project title. Opens dropdown: Edit Project, divider, Delete Project (danger color, two-step confirm).
- **Spacer** (flex: 1)
- **Sort Button:** A button labeled "Sort" (arrows icon).
- **Filter Button:** A button labeled "Filter" that opens filter options (active, completed, priority).
- **Views Button:** A button labeled "Views" that opens a dropdown to switch between List, Checklist, and Kanban.
- **New Task Button:** A primary accent button labeled "+ New" to create a new task.

### Settings Page (`s-page`, `s-*`)
**Files:** `app/settings/page.tsx` and sub-pages  
**CSS prefix:** `s-`

Standard settings layout with centered content card.

| Class | Purpose |
|---|---|
| `s-page` | Page container — `max-width: 720px`, centered, padded |
| `s-page-wide` | Wider variant — `max-width: 1000px` |
| `s-header` | Page header with title, border-bottom |
| `s-section-title` | Section heading within settings |
| `s-card` | Bordered card container |
| `s-card-row` | Row inside card (label + control) |
| `s-card-title` | Bold row label |
| `s-card-desc` | Muted description text |
| `s-form` | Form input styling context |

### Settings Navigation & Updates
- **Settings Sidebar:** Houses navigation for general configuration. Priorities, Statuses, and Platforms pages removed in v0.5.207 (not user-changeable). Platform pill UI also removed from TodoPanel and TodoForm.
- **Version Badge:** Located in the bottom corner of the Settings page sidebar (e.g. displaying `v0.5.127`). Non-clickable.
- **What's New Screen:** Located under Settings. Displays recent release notes and contains:
  - **Check for Update Button:** A button labeled "Check for Update" that allows users to manually fetch and apply newer app versions.

### Account Page (`account-*`)
**Files:** `app/account/page.tsx`, `components/settings/SettingsAccount.tsx`, `components/settings/ChangeNameModal.tsx`, `components/settings/ChangeEmailModal.tsx`, `components/settings/SettingsPasskeys.tsx`

The Account page uses the calm `MuralCanvas` behind a centered settings surface. Its header pairs the page title with Sign Out. Profile properties are read-only rows with explicit, matching actions: Change name and Change email. Both actions open canonical centered modals. On iPhone, each row stacks and its action becomes full width.

| Class | Purpose |
|---|---|
| `account-main` | Positioned page content above the fixed mural |
| `account-page` | Centered Account content width |
| `account-profile-row` | Read-only profile property with explicit change action |
| `account-profile-copy` | Flexible label/value container |
| `account-profile-label` / `account-profile-value` | Profile property typography |
| `account-passkey-actions` | Register New Passkey and Learn more action group |
| `account-modal-body` | Shared body spacing for Account dialogs |
| `account-dialog-copy` | Readable explanatory dialog text |

### Ambient Dashboard (`dash-*`)
**Status:** Current `/dashboard` page — will be replaced by Unified Dashboard  
**Files:** `components/AmbientDashboard.tsx`  
**CSS prefix:** `dash-`

| Class | Purpose |
|---|---|
| `dash-nav` | Top navigation bar (mode-aware: ambient vs dialogue) |
| `dash-strip` | Horizontal project pill selector bar |
| `dash-strip-pill` | Individual project pill button |
| `dash-version` | Version label (bottom corner) |

---

## Command Bar & Navigation

### Unified Navigation Bar (`appnav`)
**Location:** Top of every page  
**Component:** `components/AppNav.tsx`  
**Pattern:** Single `flex` row bar. On the dashboard, accepts children for dashboard-specific controls (orb toggle, project search, list toggle). On other pages, shows back link + global actions.

**Dashboard layout (merged bar):**
- **Orb toggle** — left edge, collapses/expands Orb pane (desktop) or switches to Orb tab (mobile)
- **Change Project** — opens a search-based modal for selecting projects
- **+ Project** — opens AddProductModal (hidden on mobile, available via Commands modal)
- **Spacer** (flex: 1)
- **List toggle** — collapses/expands list pane (desktop) or switches to list tab (mobile)
- **Print, Help, Settings, Account** — global nav, desktop only (mobile: Commands modal)
- **Developer Panel Toggle:** Dev-only toggle button at the bottom-right corner of the viewport (visible in dev mode only).

**Non-dashboard layout:** Back link (left) → spacer → global nav (right).

### Mobile Command Menu
On narrow viewports (iPhone, mobile screens), the individual top nav buttons (Print, Help, Settings, Account) collapse into a single button in the top bar:
- **Commands Button:** Labeled "Commands" (grid/menu icon).
- **Behavior:** Tapping it opens a centered modal with links to the full commands: "Print Backlog", "Help & Guidelines", "Settings", and "Account Profile".
- **Accessibility:** The menu opens as a named modal dialog. Command links remain plain links/buttons inside the dialog.

### Nav Buttons (`nav-btn`)
**Used in:** Command bar, AmbientDashboard nav

| Class | Purpose |
|---|---|
| `nav-btn` | Icon + optional label button. `44px` min-height for touch targets |
| `nav-btn-icon` | Icon container (centered, `20×20`) |
| `nav-btn-label` | Text label — hidden on mobile (`@media max-width: 767px`) |

### TodoView Top Bar (`tv-topbar`)
**Status:** Will be absorbed into Unified Dashboard list toolbar  
**Files:** `components/TodoView.tsx`

| Class | Purpose |
|---|---|
| `tv-topbar` | Top navigation row (back link, title, search) |
| `tv-topbar-header` | Title area |
| `tv-topbar-title` | Project name heading |
| `tv-topbar-nav` | Back button / breadcrumb |

### Change Project Modal (`SearchModal`)
**Used in:** Unified Dashboard command bar, TodoView top bar

Searchable modal for switching projects. The dashboard command bar labels this action "Change Project"; the modal title is also "Change Project". Admins see all projects with owner names; users see only their own.

Accessibility contract: `SearchModal` renders as a named `role="dialog"` with `aria-modal="true"`, focuses the search field on open, and keeps keyboard support for arrow navigation, Enter selection, and Escape close.

| Class | Purpose |
|---|---|
| `admin-search-wrap` | Input container with icon |
| `admin-search-icon` | Search magnifying glass |
| `admin-search-input` | Text input field |
| `admin-search-clear` | ✕ clear button |
| `admin-search-dropdown` | Results dropdown (absolute positioned) |
| `admin-search-result` | Individual result row |
| `admin-search-result-name` | Project name + code |
| `admin-search-result-owner` | Owner name (admin-only) |
| `admin-search-empty` | "No projects found" message |

### Horizontal Scroll Nav (`HScrollNav`)
**File:** `components/ui/HScrollNav.tsx`  
Adds fade edges and circular previous/next controls to horizontally-scrollable containers (e.g., project pill strips). Table column navigation uses compact circular controls inside a rounded group with a centered **Prev/Next Columns** caption; the group anchors to the far right of the table toolbar and wraps under when space is constrained.

### Filter Kebab (`FilterKebab`)
**File:** `components/ui/FilterKebab.tsx`  
Used for compact status/priority filters in task list toolbars. The trigger is a button with a text label and chevron; the popover uses a `menu` / `menuitemradio` pattern so the active filter is announced and keyboard users can move with Arrow keys, Home/End, select with Enter/Space, and close with Escape.

---

## Buttons

### Primary Action (`btn-primary`)
Solid background, white text. Used for main form submissions.

### Cancel / Secondary (`btn-cancel`)
Transparent background, bordered. Used alongside primary buttons.

### Outline (`btn-outline`)
Bordered, transparent. General-purpose secondary action.

### Danger Outline (`btn-danger-outline`)
Red border, red text, transparent background. Hover fills red with white text. For destructive actions in toolbars and bulk bars where filled `btn-danger` would be too heavy. Used by CrudList bulk delete.

### Danger Confirm (`btn-danger-confirm`)
Text-only red, no background or border. Used inside inline row confirmation flows (e.g., "Confirm delete").

### Row Action (`btn-row-action`)
Small inline button for table row actions. Variants: `btn-row-delete`, `btn-row-edit`.

### Toolbar Button (`tv-toolbar-btn`)
Solid pill button used in list toolbars (Sort, Filter, View). Styled with standard primary button variables; pressed active state (`aria-pressed="true"`) uses dark `var(--btn-primary-active-bg)`.

### Toolbar Primary (`tv-toolbar-primary`)
Primary-colored variant of toolbar button (e.g., "+ New"). Styled with standard primary button variables.

### Text Button (`text-btn`)
Minimal, unstyled-looking button for low-emphasis actions (e.g., "Cancel", "Delete").

### Edit Button (`edit-btn`)
Small circular icon button (`24×24`). Used for inline edit triggers.

### Close Button (`close-btn`)
×-symbol button for closing modals/panels.

### Save Button (`save-btn`)
Form save action button. Used in modal/panel footers.

### Nav Button (`nav-btn`)
See Navigation section above.

### Circular Navigation Button (`nav-circle-btn`)
Strict `44×44px` circular icon button for previous/next, pagination, and icon-only navigation actions. It explicitly sets equal width/min/max-width and height/min/max-height plus `appearance: none`, preventing iOS Safari from stretching the target into an oval. Hover and press states change the background, border, and foreground; press also gives a subtle scale response. Every instance requires an accessible label and `data-tooltip`.

### Move Button (`btn-move`)
Arrow button for reordering items in CRUD lists.

### Sign Out (`btn-sign-out`)
Full-width destructive-style button at bottom of account pages.

### Dev Button (`btn-dev`)
Small button for dev-only controls. Styled with standard primary button variables.

### Pager Button (`btn-pager`)
Pagination arrow button.

### Orb Conversation Tool Button (`oc-tool-btn`)
Used for buttons below the input field in the Orb conversation view. Styled with standard primary button background (`var(--btn-primary-bg)`).

### Orb Conversation Overflow (`oc-toolbar-overflow`, `oc-more-*`)
The Orb command toolbar uses the same compact command model on Mac, iPad, and iPhone: primary actions stay visible (`Cmds`, `Voice`, Send/Stop) and secondary actions (`Prev`, `Next`, `Copy`, `Export`, `Clear`) live behind the `More` overflow button. This avoids viewport-specific command layouts and keeps the small-pane/iPhone interaction model consistent everywhere.

### Orb Markdown (`oc-orb-md`)
Prose container for Orb and dev-channel messages. Uses `remark-gfm` for GitHub-Flavored Markdown (tables, strikethrough, autolinks). Table styles: collapsed borders, `--fs-xs` font, `--bg3` header background, alternating `--bg2` row stripes.

### Orb Insight Marker (`oc-insight`, `oc-insight-dot`)
Full-width header strip rendered at the top of Orb responses that carry a structured insight (`Observation`, `Coaching read`, or `Strategic read`). Uses a subtle accent-tinted background, uppercase label, and small accent dot to distinguish proactive guidance from ordinary response text without creating a separate nested card.

### Developer Channel Message (`oc-dev-card`, `oc-dev-label`)
Inbound messages from developer AI tools render as blue-tinted cards with the tool/model name above the message, visually distinct from both Stan's messages and Orb responses. The dashboard checks for pending messages on mount, focus, visibility return, BFCache restore, and every 15 seconds while the page is visible. Polling pauses while hidden, uses an in-flight guard to prevent duplicate processing, and does not use Supabase Realtime.

### Global Developer Panel (`GlobalDevPanel`)
**Files:** `components/dev/GlobalDevPanel.tsx`, `components/OrbDevPanel.tsx`

The development-only `DEV` launcher is mounted globally through `Providers`, so authoring tools such as Table Tuning are available on every route. Dashboard-specific Orb simulation controls are portaled into the same panel when `UnifiedDashboard` is mounted; other routes show only global tools.

### Orb Action Circle (`oc-action-circle`)
32×32px circular button base for the Orb input bar. Flex-centered, no border, smooth transition. Used as a base class by:
- **Send Button (`oc-send-btn`)** — green accent (`--pill-active-bg`), white icon. Submit button for Orb input.
- **Stop Button (`oc-stop-btn`)** — red tint background (`rgba(200,0,0,0.08)`), red square stop icon. Visible whenever the parent is submitting or any Orb message is still marked as streaming, so an orphaned stream can always be stopped.

The parent dashboard owns a synchronous, request-scoped processing lock. A request claims the lock before React state updates, preventing overlapping submissions; only that request may release its processing state. Stop marks that specific request as aborted and releases the input without allowing its late stream completion to affect a newer request.

### Banner Button (`btn-banner`)
Small uppercase pill button for floating banners (update available, maintenance mode). 12px border-radius, uppercase text, subtle box-shadow, hover scale effect. Variant: `btn-banner--warning` for amber/warning-colored banners.

### Small Modifier (`btn-sm`)
Size modifier class. Combine with any button class (e.g., `btn-primary btn-sm`, `text-btn btn-sm`) for compact contexts. Sets `font-size: 12px; padding: 4px 10px`.

---

## Tables

### Todo Table (`tv-table`)
**File:** `components/TodoView.tsx`, `components/UnifiedDashboard.tsx`  
**CSS prefix:** `tv-`

Responsive task list table. iPhone-first: actions collapse below title on mobile, expand to own column on desktop.

| Class | Purpose |
|---|---|
| `tv-table` | Table element — `width: 100%`, `border-collapse: separate` |
| `tv-table thead th` | Dark header cells, uppercase labels |
| `tv-table td` | Data cells with `box-shadow` bottom border (Safari iOS fix) |
| `tv-td-content` | Content cell (title + metadata) |
| `tv-todo-title` | Task title — 2-line clamp with ellipsis |
| `tv-td-actions` | Actions column — hidden on mobile |
| `tv-mobile-actions` | Actions row — visible only on mobile (below title) |
| `tv-row-actions` | Action button group (Edit, Done) |
| `tv-action-btn` | Individual action button in rows |
| `tv-done-toggle` | Circular done/reopen checkbox indicator |
| `tv-checkbox` | Selection checkbox for bulk actions |
| `tv-row` / `tv-row-done` | Row styling variants |

### Checklist Table (`tv-checklist`)
Simplified table — done-circle + title only. No bulk edits. Same `tv-` prefix.

### Audit Table (`audit-table`)
**File:** `components/settings/SettingsCrudList.tsx`, `components/settings/SettingsAudit.tsx`  
Standard bordered table for settings/admin pages. Simpler than `tv-table` — no responsive collapsing.
- **Header style:** Green background (`--btn-primary-bg`), white text, centered. Matches primary button styling.
- **Sheets-style Column Resizing:** Clicking a column header activates resizing for that column, rendering a resize icon (`.col-resize-handle-sheets` double-arrow) at the bottom-right and highlighting the active column with a `border-right: 2px solid var(--accent)`. Dragging the handle resizes the column to the right, pushing all columns to its right without modifying their widths. Clicking outside the headers deselects the active column.
- **Touch stability:** `touch-action: pan-x pan-y` on table, `touch-action: none` on resize handles, `overscroll-behavior-x: contain` on scroll container.

### Development Table Tuner (`TableTuner`)
**File:** `components/dev/TableTuner.tsx`

Development-only authoring tool available for every rendered HTML table on every route. Open the global `DEV` menu and choose **Tables**, then:
- Drag the highlighted header boundaries until the columns look right.
- Enter exact values directly in each column's pixel-width field when precision is useful.
- Use **Freeze through** on a column to pin the contiguous group from the left, matching spreadsheet behavior.
- Use **Unfreeze** to remove the frozen group.
- The tuner detects **Mac**, **iPad**, or **iPhone** using Orb's breakpoint and pointer rules, displays the active platform, and stores an independent draft for each platform.
- Use **Copy configuration** to capture the viewport, scroll dimensions, and all saved platform presets with their measured widths and frozen-column counts.
- Platform drafts persist independently in local storage for iteration, but never appear in production and do not change source configuration until the copied values are deliberately applied.

| Class | Purpose |
|---|---|
| `table-tuner` | Fixed development-only tuning surface opened from the existing DEV menu |
| `table-tuner-panel` | Tuning controls and measured column list |
| `table-tuner-handle` | Touch-friendly draggable column boundary overlay |
| `table-tuner-frozen-edge` | Strong divider after the final frozen column |

### CRUD List (`SettingsCrudList`)
**File:** `components/settings/SettingsCrudList.tsx`  
Reusable pattern for settings lists with add/edit/delete actions, column resize, search, scope filters, bulk delete, and server-side pagination.
- **Pagination:** `config.pagination = { pageSize: N }`. When set, `load()` receives the current page criteria and must return `totalCount`. Renders First/Previous/Next/Last controls in a footer bar inside the card.
- **Global paginated search/sort:** Set `serverSearch: true` and/or `serverSort: true` in `config.pagination`. The shared list debounces search, passes `{ search, sortKey, sortDir }` to `load()`, resets to page one when criteria change, and treats the returned count as the full filtered result count. Do not combine client-only filtering or sorting with server pagination when users expect full-dataset results.
- **Header extras:** `config.headerExtra` — ReactNode rendered in the header beside the Add button (e.g. dev-only Diagnose button on Audit Log).
- **Toolbar extras:** `config.toolbarLeading` renders before the active search control, `config.toolbarExtra` renders after it. Use these for compact mode selectors and controls that belong beside search rather than in the page header. `config.searchEnabled` can hide and deactivate the text search input when another search mode is active; hidden text search is cleared so invisible filters do not remain active. `config.searchCaption` and `config.tableNavCaption` provide small caption text for the search field and column navigation group.
- **External server filters:** `config.externalFilterKey` — change this stable key when a custom server-side filter changes so pagination resets to page one without discarding the search term.
- **Custom row click:** `config.onRowClick` — replaces edit-on-click behavior (e.g. opens a detail modal instead of edit form).
- **Selection column width:** `config.selectionColumnWidth` — optional pixel width for the bulk-selection checkbox column; defaults to `36`.
- **Pixel table widths:** Settings tables that need fixed geometry use pixel column widths (`90px`, `180px`, etc.). When every configured column uses pixels, CrudList shrink-wraps the toolbar, Prev/Next Columns controls, table frame, and pagination footer to the exact sum of the columns plus the selection column.
- **Platform table widths:** `tableColumns[].platformWidths` and `config.selectionColumnWidths` provide Mac/iPad/iPhone overrides using the same breakpoint and pointer rules as Table Tuning.
- **Platform frozen columns:** `config.stickyColumnsByPlatform` overrides the default frozen-column count per platform.
- **External search buttons (canonical):** All CrudList tables use `externalSearchTerm` + `toolbarExtra` with green `btn-primary` buttons. Tables manage search/date state in the parent component, pass `externalSearchTerm`, `searchCaption`, `externalFilterKey`, `onResetFilters`, and `toolbarExtra` to CrudList. The inline search input is fully replaced.
- **Pagination auto-hide:** The pagination footer (First/Prev/Next/Last) only renders when `totalCount > pageSize`. Tables with small datasets show no pagination controls but get them automatically when data grows.
- **Subtitle format:** All paginated tables use `Rows X–Y of Z.` (or singular `Row X of Z.`). Copy the subtitle pattern from Audit Log.

### Shared Search Modals
**Files:** `components/settings/TextSearchModal.tsx`, `components/settings/DateSearchModal.tsx`

Reusable `modal-center` search modals extracted from Audit Log and shared across all CrudList tables.

- **TextSearchModal:** Text search input with `crud-search-wrap` styling, custom placeholder with send icon + return symbol. Props: `open`, `onClose`, `onApply(term)`, `onClear()`, `currentTerm`, `placeholder?`, `ariaLabel?`. Exports `SendIcon`.
- **DateSearchModal:** Date filter with condition select (On date / At or before / At or after / Between) and date/datetime-local inputs. Props: `open`, `onClose`, `onApply(filter)`, `onClear()`, `currentFilter`. Exports `CreatedFilter` type, `shortDate`, `shortDateTime`.

Tables with date columns (Audit Log, Orb Memory, Tickets) render both buttons. Tables without date columns (Knowledge, Projects, Users) render text search button only.

### Audit Created Filter
Created timestamps display in the browser's IANA timezone. The dedicated **Created** filter supports On date, At or before, At or after, and Between. Local picker values are converted to UTC boundaries before the server query; general text search deliberately excludes Created so timestamp interpretation is never implicit or timezone-dependent. Audit details show both the browser-local timestamp and canonical UTC value.

### Action Cell Pattern (`action-cell`, `action-link`)
**File:** `app/globals.css`  
Standardized action column for all settings tables.
- **2 actions:** Both rendered as `.action-link` side by side (e.g. Edit + Delete).
- **3+ actions:** Primary action as `.action-link` + `.btn-overflow` kebab with `.dropdown-menu`.
- **`.action-link`:** Link-styled button, 12px font, min-height 36px, `--accent` color, hover bounding rectangle on platforms that support hover.
- **`.btn-overflow`:** 44px × 44px hit target, 28px vertical kebab (&#x22EE;), hover bounding rectangle.
- **Action td:** Uses `e.stopPropagation()` — clicking empty space in the action cell does NOT trigger row edit.
- **Do not** use `align: 'right'` on action columns. Actions start on the left.

### Kebab vs Gear Icon Rule
| Icon | When to use |
|---|---|
| **Kebab** (&#x22EE;) `.btn-overflow` | Action overflow on an item — edit, delete, archive, etc. |
| **Gear** (&#x2699;) | Navigation to a settings/configuration page |

Do not use a gear icon for item-level actions. Do not use a kebab for page navigation.

---

## Modals & Panels

### Centered Modal (`modal-center`)
**Canonical modal pattern.** Fixed center of viewport, resizable, max-height 85dvh.

| Class | Purpose |
|---|---|
| `modal-backdrop` | Full-screen semi-transparent backdrop (click to close) |
| `modal-center` | The modal container — centered, rounded, shadow, resizable. Default max-width 480px |
| `modal-sm` | Width modifier: max-width 400px (e.g. AddProductModal) |
| `modal-lg` | Width modifier: max-width 680px |
| `modal-compose` | Width modifier: max-width 920px. For form + live preview layouts |
| `modal-header` | Top bar with title/close button, border-bottom |
| `modal-body` | Scrollable content area |
| `modal-footer` | Bottom bar with actions (Save/Delete/Cancel), border-top |
| `compose-body` | Two-column grid body (form left, preview right). Stacks to single column on mobile |
| `close-btn` | Standard close button — 28px font, 44×44px hit target, hover state |

**Use for:** Todo edit, new project form, distill modal, any focused editing task.  
**Use `modal-compose` for:** Compose/edit workflows with a live preview (e.g. ticket email editing).
**Canonical examples:** `components/AddProductModal.tsx`, `components/TodoPanel.tsx`, `components/DistillModal.tsx`, `components/TodoForm.tsx`.

**Deprecated patterns (removed):** `.apm-modal`, `.dm-modal`, `.tf-*` — replaced by `modal-center` with width modifiers.

### Todo Create Modal
**File:** `components/TodoForm.tsx`
Uses the canonical centered modal pattern with `modal-lg`, `modal-header`, `modal-body`, and `modal-footer`. The body uses `pf-field` labels, a larger title input, a responsive two-column metadata grid, and a monospace URL textarea. Do not reintroduce standalone `.tf-*` modal shells.

### Slide Panel (`slide-panel`)
**Status:** Being phased out in favor of `modal-center`  
Right-anchored slide-in panel. Still used in some places but `modal-center` is the preferred pattern.

| Class | Purpose |
|---|---|
| `slide-panel` | Right-anchored panel, full height, max-width 460px |
| `slide-panel-header` | Top bar |
| `slide-panel-body` | Scrollable content |
| `slide-panel-footer` | Bottom actions bar |

---

## Form Fields

### Panel/Modal Fields (`pf-*`)
**Used in:** TodoPanel, TodoForm, any modal form

| Class | Purpose |
|---|---|
| `pf-field` | Field container (flex column, 5px gap) |
| `pf-label` | Label — uppercase, small, muted |
| `pf-input` | Text input — full width, bordered, rounded |
| `pf-select` | Select dropdown — styled to match inputs |
| `pf-textarea` | Multi-line textarea — min-height 80px |

### Settings Fields (`s-form`)
**Used in:** Settings pages  
Simpler form styling context for settings card rows.

---

## Feedback & Status

### Toast (`Toast`)
**File:** `components/ui/Toast.tsx`  
`useToast()` hook → `toast.success(msg)` / `toast.error(msg)`. Auto-dismissing notification.

### Warning Badge / Alert Banner
Used to flag when action is required (e.g. a ticket's linked todo is completed/closed, but the ticket itself remains open).
- **Badge:** Labeled "Todo Closed". Small amber pill (`background: #fef3c7`, `color: #d97706`). Enforces HIG tap guidelines, wrapped cleanly inside lists.
- **Alert Banner:** Prominent warning block at the top of the Edit Modal form. Amber background (`background: #fef3c7`, `color: #d97706`, `border: 1px solid rgba(217, 119, 6, 0.2)`).

### Pill (`pill-active`)
Active state pill with accent background. Used for selected filters/tabs.

### Badge (`badge`)
Small count indicator.

### Version Label (`OrbVersionLabel`)
**File:** `components/ui/OrbVersionLabel.tsx`  
Displays current app version. Non-clickable. Just displays the version text.

### Custom Tooltips (`TooltipProvider`)
**File:** `components/ui/Tooltip.tsx`  
Global custom tooltip component triggered by `data-tooltip` attribute. Configured with a 200ms delay and styled with a frosted glass background (`global-tooltip` class). Disabled on touch/mobile devices to prevent visual stickiness.

---

## Responsive Rules

### Breakpoints
| Breakpoint | Target |
|---|---|
| `max-width: 767px` | iPhone — single-column layouts, collapsed actions |
| `min-width: 768px` | iPad and desktop — multi-column, expanded actions |

### Pointer Queries
| Query | Target |
|---|---|
| `@media (pointer: coarse)` | Touch devices — larger hit targets (48px+) |
| `@media (pointer: fine)` | Mouse/trackpad — standard sizing |
| `@media (hover: hover)` | Devices that support hover states |

### Design Constraints
- **Minimum hit target:** 44pt (Apple HIG) — enforced on all interactive elements
- **Touch-action:** `none` only on drag surfaces (dividers), never on scrollable content
- **No hover-only interactions** — everything must work via tap on iPad/iPhone
- **Ageing eyes:** No text below `var(--fs-xs)` (~11px). Prefer `var(--fs-sm)` (13px) for body text

---

## Z-Index Stack

| Layer | Z-Index | Component |
|---|---|---|
| Fractal background | 0 | `MuralCanvas` (fixed, 22% opacity) |
| Split panes | 10 | `ud-split` |
| Divider | 12 | `ud-divider` |
| Navigation bar | 50 | `appnav` |
| Modal backdrop | 40 | `modal-backdrop` |
| Modals | 50 | `modal-center` |
| Toast | 60 | Toast notifications |
| Dropdowns | 100 | `admin-search-dropdown`, `up-switcher-dropdown` |

---

## Builder Protocol

### Before creating any UI:
1. **Search this catalog** for an existing pattern that fits
2. **Read the actual CSS** in `globals.css` for the pattern's classes
3. **Read the component file** for usage examples
4. **Reuse the existing classes** — do not create parallel patterns

### If no existing pattern fits:
1. **Describe** what you need and why existing patterns don't work
2. **Propose** the new classes/component with markup, CSS, and responsive behavior
3. **Wait for Stan's approval** before creating it
4. **Update this catalog** after the new pattern is approved and built

### Never do:
- Create a new button style when `btn-primary` / `btn-outline` / `tv-toolbar-btn` already exist
- Create a new modal wrapper when `modal-center` exists
- Create new form field styles when `pf-*` classes exist
- Inline styles for things that have CSS classes (borders, shadows, spacing)
- New z-index values without checking the stack above

### Keep this catalog current:
When you add, rename, or remove a UI pattern, **update this file in the same commit**:
- New classes → add a row to the relevant table
- Renamed classes → update the row
- Removed/deprecated patterns → mark **Status: Deprecated** or delete the entry
- New component files → add to the relevant section with file path

This catalog must stay in sync with `globals.css` and `components/`. Never leave it stale.

---

*Last updated: 2026-06-10 — Session 75 (Antigravity) - Fix mobile More button dropdown backdrop stacking and touch interception
