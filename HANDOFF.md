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

**Disk IO fix, ORB-188 Phases 1–2 (kanban), design exploration — 2026-05-30 (Session 35)**

### Tickets created
- **ORB-192:** Design data privacy model — privacy from users AND from the Orb itself

### What was done

**Disk IO budget fix (v0.5.91)**
- Replaced 60-second `getUrgencySnapshot()` server polling (4 DB queries/min/tab) with client-side `computeUrgency()` against cached `allTodosRef`
- Cache refreshes on mount + tab focus via `useVisibilityRefetch`
- Push notification escalation (`notifyIfEscalated`) only fires on actual urgency change — rare
- AmbientDashboard: all server urgency polling removed, timer stripped to `setTick()` for UI re-renders
- VACUUM ANALYZE run on public tables (system_settings, users, projects, todos, knowledge_repo)
- Before/after: auth table seq_scans dropped from ~4/min/tab to ~1/min total

**ORB-188 Phase 1: Extract view components**
- `components/views/types.ts` — shared `ViewTodo`, `ViewPriority`, `ViewProps` types, `parseLocalDatetime` helper
- `components/views/TaskListView.tsx` — extracted list table from UnifiedDashboard
- `components/views/TaskChecklistView.tsx` — extracted checklist table
- `components/views/ViewSwitcher.tsx` — view selector bar (List, Checklist, Kanban buttons)
- UnifiedDashboard: replaced ~120 lines of inline rendering with component imports
- `checklistMode` boolean replaced with `viewMode: ViewMode` state ('list' | 'checklist' | 'kanban')

**ORB-188 Phase 2: Kanban view**
- `components/views/TaskKanbanView.tsx` — kanban board with columns by status
- Column order: Open → In Progress → Closed → Deferred → On Hold (workflow pipeline first, parked statuses last)
- Cards show: title, priority dot, task ref, due date badge
- Click any card to open TodoPanel
- CSS: `tv-kanban-*` classes in globals.css — per-column vertical scroll, horizontal scroll for columns, fixed column headers
- No drag-and-drop yet (planned)

**ORB-188 design exploration**
- Stan answered the 5 foundational design questions — documented in `docs/orb-188-plan.md`
- Core identity: "Brownie temperament, butler intelligence" (from The Mote in God's Eye)
- Adaptive UI concept: Orb reshapes the interface per user, multiple views, user-named saved views
- Competitive landscape research: 3 AI philosophies in task management, generative UI trends
- Privacy gate: ORB-192 created — blocks behavioral observation and internet research features

**Bug fixes**
- Urgency transition messages debounced (10s window) — prevents duplicate "Orb shifted busy" spam from transient re-render flicker
- Views button in toolbar changed from stacked icon+text to horizontal text, consistent with Sort/Filter

### Version bumps
- v0.5.90 → v0.5.91

---

## Uncommitted Changes

All changes staged for commit — pending push to production.

### Modified files
- `app/globals.css` — `tv-kanban-*` CSS classes, `ud-list-content:has(.tv-kanban)` override
- `app/prototype/page.tsx` — Product type updated to include 'kanban' view_mode
- `components/AmbientDashboard.tsx` — removed server urgency polling, cleaned up unused imports/refs
- `components/UnifiedDashboard.tsx` — view components extracted, urgency polling replaced with client-side, viewMode state, debounced urgency messages, Views button simplified
- `docs/orb-188-plan.md` — full design exploration with answers, Brownie/butler identity, adaptive UI concept, competitive research
- `lib/changelog.ts` — v0.5.91 release entry
- `lib/version.ts` — v0.5.91
- `package.json` — v0.5.91

### New files
- `components/views/types.ts` — shared view types and helpers
- `components/views/TaskListView.tsx` — extracted list view component
- `components/views/TaskChecklistView.tsx` — extracted checklist view component
- `components/views/TaskKanbanView.tsx` — kanban board view component
- `components/views/ViewSwitcher.tsx` — view selector component
- `docs/Use of AI in Todo-Project Manager Apps (Perplexity).md` — Perplexity research on AI in task management

---

## Key Decisions

- **ORB-188 prompt architecture lives in `lib/orb-prompt.ts`.** Separate from the auto-generated `lib/orb-contract.ts` (tools). The generator stays untouched.
- **Preferences have no Settings UI yet.** Managed conversationally via `get_preferences`/`set_preference`. UI deferred until the flow is proven.
- **Observations computed once at context-build time.** Static for the conversation — no mid-conversation proactive interruptions. Fresh context on next conversation.
- **Greeting only fires once per session.** Persisted in sessionStorage. `/clear` resets it. New tab also triggers a fresh greeting.
- **Markdown allowed in Orb responses.** Rendered via react-markdown. Copy button preserves raw markdown. No raw HTML rendering (security).
- **Staging environment removed.** WebAuthn RP ID is bound to the production domain — staging can't test passkeys. Two-tier workflow: localhost → production. *(2026-05-30, supersedes 2026-05-28)*
- **Orb identity: Brownie temperament, butler intelligence.** The Orb quietly helps without demanding spotlight (Brownie ethos) but has judgment and communicates (butler intelligence). User is always in control.
- **Kanban column order: Open → In Progress → Closed → Deferred → On Hold.** Active pipeline first, parked statuses last. Drag-and-drop deferred.
- **Adaptive UI is the long-term direction.** Schema-driven views, Orb `set_view` tool, user-named saved views. Gated by ORB-192 (privacy model) for behavioral observation features.

---

## Prototype Files (isolated, safe to delete if direction changes)

| File | Purpose |
|---|---|
| `app/prototype/page.tsx` | Server component — auth gate, renders UnifiedDashboard |
| `components/UnifiedDashboard.tsx` | Client component — unified split-pane Orb + task list |
| `components/DragDivider.tsx` | Pointer-event draggable split divider with snap points |
| `components/views/TaskListView.tsx` | Extracted list table view |
| `components/views/TaskChecklistView.tsx` | Extracted checklist table view |
| `components/views/TaskKanbanView.tsx` | Kanban board view |
| `components/views/ViewSwitcher.tsx` | View selector bar |
| `components/views/types.ts` | Shared types for view components |
| `components/UnifiedView.tsx` | (Old prototype) task list + OrbPanel side by side — superseded |
| `components/OrbPanel.tsx` | (Old prototype) standalone Orb conversation panel — superseded |
| `app/globals.css` (`.ud-*`, `.up-*`, `.tv-kanban-*` rules) | Scoped styles for unified dashboard |

---

## Next Priorities

1. **ORB-188 Phase 3: Named views and user-level preferences.** Save filter/sort/view-type combinations as named views in `orb_preferences`.
2. **ORB-188 Phase 4: Orb `set_view` tool.** Conversational view switching ("show me a kanban", "save this view as My Sprint").
3. **Kanban drag-and-drop.** Stan wants this — move tasks between columns by dragging.
4. **ORB-192: Data privacy model.** Gates behavioral observation, internet research, Orb memory. Two dimensions: privacy from users (RLS) and privacy from the Orb (Apple model).
5. **ORB-173: Pre-Alpha Checklist.** Due June 5, 2026. Gate 4 (first impression) depends on ORB-188.
6. **ORB-191: Give Orb UI self-awareness.** Depends on ORB-188 — presentation model determines what context the Orb needs.
7. **ORB-169: Source file audit.** AmbientDashboard is orphaned (zero imports). Classic and prototype routes are dead. TodoView still active at `/dashboard/[productId]`.
8. **Update `docs/ui-catalog.md`** with `components/views/` section, `tv-kanban-*` classes, ViewSwitcher, AppNav, nav-avatar, `.oc-orb-md` patterns.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

---

## AI Tool Used Last Session

`2026-05-30 — Claude Code (Claude Opus 4.6) — Session 35`

---

*Updated by AI at end of each session. Committed with session code changes.*
