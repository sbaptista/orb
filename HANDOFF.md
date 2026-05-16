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

**SettingsCrudList, dynamic statuses, Orb hardening, bug triage — v0.4.67**

### ORB-104 — Reusable CRUD component (closed)
- Created `SettingsCrudList<T,F>` generic component with table/list layouts, config-driven render props, onAdd/onDelete/onMove hooks, scope filters, delete guards, idColumn override.
- Migrated Priorities, Statuses, Categories to use it. Remaining settings pages are specialized (Users, Tickets, Data) — don't fit the pattern. Groups/Platforms hidden from sidebar.
- Knowledge repo entry created.

### Dynamic statuses — replace hardcoded 'open' (v0.4.67)
- Migration `20260515_status_is_open.sql` executed: added `is_open boolean` column, set on 'open' status.
- Replaced hardcoded `'open'` in 6 files: manage-todo.ts, orb-converse.ts, tasks/route.ts, TodoForm.tsx, TodoView.tsx, SettingsFriction.tsx. All now query `statuses` for `is_open = true`.
- Updated `StatusDef` type and all status queries to include `is_open`.
- Added `is_open`/`is_closed` to `get-user-detail.ts` and `QueryResultsModal.tsx`.

### Statuses UI hardening
- Pinned open (top) and closed (bottom) — no nav buttons shown, can't be deleted.
- New statuses insert second-to-last (before closed). Deletes recompact sort_order.
- Badges: "Open" and "Closed" pills, dash for others. No internal flags exposed to user.
- Removed `is_closed` checkbox from add/edit form (not user-changeable).

### Priorities UI
- Migrated to SettingsCrudList with table layout. Custom RPC reorder, value-based ID.

### Orb AI hardening
- Added integrity rules for unknown status/priority terms (don't guess, list options, ask user).
- Guarded `JSON.parse` on streaming tool inputs — prevents "System error" on malformed streams.
- Strengthened scope instruction: AI must always pass explicit `product_code` on create_todo when scoped.
- Added console.warn when create_todo called without product_code while scoped.

### ORB-102 — Permission Denied on user detail (closed)
- PGRST116 was transient, user exists in both tables. Added structured console.error logging to all `.single()` calls in get-user-detail.ts for future diagnosis.

### ORB-95 — Todo sent to wrong project (closed)
- AI omitted product_code, fell back correctly to UI project. Strengthened system prompt scope instruction.

### ORB-94 — Show list displays all tasks instead of filtered subset (closed)
- Already resolved by integrity rules redesign (ORB-78). Closed as duplicate.

### Other
- Clear transcript button added to Orb input toolbar.
- Removed Platforms from settings sidebar.

### Uncommitted files (in main, not yet pushed)
- `app/actions/get-user-detail.ts` — error logging on .single() calls
- `app/actions/orb-converse.ts` — scope instruction + product_code warning

---

## Key Decisions

- **Two-layer security model:** RLS for dashboard (owner-only at DB level), server actions for Settings (role-based admin access via `createAdminClient()`).
- **Settings is for administration, not task management.** Todo CRUD removed from Settings; project todos are view-only. Use the Todos page for mutations.
- **Account is not a Settings page.** It's a standalone page accessible from the dashboard user button.
- **Product codes are required.** The conversational AI resolves todos by splitting task codes (e.g., `ORB-73`). Null codes break this.
- **Status names are DB-driven.** The `statuses` table is the single source of truth. Code uses `is_open`/`is_closed` flags, never hardcoded status strings. FK with `ON UPDATE CASCADE` ensures renames propagate automatically.
- **Reference tables need public SELECT policies.** Supabase ALL policies don't reliably grant SELECT to browser clients. Always add explicit SELECT policies.
- **Open is pinned at sort_order 1, closed at max.** Neither can be deleted or reordered. New statuses insert before closed. Deletes recompact all sort_orders.

---

## Next Priorities

1. **ORB-96/97 — Push notifications + due dates.** Stan flagged these as scope creep that changes Orb from a simple todo system. Need Stan's decision on whether to close as out-of-scope or keep for future consideration.

2. **ORB-92 — Task relationships and dependencies.** AI-filed from ORB-87 gap analysis. Speculative, P5, no concrete use case yet. Left open with audit notes.

3. **ORB-86 — Help system audit.** Open, no priority set.

4. Review remaining open Orb tickets from the backlog.

---

## AI Tool Used Last Session

`2026-05-15 — Claude Code (Anthropic Claude Opus 4.6)`

---

*Updated by AI at end of each session. Committed with session code changes.*
