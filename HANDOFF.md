# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads this at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.4.95 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**Single source of truth for Orb AI — 2026-05-19**

1. **Timezone-Agnostic Due Dates & Reminders (ORB-96 / ORB-97)**
   - Added `todos.due_at` (`timestamp without time zone`) and `todos.reminded_at` (`timestamp with time zone`) columns.
   - Added `users.urgency_threshold_hours` (`integer`) and `users.timezone` (`text`) columns.
   - Created datetime-local input fields across task edit forms/modals to modify due dates.
   - Configured dynamic timezone detection on mount to keep `users.timezone` synchronized.
   - Updated the warning check condition to trigger when `now >= dueUTC - urgency_threshold_hours` to dispatch warning emails ahead of time.
   - Refactored email template delivery to use a custom Resend template for invitations and warning reminders.
   - Created a Vercel cron endpoint `/api/cron/reminders` running once per day.
2. **Settings Urgency Custom Subpage**
   - Created `/settings/urgency` and `SettingsUrgency.tsx` for managing warning thresholds.
   - Structured styling with high-fidelity select controls and icons.
3. **Slash Commands Discovery Dialog & Fixes**
   - Created a `/` toggle button and `/` + `[Enter]` listener to open an interactive commands dialog box above the input field.
   - Moved all autocomplete menus and dialogs outside the `overflow: hidden` boundaries of `.oc-input-border` to the parent `.oc-input-wrap` relative container to prevent clipping on all viewports.
   - Fixed focus loss / text selection race conditions using `onMouseDown={(e) => e.preventDefault()}` on all interactive dialog controls.
   - Set the toolbar `/` button to automatically populate `/` into the chat textarea.
4. **Dynamic Welcome Message for Invitees**
   - Fetched the user's `release_stage` on dashboard mount and stored it in state.
   - Prefilled the welcome conversation prompt dynamically using the user's release stage (e.g. `alpha`, `beta`, `pre-alpha`) rather than hardcoding `"pre-alpha"`.
5. **Helm-style Offline Page Overlay (ORB-116)**
   - Created the `/api/health` API endpoint to monitor connection health.
   - Created the `useOnlineStatus` hook to poll health and handle offline event listeners.
   - Built a premium, full-screen `OfflinePage` component featuring background stars, twinkling animations, diagonal shooting meteors, and rotating concentric planetary orbits centered around a pulsing glowing Orb.
   - Integrated into `OfflineBanner` as an overlay so that the main application state and form/draft inputs are preserved in the DOM while offline.
   - Added a "Simulate Offline" toggle button inside the `OrbDevPanel` (under a new "Connectivity" section) in local development to easily test this screen without disabling hardware network adapters.

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
*   **Outer container layout for floating menus.** Interactive absolute-positioned dropdowns must live outside overflow-clipped cards to prevent clipping, positioned relatively to the parent container wrapper.

---

## Next Priorities

1. **Test count consistency** — Verify Orb greeting, conversation, and query_todos all report matching numbers after deploy.
2. **Re-evaluate INSIGHTS** — If a future use case emerges (e.g., pattern detection as a separate tool the AI can choose to call), the code is ready in `lib/insights.ts`.

---

## AI Tool Used Last Session

`2026-05-19 — Antigravity (Gemini 2.5 Pro)`

---

*Updated by AI at end of each session. Committed with session code changes.*
