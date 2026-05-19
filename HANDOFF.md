# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads this at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.4.90 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**Single source of truth for Orb AI — 2026-05-19**

1. **Stop Processing button built (ORB-118)**
   - Exposed `onStop` callback prop from `AmbientDashboard` to `OrbConversation`.
   - Replaced Send button with a red pulsing Stop button when `submitting` is true.
   - Handled stream cancellation gracefully by breaking the chunk loop, resetting loading state immediately, and preventing error notifications when aborted by the user.
2. **Restored building rule in AGENTS.md**
   - Added rule to `AGENTS.md` to prevent building/implementing changes without explicit permission/confirmation from Stan.
3. **Bumped version**
   - Bumped to `0.4.90` in `package.json` and `lib/version.ts`.

---

## Uncommitted Changes

- **[AGENTS.md](file:///Users/stanleybaptista/Projects/orb/AGENTS.md)**: Added rule to never build/implement changes without explicit permission from Stan.
- **[components/OrbConversation.tsx](file:///Users/stanleybaptista/Projects/orb/components/OrbConversation.tsx)**: Added stop button layout & styling and destructured `onStop`.
- **[components/AmbientDashboard.tsx](file:///Users/stanleybaptista/Projects/orb/components/AmbientDashboard.tsx)**: Handled stop control refs, `handleStop` function, and chunk loop exit.
- **[package.json](file:///Users/stanleybaptista/Projects/orb/package.json)**: Bumped version to `0.4.90`.
- **[lib/version.ts](file:///Users/stanleybaptista/Projects/orb/lib/version.ts)**: Bumped version to `v0.4.90`.
- **[.claude/settings.local.json](file:///Users/stanleybaptista/Projects/orb/.claude/settings.local.json)**: Local settings updated.

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
3. **ORB-109** — Session persistence.
4. **ORB-116** — Build Helm-style offline page.
5. **Re-evaluate INSIGHTS** — If a future use case emerges (e.g., pattern detection as a separate tool the AI can choose to call), the code is ready in `lib/insights.ts`.

---

## AI Tool Used Last Session

`2026-05-19 — Antigravity (Gemini 2.5 Pro)`

---

*Updated by AI at end of each session. Committed with session code changes.*
