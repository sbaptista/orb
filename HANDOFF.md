# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.5.35 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**ORB-132, ORB-148 (in progress) — 2026-05-25 (Session 21)**

### ORB-132 — Disk I/O Budget Fix (v0.5.35, shipped)
- Root cause: missing indexes, not the RLS initplan fix (which was confirmed correct via `pg_get_expr`)
- `todos` had 60,094 sequential scans reading 10.7M rows — no index on `(product_id, status)`
- `projects` had 94,111 seq scans from the RLS correlated subquery on todos — no index on `created_by`
- `audit_log` had 3,293 seq scans — no index on `user_id` or `created_at`
- `system_settings` was at 1200% dead row bloat; `public.users` 300%; `projects` 270%
- **Fix:** `scripts/migrations/20260525_disk_io_indexes.sql` — 5 partial indexes added and applied
- **Fix:** Manual `VACUUM ANALYZE` run on 7 tables — dead rows cleared to 0 on all

### ORB-148 — Dedicated Ticketing System (IN PROGRESS — code written, DB migration not yet run)
- All code changes complete from the previous session (crash recovery confirmed):
  - `scripts/migrations/20260525_tickets_table.sql` — written, **NOT YET RUN against DB**
  - `app/actions/ticket-actions.ts` — fully rewritten (createTicket, updateTicketStatus, createTodoFromTicket, getTickets, dismissTicket)
  - `lib/email.ts` — sendWelcomeEmail + sendTicketStatusEmail added
  - `app/actions/orb-converse.ts` — create_ticket passes reportedBy; update_todo propagates to linked ticket
  - `components/TodoView.tsx` — ticket_id on Todo type; handleToggleDone + handleBulkMarkDone propagate
  - `components/TodoPanel.tsx` — status change propagates to linked ticket
  - `components/InlineEditPopover.tsx` — status change propagates to linked ticket
  - `components/settings/SettingsSidebar.tsx` — Tickets nav item added (admin-only)
  - `components/settings/SettingsTickets.tsx` — full admin UI (table, Create Todo inline form, Dismiss flow)
  - `app/settings/tickets/page.tsx` — page wired up
  - `app/actions/complete-onboarding.ts` — welcome email on onboarding

**Still to do for ORB-148:**
1. Run `scripts/migrations/20260525_tickets_table.sql` against the DB
2. Run `npm run build` to verify TypeScript
3. Migration of existing TICKETS todos → tickets table (one-time script, not yet written)
4. Answer open question: Orb `update_ticket` tool? (currently only affects tickets via linked todo)

---

## ORB-148 Implementation Plan Summary

The full plan is at `/Users/stanleybaptista/.gemini/antigravity/brain/127a1ebd-b820-4b5a-ab76-68a651038cae/implementation_plan.md`. Key points:

**New `tickets` table** — replaces todos-in-Tickets-project:
- Fields: `ticket_number`, `type`, `source`, `summary`, `detail`, `conversation_snippet`, `reported_by UUID → users`, `status` (open/in_progress/closed/dismissed), `dismiss_reason`, `todo_id UUID → todos`, `notified_in_progress`, `notified_closed`

**New `ticket_id UUID` column on `todos`** — the coordination link

**Status propagation:** when a linked todo changes status → ticket status updates → reporter gets push + email notification (with dedup via `notified_*` flags)

---

## Uncommitted Changes

### Modified
- `app/actions/complete-onboarding.ts` — welcome email on onboarding
- `app/actions/orb-converse.ts` — create_ticket passes reportedBy; update_todo propagates to ticket
- `app/actions/ticket-actions.ts` — full rewrite for tickets table
- `components/InlineEditPopover.tsx` — ticket status propagation
- `components/TodoPanel.tsx` — ticket status propagation
- `components/TodoView.tsx` — ticket_id field; propagation in toggle/bulk handlers
- `components/settings/SettingsSidebar.tsx` — Tickets nav item
- `lib/email.ts` — sendWelcomeEmail + sendTicketStatusEmail
- `lib/changelog.ts` — v0.5.35 entry
- `lib/version.ts` — v0.5.35
- `package.json` — v0.5.35

### New (untracked)
- `app/settings/tickets/page.tsx`
- `components/settings/SettingsTickets.tsx`
- `scripts/migrations/20260525_tickets_table.sql`
- `scripts/migrations/20260525_disk_io_indexes.sql`

---

## Key Decisions

- **Indexes, not RLS, were the disk I/O problem.** The `initplan` fix from ORB-131 applied correctly. The real cause was missing indexes on `todos(product_id, status)` and `projects(created_by)` — causing 60k+ seq scans. *(ORB-132, 2026-05-25)*
- **Dedicated `tickets` table replaces TICKETS project todos.** The TICKETS project approach conflated external-facing reporter experience with internal work tracking. A two-layer model (tickets + todos linked by `ticket_id` FK) is the correct architecture. Migration will preserve all existing ticket data. *(Decision reached ORB-148 planning, 2026-05-25)*
- **Checklist mode is per-project, persists to DB.** `projects.view_mode` column drives it. *(ORB-155, 2026-05-25)*
- **Orb mode transition uses opacity fade, not CSS-only.** `transform-origin` is not animatable in CSS; opacity fade via React state is the correct workaround. *(ORB-156, 2026-05-25)*
- **Persist conversation transcript across page transitions.** Previously, `AmbientDashboard` completely cleared `SS_CONVERSATION` on mount. Reading from `sessionStorage` on mount preserves context. *(ORB-154)*
- **`query_db` replaces whack-a-mole filter additions.** Declarative JSON query format with table allowlist, filter array, select, order, limit. RLS-scoped. 200-row cap.
- **Keep `query_todos` for simple lookups.** `query_db` supplements it for complex/structural questions.
- **Shift top-right navigation instead of hiding.** Hiding the navigation buttons in dialogue mode degrades UX.
- **Email is the stable identity, not auth UUID.** Supabase can replace auth UUIDs on invite/re-invite.
- **Atomic ID reconciliation via Postgres function.** Supabase JS client can't do multi-statement transactions.
- **Lazy SDK initialization in server actions.** Module-scope SDK constructors crash Vercel function chunks.
- **Insight engine is zero-cost.** Pure computation on server — no AI calls.
- **Single source of truth for dormancy filtering.** `visibleProjectsQuery()` in `lib/projects.ts`.
- **Single source of truth for status classification.** `lib/status-groups.ts` — ACTIVE (open + in progress), PARKED (deferred + on hold).
- **Database is the source of truth — period.** No silent scoping, no in-memory divergence.
- **Single auth authority.** `getAuthContext()` / `requireAdmin()` in `lib/auth.ts`. Exceptions: `complete-onboarding.ts`, `friction-actions.ts` / `ticket-actions.ts` (system-level), REST API routes.
- **RLS is the safety net.** Regular Supabase client for user operations, admin client only for intentional cross-user access.
- **Print is browser-native window.print().** No jspdf/html2canvas dependencies.

---

## Next Priorities

1. **ORB-148** — Run the DB migration (`20260525_tickets_table.sql`), then `npm run build`, then write the one-time TICKETS→tickets migration script.
2. **JSON export/import** — second offboarding path (complement to print/PDF).
3. **iPhone update flow retest** — Stan deleted Home Screen PWA and will test UpdateBanner on next version bump (v0.5.35 is a good candidate).

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing

---

## AI Tool Used Last Session

`2026-05-25 — Antigravity (Claude Sonnet 4.6 Thinking)`

---

*Updated by AI at end of each session. Committed with session code changes.*
