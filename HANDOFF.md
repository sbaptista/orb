# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.5.13 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**Version Update Notification, "What's New" Settings & Global Toast Relocation — 2026-05-21 (Session 7)**

1. **Version Update Notification Banner**
   - Created `/api/version` returning the active deployment version with cache-busting headers.
   - Built the client-side `UpdateBanner` component to poll the version API (on mount, focus, and every 5m) and show a sliding top layout row with an "Update" button plus a neutral toast.
   - Rendered the banner inside `<Providers>` in `layout.tsx` to hook into `ToastContext`.

2. **Update Developer Simulation**
   - Added a "Simulate Update Available" button in the DEV panel which manages a `todos_dev_simulate_update` localStorage key and dispatches a custom `'todos-dev-update-change'` event for immediate client-side simulation.

3. **"What's New" Settings Feed**
   - Created `lib/changelog.ts` with release definitions and histories.
   - Designed the `SettingsWhatsNew` component with a beautiful timeline UI showcasing latest release indicators, release dates, and change items.
   - Created the `/settings/whats-new` routing path and added it to the Settings sidebar navigation list with a sparkle icon (`✨`).

4. **Offline Layout Consolidation**
   - Deleted the obsolete `OfflineBanner` component.
   - Moved all online connectivity checking directly into `OfflinePage` via `useOnlineStatus()`, automatically showing the breathing Julia fractal overlay when offline and returning `null` when online.

5. **Global Toast Relocation**
   - Repositioned the global toast notifications container to `top: calc(24px + var(--sat))` and slide down from `-8px` to align perfectly with the top update banner.

6. **Release Verification Guidelines**
   - Updated the `AGENTS.md` file to mandate patch version bumping (`package.json` + `lib/version.ts`) and static entry documentation (`lib/changelog.ts`) before any production release.
   - Configured the agent Comprehension Check to prompt for release documentation rules and verify rule comprehension verbatim at session startup.

---

## Uncommitted Changes

### Modified
- **[package.json](file:///Users/stanleybaptista/Projects/orb/package.json)** — version bump to 0.5.13
- **[lib/version.ts](file:///Users/stanleybaptista/Projects/orb/lib/version.ts)** — version bump to v0.5.13
- **[app/layout.tsx](file:///Users/stanleybaptista/Projects/orb/app/layout.tsx)** — mount UpdateBanner and swap OfflineBanner for OfflinePage
- **[components/OrbDevPanel.tsx](file:///Users/stanleybaptista/Projects/orb/components/OrbDevPanel.tsx)** — simulated update available toggle button and event emitter
- **[components/settings/SettingsSidebar.tsx](file:///Users/stanleybaptista/Projects/orb/components/settings/SettingsSidebar.tsx)** — navigation link for What's New settings page
- **[components/ui/OfflinePage.tsx](file:///Users/stanleybaptista/Projects/orb/components/ui/OfflinePage.tsx)** — handle useOnlineStatus natively to render fullscreen overlay
- **[components/ui/Toast.tsx](file:///Users/stanleybaptista/Projects/orb/components/ui/Toast.tsx)** — relocate toast notifications to the top globally
- **[AGENTS.md](file:///Users/stanleybaptista/Projects/orb/AGENTS.md)** — comprehension checks, verbatim rules, and production release guidelines

### Deleted
- **[components/ui/OfflineBanner.tsx](file:///Users/stanleybaptista/Projects/orb/components/ui/OfflineBanner.tsx)** — removed obsolete banner component

### New
- **[app/api/version/route.ts](file:///Users/stanleybaptista/Projects/orb/app/api/version/route.ts)** — route handler returning deployment version
- **[components/UpdateBanner.tsx](file:///Users/stanleybaptista/Projects/orb/components/UpdateBanner.tsx)** — client-side version comparison and layout banner
- **[lib/changelog.ts](file:///Users/stanleybaptista/Projects/orb/lib/changelog.ts)** — release data structures and historical entries
- **[app/settings/whats-new/page.tsx](file:///Users/stanleybaptista/Projects/orb/app/settings/whats-new/page.tsx)** — WhatsNew page wrapper routing settings
- **[components/settings/SettingsWhatsNew.tsx](file:///Users/stanleybaptista/Projects/orb/components/settings/SettingsWhatsNew.tsx)** — timeline view of release changelogs

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
*   **Client-side dynamic version comparisons.** Server routes with cache headers guarantee clean responses bypassing cache networks.
*   **Consolidated connectivity gates.** Centralized online validation in fullscreen pages keeps modular UI elements clean of duplicate connection hook listeners.

---

## Next Priorities

1. **Deploy to production** — push version 0.5.12 to remote repository and deploy on Vercel.
2. **Verify live update flow** — verify Simulated/Real client-side update updates and cache clearance on production deployment.

---

## AI Tool Used Last Session

`2026-05-21 — Antigravity`

---

*Updated by AI at end of each session. Committed with session code changes.*
