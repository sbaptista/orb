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

**Desktop Pane Toggle & Viewport Layout Refinements — 2026-06-01 (Session 40)**

### Tickets closed
- None

### What was done
- **Fixed Desktop Full Width Switching (v0.5.105)**: Applied explicit `width: '100%'` inline styles to `.ud-orb-pane` and `.ud-list-pane` when they are rendered as the sole visible pane on desktop viewports. This fixes the layout bug where hiding one of the panes on desktop results in the remaining active pane staying stuck at 50% width next to an empty background.
- **Grayed Out Active Mobile Toggles (v0.5.106)**: Configured the mobile tab toggle buttons ("Orb" and "List") to disable when their respective tab is already active, which dynamically grays them out and blocks redundant clicks.
- **Enlarged Mobile Button Labels (v0.5.106)**: Changed `.nav-btn-label` to use the standard `var(--fs-sm)` button text font size variable, and bumped mobile `--fs-sm` font size override to `17px` (2px larger than the previous `15px`) to improve iPhone readability.
- **Constant Project Search Placeholder (v0.5.106 / v0.5.108)**: Changed the project search input placeholder in both `UnifiedDashboard` and classic `TodoView` to always show `"Type to select project or user..."` instead of dynamically switching based on the current selection.
- **Standardized Text Sizes (v0.5.107 / v0.5.108)**: Refactored hardcoded font sizes in search inputs, placeholders, and slash command view structures to use standardised CSS variables (`var(--fs-sm)` and `var(--fs-version)`), enabling them to scale dynamically with the rest of the application layouts.
- **Orb Conversation Toolbar Text Labels (v0.5.108)**: Redesigned the icon button strip below the input field in the Orb conversation view to display text labels centered directly below the icons/characters. Enabled horizontal scrolling on the toolbar for mobile viewports to prevent layout wrapping.

### Version bumps
- v0.5.104 → v0.5.105 → v0.5.106 → v0.5.107 → v0.5.108

---

## Uncommitted Changes

- `package.json` (modified)
- `lib/version.ts` (modified)
- `lib/changelog.ts` (modified)
- `components/UnifiedDashboard.tsx` (modified)
- `app/globals.css` (modified)
- `docs/mobile_dashboard_layout_proposal.md` (untracked)
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

`2026-06-01 — Antigravity (Gemini 1.5 Pro) — Session 40`

---

*Updated by AI at end of each session. Committed with session code changes.*
