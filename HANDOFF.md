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

**Dev channel, kanban drag-and-drop, UI self-awareness, value demonstration — 2026-05-31/06-01 (Session 36)**

### Tickets closed
- **ORB-188:** Define AI presentation model — Phases 1-2 (component extraction + kanban board). Phases 3-4 extracted to ORB-194.
- **ORB-191:** Give Orb UI self-awareness — uiContext injection (view mode, filters, device type)
- **ORB-195:** Demonstrate Orb's value to user — Nuts and Bolts test: 6 Pass, 1 Partial, 0 Fail

### Tickets created
- **ORB-194:** Named views + Orb set_view tool (extracted from ORB-188 Phases 3-4)

### What was done

**Dev Channel v1 (v0.5.92) — Developer → Orb direction**
- `dev_channel` database table with status lifecycle (pending → delivered → processed), RLS admin-only
- `POST/GET /api/dev-channel` authenticated via ORB_API_SECRET
- `app/actions/dev-channel.ts` — server actions for fetching, delivering, processing
- Read-only tool restriction for dev channel processing
- DevCard UI component — blue-tinted card with sender label in OrbConversation
- Tab-focus polling in UnifiedDashboard via useVisibilityRefetch
- Knowledge repo auto-logging of all exchanges

**Dev Channel v2 (v0.5.93) — Orb → Developer direction**
- `send_to_developer` tool in lib/orb-prompt.ts
- Orb can proactively send messages to developer tools during user conversations
- Developer tools poll via GET /api/dev-channel?direction=orb_to_dev

**Behavioral persistence (v0.5.94)**
- Knowledge repo entries tagged `orb-behavior` loaded into system prompt as enforceable rules
- First rule: send_to_developer requires Stan's approval
- Dev channel message retention: processed/delivered purged after 7 days, pending kept forever

**Kanban drag-and-drop (v0.5.95, ORB-178)**
- HTML5 drag on desktop, touch drag with floating clone on mobile
- Drop target highlighting, "Drop here" prompt on empty columns
- Status changes via drag trigger audit logging, ticket propagation, distill modal
- Kanban "All" filter fix — skip pagination so all columns populate
- Removed strikethrough on closed todos across all views
- Deduplicated urgency transition messages in addOrbMessage

**UI self-awareness (v0.5.95, ORB-191)**
- OrbRequest extended with uiContext: viewMode, filterStatus, filterPriority, sortAsc, orbPaneVisible, listPaneVisible, isMobile
- Injected into system prompt as UI STATE

**Mutation approval + contextual coaching (v0.5.95)**
- Mutation approval protocol: Orb proposes before executing, waits for user confirmation
- Multi-action parsing: "review deck by Friday, login bug is urgent, dark mode eventually" → 3 correctly attributed tasks
- Contextual coaching: Orb weaves observations into mid-conversation responses at natural moments
- New preference: mutation_approval (ask/session/allow)

**ORB-195 fixes (v0.5.96)**
- Capability check: Orb discloses unsupported features (recurring tasks, dependencies, etc.) before proposing — never silently degrades
- Fuzzy search for knowledge repo: typo-tolerant matching (edit distance ≤ 2), shared lib/fuzzy-search.ts

**ORB-195 Nuts and Bolts test results**
- Test 1 (The Glance): Pass — ambient state matched reality
- Test 2 (One Sentence, Multiple Actions): Partial — parsed correctly but silently created one-time for recurring. Fixed in v0.5.96.
- Test 3 (What should I focus on?): Pass — cross-project reasoning, Stan: "I'm impressed"
- Test 4 (The State Shift): Pass — one message per transition
- Test 5 (Why did you say that?): Pass — traced reasoning to data points
- Test 6 (Closing the Loop): Pass — found knowledge on second try. Fuzzy search fixed in v0.5.96.
- Test 7 (Contextual Coaching): Pass — natural, useful, non-intrusive

### Version bumps
- v0.5.91 → v0.5.92 → v0.5.93 → v0.5.94 → v0.5.95 → v0.5.96

---

## Uncommitted Changes

None — all changes committed and pushed to production.

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

`2026-06-01 — Claude Code (Claude Opus 4.6) — Session 36`

---

*Updated by AI at end of each session. Committed with session code changes.*
