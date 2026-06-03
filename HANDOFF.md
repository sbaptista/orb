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

**ORB-202, ORB-203, ORB-198, git push lockdown — 2026-06-02 (Sessions 38+45+46)**

### Tickets closed
- ORB-198: Orb lacks UI navigation knowledge (Session 45, Antigravity)
- ORB-202: When todos are created from tickets, close the ticket (Session 46, Claude Code)
- ORB-203: Decouple query scope from mutation scope (Session 46, Claude Code)

### What was done
- **ORB-202:** Tickets auto-close when a todo is created from them. Reporter notified via existing notification flow.
- **ORB-203:** Removed scopeToProduct — Orb always sees all projects (global query), mutations default to selected project. Removed All/Scope toggle button from toolbar.
- **ORB-198 (Antigravity):** Runtime loading of ui-catalog.md into Orb system prompt. Enriched UI catalog with button labels, locations, mobile behavior. Created verify-ui-catalog.js lint check.
- **Git push lockdown:** Removed `Bash(git push *)` from allowlists in Orb and Helm. Documented in shared AGENTS.md, project AGENTS.md, and knowledge repo.
- **Plan reviews:** SystemStateProvider consolidation plan (amended), mobile layout proposal (Model B endorsed).

### Version bumps
- v0.5.127 → v0.5.128

---

## Uncommitted Changes

None (all committed this session).

---

## Key Decisions

- **Git push is NEVER automatic.** Structural enforcement: `Bash(git push *)` removed from all project allowlists. Behavioral enforcement: shared AGENTS.md + project AGENTS.md + knowledge repo. All three layers.
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
- **Dev-to-dev channel proposal reviewed.** Decision: not implementing yet. Current HANDOFF.md + WIP.md + knowledge repo process works. The proposal (docs/dev-to-dev-channel-plan.md) introduces a control gap — AI-to-AI messages bypass Stan's visibility. Would only be justified if AIs work on separate machines/branches simultaneously.
- **Mobile layout: Model B (client-side tabs) endorsed.** No swipe gestures, no auto-switching, bottom tab bar, data-attribute CSS. Portrait iPad gets tabs too (breakpoint ≥1024px for split).

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
2. **SystemStateProvider consolidation.** Plan reviewed and amended — ready to implement when approved.
3. **Mobile layout (Model B).** Plan reviewed — client-side tabs, bottom nav, no swipe gestures.
4. **ORB-194: Named views + Orb set_view tool.** Conversational view switching, saved view configurations.
5. **ORB-192: Data privacy model.** Gates behavioral observation, internet research, Orb memory.
6. **ORB-173: Pre-Alpha Checklist.** Due June 5, 2026. Value demo (ORB-195) now done.
7. **Newcomer onboarding.** Guided first interaction or walkthrough cards. Design needed.
8. **Recurring tasks.** Identified as gap in ORB-195 Test 2. Schema + tool extension needed.
9. **External tester validation.** Run Nuts and Bolts tests with 3-5 non-immersed users.
10. **ORB-169: Source file audit.** AmbientDashboard orphaned. Dead routes.
11. **Update `docs/ui-catalog.md`** with view components, kanban classes, dev channel card, nav patterns.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Never `git push` without Stan's explicit in-chat approval** — structural enforcement via settings.local.json
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

---

## AI Tool Used Last Session

`2026-06-02 — Claude Code (Opus 4.6) — Session 46`

---

*Updated by AI at end of each session. Committed with session code changes.*
