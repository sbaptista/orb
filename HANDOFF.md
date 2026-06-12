# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app
- **Local version:** v0.5.202 (production before push: v0.5.193)

---

### Last Session Completed

**ORB-196/239/241/242: World Class App polish and hardening — 2026-06-11 (Codex)**

### What was done

Completed the current world-class-app polish batch started by Claude Code, then carried three follow-up tickets through local implementation, closure, and Knowledge Repo entries.

1. **Interaction polish handoff from Claude Code** — Preserved and release-documented the ORB-196 work already in the tree:
   - `components/ui/SkeletonRows.tsx` with staggered shimmer loading states
   - Main views: UnifiedDashboard, TodoView, UnifiedView, AmbientDashboard, DashboardProducts
   - Settings: SettingsAccount, SettingsMaintenance, SettingsUserDetail, SettingsGroups, SettingsProjectTodos, SettingsFriction, SettingsCrudList, SettingsUrgency
   - `components/ui/EmptyState.tsx` and Orb-illustrated empty states in list/checklist/query-result surfaces
   - `components/ui/FilterKebab.tsx` for status/priority filters in UnifiedDashboard and TodoView
   - Modal footer conformity around `btn-cancel`, `btn-primary`, and `btn-danger`
   - Copy cleanup from "Ask the Orb" to "Ask Orb"

2. **ORB-241: Resize handle visibility** — Made the split-pane divider easier to discover and use:
   - Added visible divider handle treatment with hover/drag feedback
   - Added separator semantics to `DragDivider`
   - Removed 30/50/70 snap-back behavior so the divider stays where released
   - Tuned iPad/coarse-pointer gutter to 40px after Stan testing

3. **ORB-242: Change Project clarity** — Renamed the dashboard command-bar project switcher:
   - Button label changed from "Search" to "Change Project"
   - Icon changed from magnifying glass to project-switch/swap icon
   - Project switcher modal title changed to "Change Project"
   - Search placeholder remains unchanged

4. **ORB-239: Accessibility hardening** — Completed as semantics/behavior work with no redesign:
   - Added named dialog semantics to SearchModal/project switcher, AppNav Commands, Distill Knowledge, SettingsCrudList, and SettingsAudit
   - Associated visible labels with weakly named controls in QueryResultsModal, SettingsCategories, and generic settings filters
   - Added descriptive confirmation wiring for todo delete, bulk todo delete, query-result delete, and settings delete confirmations
   - Updated FilterKebab to use a menu/menuitemradio pattern with Arrow, Home, End, Escape, Enter, and Space keyboard support

5. **Knowledge Repo** — Created linked durable entries:
   - ORB-196 handoff: `11451249-c43f-4499-a162-e174f452c82c`
   - ORB-241 resize handle: `343d8441-08a7-40bb-9ea2-c1bb4ecf245b`
   - ORB-242 Change Project: `96c17356-9c25-4599-85db-ea0650d1594e`
   - ORB-239 accessibility hardening: `e4d05597-88a9-42e7-bb94-4a139118ea5b`

### Closed Todos This Session

- **ORB-241** — Resize handle visibility
- **ORB-242** — Rename Search button to Change Project
- **ORB-239** — Accessibility sweep

### Uncommitted Changes

All files below have uncommitted changes in the working tree:

- `app/globals.css` — Skeleton shimmer CSS, filter kebab CSS, table row padding increase, divider visibility/touch gutter polish, Change Project comment update
- `components/ui/SkeletonRows.tsx` — NEW skeleton loading component
- `components/ui/FilterKebab.tsx` — NEW filter dropdown kebab component; keyboardable menu/menuitemradio accessibility pattern
- `components/ui/EmptyState.tsx` — Orb-illustrated empty states (prior session, uncommitted)
- `components/UnifiedDashboard.tsx` — SkeletonRows, FilterKebab, close button on filter bar, exact divider persistence, Change Project modal title
- `components/DragDivider.tsx` — Visible active drag state, separator semantics, pointer capture release
- `components/AppNav.tsx` — Change Project label/icon; Commands modal dialog semantics
- `components/TodoView.tsx` — SkeletonRows, FilterKebab, close button on filter bar, bulk delete confirmation description
- `components/UnifiedView.tsx` — SkeletonRows import + usage
- `components/AmbientDashboard.tsx` — SkeletonRows import + usage
- `components/DashboardProducts.tsx` — SkeletonRows import + usage
- `components/AddProductModal.tsx` — Modal footer conformity (btn-cancel/btn-primary/btn-danger)
- `components/DistillModal.tsx` — Modal footer conformity and named dialog semantics
- `components/TodoPanel.tsx` — Modal footer conformity and delete confirmation description
- `components/TodoForm.tsx` — Modal footer conformity
- `components/QueryResultsModal.tsx` — Modal footer conformity, EmptyState, label associations, delete confirmation description
- `components/OrbConversation.tsx` — "Ask Orb" text fix
- `components/OrbTour.tsx` — "Ask Orb" text fix
- `components/OrbHelp.tsx` — "Ask Orb" text fix
- `components/OrbPanel.tsx` — "Ask Orb" text fix
- `components/ui/SearchModal.tsx` — Header with title + X close button, optional title prop, named dialog semantics
- `components/settings/SettingsAccount.tsx` — SkeletonRows
- `components/settings/SettingsMaintenance.tsx` — SkeletonRows
- `components/settings/SettingsUserDetail.tsx` — SkeletonRows
- `components/settings/SettingsGroups.tsx` — SkeletonRows
- `components/settings/SettingsProjectTodos.tsx` — SkeletonRows
- `components/settings/SettingsFriction.tsx` — SkeletonRows
- `components/settings/SettingsCrudList.tsx` — SkeletonRows, named modal dialog semantics, generic filter label association, delete confirmation announcements/descriptions
- `components/settings/SettingsAudit.tsx` — Audit Entry modal dialog semantics
- `components/settings/SettingsCategories.tsx` — Category form label associations
- `components/settings/SettingsUrgency.tsx` — SkeletonRows
- `components/views/TaskChecklistView.tsx` — EmptyState
- `components/views/TaskListView.tsx` — EmptyState
- `lib/changelog.ts` — v0.5.201 and v0.5.202 release entries
- `lib/version.ts` — v0.5.202
- `package.json` — v0.5.202
- `docs/design-brief.md` — "Ask Orb" text fix
- `docs/ui-catalog.md` — Divider, Change Project, and accessibility contract updates
- `docs/orb-241-resize-handle-visibility-plan.md` — Durable plan/status file for ORB-241

Not staged for commit:
- `app/actions/dev-log.ts` — Antigravity artifact (untracked, can be deleted)
- `docs/Fix_Mobile_More_Dropdown.md` — Antigravity artifact (untracked, can be deleted)

### Verification

- `npm run lint` — passes; UI catalog verification passes; remaining 66 warnings are pre-existing baseline
- `NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/orb-eval.ts --tier 1` — Tier 1 7/7 passed

---

## Panel Transitions — Design Notes for Next AI

The orb panel and list panel currently use **conditional rendering** (mount/unmount) to show/hide. This means CSS transitions can't animate them — the element doesn't exist in the DOM before it appears.

**Current pattern** (UnifiedDashboard.tsx):
```
{showOrb && <OrbConversation ... />}
{showList && <div className="ud-list-content">...</div>}
```

**To add transitions, the next AI needs to:**
1. Keep both panels always mounted in the DOM
2. Use CSS classes to control visibility (`opacity`, `transform`, `pointer-events`)
3. Toggle a class like `panel--visible` / `panel--hidden` instead of conditional rendering
4. Add CSS transitions (~200ms) for the opacity/transform change
5. Use `pointer-events: none` on hidden panels to prevent interaction
6. Consider: hidden panels still run effects/subscriptions — may need to gate data fetching behind visibility state to avoid unnecessary API calls

**Complexity:** Medium-high. The panels have state (conversation history, scroll position) that benefits from staying mounted. But they also have polling/subscriptions that shouldn't run when hidden. Test on all three platforms — the resize handle between panels also needs to work correctly with always-mounted panels.

---

## Earlier Sessions

**ORB-196: Unified Toolbar + Modal Conformity — 2026-06-10 (Session 76, Claude Code)**
- Merged AppNav + CommandBar into single unified toolbar. SearchModal component. Modal footer standardization (btn-cancel/btn-primary/btn-danger). Empty states with OrbMini illustration. "Ask Orb" text consistency. Edge button toggle states for mobile.

**CSS Variable Uniformity Sweep (ORB-237) + More Kebab Fix (ORB-236) — 2026-06-10 (Session 75, Claude Code)**
- ORB-236: Fixed kebab button with textareaRef focus + preventDefault pattern. Beautified More menu.
- ORB-237: Replaced ~300 hardcoded text values with CSS variables. Three-tier responsive scaling. 40 files changed.

**Table Improvements completion (ORB-233) — 2026-06-08 (Session 72, Claude Code)**
- Single-column resize fix, table card shrink-wrap, stale localStorage fix, priorities simplification, tickets overflow menu, table headings, standardized action columns, removed Order columns, invitations kebab, Audit Log on SettingsCrudList, iPad touch stability. v0.5.177–v0.5.184.

---

## Key Decisions

- **Unified toolbar: same 6 buttons on all screens.** No desktop/mobile split. Search is a modal trigger button (Linear Cmd+K pattern), not an inline input. Orb and List are paired edge buttons with accent color.
- **Modal conformity:** All modals use `modal-footer` with `justify-content: flex-end`. Cancel = `btn-cancel` (looks like text). Primary = `btn-primary` (green fill). Delete = `btn-danger` (red fill) with `marginRight: auto` (far left). X close button top-right.
- **Filter presentation:** Kebab menus, not native selects or pills. Consistent with commands rule: styled dropdown triggered by a button. Accessibility contract: menu/menuitemradio pattern with keyboard support.
- **Accessibility hardening boundary:** No redesign unless a real contrast/motion failure is found. Prefer visible titles and labels as accessible names; attach destructive confirmation text to the final destructive action.
- **Resize divider behavior:** Do not snap the divider back to preset ratios after drag. Persist the exact user-selected position; use a 40px coarse-pointer gutter on iPad/touch.
- **Project switcher language:** The dashboard project selector is "Change Project", not "Search"; `SearchModal` remains reusable with a default title of "Search".
- **Empty states:** OrbMini SVG illustration + message. 5 variants. "Ask Orb" not "Ask the Orb".
- **Loading states:** Skeleton shimmer rows, never bare "Loading…" text.
- **Git push is NEVER automatic.** Structural enforcement via settings.local.json.
- **Disabled opacity normalized to 0.7** across the entire app.
- **Three-tier font scaling:** Desktop → Tablet (touch) → Phone.
- **Staging environment removed.** Two-tier workflow: localhost → production.
- **Orb identity: Brownie temperament, butler intelligence.**

---

## Next Priorities

1. **ORB-196: Panel transitions** — Animate orb/list pane show/hide. See "Panel Transitions — Design Notes" section above.
2. **ORB-240: Guided tour update** — Reflects empty state, "Ask Orb" wording, Change Project, and current toolbar behavior.
3. **Clean up Antigravity artifacts.** Delete or deliberately ignore `app/actions/dev-log.ts` and `docs/Fix_Mobile_More_Dropdown.md`.
4. **ORB-192: Data privacy model.** Gates behavioral observation, internet research, Orb memory.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Never `git push` without Stan's explicit in-chat approval** — structural enforcement via settings.local.json
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

## AI Tool Used Last Session

`2026-06-11 — Codex (GPT-5)`

---

*Updated by AI at end of each session. Committed with session code changes.*
