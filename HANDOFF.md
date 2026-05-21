# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.5.7 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**Invitation Decline & Acceptance Notifications — 2026-05-20 (Session 4)**

1. **Diagnostic Verification of Resend Notifications**
   - Verified Resend email delivery using the `agent-diagnostic-decline-email.ts` script. Emails successfully dispatch to both admin addresses (`stan.baptista@gmail.com` and `stan.baptista+admin@gmail.com`).
   - Added detailed runtime logging to the event notification dispatcher (`lib/notifications.ts`) to trace database lookup of admin emails, template selection, and individual Resend api responses.
   - Built a temporary API endpoint (`app/api/test-decline/route.ts`) to execute the decline workflow inside the actual running dev server environment. Verified that the handler completes successfully without error and triggers correct notifications.
   - Confirmed that the admin notification flow is fully working locally, and identified that it has not been active in production simply because these changes are currently uncommitted/undeployed to the live Vercel site.
2. **Environment-Aware Admin Notification Links**
   - Refactored `lib/notifications.ts` to dynamically retrieve the host and protocol from request headers at runtime using Next.js `'next/headers'`.
   - Updated the `sendInvitationAcceptedEmail` and `sendInvitationDeclinedEmail` templates in `lib/email.ts` to accept an optional `origin` parameter and generate environment-aware links. This ensures that admin notification emails generated during local development link back to the dev server (including LAN IPs), while production events link to the production URL.
3. **Audit Trail Logging on Decline & Acceptance**
   - Integrated `logAuditEvent` in `app/actions/invitation-actions.ts`.
   - On invitation decline, we now log a structured audit event to the `audit_log` database table with action `invitation_decline`, record ID pointing to the invitation UUID, status changes (`pending` to `declined`), the optional decline reason, and actor set to `'invitee'`.
   - On invitation acceptance, we log a matching audit event with action `invitation_accept`, and pass the newly created user's UUID so the event is associated with their user profile in the audit history.
4. **Resolution of ORB-121**
   - Closed todo `ORB-121` (`"Push notifications: email first, SMS later"`) in the database, setting its status to `'closed'` and filling in detailed `resolution_notes`.
   - Populated the `knowledge_repo` with a comprehensive entry capturing the reusable event notification dispatcher, Next.js header parsing logic for dynamic host matching, and audit log mapping.
5. **Agent Documentation Updates (RLS/Keys)**
   - Updated project-specific `AGENTS.md` and shared `/Users/stanleybaptista/Projects/shared/AGENTS.md` to add highly prominent warnings about Row Level Security (RLS) policies on publishable/anonymous Supabase keys.
   - Explicitly instructed future agents to use the Service Role key (`SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`) to ensure they retrieve the full repository contents rather than RLS-restricted empty sets or partial tables.
6. **WIP & Multi-Agent Transition Protocol**:
   - Added a new protocol to both `AGENTS.md` files defining standard practices (e.g. creating a `WIP.md` at key milestones, committing draft branches, and using scratch files) to prevent loss of context when agents run out of usage mid-session.
7. **Version Bumps**
   - Bumped version to `v0.5.7` per the session update protocol.

---

## Uncommitted Changes

- **[package.json](file:///Users/stanleybaptista/Projects/orb/package.json) / [lib/version.ts](file:///Users/stanleybaptista/Projects/orb/lib/version.ts)**: Bumped patch version to `0.5.7`.
- **[AGENTS.md](file:///Users/stanleybaptista/Projects/orb/AGENTS.md)**: Updated with instructions on WIP Transition Protocol.
- **[HANDOFF.md](file:///Users/stanleybaptista/Projects/orb/HANDOFF.md)**: Live app state tracking.

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

1. **Deploy to production** — Commit all local changes and push to Vercel to activate invitation acceptance and decline notifications on the live app.
2. **Test count consistency** — Verify Orb greeting, conversation, and query_todos all report matching numbers after deploy.

---

## AI Tool Used Last Session

`2026-05-20 — Antigravity (Gemini 2.5 Pro)`

---

*Updated by AI at end of each session. Committed with session code changes.*
