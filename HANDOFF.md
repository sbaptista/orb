# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.5.9 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**Slash Commands, Knowledge CRUD, Web Push Notifications — 2026-05-20 (Session 5)**

1. **Slash Command System Overhaul**
   - Unified two competing slash menu implementations (inline typing + button dialog) into a single `.oc-slash-menu`
   - Trimmed to 8 essential commands with group headers (Todos: `/add`, `/close`; Projects: `/create`, `/drop`, `/edit`, `/switch`; Session: `/clear`, `/settings`)
   - Fill-only behavior — selecting a command populates the input with placeholder selected, never auto-submits
   - Escape dismisses menu without clearing input; active item scrolls into view via `scrollIntoView`
   - Removed ~90 lines of dead `.oc-commands-*` CSS
   - Added catch-all `toast.neutral('Unknown command')` for unrecognized commands
   - Added DISAMBIGUATION rule to `lib/orb-contract.ts`: bare "create X" = todo, "create a project" = project

2. **Todo Delete Bug Fix**
   - Supabase `.delete()` silently returns no error when RLS blocks zero rows
   - Fixed by chaining `.select().maybeSingle()` and checking `if (!deleted)`

3. **Knowledge Base Settings — Full CRUD Table**
   - Rewrote `SettingsKnowledge.tsx` from read-only accordion to `SettingsCrudList` table with search, sort, bulk delete, and edit form

4. **Table Hover Highlights**
   - Added `.audit-table tbody tr:hover td { background: var(--bg3) }` for Projects and Knowledge tables

5. **PWA Foundation**
   - Enhanced `app/manifest.ts` with `id`, `orientation`, `categories`, 192/512 icon entries
   - Created `app/icon-192/route.tsx` and `app/icon-512/route.tsx` generated orb icons
   - Created `lib/orb-state.ts` — shared urgency computation (`computeUrgency`, `computeOrbState`, `isDueWithinWarning`)
   - Created `app/api/orb-state/route.ts` — GET endpoint with dual auth (session cookie or API key)
   - Created `lib/email.ts` — `sendDigestEmail()` with orb-styled HTML template

6. **Web Push Notifications — Full End-to-End**
   - Generated VAPID keys, added to `.env.local` and Vercel
   - Created `lib/push.ts` — server-side push via `web-push` package with `sendPushToUser()`, `snapshotUrgency()`, `checkAndNotifyEscalation()`
   - Created `lib/push-client.ts` — client-side subscription management
   - Created `app/api/push/route.ts` — POST subscribe, DELETE unsubscribe
   - Created `public/sw.js` — service worker for push events and notification clicks
   - Created `components/ServiceWorkerRegistrar.tsx` — registers SW on mount (added to layout)
   - Created `components/settings/SettingsNotifications.tsx` — enable/disable push UI with state detection
   - Created `app/settings/notifications/page.tsx` — settings route
   - Added Notifications link to `SettingsSidebar.tsx`
   - Created `app/actions/push-actions.ts` — `getUrgencySnapshot()` and `notifyIfEscalated()` server actions for client components
   - Urgency escalation triggers push from **both** Orb conversations and direct UI edits (TodoPanel, TodoView, TodoForm)
   - Refactored `orb-converse.ts` to use shared `checkAndNotifyEscalation` instead of inline implementation

7. **Migrations Applied**
   - `20260520_knowledge_repo_crud_rls.sql` — UPDATE and DELETE policies for knowledge_repo
   - `20260520_push_subscriptions.sql` — push_subscriptions table with RLS

8. **Version Bump** — v0.5.9

---

## Uncommitted Changes

### Modified
- **[package.json](file:///Users/stanleybaptista/Projects/orb/package.json) / [lib/version.ts](file:///Users/stanleybaptista/Projects/orb/lib/version.ts)** — version bump to 0.5.9
- **[app/actions/orb-converse.ts](file:///Users/stanleybaptista/Projects/orb/app/actions/orb-converse.ts)** — urgency escalation refactored to shared helper, delete fix, disambiguation rule
- **[app/actions/manage-todo.ts](file:///Users/stanleybaptista/Projects/orb/app/actions/manage-todo.ts)** — added urgency escalation checks on create/update/delete
- **[app/globals.css](file:///Users/stanleybaptista/Projects/orb/app/globals.css)** — slash menu group headers, scroll fix, table hover, removed dead CSS
- **[app/layout.tsx](file:///Users/stanleybaptista/Projects/orb/app/layout.tsx)** — added ServiceWorkerRegistrar
- **[app/manifest.ts](file:///Users/stanleybaptista/Projects/orb/app/manifest.ts)** — enhanced PWA manifest
- **[components/AmbientDashboard.tsx](file:///Users/stanleybaptista/Projects/orb/components/AmbientDashboard.tsx)** — slash command handlers, imports from shared orb-state
- **[components/OrbConversation.tsx](file:///Users/stanleybaptista/Projects/orb/components/OrbConversation.tsx)** — unified slash menu, fill-only behavior
- **[components/OrbHelp.tsx](file:///Users/stanleybaptista/Projects/orb/components/OrbHelp.tsx)** — updated slash commands section
- **[components/TodoForm.tsx](file:///Users/stanleybaptista/Projects/orb/components/TodoForm.tsx)** — urgency escalation on create
- **[components/TodoPanel.tsx](file:///Users/stanleybaptista/Projects/orb/components/TodoPanel.tsx)** — urgency escalation on save/delete
- **[components/TodoView.tsx](file:///Users/stanleybaptista/Projects/orb/components/TodoView.tsx)** — urgency escalation on toggle done, bulk ops
- **[components/settings/SettingsKnowledge.tsx](file:///Users/stanleybaptista/Projects/orb/components/settings/SettingsKnowledge.tsx)** — full CRUD table rewrite
- **[components/settings/SettingsSidebar.tsx](file:///Users/stanleybaptista/Projects/orb/components/settings/SettingsSidebar.tsx)** — added Notifications link
- **[lib/email.ts](file:///Users/stanleybaptista/Projects/orb/lib/email.ts)** — digest email template
- **[lib/orb-contract.ts](file:///Users/stanleybaptista/Projects/orb/lib/orb-contract.ts)** — DISAMBIGUATION rule
- **[package-lock.json](file:///Users/stanleybaptista/Projects/orb/package-lock.json)** — web-push dependency

### New
- **[app/actions/push-actions.ts](file:///Users/stanleybaptista/Projects/orb/app/actions/push-actions.ts)** — server actions for client-side urgency escalation
- **[app/api/orb-state/route.ts](file:///Users/stanleybaptista/Projects/orb/app/api/orb-state/route.ts)** — orb state API endpoint
- **[app/api/push/route.ts](file:///Users/stanleybaptista/Projects/orb/app/api/push/route.ts)** — push subscribe/unsubscribe API
- **[app/icon-192/route.tsx](file:///Users/stanleybaptista/Projects/orb/app/icon-192/route.tsx)** — 192px generated icon
- **[app/icon-512/route.tsx](file:///Users/stanleybaptista/Projects/orb/app/icon-512/route.tsx)** — 512px generated icon
- **[app/settings/notifications/page.tsx](file:///Users/stanleybaptista/Projects/orb/app/settings/notifications/page.tsx)** — notifications settings route
- **[components/ServiceWorkerRegistrar.tsx](file:///Users/stanleybaptista/Projects/orb/components/ServiceWorkerRegistrar.tsx)** — SW registration component
- **[components/settings/SettingsNotifications.tsx](file:///Users/stanleybaptista/Projects/orb/components/settings/SettingsNotifications.tsx)** — push notification settings UI
- **[lib/orb-state.ts](file:///Users/stanleybaptista/Projects/orb/lib/orb-state.ts)** — shared urgency computation
- **[lib/push.ts](file:///Users/stanleybaptista/Projects/orb/lib/push.ts)** — server-side push + escalation helpers
- **[lib/push-client.ts](file:///Users/stanleybaptista/Projects/orb/lib/push-client.ts)** — client-side push subscription management
- **[public/sw.js](file:///Users/stanleybaptista/Projects/orb/public/sw.js)** — service worker
- **[scripts/migrations/20260520_knowledge_repo_crud_rls.sql](file:///Users/stanleybaptista/Projects/orb/scripts/migrations/20260520_knowledge_repo_crud_rls.sql)**
- **[scripts/migrations/20260520_push_subscriptions.sql](file:///Users/stanleybaptista/Projects/orb/scripts/migrations/20260520_push_subscriptions.sql)**
- **[scripts/test-push.ts](file:///Users/stanleybaptista/Projects/orb/scripts/test-push.ts)** — push notification test script

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
*   **Push notifications fire from all mutation paths.** Both Orb conversation (`orb-converse.ts`) and direct UI edits (`TodoPanel`, `TodoView`, `TodoForm`) use shared `snapshotUrgency` / `checkAndNotifyEscalation` to detect urgency escalation.
*   **Slash commands are fill-only.** Selecting a command fills the input with placeholder selected — never auto-submits. Consistent with Claude Code's slash command behavior.

---

## Next Priorities

1. **Test push notifications in production** — verify Safari/Chrome on live site after deploy
2. **PWA widget phases 5-6** — scheduled escalation checks (cron), email digest integration
3. **Comet browser notifications** — Comet's Notification API doesn't bridge to macOS; investigate or document as known limitation

---

## AI Tool Used Last Session

`2026-05-20 — Claude Code (Claude Opus 4)`

---

*Updated by AI at end of each session. Committed with session code changes.*
