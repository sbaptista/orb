# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.5.10 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**Access Hardening, Email Change Tracking & Ticket Notification System with Dynamic Routing — 2026-05-21 (Session 6)**

1. **Invitation-Only Access Blocker**
   - Created the `checkLoginAllowed(email)` server action in `auth-actions.ts`.
   - Updated the Login page (`app/auth/login/page.tsx`) to check if the email has a pending invitation or is already registered in the DB before dispatching OTP codes.
   - Blocks OTP delivery and displays a user-friendly invitation-only warning notice to uninvited users.
   - Wrapped `LoginForm` in `<Suspense>` to handle `useSearchParams()` safely.

2. **Email Change Detection & Synchronization**
   - Refactored `resolveUser` in `lib/resolve-user.ts` to first query by the stable auth ID (`authId`).
   - If a mismatch is detected between the Auth email and the Database email, it automatically updates both `public.users` and `public.invitations` tables, and records a `user_update` event in the `audit_log` database table with before/after email states.
   - Refactored `completeOnboarding` in `complete-onboarding.ts` to verify the user resolution status before allowing onboarding.

3. **Admin Notifications for New Tickets**
   - Modified `createTicket` in `app/actions/ticket-actions.ts` to retrieve both user IDs and emails for all admins (`role_id` in `[1, 3]`).
   - Trigger both an email via Resend (`sendTicketNotificationEmail`) and a Web Push Alert via the VAPID push manager (`sendPushToUser`) in parallel when a ticket is created.
   - Configured push payloads with category titles (`New Ticket: [Type]`), summary bodies, unique tags (`ticket-[ticketId]`), and redirection URLs pointing to `/settings/tickets`.

4. **Dynamic Environment Routing for Ticket Emails**
   - Updated `createTicket` to dynamically inspect request headers (`x-forwarded-host`, `host`, `x-forwarded-proto`) via Next.js `headers()`. Reconstructs the exact requesting environment origin (e.g. `http://localhost:3001` or a staging URL) dynamically.
   - Isolated the header lookup in a `try/catch` to fail gracefully (returning `undefined`) when invoked outside a request context (like in cron triggers or dev scripts).
   - Updated `sendTicketNotificationEmail` to accept `origin?: string` and construct the dashboard redirection URL `${siteUrl}/settings/tickets`, fallback to production `SITE_URL` when `origin` is absent.
   - Preserved `ICON_URL` using production `SITE_URL` to ensure the logo renders correctly in external email clients.

5. **Migrations & Scripts**
   - Created `scripts/test-ticket-notification.ts` to trigger new tickets and verify push/email delivery locally.

---

## Uncommitted Changes

### Modified
- **[package.json](file:///Users/stanleybaptista/Projects/orb/package.json)** — version bump to 0.5.10
- **[lib/version.ts](file:///Users/stanleybaptista/Projects/orb/lib/version.ts)** — version bump to v0.5.10
- **[app/actions/complete-onboarding.ts](file:///Users/stanleybaptista/Projects/orb/app/actions/complete-onboarding.ts)** — onboarding authorization check
- **[app/actions/ticket-actions.ts](file:///Users/stanleybaptista/Projects/orb/app/actions/ticket-actions.ts)** — email, push alerts, and dynamic origin resolution for admins on ticket submission
- **[app/auth/login/page.tsx](file:///Users/stanleybaptista/Projects/orb/app/auth/login/page.tsx)** — login access verification and error handling
- **[lib/email.ts](file:///Users/stanleybaptista/Projects/orb/lib/email.ts)** — dynamic origin routing support for new ticket notification links
- **[lib/resolve-user.ts](file:///Users/stanleybaptista/Projects/orb/lib/resolve-user.ts)** — stable ID resolution, email change synchronization, and auditing


### New
- **[app/actions/auth-actions.ts](file:///Users/stanleybaptista/Projects/orb/app/actions/auth-actions.ts)** — pre-login authorization checker
- **[scripts/add-access-hardening-knowledge.ts](file:///Users/stanleybaptista/Projects/orb/scripts/add-access-hardening-knowledge.ts)** — registers access hardening and ticket alert knowledge to the database repository
- **[scripts/test-ticket-notification.ts](file:///Users/stanleybaptista/Projects/orb/scripts/test-ticket-notification.ts)** — integration test for ticket alerts



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

---

## Next Priorities

1. **Deploy to production** — push changes to remote repository and deploy on Vercel.
2. **Verify notifications in production** — verify Safari/Chrome push subscriptions on the live site after deployment.

---

## AI Tool Used Last Session

`2026-05-21 — Antigravity (Gemini 2.0 Flash)`

---

*Updated by AI at end of each session. Committed with session code changes.*
