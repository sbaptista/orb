# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads this at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.4.89 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**Single source of truth for Orb AI — 2026-05-19**

Stan identified a fundamental trust problem: the Orb was parroting numbers from a pre-computed INSIGHTS engine that its own tools couldn't verify. When challenged, the AI admitted it couldn't reproduce the counts. Multiple data paths were producing conflicting numbers.

### 1. Removed INSIGHTS injection from system prompt (v0.4.88)

`computeInsights()` was injected into every AI conversation turn — a summary line with counts and pattern-detection insights. The AI treated these as authoritative and quoted them without verification. Removed:

- `computeInsights()` call from `buildContext()` (code preserved in `lib/insights.ts`)
- INSIGHTS block + PROACTIVE BEHAVIOR instructions from AI system prompt
- Greeting reworked to use backlog context (same ACTIVE/PARKED split the conversation sees)

### 2. query_todos made trustworthy (v0.4.89)

- **`status_group` param** — `"active"` (open + in progress) or `"parked"` (deferred + on hold), using `isActive()`/`isParked()` from `status-groups.ts`. Same source of truth as the backlog context.
- **Default `max_results` raised** from 10 to 100 — if there are 44 non-closed items, the AI returns all 44.
- **`show_results` flag** — defaults true. Set false for internal queries so the UI doesn't show an irrelevant list when the AI is counting or verifying.

### 3. Eliminated undefined display codes (v0.4.89)

Dormant project (CAN26) todos were in `todoList` but their project wasn't in `productList` (excluded by `visibleProjectsQuery`). Result: `undefined-10`, `undefined-23`, etc.

- `todoList` now filtered to visible projects only — dormant project todos excluded at the source
- `todoCode()` helper — all display code construction goes through one function, falls back to `'???'` never `undefined`

### 4. Dormant project visibility for admins (v0.4.89)

- Dormant projects listed in backlog context as a DORMANT section (code only, no todos, no CRUD)
- System prompt tells AI to answer dormant questions from context, not query
- `set_dormancy` tool already supports awakening — admin can say "wake up CAN26" in Orb

---

## Uncommitted Changes

None — all pushed.

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
*   **INSIGHTS suspended from AI prompt.** `computeInsights()` code preserved in `lib/insights.ts` but not injected into system prompt. Value didn't override the trust cost — AI parroted unverifiable numbers. Greeting and conversation now use the same backlog context as the single data path.
*   **query_todos is the AI's single verification path.** `status_group`, `show_results`, and raised default limit ensure the AI can reproduce any number it states.

---

## Next Priorities

1. **Test count consistency** — Verify Orb greeting, conversation, and query_todos all report matching numbers after deploy.
2. **Close ORB-113** — move_todo + auth consolidation was completed but not formally closed. Write resolution notes + knowledge repo entry.
3. **ORB-116** — Build Helm-style offline page to replace OfflineBanner.
4. **ORB-109** — Session persistence.
5. **Re-evaluate INSIGHTS** — If a future use case emerges (e.g., pattern detection as a separate tool the AI can choose to call), the code is ready in `lib/insights.ts`.

---

## AI Tool Used Last Session

`2026-05-19 — Claude Code (claude-opus-4-6)`

---

*Updated by AI at end of each session. Committed with session code changes.*
