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

**Kanban Touch Drag Cleanups, Selection, and Scroll Fixes — 2026-06-01 (Session 42)**

### Tickets closed
- None

### What was done
- **Fixed Horizontal Scroll Hijacking during Touch Drag (v0.5.124)**: Prevented horizontal column scrolling from reclaiming active touch gestures on iOS Safari. Once the 300ms long-press hold finishes and `holdReady` triggers, all early `touchmove` events are immediately `preventDefault()`ed (lowered movement activation threshold to 2px), blocking Safari from ever interpreting the touch action as horizontal container scrolling.
- **Disabled Text Selection on Kanban Elements (v0.5.123)**: Added `user-select: none` and `-webkit-user-select: none` to the `.tv-kanban` column container and `.tv-kanban-card` classes to prevent accidental text highlight overlays and Safari magnification bubbles during touch drag actions on mobile.
- **Removed Debug Coordinate Check Alert (v0.5.122)**: Cleaned up the touch drag coordinate debug alerts and associated tracking references (`dragHistoryRef` and `lastTouchXRef`) from `TaskKanbanView.tsx` now that mobile touch drag-and-drop drop testing is complete and successful.
- **Fixed Mobile Drop Failures in Kanban View (v0.5.116)**: Resolved touch drag drops failing on iPhone by registering native document-level touch listeners for `touchmove`, `touchend`, and `touchcancel` with `{ passive: false }` to prevent iOS Safari scrolling interference. Added React refs for `dropTarget` and `onStatusChange` to bypass stale closure bugs during active touch gestures.
- **Cleaned Up Card Wrapper JSX (v0.5.116)**: Removed unused React synthetic touch handlers (`onTouchMove`, `onTouchEnd`, `onTouchCancel`) from Kanban card divs to let native document listeners handle the touch flow.
- **Cleaned Up Unused Props (v0.5.116)**: Removed unused `statusColor` prop from `KanbanCard` and its instantiation.
- **Prevented Horizontal Scroll Interference (v0.5.120)**: Added `touch-action: pan-y` style rule on Kanban cards in `globals.css` to block browser-level horizontal scrolling gestures from claiming and cancelling the drag session.
- **Disabled Native HTML5 Drag Hijacking (v0.5.121)**: Set `draggable={!isTouchDevice}` dynamically on cards so touch viewports execute custom touch drag-and-drop instead of browser-level native drag ghosting.

### Version bumps
- v0.5.121 → v0.5.122 → v0.5.123 → v0.5.124

---

## Uncommitted Changes

- `package.json` (modified)
- `lib/version.ts` (modified)
- `lib/changelog.ts` (modified)
- `components/views/TaskKanbanView.tsx` (modified)
- `app/globals.css` (modified)
- `HANDOFF.md` (modified)

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

`2026-06-01 — Antigravity (Gemini 3.5 Flash) — Session 42`

---

*Updated by AI at end of each session. Committed with session code changes.*
