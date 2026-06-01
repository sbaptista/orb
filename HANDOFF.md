# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**API Health and Version Polling Consolidation — 2026-06-01 (Session 38)**

### Tickets closed
- None

### What was done
- **Created SystemStateProvider (v0.5.99)**: Unified check logic for `/api/health` and `/api/version` inside a single client context provider.
- **Deduplication & Debounce**: Implemented a 500ms trailing debounce on window focus and visibility change event listeners to prevent back-to-back duplicate fetching.
- **Hidden Tab Polling Pause**: Configured the 30-second interval timers for health and version status checks to automatically pause ticks when `document.visibilityState === 'hidden'`.
- **Refactored Consumers**: Rewrote `useOnlineStatus`, `MaintenanceOverlay`, `MaintenanceBanner`, and `UpdateBanner` to consume system state from `useSystemState` instead of running their own local intervals and listeners.
- **DEV Panel Compatibility**: Supported `todos-dev-offline-change` and `todos-dev-update-change` simulation triggers and localStorage variables within the new provider layout.
- **Layout Adjustments**: Moved `OfflinePage` and `MaintenanceOverlay` inside the `<Providers>` layout tree in `app/layout.tsx` to enable access to the React Context.

### Version bumps
- v0.5.96 → v0.5.97 → v0.5.98 → v0.5.99

---

## Uncommitted Changes

- `app/layout.tsx` (modified)
- `components/MaintenanceBanner.tsx` (modified)
- `components/MaintenanceOverlay.tsx` (modified)
- `components/Providers.tsx` (modified)
- `components/UpdateBanner.tsx` (modified)
- `components/views/TaskKanbanView.tsx` (modified)
- `hooks/useOnlineStatus.ts` (modified)
- `lib/changelog.ts` (modified)
- `lib/version.ts` (modified)
- `package.json` (modified)
- `components/SystemStateProvider.tsx` (new file)
- `output.css` (untracked)
- `.claude/settings.local.json` (modified)
- `docs/Consolidate_API_Health_and_Version_Polling.md` (untracked)

---

## Key Decisions

- **Dev channel architecture: two complementary reply paths.** `orb_response` field = direct reply for dev→orb exchanges. `send_to_developer` tool = Orb proactively flagging things during user conversations.
- **Tickets = strategic backlogs, dev channel = tactical debugging.** Orb's own assessment: "Latency matters." The two systems complement, not replace.
- **Dev channel read-only tools only.** No mutations without Stan's approval.
- **No Supabase Realtime for dev channel.** Tab-focus polling via useVisibilityRefetch.
- **Behavioral persistence via knowledge repo tagging.** Entries tagged `orb-behavior` are loaded into the system prompt. No new tables needed — just write a knowledge entry.
- **Mutation approval default: ask.** New users start with ask (propose before executing). Power users can set to session or allow.
- **Never silently degrade a request.** Capability check prompt ensures the Orb discloses unsupported features before proposing mutations.
- **ORB-188 prompt architecture lives in `lib/orb-prompt.ts`.** Separate from the auto-generated `lib/orb-contract.ts` (tools). The generator stays untouched.
- **Staging environment removed.** Two-tier workflow: localhost → production.
- **Orb identity: Brownie temperament, butler intelligence.** User is always in control.
- **Kanban column order: Open → In Progress → Closed → Deferred → On Hold.** Drag-and-drop implemented.
- **Adaptive UI is the long-term direction.** Named views + Orb set_view tool deferred to ORB-194.

---

## Prototype Files (isolated, safe to delete if direction changes)

| File | Purpose |
|---|---|
| `app/prototype/page.tsx` | Server component — auth gate, renders UnifiedDashboard |
| `components/UnifiedDashboard.tsx` | Client component — unified split-pane Orb + task list |
| `components/DragDivider.tsx` | Pointer-event draggable split divider with snap points |
| `components/views/TaskListView.tsx` | Extracted list table view |
| `components/views/TaskChecklistView.tsx` | Extracted checklist table view |
| `components/views/TaskKanbanView.tsx` | Kanban board view with drag-and-drop |
| `components/views/ViewSwitcher.tsx` | View selector bar |
| `components/views/types.ts` | Shared types for view components |
| `components/UnifiedView.tsx` | (Old prototype) task list + OrbPanel side by side — superseded |
| `components/OrbPanel.tsx` | (Old prototype) standalone Orb conversation panel — superseded |
| `app/globals.css` (`.ud-*`, `.up-*`, `.tv-kanban-*`, `.oc-dev-*` rules) | Scoped styles for unified dashboard + dev channel |

---

## Next Priorities

1. **ORB-178: Kanban remaining work.** Drag-and-drop done. May need polish after external testing.
2. **ORB-194: Named views + Orb set_view tool.** Conversational view switching, saved view configurations.
3. **ORB-192: Data privacy model.** Gates behavioral observation, internet research, Orb memory.
4. **ORB-173: Pre-Alpha Checklist.** Due June 5, 2026. Value demo (ORB-195) now done.
5. **Newcomer onboarding.** Guided first interaction or walkthrough cards. Design needed.
6. **Recurring tasks.** Identified as gap in ORB-195 Test 2. Schema + tool extension needed.
7. **External tester validation.** Run Nuts and Bolts tests with 3-5 non-immersed users.
8. **ORB-169: Source file audit.** AmbientDashboard orphaned. Dead routes.
9. **Update `docs/ui-catalog.md`** with view components, kanban classes, dev channel card, nav patterns.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

---

## AI Tool Used Last Session

`2026-06-01 — Antigravity (Gemini 3.5 Flash) — Session 38`

---

*Updated by AI at end of each session. Committed with session code changes.*
