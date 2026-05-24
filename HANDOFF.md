# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.5.29 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**Implemented Manual Maintenance Mode (ORB-141) — 2026-05-24 (Session 15)**

1. **Created `system_settings` table** — added database table with composite RLS policies allowing public reads and admin-only writes.
2. **Created `MaintenancePage` & route** — client component with breathing Julia Set canvas, shooting meteors, starfield, and the calm pulsing Moonlight Orb with centered "ORB" text. Under `/maintenance`.
3. **Created `MaintenanceOverlay`** — client-side polling component that checks `/api/version` and overlays the UI when the user is locked out.
4. **Updated API and middleware** — added optimized cache (15s TTL) in middleware to redirect non-admins, return 503 for APIs, and support admin role bypass.
5. **Added settings page** — created `/settings/maintenance` for admins to toggle the flag, with audit log writing (`maintenance_enable` / `maintenance_disable`).
6. **Added admin warning banner** — displays a persistent warning banner at the top of the viewport for other logged-in admins to notify them when maintenance mode is active.
7. **Version bump** — v0.5.28 → v0.5.29.

---

## Uncommitted Changes

### Modified
- `package.json` — Version bump to v0.5.29
- `lib/version.ts` — Version bump to v0.5.29
- `lib/changelog.ts` — Added v0.5.29 release notes
- `middleware.ts` — Cache-optimized database maintenance check, redirects, and API 503 intercepts
- `app/layout.tsx` — Registered global MaintenanceOverlay listener and MaintenanceBanner
- `app/api/version/route.ts` — Dynamic version check endpoint with maintenance lockout status
- `components/settings/SettingsSidebar.tsx` — Added Maintenance Mode settings page to navigation (admin only)
- `HANDOFF.md` — this file

### Deleted
- None

### New
- `scripts/migrations/20260524_system_settings.sql` — Database migration for configuration table
- `components/ui/MaintenancePage.tsx` — Breathing Julia Set canvas + calm Moonlight Orb centered visual component
- `components/MaintenanceOverlay.tsx` — Dynamic client-side background poller for session lockout
- `components/MaintenanceBanner.tsx` — Warning banner for logged-in admins when maintenance is active
- `components/settings/SettingsMaintenance.tsx` — Settings view toggle with upsert and audit logging
- `app/maintenance/page.tsx` — Standalone /maintenance route
- `app/settings/maintenance/page.tsx` — Standalone /settings/maintenance admin route

---

## Key Decisions

*   **Decoupled Maintenance Mode check with edge cache.** Checking maintenance status via database on every single request in middleware degrades performance. Querying a lightweight `system_settings` table and caching it in middleware memory (15-second TTL) ensures sub-millisecond route resolution while remaining responsive to status updates. Fallback to `true` on database connection errors self-heals during database downtime.
*   **Non-destructive client session preservation.** Fullscreen overlays block user interactions during maintenance without forcing logout. This preserves active user session cookies so they can resume work seamlessly without re-authenticating when maintenance ends.
*   **PWA standalone mode top-left layout safety.** Window controls in standalone mode (iPad Stage Manager, macOS) can obscure top-left interactive elements (like back links). Offset layout headers using a `(display-mode: standalone)` media query wrapper to ensure comfortable hit targets and readability.
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
*   **Print is browser-native window.print().** No jspdf/html2canvas dependencies. Dedicated server-rendered print route with @media print CSS. One of two offboarding paths (JSON export is the other, not yet built).

---

## Next Priorities

1. **ORB-132** — Verify RLS initplan fix impact on Supabase disk I/O budget (due May 24, high priority).
2. **JSON export/import** — second offboarding path (complement to print/PDF).
3. **Test invitation flow** — Stan is testing invite emails with privacy/availability notices.
4. **iPhone update flow retest** — Stan deleted Home Screen PWA and will test UpdateBanner on next version bump.
5. **ORB-129 Phase 5 (iOS widget)** — shelved until Xcode + Apple Developer account are available. Phases 1–3 complete.
6. **ORB-129 Phase 4 (Email digest)** — daily/weekly orb state summary via Resend. Infrastructure exists.
7. **Offline editing with sync** — discussed but requires full data layer rewrite (IndexedDB + conflict resolution). Not scoped yet.

---

## AI Tool Used Last Session

`2026-05-24 — Antigravity (Gemini 1.5 Pro)`

---

*Updated by AI at end of each session. Committed with session code changes.*
