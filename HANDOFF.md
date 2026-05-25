# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.5.33 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**Interactive OTP Email (ORB-151) — 2026-05-24 (Session 20)**

1. **Clickable OTP Verification Link**: Configured a custom magic_link email template at `supabase/templates/magic_link.html` and registered it in `supabase/config.toml`. The 6-digit verification code is now a clickable link pointing to the verification page with the code in the query parameters.
2. **Auto-Fill, Auto-Copy, and Auto-Verify**: Updated `/auth/verify-otp` to parse the `code` query parameter on mount, automatically copy it to the user's clipboard, pre-fill the OTP input field, and auto-submit the form for validation to provide a seamless magic-link style login experience.
3. **Version bump** — Bumped version to `0.5.33` across `package.json`, `lib/version.ts`, and `lib/changelog.ts`.
4. **Verification** — Ran a successful Next.js production build locally.

---

## Uncommitted Changes

### Modified
- `package.json` — Version bump to v0.5.33
- `lib/version.ts` — Version bump to v0.5.33
- `lib/changelog.ts` — Added v0.5.33 release notes
- `app/auth/verify-otp/page.tsx` — Parse query param code, auto-copy, and auto-submit
- `app/globals.css` — Added .auth-success class
- `supabase/config.toml` — Added magic_link template config
- `HANDOFF.md` — this file

### Deleted
- None

### New
- `supabase/templates/magic_link.html` — Custom OTP email template

---

## Key Decisions

*   **Persist conversation transcript across page transitions.** Previously, `AmbientDashboard` completely cleared `SS_CONVERSATION` on mount, which meant navigating to the detailed `TodoView` and back to the dashboard destroyed the conversation state. Reading from `sessionStorage` on mount preserves context seamlessly while still starting fresh on tab close or user change.
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

1. **ORB-148** — Notify users when feedback todos are addressed (needs `reported_by` field on todo + notification mechanism).
2. **ORB-132** — Verify RLS initplan fix impact on Supabase disk I/O budget.
3. **JSON export/import** — second offboarding path (complement to print/PDF).
4. **iPhone update flow retest** — Stan deleted Home Screen PWA and will test UpdateBanner on next version bump.

---

## AI Tool Used Last Session

`2026-05-24 — Antigravity (Gemini 1.5 Pro)`

---

*Updated by AI at end of each session. Committed with session code changes.*
