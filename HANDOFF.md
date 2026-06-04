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

**ORB-197 onboarding: driver.js guided tour + eval-suite rule in AGENTS — 2026-06-03 (Session, Perplexity Comet)**

### What was done
- **Replaced the dense text-list onboarding with a driver.js guided tour.** Root problem: the old welcome message used a numbered list, but react-markdown has no remarkGfm/remark-breaks, so single \n collapsed and the list rendered broken. Stan asked for a better approach (videos / screen highlights). Chose driver.js coach marks (v1.4.0, Stan ran `npm i driver.js` himself).
- **Tour design = observational + state-safe.** Every step points at a real element and explains it; no step REQUIRES an action, so the tour is correct from any app state (fresh login or after poking around). Elements resolved at step-time via a query fn that tolerates missing anchors (driver.js shows a centered popover instead of erroring).
- **No auto-start (Stan's call).** First-login shows a one-line nudge IN the conversation with "Start tour" / "Maybe later" buttons. "Take the tour" also lives in Help (top bar). Tour launched via a module-level singleton (registerOrbTour by dashboard / launchOrbTour from nudge + Help) to avoid prop-drilling.
- **Mobile (iPhone/iPad) support.** App uses tabbed panes on mobile (activeMobileTab 'orb'|'list'). Tour does per-step pane prep (onHighlightStarted → switch pane → driver.refresh()) so spotlights land correctly. Popover sides are mobile-aware.
- **Seeded WELCOME tasks retitled** to clean, prefix-free titles (the tour replaces the old message↔todo numbering bridge). Kept all 6 (count is load-bearing for the mood mechanic: 6 open medium tasks → busy/lavender; check one off → 5 active → calm/green = the visible shift testers see).
- **Eval suite codified as a must-do in AGENTS.** The Orb eval framework (scripts/eval-cases.ts + scripts/orb-eval.ts) was previously only recorded in HANDOFF, not required anywhere. Added a mandatory "Orb Eval Suite" section to project AGENTS.md (+ top instruction + production-push gate) and a cross-project rule #13 in shared AGENTS.md. Scope kept tight: Orb-conversation capabilities only (tools/speech). NO ORB-197 eval case was added (the tour is pure UI — out of the suite's reach; Stan confirmed skip).

### Files (tour — pushed to Mac, v0.5.135, COMMIT APPROVED by Stan, do NOT push to prod without his go-ahead)
- NEW: components/OrbTour.tsx (singleton tour controller, 6 steps)
- components/OrbConversation.tsx (nudge card + Start/Maybe-later buttons, action?:'tour', onDismissNudge, data-tour="conversation-input")
- components/UnifiedDashboard.tsx (long welcome → one-line nudge; registerOrbTour effect; data-tour anchors orb/views; onDismissNudge)
- components/AppNav.tsx (data-tour="help")
- components/OrbHelp.tsx ("Take the tour" button in panel top bar → launchOrbTour)
- app/globals.css (.orb-tour-popover skin, .oc-tour-start/.oc-tour-later, .help-tour-btn — Orb green tokens)
- lib/onboarding-seeding.ts (6 WELCOME tasks retitled, clean)
- package.json + lib/version.ts (0.5.134 → 0.5.135); package-lock.json (driver.js ^1.4.0)

### Files (AGENTS eval rule — pushed to Mac, doc-only, NO version bump)
- AGENTS.md (project): new "Orb Eval Suite (mandatory)" section + top instruction bullet + eval gate in Production Releases
- ../shared/AGENTS.md: Working Rule #13 (keep each project's eval/behavior suite current)

### Version bumps
- v0.5.134 → v0.5.135 (tour code). AGENTS edits are doc-only (no bump).

### Next / open
- Stan was testing the tour locally (Mac/iPad/iPhone) when this handoff was written.
- COMMIT APPROVED for the tour work + AGENTS edits (commit only, NO git push — prod deploy is Stan's call). Suggested message below.
- changelog.ts NOT yet updated for v0.5.135 — required before any prod push (see AGENTS "Production Releases").
- Suggested commit (run from main dir, after Stan confirms tests pass):
  `cd /Users/stanleybaptista/Projects/orb && git add -A && git commit -m "ORB-197: driver.js guided onboarding tour (v0.5.135) + codify Orb eval suite as a must-do in AGENTS"`

---

## Earlier Sessions

**Eval framework, scope fix, ORB-202/203, git push lockdown — 2026-06-02 (Session 46)**

### Tickets closed
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
