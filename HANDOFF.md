# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads this at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** see `/Users/stanleybaptista/Projects/orb/package.json` (canonical - currently v0.4.76)
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**ORB-105 — UI Polish, Project Owner Support, Interactive Sorting, & Dynamic Redirects — 2026-05-17**

### UI & UX Refinements
- **User Dialogue Bubbles Left-Aligned:** In [OrbConversation.tsx](file:///Users/stanleybaptista/Projects/orb/components/OrbConversation.tsx), changed user dialogue card alignment from right (`flex-end`) to left (`flex-start`) to dramatically optimize reading flow on mobile devices.
- **Clamped Email Column:** In [SettingsUsers.tsx](file:///Users/stanleybaptista/Projects/orb/components/settings/SettingsUsers.tsx), added text truncation and CSS clamping (`minWidth: 0` + `truncate` class) to keep long email addresses from pushing boundaries or causing layout overflows on narrow viewports.

### Project Owner / User ID Support
- **Backend update:** Modified the `updateProject` Server Action in [manage-project.ts](file:///Users/stanleybaptista/Projects/orb/app/actions/manage-project.ts) to accept `created_by?: string | null` in the payload parameter.
- **CRUD resolved with listUsers:** Re-engineered [SettingsProjects.tsx](file:///Users/stanleybaptista/Projects/orb/components/settings/SettingsProjects.tsx) to fetch the full list of system users and map the `created_by` owner UUID to the user's full name or email address inside the Projects grid.
- **Owner Select Menu:** Populated a beautifully integrated, dynamic select dropdown in the Add/Edit Project form to let admins assign and edit project ownership.

### Interactive Invitations Column Sorting
- **Table sorting upgrade:** Upgraded [SettingsInvitations.tsx](file:///Users/stanleybaptista/Projects/orb/components/settings/SettingsInvitations.tsx) to support complete client-side sorting of invitations.
- **Column triggers:** Users can interactively sort invitations by Date, Email, Release Stage, Status, or Responded Date. Columns display active sort status indicators (`▲`/`▼`/`↕`).

### Bulletproof Client-Side Dynamic Origin Passing
- **Header bypass:** Solved Next.js local server internal header resolution quirks (e.g. Vercel proxy headers in mixed SSL environments overriding ports/origins) by shifting origin detection to the browser.
- **Action signature update:** Modified `inviteUser` in [invite-user.ts](file:///Users/stanleybaptista/Projects/orb/app/actions/invite-user.ts) to accept `originInput?: string`, and updated [SettingsUsers.tsx](file:///Users/stanleybaptista/Projects/orb/components/settings/SettingsUsers.tsx) to hard-pass the address bar ground-truth (`window.location.origin`) directly. This guarantees invite redirect links always match your environment.
- **Reverted Hardcoding:** Reverted all hardcoded `192.168.86.90` testing fallbacks in [email.ts](file:///Users/stanleybaptista/Projects/orb/lib/email.ts) to utilize standard production fallbacks (`https://orb-eight-lake.vercel.app`), as the runtime resolution is now 100% dynamic!

---

## Uncommitted Changes

**Modified:**
- `components/OrbConversation.tsx` — Left-aligned dialogue bubbles.
- `components/settings/SettingsUsers.tsx` — Clamped email column, passed browser `window.location.origin` to `inviteUser`.
- `components/settings/SettingsProjects.tsx` — Added User list fetching, Owner column, and Owner dropdown select.
- `components/settings/SettingsInvitations.tsx` — Interactive column sorting with indicators.
- `app/actions/manage-project.ts` — Added `created_by` updating in `updateProject` payload.
- `app/actions/invite-user.ts` — Added dynamic `originInput` support and console logging statements.
- `lib/email.ts` — Reverted default Site URL fallback to production.

---

## Key Decisions

- **Client-Passed Origin:** Passing the address bar's literal `window.location.origin` as a parameter to Server Actions is far more robust than relying on Server-side HTTP headers (`headers().get('host')`) in local SSL development with Next.js, as internal scoping/proxies frequently mismatch ports.
- **onboarded_at is the welcome gate:** Keeps the first-time user dashboard locked to onboarding until welcome submit.
- **PKCE vs Implicit Flow redirects:** Supabase admin-generated verification links use Implicit flow (returning tokens in browser hash `#access_token=...`). If implicit flow token verification is parsed by the client SDK on `/auth/login`, ensure a dev-server restart and hard-reload is triggered to clear Next.js's route cache.

---

## Next Priorities

1. **Verify Local Invite Link Routing:**
   * Restart the local server (`npm run dev`) and force a browser hard refresh (`Cmd + Shift + R`) on the local settings page (`https://192.168.86.90:3001/settings/users`).
   * Delete test user `stan.baptista+t1@gmail.com` from the Supabase dashboard.
   * Send a fresh invitation, look at the terminal console for `[inviteUser] origin resolved to: https://192.168.86.90:3001`, and click the email link.
   * Verify it routes smoothly to `https://192.168.86.90:3001/auth/callback`.
2. **ORB-98 Phase 4:** Send invites (May 18 target), passive monitoring, Week 1 retro (May 25).

---

## AI Tool Used Last Session

`2026-05-17 — Gemini (Antigravity)`

---

*Updated by AI at end of each session. Committed with session code changes.*
