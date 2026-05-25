# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.5.30 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**query_db tool planning + ORB-146 AI context audit + ticket elimination — 2026-05-24 (Session 17)**

### Completed this session:
1. **Ticket system elimination** — Replaced the `tickets` table with a dedicated TICKETS project. Updated `ticket-actions.ts`, deleted `SettingsTickets.tsx` and `app/settings/tickets/page.tsx`, removed sidebar link, ran `DROP TABLE tickets` migration. All feedback now flows through `createTicket()` as todos in the TICKETS project.
2. **ORB-146: Comprehensive AI context audit** — Classified all 135 columns across 15 tables. Added project-user mapping (`userMap`), enriched todo data (groups, categories, URLs), priority urgency flags, knowledge repo tags + origin task codes, invitation details with decline reasons, user listing for admins.
3. **Fixed query_todos default behavior** — Now returns ALL statuses by default (was silently excluding closed). Added QUERY STRATEGY section to system prompt.
4. **Fixed Orb hallucination root cause analysis** — Identified that pre-built tool handlers with fixed filters force AI to post-process large result sets, leading to fabrication (28 fake tasks with URLs when only 1 exists).
5. **Designed `query_db` tool** — Full plan written and approved. See `docs/query-db-plan.md`.
6. **Created ORB-148** — Future: notify users when feedback todos are addressed (needs `reported_by` field).
7. **Version bumps** — v0.5.24 through v0.5.27 across sessions.

### NOT yet implemented:
- **`query_db` tool** — Plan is approved and saved to `docs/query-db-plan.md`. Implementation not started. Next agent should read that plan and implement it.

---

## Uncommitted Changes

### Modified
- `app/actions/orb-converse.ts` — ORB-146 context enrichment (userMap, todoLine, query_todos default-to-all, QUERY STRATEGY prompt section, enriched result mapping with owner/group/category/urls)
- `lib/orb-contract.ts` — Updated query_todos description, added has_urls/has_group/has_category params (NOTE: these should be reverted as part of query_db implementation — they're superseded)
- `lib/version.ts` — v0.5.27
- `package.json` — v0.5.27
- `HANDOFF.md` — this file
- `.claude/settings.local.json` — local settings

### Deleted
- `components/settings/SettingsTickets.tsx` (committed in earlier push)
- `app/settings/tickets/page.tsx` (committed in earlier push)

### New
- `docs/query-db-plan.md` — Full implementation plan for the query_db tool
- `docs/orb-monetization-strategy.md` — (unrelated, pre-existing untracked)
- `docs/orb_competitive_analysis (Perplexity).md` — (unrelated, pre-existing untracked)
- `supabase/` — (unrelated, pre-existing untracked)

---

## Key Decisions

*   **`query_db` replaces whack-a-mole filter additions.** Instead of adding filter params to `query_todos` one at a time, give Orb direct read-only DB access via Supabase query builder. Declarative JSON query format with table allowlist, filter array, select, order, limit. RLS-scoped for regular users, admin bypass for admins. 200-row cap. See `docs/query-db-plan.md`.
*   **Keep `query_todos` for simple lookups.** `query_db` supplements it for complex/structural questions. System prompt guides routing.
*   **Ticket system → TICKETS project.** Feedback (bugs, suggestions, capability gaps, workflow friction) stored as todos in a dedicated TICKETS project instead of a separate tickets table.
*   **Shift top-right navigation instead of hiding.** Hiding the navigation buttons in dialogue mode degrades UX. Moving them 88px left clears space.
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
*   **Print is browser-native window.print().** No jspdf/html2canvas dependencies.

---

## Next Priorities

1. **Implement `query_db` tool** — Plan approved in `docs/query-db-plan.md`. Create `lib/db-schema.ts`, add tool to `lib/orb-contract.ts`, add handler in `orb-converse.ts`, update system prompt, update `docs/api-spec.yaml`. Revert partial `has_urls`/`has_group`/`has_category` from `orb-contract.ts`. Version bump + changelog after.
2. **ORB-148** — Notify users when feedback todos are addressed (needs `reported_by` field on todo + notification mechanism).
3. **ORB-132** — Verify RLS initplan fix impact on Supabase disk I/O budget.
4. **JSON export/import** — second offboarding path (complement to print/PDF).
5. **iPhone update flow retest** — Stan deleted Home Screen PWA and will test UpdateBanner on next version bump.

---

## AI Tool Used Last Session

`2026-05-24 — Claude Code (Claude Opus 4.6)`

---

*Updated by AI at end of each session. Committed with session code changes.*
