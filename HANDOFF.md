# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.5.30 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**Resolved UI Alignment Overlap in Dialogue Mode (ORB-150) — 2026-05-24 (Session 16)**

1. **Created todo ORB-150** — confirmed task exists, fixed, and closed it in database with resolution notes.
2. **Fixed top-right navigation overlap** — added `data-mode` attribute to the `.dash-nav` container in [components/AmbientDashboard.tsx](file:///Users/stanleybaptista/Projects/orb/components/AmbientDashboard.tsx).
3. **Styled shift offset in CSS** — positioned `.dash-nav[data-mode="dialogue"]` to shift `right: 88px` with a matching `0.6s` cubic-bezier transition in [app/globals.css](file:///Users/stanleybaptista/Projects/orb/app/globals.css) to slide the buttons away from the scaled-down Orb.
4. **Created Knowledge Repository entry** — documented layout lessons regarding dynamic CSS translation offsets and absolute elements in Supabase.
5. **Version bump** — bumped version to `0.5.30` across package.json, version.ts, and changelog.ts.
6. **Verification** — verified successful Next.js build.

---

## Uncommitted Changes

### Modified
- `package.json` — Version bump to v0.5.30
- `lib/version.ts` — Version bump to v0.5.30
- `lib/changelog.ts` — Added v0.5.30 release notes
- `app/globals.css` — Shift top-right navigation bar to the left in dialogue mode
- `components/AmbientDashboard.tsx` — Add data-mode attribute to .dash-nav container
- `HANDOFF.md` — this file

### Deleted
- None

### New
- None

---

## Key Decisions

*   **Shift top-right navigation instead of hiding.** Hiding the navigation buttons (List, Print, Help, Settings, Account) in dialogue mode degrades the user experience by locking the user out of core dashboard options. Moving them 88px to the left clears the visual space of the scaled-down Orb at `right: 10px` without cluttering the left side of the header.
*   **Coordinate motion curves.** Synchronized the transition time and easing curve of the `.dash-nav` shift (`transition: right 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)`) with the Orb's scaling animation to maintain visual alignment and fluid motion.
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
