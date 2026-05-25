# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.5.37 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**ORB-132 (closed), ORB-148 (closed) — 2026-05-25 (Session 21)**

### ORB-132 — Disk I/O Budget Fix (v0.5.35–v0.5.36, shipped)
- **Root cause 1:** Missing indexes → 60k seq scans on todos, 94k on projects. Fixed with 5 partial indexes in `scripts/migrations/20260525_disk_io_indexes.sql`.
- **Root cause 2:** `postgres_changes` Realtime subscription in `TodoView.tsx` was consuming **80% of all DB query time** (1M WAL reads/day). Removed — `useVisibilityRefetch` is sufficient.
- VACUUM ANALYZE on 7 bloated tables (system_settings was 1200% dead rows).
- pg_prewarm installed; new indexes and hot tables prewarmed.
- **AGENTS.md updated** with mandatory DB health section: design-time impact checklist, Realtime rule, periodic inspection queries, index conventions.

### ORB-148 — Dedicated Ticketing System (v0.5.37, shipped, closed)
- `scripts/migrations/20260525_tickets_table.sql` applied — `tickets` table + `ticket_id` FK on todos + trigger + RLS (initplan-safe) + 3 indexes.
- `scripts/migrations/migrate-tickets-todos.js` run — 2 historical TICKETS todos migrated; TICKETS project marked dormant.
- All code from previous session confirmed: ticket-actions.ts, SettingsTickets.tsx, orb-converse.ts propagation, TodoView/Panel/InlineEditPopover propagation, email templates, welcome email on onboarding.
- Build verified clean (TypeScript passes, /settings/tickets in route table).
- ORB-148 closed with resolution notes.

---

## Uncommitted Changes

All changes from this session are committed and pushed. No local-only state.

---

## Key Decisions

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

1. **DB Health monitoring** (new todo) — Establish ongoing monitoring, design-time impact analysis, and periodic review process. The AGENTS.md section is the start; the todo asks for a more comprehensive, lasting solution (e.g. automated health snapshots, cron-based alerts).
2. **JSON export/import** — second offboarding path (complement to print/PDF).
3. **iPhone update flow retest** — Stan deleted Home Screen PWA and will test UpdateBanner on next version bump.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

---

## AI Tool Used Last Session

`2026-05-25 — Antigravity (Claude Sonnet 4.6 Thinking)`

---

*Updated by AI at end of each session. Committed with session code changes.*
