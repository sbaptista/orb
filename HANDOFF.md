# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads this at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.4.77 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**Pre-Alpha Onboarding Revamp, Server-Side OTP Hashing, & Security Isolation — 2026-05-17**

This session completely overhauled the invitation lifecycle, bypassed Next.js server-side hash limits, isolated user sessions, and polished conversational interaction.

### 🛡️ Server-Side OTP Token Hashing & Session Isolation
*   **Query-Parameterized Callback:** Modified the invite generation in [invite-user.ts](file:///Users/stanleybaptista/Projects/orb/app/actions/invite-user.ts) to extract the `hashed_token` from `generateLink` properties, compiling a secure, server-readable link: `/auth/callback?token_hash=HASHED_TOKEN&type=invite`. This successfully bypasses client-side implicit flow limitations.
*   **Force Sign-Out on Callback:** Implemented `await supabase.auth.signOut()` at the beginning of the callback route handler in [route.ts](file:///Users/stanleybaptista/Projects/orb/app/auth/callback/route.ts). This purges pre-existing session cookies on the browser before verifying the new user, blocking crossover hijack vulnerabilities if the link is invalid or expired.
*   **Dynamic Host Matching:** Checked `Host` and `x-forwarded-host` headers directly in [route.ts](file:///Users/stanleybaptista/Projects/orb/app/auth/callback/route.ts) to resolve origins, guaranteeing cookie hosts match routing destinations flawlessly.

### 👥 User-Specific Onboarding & Transcript Cleansing
*   **User-Bound Greetings:** Refactored the welcome message check in [AmbientDashboard.tsx](file:///Users/stanleybaptista/Projects/orb/components/AmbientDashboard.tsx) to target user-specific keys (`todos_welcome_shown_${user.id}`). This prevents dismissed onboarding indicators from leaking across different user profiles on the same browser.
*   **Session Storage Cleanse:** Added a user ID check on mount. If a different user signs in on the same browser tab, all session storage conversation transcripts and inputs are instantly destroyed to prevent layout crossover.

### 💬 Catch-22 Conversation & UI Polish
*   **Conversational Project Creation:** Removed the global `!selectedId` check in [AmbientDashboard.tsx](file:///Users/stanleybaptista/Projects/orb/components/AmbientDashboard.tsx), moving it inline strictly inside commands that require an active project (`/tasks`, `/edit`). This enables newly invited users without projects to immediately type `"Create a project called Work"` or request `/help` conversational utilities on signup!
*   **Nullable productId Support:** Upgraded [orb-converse.ts](file:///Users/stanleybaptista/Projects/orb/app/actions/orb-converse.ts)'s type signatures to support `string | null` for `productId`, ensuring backend context queries handle null backlog states gracefully.
*   **Bubble Alignment & Reading Flow:** Realigned user query bubble containers in [OrbConversation.tsx](file:///Users/stanleybaptista/Projects/orb/components/OrbConversation.tsx) to the **right side** (`justifyContent: 'flex-end'`), while keeping the bubble text naturally left-aligned (`text-align: left`) in [globals.css](file:///Users/stanleybaptista/Projects/orb/app/globals.css) for a perfect chat flow.

---

## Key Decisions

*   **Server-Side OTP verification is crucial:** Client-side Implicit flow hash token reading is highly prone to Next.js route caching and crossover. Standardizing on `verifyOtp` server-side via `token_hash` query parameters is the bulletproof solution.
*   **RLS-Compliant Database Knowledge Base:** Synced the comprehensive onboarding revamp learnings into Orb's custom database `knowledge_repo` table for **every single project** via a local synchronization script ([scripts/add-onboarding-knowledge.ts](file:///Users/stanleybaptista/Projects/orb/scripts/add-onboarding-knowledge.ts)), ensuring complete cross-project visibility while adhering to strict row-level security.

---

## Next Priorities

1.  **Monitor Live Deployment Callback Routing:**
    *   Deploy v0.4.77 to production Vercel.
    *   Send a live invitation from the settings dashboard and verify the dynamic verification link, callback cookies, and isolated welcome prompt load flawlessly on the production domain.
2.  **Begin Passive Monitoring:**
    *   Prepare for pre-alpha launch user invitations (May 18 target) and track first-week onboarding retro (May 25).

---

## AI Tool Used Last Session

`2026-05-17 — Gemini (Antigravity)`

---

*Updated by AI at end of each session. Committed with session code changes.*
