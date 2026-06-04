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

**Close ORB-173/197 + production push — 2026-06-03 (Session 47, Claude Code)**

### What was done
- **Closed ORB-197 (Onboarding for Testers).** Verified Perplexity's driver.js guided tour implementation: 6 observational steps, mobile pane switching, no auto-start, singleton pattern. Code was already committed in v0.5.135. Resolution notes + KR entry (by Perplexity) already existed; added resolution_notes to the todo.
- **Closed ORB-173 (Pre-Alpha Checklist).** Verified all 5 gates: core loop, multi-user, infrastructure, first impression (ORB-197 tour), operator management. Created KR entry documenting gate completion.
- **Added changelog entries for v0.5.135** (tour + eval suite codification) and **v0.5.136** (ticket closures). Perplexity had skipped the changelog.
- **Bumped version to v0.5.136** (package.json + lib/version.ts).
- **Production push** of all accumulated changes (v0.5.128–v0.5.136).

---

## Earlier Sessions

**Eval framework, scope fix, ORB-202/203, git push lockdown — 2026-06-02 (Session 46)**

### Tickets closed (Session 46)
- ORB-202: When todos are created from tickets, close the ticket
- ORB-203: Decouple query scope from mutation scope
- ORB-206: Bug: Make sure deleted users have their emails removed (Session 48, Antigravity)

### What was done
- **ORB-202:** Tickets auto-close when a todo is created from them. Reporter notified.
- **ORB-203:** Removed scopeToProduct — Orb always sees all projects (global query), mutations default to selected project. Removed All/Scope toggle button from Orb toolbar. Files: orb-converse.ts, OrbConversation.tsx, UnifiedDashboard.tsx, AmbientDashboard.tsx, OrbPanel.tsx.
- **Scope transparency prompt fix:** Restructured SCOPE instruction as bullet list with mandatory naming rule.
- **Orb eval framework:** Built `app/api/orb-eval/route.ts` (dev-only, non-streaming), `scripts/orb-eval.ts` (runner with progress bar), `scripts/eval-cases.ts` (11 test cases). Tier 1: tool correctness (5 cases, deterministic). Tier 2: behavioral (6 cases, statistical 2/3 pass). Run: `NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/orb-eval.ts`. Results: Tier 1 5/5 ✅, Tier 2 6/6 ✅.
- **Git push lockdown:** Removed `Bash(git push *)` from allowlists in Orb and Helm. Documented in shared AGENTS.md (with per-tool enforcement table), project AGENTS.md, knowledge repo.
- **Plan reviews:** SystemStateProvider (amended), mobile layout proposal (Model B endorsed), dev-to-dev channel (deferred — control gap).
- **DB vacuum:** Cleaned bloated tables from testing churn.

### Version bumps
- v0.5.128 → v0.5.132

---

## Uncommitted Changes

- lib/changelog.ts (added v0.5.135 + v0.5.136 entries)
- lib/version.ts (0.5.135 → 0.5.136)
- package.json (0.5.135 → 0.5.136)
- HANDOFF.md (this file)

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
- **Orb eval framework built.** `scripts/orb-eval.ts` + `scripts/eval-cases.ts` + `app/api/orb-eval/route.ts`. After any change to orb-converse.ts, orb-prompt.ts, or orb-contract.ts, run `NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/orb-eval.ts` and report results. Tier 1 failures are regressions. Use `--tier 1` for cheap runs (~$0.15), full suite ~$0.71.
- **API cost is a constraint.** Three cost streams: Claude Code (Opus), Orb conversations (Sonnet), eval runs (Sonnet). Highest-leverage cost reduction: route simple Orb queries (counts, lists) to deterministic code paths instead of LLM calls.

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
6. **Recurring tasks.** Identified as gap in ORB-195 Test 2. Schema + tool extension needed.
7. **External tester validation.** Run Nuts and Bolts tests with 3-5 non-immersed users.
8. **ORB-169: Source file audit.** AmbientDashboard orphaned. Dead routes.
9. **Update `docs/ui-catalog.md`** with view components, kanban classes, dev channel card, nav patterns.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Never `git push` without Stan's explicit in-chat approval** — structural enforcement via settings.local.json
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

---

## AI Tool Used Last Session

`2026-06-03 — Claude Code (Opus 4.6) — Session 47`

---

*Updated by AI at end of each session. Committed with session code changes.*
