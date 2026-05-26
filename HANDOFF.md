# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.5.54 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**TodoView table layout, iPhone-first responsive design, update banner — 2026-05-25 (Session 22)**

### TodoView List Mode — Table Conversion (v0.5.48–v0.5.54, shipped)
- Replaced flex-row div layout with proper HTML `<table>` — column headers, select-all checkbox, labeled action buttons (Edit, Quick, Done) with bordered pill styling.
- iPhone-first responsive: on mobile, actions collapse below the title inside each row (no horizontal scrolling). On desktop, actions stay in their own column at the far right.
- Title clamped to 2 lines with ellipsis overflow (uses `max-width: 0` trick on `<td>` to force overflow).
- Removed status pills and priority indicators from list rows — redundant with active filters.
- Darkened table header with uppercase labels, increased row padding for readability.
- Project name moved to its own centered row above the table.

### TodoView Checklist Mode — Table Rebuild
- Rebuilt as a clean table with done-circle and title only — no bulk edits (use list view for bulk operations).

### Bug Fixes
- Fixed constant screen refreshing: background 30s poll was setting `loading = true` every cycle, flashing the entire list. Now only the initial load shows loading state.
- Fixed Safari iOS row borders: `border-bottom` on `<tr>` and `<td>` not rendering in iOS Safari. Switched to `box-shadow: inset 0 -1px 0 0 var(--border)` which renders reliably.
- Table uses `border-collapse: separate; border-spacing: 0` instead of `collapse` for iOS compatibility.

### Update Banner
- Centered button with "An application update is available" message to its right, replacing the previous right-aligned button + toast notification pattern.

### Prior Session (uncommitted, included in this commit)
- AmbientDashboard, TodoForm, TodoPanel, SettingsPlatforms, SettingsSidebar updates
- ProductConfigPanel deleted

---

## Uncommitted Changes

All changes from this session are committed and pushed. No local-only state.

---

## Key Decisions

- **iPhone-first table design.** TodoView table is designed mobile-first: actions collapse inline below title on iPhone, expand to their own column on desktop. No horizontal scrolling needed. *(v0.5.54, 2026-05-25)*
- **Box-shadow for iOS table row borders.** Safari iOS drops `border-bottom` on `<td>` even with `border-collapse: separate`. `box-shadow: inset 0 -1px 0 0` is the reliable cross-browser pattern. *(v0.5.54, 2025-05-25)*
- **No bulk edits in checklist mode.** Checklist is a quick tap-to-complete interface. Bulk operations belong in list view. *(v0.5.54, 2026-05-25)*
- **Background poll must not flash loading state.** `setLoading(true)` only on initial load, not on 30s poll refetches. *(v0.5.54, 2026-05-25)*
- **DB health is a first-class concern.** AGENTS.md now enforces design-time DB impact analysis and periodic health review for every session. See the Database Health section in AGENTS.md for canonical queries. *(2026-05-25)*
- **No Realtime subscriptions for single-user views.** `postgres_changes` causes continuous WAL decoding. `useVisibilityRefetch` is the correct pattern for this app. *(ORB-132, 2026-05-25)*
- **Indexes, not RLS, were the disk I/O problem.** The initplan fix from ORB-131 applied correctly. Missing indexes on `todos(product_id, status)` and `projects(created_by)` were the dominant cause. *(ORB-132, 2026-05-25)*
- **Dedicated `tickets` table replaces TICKETS project todos.** Two-layer model: tickets (reporter-facing) + todos (engineer-facing) linked by `ticket_id` FK. *(ORB-148, 2026-05-25)*
- **Checklist mode is per-project, persists to DB.** `projects.view_mode` column. *(ORB-155)*
- **Orb mode transition uses opacity fade, not CSS-only.** `transform-origin` is not animatable; opacity fade via React state is correct. *(ORB-156)*
- **`query_db` replaces whack-a-mole filter additions.** Declarative JSON query format. RLS-scoped. 200-row cap.
- **Email is the stable identity, not auth UUID.**
- **Atomic ID reconciliation via Postgres function.**
- **Lazy SDK initialization in server actions.**
- **Single source of truth for dormancy filtering.** `visibleProjectsQuery()` in `lib/projects.ts`.
- **Single source of truth for status classification.** `lib/status-groups.ts`.
- **Database is the source of truth — period.**
- **Single auth authority.** `getAuthContext()` / `requireAdmin()` in `lib/auth.ts`.
- **RLS is the safety net.** All new RLS policies use `(SELECT auth.uid())` wrapper.
- **Print is browser-native window.print().**

---

## Next Priorities

1. **DashboardView cleanup** — Stan wants to tackle the main dashboard page next session.
2. **DB Health monitoring** — Establish ongoing monitoring, design-time impact analysis, and periodic review process.
3. **JSON export/import** — second offboarding path (complement to print/PDF).
4. **iPhone update flow retest** — Stan deleted Home Screen PWA and will test UpdateBanner on next version bump.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

---

## AI Tool Used Last Session

`2026-05-25 — Claude Code (Claude Opus 4.6)`

---

*Updated by AI at end of each session. Committed with session code changes.*
