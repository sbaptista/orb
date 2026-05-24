# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.5.28 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**Fixed topbar navigation overlap on iPad/iPhone PWA and expanded task search context — 2026-05-24 (Session 14)**

1. **Fixed back link overlap in PWA (ORB-149)** — adjusted `.tv-topbar` layout dynamically using safe area left insets (`var(--sal)`) and added a media query override (`display-mode: standalone`) on device widths >= 768px to pad `.tv-topbar` by `80px` to shift the `<- Back` link away from Stage Manager window controls (traffic lights) on iPad.
2. **AI search & query strategy upgrades** — updated the `query_todos` tool to return all statuses by default when no status filter is specified, returning task owner, category, group name, and URL attachment count to improve assistant context. Added instructions to system prompt on query strategies (e.g. scoping counts and using `status_group='active'` selectively).
3. **Linked knowledge base entries** — modified system prompt generation to automatically link knowledge repository entries back to their source tasks (e.g. `[from: ORB-123]`) if they were generated during todo resolution.
4. **Enhanced admin profiles in context** — resolved role names and decline reasons in `invitations` displayed to admins.
5. **Closed ORB-149** with resolution notes + knowledge repo entries.
6. **Version bump** — v0.5.24 → v0.5.28.

---

## Uncommitted Changes

### Modified
- `app/globals.css` — Safe area left inset and standalone media query padding overrides for `.tv-topbar`
- `app/actions/orb-converse.ts` — Enriched query_todos payload, updated system prompt queries strategies, links knowledge to tasks
- `lib/orb-contract.ts` — Auto-generated tool schema changes for query_todos has_urls/has_group/has_category filters
- `lib/changelog.ts` — Added v0.5.28 release notes
- `lib/version.ts` — Version bump to v0.5.28
- `package.json` — Version bump to v0.5.28
- `HANDOFF.md` — this file

### Deleted
- None

### New
- None

---

## Key Decisions

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

`2026-05-24 — Antigravity (Gemini 3.5 Flash)`

---

*Updated by AI at end of each session. Committed with session code changes.*
