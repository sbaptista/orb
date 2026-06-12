# UI Component Catalog

> **Read this before building any UI.** Every AI agent must check this catalog at session start.  
> If a pattern exists here, use it. If none fits, propose the new pattern to Stan before creating it.  
> Source of truth for CSS: `app/globals.css`. Source of truth for components: `components/`.

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
Adds fade edges and optional scroll arrows to horizontally-scrollable containers (e.g., project pill strips).

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

### Danger Confirm (`btn-danger-confirm`)
Red background. Used only inside confirmation flows (e.g., "Confirm delete").

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

### Orb Action Circle (`oc-action-circle`)
32×32px circular button base for the Orb input bar. Flex-centered, no border, smooth transition. Used as a base class by:
- **Send Button (`oc-send-btn`)** — green accent (`--pill-active-bg`), white icon. Submit button for Orb input.
- **Stop Button (`oc-stop-btn`)** — red tint background (`rgba(200,0,0,0.08)`), red square stop icon. Visible while Orb is processing.

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

### CRUD List (`SettingsCrudList`)
**File:** `components/settings/SettingsCrudList.tsx`  
Reusable pattern for settings lists with add/edit/delete actions, column resize, search, scope filters, bulk delete, and server-side pagination.
- **Pagination:** `config.pagination = { pageSize: N }`. When set, `load()` receives `{ page, pageSize }` and must return `totalCount`. Renders Previous/Next pager in a footer bar inside the card.
- **Header extras:** `config.headerExtra` — ReactNode rendered in the header beside the Add button (e.g. dev-only Diagnose button on Audit Log).
- **Custom row click:** `config.onRowClick` — replaces edit-on-click behavior (e.g. opens a detail modal instead of edit form).

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

**Deprecated patterns (removed):** `.apm-modal`, `.dm-modal` — replaced by `modal-center` with width modifiers.

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
