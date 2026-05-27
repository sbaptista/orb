# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.5.59 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**Prototype Zero-Row Project Switcher & Commands — 2026-05-26 (Session 25)**

- **Zero-Row Project Switcher:** Replaced the horizontal project bar (`up-project-bar`) on the `/prototype` route with a project switcher dropdown trigger (`[Project Name] ▾`) directly inside the top bar, recovering ~48px of vertical screen height.
- **Responsive Switcher UI:** Built a searchable desktop dropdown switcher and a touch-friendly slide-up bottom drawer overlay switcher for mobile (iPhone/iPad) with search filtering and automatic close.
- **App-wide Commands:** Integrated list page actions (List, Print, Help, Settings, Account) on the top-right of the desktop topbar, and hooked up client-side overlays for `PrintModal` and `OrbHelp`.
- **User Details Integration:** Passed resolved user data from `app/prototype/page.tsx` into `UnifiedView` to dynamically display the active user's initial on the Account button.
- **Version bump:** Bumped version to `v0.5.59` in `package.json`, `lib/version.ts`, and `lib/changelog.ts`.

---

## Uncommitted Changes

- **[package.json](file:///Users/stanleybaptista/Projects/orb/package.json)**: Bumped version to `0.5.59`.
- **[version.ts](file:///Users/stanleybaptista/Projects/orb/lib/version.ts)**: Bumped display version to `v0.5.59`.
- **[changelog.ts](file:///Users/stanleybaptista/Projects/orb/lib/changelog.ts)**: Documented changes for `v0.5.58` and `v0.5.59`.
- **[login/page.tsx](file:///Users/stanleybaptista/Projects/orb/app/auth/login/page.tsx)**: Added OTP cooldown timer and UI (from v0.5.58).
- **[globals.css](file:///Users/stanleybaptista/Projects/orb/app/globals.css)**: Added `.auth-info` style (v0.5.58) and `.up-*` styles for switcher trigger, desktop dropdown, and mobile drawer overlay (v0.5.59).
- **[prototype/page.tsx](file:///Users/stanleybaptista/Projects/orb/app/prototype/page.tsx)**: Pass user details to `UnifiedView`.
- **[UnifiedView.tsx](file:///Users/stanleybaptista/Projects/orb/components/UnifiedView.tsx)**: Replaced project pill bar with Zero-Row switcher header and integrated app-wide commands.

---

## Key Decisions

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
- **Dedicated `tickets` table replaces TICKETS project todos.** Two-layer model. *(ORB-148, 2026-05-25)*
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

1. **Continue prototype iterations for ORB-160**: Refine visual alignment of top bar panels and begin implementing the task list flyout panel layout overlaying the dashboard.
2. **Monitor Disk IO Budget** — Check Supabase Dashboard → Observability → Disk IO chart to confirm that both the Realtime subscription removal (`v0.5.57`) and OTP request cooldown (`v0.5.58`) keep Disk IO at a minimum.
3. **iPhone update flow retest** — Stan deleted Home Screen PWA and will test UpdateBanner on next version bump.
4. **JSON export/import** — second offboarding path (complement to print/PDF).

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

---

## AI Tool Used Last Session

`2026-05-26 — Antigravity (Gemini 3.5 Flash)`

---

*Updated by AI at end of each session. Committed with session code changes.*
