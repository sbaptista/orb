# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads this at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** see `/Users/stanleybaptista/Projects/orb/package.json` (canonical)
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**Priority hardcoding elimination + build fixes — v0.4.64 (committed)**

### ORB-100 — Remove hardcoded priority colors and urgency thresholds (closed)
- **Testing verified**: Priority 1 displays orange `#a05010`, no priority displays light gray `var(--border)`. System fully data-driven from DB.
- **Resolution notes recorded** on ORB-100 in Orb app.
- **Migration** (`20260515_priority_columns.sql`): Added `color` and `is_urgent` columns to priorities table. Set priority 1 as urgent with color `#a05010`.
- **Code changes** (7 files):
  - **AmbientDashboard.tsx** — Fetches priorities on mount. `computeUrgency()` now accepts `urgentValues` set and checks `is_urgent` flag instead of `priority_value === 1`. Passes `priorityColorMap` to OrbConversation.
  - **OrbConversation.tsx** — New `priorityColors: Map<number, string>` prop. OrbCard uses it for priority dot colors.
  - **TodoView.tsx** — `priorityMap` now maps to full Priority objects. Priority dot uses `priorityMap.get(value)?.color`.
  - **TodoPanel.tsx** — Updated to use `statuses` prop and dynamic priority fetching (completed in prior session).
  - **QueryResultsModal.tsx** — Eager priority fetch in useEffect, `priorityColorMap` for priority dots (completed in prior session).
  - **SettingsFriction.tsx** — Looks up urgent priority via `is_urgent = true` query instead of hardcoded `1`. Uses `.maybeSingle()` to safely get the value.
  - **seed-can26.ts** — Queries urgent priority value from DB instead of hardcoded `1`.
- **Debugging**: Added console.log to SettingsFriction for priority lookup. When testing Settings > Tickets, check browser console to confirm urgent priority is found.

### Build fix — v0.4.64 (committed)
- **Type error**: OrbDevPanel was missing `roleOverride` and `onRoleOverrideChange` props in AmbientDashboard.
- **Fix**: Added `roleOverride` state to AmbientDashboard and passed props to OrbDevPanel.
- **Build**: Should now pass TypeScript check and deploy successfully.

---

**Status hardcoding elimination — v0.4.63**

### ORB-91 — False positive ticket
- Investigated auto-generated ticket (PGRST116 on SettingsUserDetail load). Confirmed the page uses `createAdminClient()` which bypasses RLS — error was fabricated by the conversational Orb AI via `create_ticket`.
- Closed ORB-91 with resolution notes. Created knowledge repo entry documenting that `orb-auto` tickets can contain AI-fabricated error details.

### Database migration (`20260515_status_fk.sql`)
- Dropped brittle `todos_status_check` CHECK constraint (hardcoded `open`, `in_progress`, `on_hold`, `done`).
- Migrated existing todo rows: 111 `done` → `closed`, 14 `on_hold` → `on hold`.
- Added `UNIQUE` constraint on `statuses.name`.
- Added FK `todos.status → statuses.name` with `ON UPDATE CASCADE ON DELETE RESTRICT`. Renaming a status in the `statuses` table now cascades automatically to all todos.

### Code changes (12 files)
- **TodoView.tsx** — Removed hardcoded `Status` type union and `STATUS_COLOR` map. Fetches statuses from DB. Uses `isClosed()` helper (checks `is_closed` flag) and `statusColor()` (generates CSS var from status name). Filter dropdown populated dynamically.
- **TodoPanel.tsx** — Accepts `statuses` prop. Uses `is_closed` flag instead of `=== 'done'`. Dynamic status dropdown.
- **QueryResultsModal.tsx** — Accepts `statuses` prop. Replaced `STATUS_COLOR` map with `statusColor()` function. Dynamic dropdown in inline editor.
- **OrbConversation.tsx** — Updated `'done'` → `'closed'` for result styling.
- **AmbientDashboard.tsx** — Updated `'done'` → `'closed'` for open todo filtering and urgency computation.
- **orb-converse.ts** — Removed `'done'` fallback in closing status detection; relies solely on `is_closed` flag from statuses table.
- **orb-contract.ts** — Removed hardcoded `enum: ["open", "done"]` from `update_todo` tool schema; AI now uses status names from system prompt context.
- **app/api/tasks/[id]/route.ts** — Looks up `is_closed` from statuses table instead of `=== 'done'` to set `closed_at`.
- **globals.css** — Renamed `--status-done` → `--status-closed`.
- **archive-data.ts**, **archive-todos.ts** — Updated fallback status names.
- **seed-can26.ts** — Updated status mapping (`done` → `closed`, `on-hold` → `on hold`).

### Commits in this session

**v0.4.64** (priority hardcoding elimination):
- f46a004: docs: Update HANDOFF — ORB-100 complete, mark remaining issues
- Earlier: Priority refactor changes (7 files)

**v0.4.64** (build fixes):
- c91eaba: fix: Add missing roleOverride props to OrbDevPanel

All changes committed to main:

- `package.json` — version 0.4.64
- `lib/version.ts` — version 0.4.64
- `app/globals.css` — `--status-closed` CSS variable (from v0.4.63)
- `app/actions/archive-data.ts` — fallback update (from v0.4.63)
- `app/actions/orb-converse.ts` — removed `'done'` fallback (from v0.4.63)
- `app/api/tasks/[id]/route.ts` — dynamic `is_closed` lookup (from v0.4.63)
- `components/TodoView.tsx` — dynamic statuses + priorities (mixed)
- `components/TodoPanel.tsx` — `statuses` prop, dynamic dropdown (from v0.4.63)
- `components/QueryResultsModal.tsx` — `statuses` + `priorityColorMap` (mixed)
- `components/OrbConversation.tsx` — `priorityColors` prop, dynamic priority dots (NEW)
- `components/AmbientDashboard.tsx` — fetch priorities, dynamic urgency (NEW)
- `components/settings/SettingsFriction.tsx` — dynamic urgent priority lookup (NEW)
- `lib/orb-contract.ts` — removed hardcoded status enum (from v0.4.63)
- `scripts/migrations/20260515_status_fk.sql` — status migration (executed in v0.4.63)
- `scripts/migrations/20260515_priority_columns.sql` — priority migration (executed in v0.4.64)
- `scripts/archive-todos.ts` — fallback update (from v0.4.63)
- `scripts/seed-can26.ts` — dynamic urgent priority lookup (NEW)

---

## Key Decisions

- **Two-layer security model:** RLS for dashboard (owner-only at DB level), server actions for Settings (role-based admin access via `createAdminClient()`).
- **Settings is for administration, not task management.** Todo CRUD removed from Settings; project todos are view-only. Use the Todos page for mutations.
- **Account is not a Settings page.** It's a standalone page accessible from the dashboard user button.
- **Product codes are required.** The conversational AI resolves todos by splitting task codes (e.g., `ORB-73`). Null codes break this.
- **Status names are DB-driven.** The `statuses` table is the single source of truth. Code uses `is_closed` flag, never hardcoded status strings. FK with `ON UPDATE CASCADE` ensures renames propagate automatically.

---

## Next Priorities

1. **Vercel deployment**: Latest commit (c91eaba) should now build successfully. Monitor the deployment.
2. **Settings > Tickets priority lookup**: Returns null when generating tickets. Debug logs in SettingsFriction.tsx — check browser console to see what the urgent priority query returns. May be RLS or timing issue.
3. **Orb multi-todo query filtering**: When asking for "show ORB-102, ORB-103, ORB-104", only ORB-104 is returned. Root cause in `app/actions/orb-converse.ts` query logic — likely not passing all matched todos to results.
4. Create reusable page/component templates (topbar+back, CRUD list, detail view) so new pages are assembled from existing parts.
5. Review open Orb tickets from the Friction Queue.

---

## AI Tool Used Last Session

`2026-05-14 — Claude Code (Anthropic Claude Opus 4.6 / Haiku 4.5)`

---

*Updated by AI at end of each session. Committed with session code changes.*
