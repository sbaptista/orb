# UI Component Catalog

> **Read this before building any UI.** Every AI agent must check this catalog at session start.  
> If a pattern exists here, use it. If none fits, propose the new pattern to Stan before creating it.  
> Source of truth for CSS: `app/globals.css`. Source of truth for components: `components/`.

---

## Page Layouts

### Unified Dashboard (`ud-*`)
**Status:** Active prototype at `/prototype`, will replace `/dashboard`  
**Files:** `components/UnifiedDashboard.tsx`, `components/DragDivider.tsx`  
**CSS prefix:** `ud-`

The target layout for the main app page. Two equal-citizen panes (Orb + List) with a draggable divider:
- **iPhone:** Vertical stack (column), divider drags up/down
- **Desktop:** Side-by-side (row), divider drags left/right
- Full-bleed `MuralCanvas` fractal at z:0 behind everything

| Class | Purpose |
|---|---|
| `ud-command-bar` | Top bar — project search, nav buttons, panel toggles. Frosted glass, `z-index: 20` |
| `ud-split` | Flex container for both panes + divider. `flex-direction: column` on mobile, `row` on desktop |
| `ud-orb-pane` | Left/top pane — transparent background, houses `OrbConversation` |
| `ud-list-pane` | Right/bottom pane — frosted glass background, houses list toolbar + table |
| `ud-list-toolbar` | Toolbar row inside list pane (sort, filter, view toggle, + New) |
| `ud-list-title` | Project name heading inside list toolbar |
| `ud-list-content` | Scrollable content area inside list pane |
| `ud-divider` / `ud-divider--vertical` / `ud-divider--horizontal` | Drag handle between panes |
| `ud-divider-handle` | The visible pill inside the divider |

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

### App-Wide Command Bar (`ud-command-bar`)
**Location:** Top of Unified Dashboard  
**Pattern:** `flex` row — project search (left), spacer, nav buttons (right), panel toggles (edges)

This is the canonical top bar for all future pages. Contains:
- Panel toggle buttons (sidebar icons, far left and far right)
- Project search dropdown (`admin-search-*` pattern)
- Nav buttons: Print, Help, Settings, Account

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

### Project Search Dropdown (`admin-search-*`)
**Used in:** Unified Dashboard command bar, TodoView top bar

Searchable dropdown for switching projects. Admins see all projects with owner names; users see only their own.

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
Bordered pill button used in list toolbars (Sort, Filter, View). Supports `aria-pressed="true"` active state.

### Toolbar Primary (`tv-toolbar-primary`)
Accent-colored variant of toolbar button (e.g., "+ New").

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
Small orange button for dev-only controls.

### Pager Button (`btn-pager`)
Pagination arrow button.

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
**File:** `app/settings/audit/page.tsx`  
Standard bordered table for settings/admin pages. Simpler than `tv-table` — no responsive collapsing.

### CRUD List (`settings-crud-list`)
**File:** `components/ui/` (inline in settings pages)  
Reusable pattern for settings lists with count badges, reorder arrows, and add/edit/delete actions.

---

## Modals & Panels

### Centered Modal (`modal-center`)
**Canonical modal pattern.** Fixed center of viewport, max-width 480px, max-height 70dvh.

| Class | Purpose |
|---|---|
| `modal-backdrop` | Full-screen semi-transparent backdrop (click to close) |
| `modal-center` | The modal container — centered, rounded, shadow |
| `modal-header` | Top bar with title/close button, border-bottom |
| `modal-body` | Scrollable content area |
| `modal-footer` | Bottom bar with actions (Save/Delete/Cancel), border-top |

**Use for:** Todo edit, new todo form, distill modal, any focused editing task.

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

### Pill (`pill-active`)
Active state pill with accent background. Used for selected filters/tabs.

### Badge (`badge`)
Small count indicator.

### Version Label (`OrbVersionLabel`)
**File:** `components/ui/OrbVersionLabel.tsx`  
Displays current app version. Click opens changelog.

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
| Command bar | 20 | `ud-command-bar` |
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

*Last updated: 2026-05-27 — Session 27*
