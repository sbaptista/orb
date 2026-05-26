# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.5.56 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**TodoView table layout + Unified prototype — 2026-05-25 (Session 22)**

### TodoView List Mode — Table Conversion (v0.5.48–v0.5.54, shipped)
- Replaced flex-row div layout with proper HTML `<table>` — column headers, select-all checkbox, labeled action buttons (Edit, Quick, Done) with bordered pill styling.
- iPhone-first responsive: on mobile, actions collapse below the title inside each row (no horizontal scrolling). On desktop, actions stay in their own column at the far right.
- Title clamped to 2 lines with ellipsis overflow (uses `max-width: 0` trick on `<td>` to force overflow).
- Removed status pills and priority indicators from list rows — redundant with active filters.
- Darkened table header with uppercase labels, increased row padding for readability.
- Project name moved to its own centered row above the table.

### TodoView Checklist Mode — Table Rebuild
- Rebuilt as a clean table with done-circle and title only — no bulk edits (use list view for bulk operations).

### Bug Fixes
- Fixed constant screen refreshing: background 30s poll was setting `loading = true` every cycle, flashing the entire list. Now only the initial load shows loading state.
- Fixed Safari iOS row borders: `border-bottom` on `<tr>` and `<td>` not rendering in iOS Safari. Switched to `box-shadow: inset 0 -1px 0 0 var(--border)` which renders reliably.
- Table uses `border-collapse: separate; border-spacing: 0` instead of `collapse` for iOS compatibility.

### Update Banner
- Centered button with "An application update is available" message to its right, replacing the previous right-aligned button + toast notification pattern.

### Unified Prototype (v0.5.55–v0.5.56, shipped)
- New `/prototype` route — unified command surface with task list and Orb conversation panel side by side.
- **Desktop:** 60/40 split — task list left, Orb panel right.
- **iPhone:** full-width task list with collapsible bottom sheet for Orb (60% height, slide-up animation).
- **Mini Orb sphere** in panel header — breathing gradient ball with project code arc text and active task count. Restores the Orb's visual presence that was missing in the first iteration (Stan's feedback: "I really miss the Orb itself").
- OrbPanel component (`components/OrbPanel.tsx`): standalone conversation panel with streaming, thought indicators, auto-refetch on mutations via `onMutation` callback.
- Project selector pill bar for switching projects without navigation.
- Completely isolated — no changes to existing AmbientDashboard or TodoView.

### Design Review
- Reviewed Gemini's ambient dialogue design proposal and Perplexity's critical review.
- **Key takeaway from Perplexity:** Orb is best positioned as a "personal project-thinking tool" — not a "todo app with AI." The value is in the integration of list execution + Orb orchestration.
- **Key takeaway from prototype feedback:** The Orb is a *presence*, not just a chat interface. Any unified layout must keep the Orb visually dominant, not demote it to a sidebar.

### Prior Session (uncommitted, included in v0.5.54 commit)
- AmbientDashboard, TodoForm, TodoPanel, SettingsPlatforms, SettingsSidebar updates
- ProductConfigPanel deleted

---

## Uncommitted Changes

All changes from this session are committed and pushed. No local-only state.

---

## Key Decisions

- **The Orb is a presence, not a chat box.** Any unified layout must keep the Orb visually dominant. Demoting it to a sidebar kills what makes the product distinctive. *(v0.5.56, 2026-05-25)*
- **Prototype direction for DashboardView:** Don't promote the list and demote the Orb. Instead, keep the Orb center stage (existing AmbientDashboard layout) and add a task list as a flyout panel that coexists with it. *(2026-05-25)*
- **iPhone-first table design.** TodoView table is designed mobile-first: actions collapse inline below title on iPhone, expand to their own column on desktop. No horizontal scrolling needed. *(v0.5.54, 2026-05-25)*
- **Box-shadow for iOS table row borders.** Safari iOS drops `border-bottom` on `<td>` even with `border-collapse: separate`. `box-shadow: inset 0 -1px 0 0` is the reliable cross-browser pattern. *(v0.5.54, 2026-05-25)*
- **No bulk edits in checklist mode.** Checklist is a quick tap-to-complete interface. Bulk operations belong in list view. *(v0.5.54, 2026-05-25)*
- **Background poll must not flash loading state.** `setLoading(true)` only on initial load, not on 30s poll refetches. *(v0.5.54, 2026-05-25)*
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

1. **DashboardView evolution** — Based on prototype learnings: add a task list flyout to the existing AmbientDashboard rather than building a separate unified page. The Orb stays center stage.
2. **DB Health monitoring** — Establish ongoing monitoring, design-time impact analysis, and periodic review process.
3. **JSON export/import** — second offboarding path (complement to print/PDF).
4. **iPhone update flow retest** — Stan deleted Home Screen PWA and will test UpdateBanner on next version bump.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

---

## AI Tool Used Last Session

`2026-05-25 — Claude Code (Claude Opus 4.6)`

---

*Updated by AI at end of each session. Committed with session code changes.*
