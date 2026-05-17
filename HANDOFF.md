# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads this at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.4.78 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**Onboarding Re-Architecture & Shared Project Access — 2026-05-17**

Major overhaul of the invitation/onboarding lifecycle. Root cause: Supabase `generateLink({ type: 'invite' })` replaces the auth.users UUID for an existing email, orphaning the `users` table row and all FK references. This caused Stan's production account to hit a "Create your account" page after a test invitation was sent to his own email.

### Onboarding Re-Architecture

*   **`resolveUser()` — single source of truth** ([lib/resolve-user.ts](lib/resolve-user.ts)): New function that runs after every successful authentication. Looks up users **by email** (the only stable identifier), not by auth UUID. Handles four cases:
    1. Existing user, same auth ID → normal login (no-op)
    2. Existing user, different auth ID → atomic ID reconciliation via `reconcile_user_id()` Postgres function
    3. No user row, pending invitation → creates user from invitation data, marks invitation accepted
    4. No user, no invitation → redirects to `/auth/create-account`
*   **`reconcile_user_id()` Postgres function** ([scripts/migrations/20260517_reconcile_user_id.sql](scripts/migrations/20260517_reconcile_user_id.sql)): Atomic transaction that migrates all FK references (`projects.created_by`, `invitations.invited_by`, `audit_log.user_id`) from old UUID to new UUID.
*   **Callback route simplified** ([app/auth/callback/route.ts](app/auth/callback/route.ts)): 136 → 62 lines. Both branches (token_hash and code exchange) now delegate to `resolveUser()`. No user-creation logic in the route.
*   **verify-otp simplified** ([app/auth/verify-otp/page.tsx](app/auth/verify-otp/page.tsx)): Removed client-side users table query. Just redirects to `/dashboard` after OTP success. Server-side guard in dashboard handles the rest.
*   **Dashboard guard** ([app/dashboard/page.tsx](app/dashboard/page.tsx)): Calls `resolveUser()` on every load. Handles ID reconciliation transparently.
*   **Ghost cleanup removed** ([app/actions/complete-onboarding.ts](app/actions/complete-onboarding.ts)): The old DELETE-by-email cleanup caused FK violations. Replaced by `resolveUser()` reconciliation.
*   **Invite hardening** ([app/actions/invite-user.ts](app/actions/invite-user.ts)): Blocks inviting existing users ("This email is already a registered user") and duplicate pending invitations. Still cleans stale auth entries for genuinely new invites.
*   **Friendly errors + auto-tickets**: All onboarding errors now show user-friendly messages. Raw DB errors auto-create tickets via `createTicket()`.

### Shared Project Access (Orb Feedback)

*   **Orb Feedback marked `is_shared = true`** in database. All users with `release_stage` set can now see it.
*   **`release_stage` backfilled** to `'pre-alpha'` for all existing users. New invitees get it automatically from invitation data via `resolveUser()`.
*   **Todos RLS updated** ([scripts/migrations/20260517_shared_todos_rls.sql](scripts/migrations/20260517_shared_todos_rls.sql)): Shared project todos allow **SELECT and INSERT** for all `release_stage` users. **UPDATE and DELETE** restricted to project owner or admins (role_id 1 or 3).
*   **Permission-denied toast** ([components/TodoPanel.tsx](components/TodoPanel.tsx)): Non-admin users attempting to modify shared project todos see "You do not have permission to modify this item." instead of generic "Failed to save."

### Orb Conversational AI — Project Creation

*   **`create_project` tool** added to [lib/orb-contract.ts](lib/orb-contract.ts) and handler in [app/actions/orb-converse.ts](app/actions/orb-converse.ts). Admin-gated. Creates project and auto-switches to it.
*   **`project_create` mutation type**: New project appears in the project strip immediately without page reload.

### Other Fixes

*   **Transcript clearing** ([components/AmbientDashboard.tsx](components/AmbientDashboard.tsx)): Conversation transcript now clears on every fresh mount. Previous sessions' transcripts no longer persist across logins. Invitee welcome messages unaffected (driven by `onboarded_at`).
*   **Knowledge repo deduplication**: Removed 8 duplicate "Pre-Alpha Onboarding" entries from `knowledge_repo`. Updated [scripts/add-onboarding-knowledge.ts](scripts/add-onboarding-knowledge.ts) to insert one global entry (anchored to ORB project) with title-based uniqueness check.

---

## Uncommitted Changes

- `lib/resolve-user.ts` (NEW) — resolveUser() function
- `scripts/migrations/20260517_reconcile_user_id.sql` (NEW) — Postgres function for atomic ID reconciliation
- `scripts/migrations/20260517_shared_todos_rls.sql` (NEW) — shared project todos RLS
- `app/auth/callback/route.ts` — simplified to use resolveUser()
- `app/auth/verify-otp/page.tsx` — removed client-side user lookup
- `app/auth/create-account/page.tsx` — friendly error handling
- `app/dashboard/page.tsx` — resolveUser() guard
- `app/actions/complete-onboarding.ts` — removed ghost cleanup, friendly errors
- `app/actions/invite-user.ts` — blocks existing users, duplicate invitations
- `app/actions/orb-converse.ts` — create_project tool handler, project_create mutation type
- `lib/orb-contract.ts` — create_project tool definition
- `components/AmbientDashboard.tsx` — transcript clearing, project_create handling
- `components/TodoPanel.tsx` — RLS permission-denied toast
- `lib/version.ts` — v0.4.78
- `package.json` — v0.4.78
- `scripts/add-onboarding-knowledge.ts` — single-entry global dedup

---

## Key Decisions

*   **Email is the stable identity, not auth UUID.** Supabase can replace auth UUIDs on invite/re-invite. All user lookups now go through `resolveUser()` which queries by email first.
*   **Atomic ID reconciliation via Postgres function.** Supabase JS client can't do multi-statement transactions, so FK migration uses a server-side `reconcile_user_id()` function called via `rpc()`.
*   **Shared project access is read+create for users, full access for admins.** Prevents invited users from modifying/deleting feedback they didn't create, while still allowing them to contribute.
*   **Knowledge repo entries are global, not per-project.** One entry anchored to a single project for RLS, readable by all authenticated users. Deduplication by title.

---

## Next Priorities

1.  **Deploy v0.4.78 to production** and verify the full invitation flow end-to-end on the live domain.
2.  **Monitor first invited users** — ensure Orb Feedback appears, todos can be created, and the welcome onboarding flow works.
3.  **Test edge cases**: re-invite after deletion, expired links, same-email re-invite blocked.

---

## AI Tool Used Last Session

`2026-05-17 — Claude Code (claude-opus-4-6)`

---

*Updated by AI at end of each session. Committed with session code changes.*
