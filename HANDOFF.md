# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.5.65 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**Resilient Offline Handling for Server Actions & Supabase Queries — 2026-05-27 (Session 26)**

- **Error Handling for Server Actions:** Added client-side `try/catch` and `.catch()` blocks to Server Action invocations (`getUrgencySnapshot`, `orbGreeting`, and `notifyIfEscalated`) in background loops, mount effects, and click/bulk action handlers to prevent crashes upon waking.
- **Error Handling for Supabase Queries:** Wrapped all client-side Supabase database queries executing inside `useEffect` blocks (in `AmbientDashboard`, `UnifiedDashboard`, and `TodoView`) in `try/catch` and `.catch()` blocks to prevent unhandled runtime errors from network drops during sleep or wake.
- **Offline Reactivity on Wake:** Enhanced `useOnlineStatus` hook to listen to `visibilitychange` and `focus` events. This ensures that when the browser wakes up or is refocused, the connectivity state `/api/health` check is run immediately. Stale online state is avoided, and the custom `OfflinePage` overlay shows instantly during the transient reconnecting phase.
- **Hook Order Violation Fix:** Fixed a pre-existing React Hook order violation in `OfflinePage.tsx` where an early return was declared conditionally before `useRef`/`useEffect` hooks, preventing client-side react runtime crashes on offline state transitions.
- **Version bump:** Bumped patch version to `v0.5.65` in `package.json`, `lib/version.ts`, and `lib/changelog.ts`.

---

## Uncommitted Changes

- **[package.json](file:///Users/stanleybaptista/Projects/orb/package.json)**: Bumped version to `0.5.65`.
- **[version.ts](file:///Users/stanleybaptista/Projects/orb/lib/version.ts)**: Bumped display version to `v0.5.65`.
- **[changelog.ts](file:///Users/stanleybaptista/Projects/orb/lib/changelog.ts)**: Documented changes for `v0.5.65` and `v0.5.64`.
- **[hooks/useOnlineStatus.ts](file:///Users/stanleybaptista/Projects/orb/hooks/useOnlineStatus.ts)**: Added visibility and focus event listeners to trigger check() immediately.
- **[AmbientDashboard.tsx](file:///Users/stanleybaptista/Projects/orb/components/AmbientDashboard.tsx)**: Wrapped Server Actions and client-side database queries in try/catch and catch handlers.
- **[UnifiedDashboard.tsx](file:///Users/stanleybaptista/Projects/orb/components/UnifiedDashboard.tsx)**: Wrapped Server Actions and client-side database queries in try/catch and catch handlers.
- **[TodoView.tsx](file:///Users/stanleybaptista/Projects/orb/components/TodoView.tsx)**: Wrapped Server Actions and client-side database queries in try/catch.
- **[OfflinePage.tsx](file:///Users/stanleybaptista/Projects/orb/components/ui/OfflinePage.tsx)**: Fixed conditional hook order issue by moving early return below hook declarations.

---

## Key Decisions

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
| `app/prototype/page.tsx` | Server component — auth gate, renders UnifiedView |
| `components/UnifiedView.tsx` | Client component — task list + OrbPanel side by side |
| `components/OrbPanel.tsx` | Standalone Orb conversation panel with mini sphere |
| `app/globals.css` (`.up-*` rules) | Scoped styles — no conflicts with existing CSS |

---

## Next Priorities

- **Test wake-from-sleep and offline behavior** on MacBook, iPhone, and iPad to confirm that it displays the custom offline page and recovers automatically when reconnected instead of crashing.
- **Continue prototype iterations for ORB-160**: Refine visual alignment of top bar panels and begin implementing the task list flyout panel layout overlaying the dashboard.
- **Monitor Disk IO Budget** — Check Supabase Dashboard → Observability → Disk IO chart to confirm that both the Realtime subscription removal (`v0.5.57`) and OTP request cooldown (`v0.5.58`) keep Disk IO at a minimum.
- **JSON export/import** — second offboarding path (complement to print/PDF).

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

---

## AI Tool Used Last Session

`2026-05-27 — Antigravity (Gemini 3.5 Flash)`

---

*Updated by AI at end of each session. Committed with session code changes.*
