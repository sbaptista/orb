# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.5.14 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**RLS initplan optimization (ORB-131) — 2026-05-22 (Session 10)**

1. **Fixed RLS initplan policies** (`scripts/migrations/20260522_rls_initplan_fix.sql`)
   - Rewrote all 39 RLS policies to wrap `auth.uid()` in `(select auth.uid())` and `auth.role()` in `(select auth.role())`.
   - Postgres now evaluates auth functions once per query (InitPlan) instead of once per row.
   - Root cause of Supabase disk I/O budget depletion.

2. **Consolidated priorities policies**
   - Dropped 3 redundant individual policies (insert/update/delete) that overlapped with the `ALL` policy.
   - Total policies: 43 → 40.

3. **Dropped duplicate index**
   - `statuses_name_unique` constraint was identical to `statuses_name_key`. Removed.

4. **Verified clean state**
   - Zero policies with bare `auth.uid()` remaining.
   - Dead tuple counts minimal, autovacuum running normally.
   - `orb_friction` and `tickets` tables confirmed correct (RLS on, no policies = service-role-only access).

5. **Closed ORB-130 (duplicate) and ORB-131** with resolution notes + knowledge repo entry.

---

## Uncommitted Changes

### Modified
- `HANDOFF.md` — this file

### Deleted
- None

### New
- `scripts/migrations/20260522_rls_initplan_fix.sql` — RLS initplan fix migration (already executed)

---

## Key Decisions

*   **Email is the stable identity, not auth UUID.** Supabase can replace auth UUIDs on invite/re-invite.
*   **Atomic ID reconciliation via Postgres function.** Supabase JS client can't do multi-statement transactions.
*   **Lazy SDK initialization in server actions.** Module-scope SDK constructors crash Vercel function chunks.
*   **Insight engine is zero-cost.** Pure computation on server — no AI calls.
*   **Conversational tuning over settings UI.** User tells the Orb scope preferences, AI respects them.
*   **Single source of truth for dormancy filtering.** `visibleProjectsQuery()` in `lib/projects.ts`.
*   **Single source of truth for status classification.** `lib/status-groups.ts` — ACTIVE (open + in progress), PARKED (deferred + on hold). All consumers import from here.
*   **"Active" not "open" for counts.** Active = open + in progress. Parked = deferred + on hold. "Open" is a specific status only.
*   **"Busy" not "active" for urgency state.** The Orb surface shows BUSY/CALM/URGENT. "Active" is reserved for the status grouping.
*   **Database is the source of truth — period.** No silent scoping, no in-memory divergence.
*   **Single auth authority.** `getAuthContext()` / `requireAdmin()` in `lib/auth.ts` is the only path. Exceptions: `complete-onboarding.ts` (bootstrap), `friction-actions.ts` / `ticket-actions.ts` (system-level), REST API routes (shared secret).
*   **RLS is the safety net.** Regular Supabase client for user operations, admin client only for intentional cross-user access.
*   **Admin insights split "yours" vs "all".** Admins see all users' data via RLS bypass — insights summary separates own-project counts from cross-user totals so numbers align with the Orb surface.
*   **INSIGHTS suspended from AI prompt.** `computeInsights()` code preserved in `lib/insights.ts` but not injected into system prompt. Greeting and conversation now use the same backlog context as the single data path.
*   **query_todos is the AI's single verification path.** `status_group`, `show_results`, and raised default limit ensure the AI can reproduce any number it states.
*   **Outer container layout for floating menus.** Interactive absolute-positioned dropdowns must live outside overflow-clipped cards to prevent clipping, positioned relatively to the parent container wrapper.
*   **Push notifications fire from all mutation paths.** Both Orb conversation (`orb-converse.ts`) and direct UI edits (`TodoPanel`, `TodoView`, `TodoForm`) use shared `snapshotUrgency` / `checkAndNotifyEscalation` to detect urgency escalation.
*   **Slash commands are fill-only.** Selecting a command fills the input with placeholder selected — never auto-submits. Consistent with Claude Code's slash command behavior.
*   **Client-side dynamic version comparisons.** Server routes with cache headers guarantee clean responses bypassing cache networks.
*   **Consolidated connectivity gates.** Centralized online validation in fullscreen pages keeps modular UI elements clean of duplicate connection hook listeners.

---

## Next Priorities

1. **ORB-129 Phase 5 (iOS widget)** — shelved until Xcode + Apple Developer account are available. Phases 1–3 complete.
2. **ORB-129 Phase 4 (Email digest)** — daily/weekly orb state summary via Resend. Infrastructure exists.
3. **Offline editing with sync** — discussed but requires full data layer rewrite (IndexedDB + conflict resolution). Not scoped yet.

---

## AI Tool Used Last Session

`2026-05-22 — Claude Code (Opus 4.6)`

---

*Updated by AI at end of each session. Committed with session code changes.*

