# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.5.66 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**Unified Dashboard Phase 1 + Explicit DB Grants — 2026-05-27 (Session 27)**

- **Unified Dashboard (v0.5.60):** Built `UnifiedDashboard.tsx` merging Orb conversation and task list into a single split-pane view. Vertical stack on iPhone (drag up/down), side-by-side on desktop (drag left/right). `DragDivider.tsx` with snap points (30/70, 50/50, 70/30) and localStorage persistence. Fractal background visible through both panes. Widened OrbConversation max-width from 420px to 600px.
- **Dashboard Refinements (v0.5.61):** Removed project strip from Orb. Added panel toggle icons (sidebar show/hide) on command bar edges. Converted TodoPanel from slide-in to floating centered modal (`modal-center`). Replaced project dropdown with admin-aware search (admins see all projects with owner names). Fixed command bar font to `font-ui`.
- **Explicit Database Grants (v0.5.66):** Migration `20260527_explicit_grants.sql` tightens existing table grants (anon loses write access to user data) and sets `ALTER DEFAULT PRIVILEGES` for the `postgres` role so future tables auto-get correct grants. Prepares for Supabase breaking change (Oct 30, 2026). Knowledge repo entry created with full details and link to Supabase discussion.
- **Version bump:** `v0.5.60` → `v0.5.61` → `v0.5.66` (intermediate versions by other AI sessions).

---

## Uncommitted Changes

None — all changes committed and pushed.

---

## Key Decisions

- **Explicit DB grants + ALTER DEFAULT PRIVILEGES future-proof new tables.** Supabase will stop auto-exposing new public tables to the Data API on Oct 30, 2026. Migration `20260527_explicit_grants.sql` tightens existing grants and sets defaults so new tables created via psql get correct grants automatically. See knowledge repo entry for full details. *(2026-05-27)*
- **Server Actions called inside client-side background polling or mount effects require robust client-side error handling.** Otherwise, when a device wakes up from sleep or backgrounds/foregrounds while offline, the failing `fetch` call will throw an uncaught promise rejection that crashes the entire React application shell before OS offline detection can update the UI. *(2026-05-27)*
- **Zero-Row Project Switcher preserves iPhone real estate.** By integrating the switcher dropdown directly into the topbar title button and removing the project pill bar row, we save ~48px of vertical screen height on narrow devices. *(2026-05-26)*
- **OTP requests require client-side rate-limiting.** Because GoTrue does not automatically expire or delete abandoned `auth.flow_state` rows immediately, any public-facing sign-in path can trigger persistent write-bloat if users repeatedly request OTPs. Client-side cooldown is a simple, effective mitigation. *(2026-05-26)*
- **Orb needs space — cramped is a dealbreaker.** The prototype's 60/40 split makes the Orb feel squeezed. The spaciousness of AmbientDashboard is a feature. Next iteration must preserve that breathing room. *(2026-05-25)*
- **The Orb is a presence, not a chat box.** Any unified layout must keep the Orb visually dominant. Demoting it to a sidebar kills what makes the product distinctive. *(v0.5.56, 2026-05-25)*
- **Prototype direction for DashboardView:** Don't promote the list and demote the Orb. Instead, keep the Orb center stage (existing AmbientDashboard layout) and add a task list as a flyout panel that coexists with it. *(2026-05-25)*
- **iPhone-first table design.** TodoView table is designed mobile-first: actions collapse inline below title on iPhone, expand to their own column on desktop. No horizontal scrolling needed. *(v0.5.54, 2026-05-25)*
- **Box-shadow for iOS table row borders.** Safari iOS drops `border-bottom` on `<td>` even with `border-collapse: separate`. `box-shadow: inset 0 -1px 0 0` is the reliable cross-browser pattern. *(v0.5.54, 2026-05-25)*
- **No bulk edits in checklist mode.** Checklist is a quick tap-to-complete interface. Bulk operations belong in list view. *(v0.5.54, 2026-05-25)*
- **Background poll must not flash loading state.** `setLoading(true)` only on initial load, not on poll refetches. *(v0.5.54, 2026-05-25)*
- **60s poll interval is sufficient for single-user.** Reduced from 30s to halve query volume. *(v0.5.57, 2026-05-25)*
- **DB health is a first-class concern.** AGENTS.md now enforces design-time DB impact analysis and periodic health review for every session. *(2026-05-25)*
- **No Realtime subscriptions for single-user views.** `useVisibilityRefetch` is the correct pattern. *(ORB-132, 2026-05-25)*
- **Checklist mode is per-project, persists to DB.** `projects.view_mode` column. *(ORB-155)*
- **`query_db` replaces whack-a-mole filter additions.** Declarative JSON query format. RLS-scoped. 200-row cap.
- **Email is the stable identity, not auth UUID.**
- **Database is the source of truth — period.**
- **Single auth authority.** `getAuthContext()` / `requireAdmin()` in `lib/auth.ts`.
- **RLS is the safety net.** All new RLS policies use `(SELECT auth.uid())` wrapper.

---

## Prototype Files (isolated, safe to delete if direction changes)

| File | Purpose |
|---|---|
| `app/prototype/page.tsx` | Server component — auth gate, renders UnifiedDashboard |
| `components/UnifiedDashboard.tsx` | Client component — unified split-pane Orb + task list |
| `components/DragDivider.tsx` | Pointer-event draggable split divider with snap points |
| `components/UnifiedView.tsx` | (Old prototype) task list + OrbPanel side by side — superseded |
| `components/OrbPanel.tsx` | (Old prototype) standalone Orb conversation panel — superseded |
| `app/globals.css` (`.ud-*`, `.up-*` rules) | Scoped styles for unified dashboard |

---

## Next Priorities

1. **Continue ORB-160 prototype iterations:** Phase 2 (TodoPanel → modal-center is done), Phase 3 (delete InlineEditPopover), Phase 4 (route swap: `/dashboard` renders UnifiedDashboard), Phase 5 (cleanup old components).
2. **Test wake-from-sleep and offline behavior** on MacBook, iPhone, and iPad to confirm custom offline page displays and recovers.
3. **Test unified dashboard at /prototype** on iPhone and desktop — verify split pane, divider drag, panel toggles, admin search, floating edit modal.
4. **Monitor Disk IO Budget** — Check Supabase Dashboard → Observability → Disk IO chart.
5. **JSON export/import** — second offboarding path (complement to print/PDF).

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

---

## AI Tool Used Last Session

`2026-05-27 — Claude Code (Claude Opus 4.6)`

---

*Updated by AI at end of each session. Committed with session code changes.*
