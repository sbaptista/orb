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

**Scope Proactive Observations by Project Ownership — 2026-06-04 (Session 53, Antigravity)**

### What was done
- **Scoping Proactive Observations (ORB-207)**: Filtered proactive observations (overdue/stale task highlights in the greeting prompt) in `app/actions/orb-converse.ts` and `app/api/orb-eval/route.ts` to analyze only projects owned/created by the current user (`auth.user.id`).
- **Data Segregation**: Prevented leakage of other users' tasks into an Admin's proactive observations greeting while keeping the global query backlog context in the main panels intact.
- **Database & Knowledge Repo**: Closed task `ec5d4980-efa0-4fad-8002-3342c6610904` and created a matching `knowledge_repo` entry describing the scoping design decisions.
- **Verification**: Verified clean build (`npx tsc --noEmit`), verified UI catalog check (`node scripts/verify-ui-catalog.js`), and ran Tier 1 of the Orb eval suite (5/5 passed ✅).

---

## Earlier Sessions

**Make Conversation Input Field Prominent — 2026-06-04 (Session 52, Antigravity)**
- **Prominent Input (ORB-211)**: Increased `.oc-input-border` default border thickness to `1.5px`, used a higher-contrast border color (`rgba(60, 110, 60, 0.28)`), and added a subtle shadow (`box-shadow: var(--shadow-sm);`).
- **Hover & Focus Ring Glow**: Added `:hover` transition border color (`rgba(60, 110, 60, 0.45)`) and `:focus-within` border color (`rgba(60, 110, 60, 0.75)`) with an active accent glow focus ring.
- **Spacing Separation**: Increased the separation space between the bottom message in the thread and the input container (changed `.oc-thread` bottom padding and `.oc-input-wrap` top margin to `16px`) to improve visual hierarchy and differentiate text blocks.
- **Inline Style cleanup**: Removed inline styling overrides from `components/OrbConversation.tsx` to handle all transitions and borders inside CSS.
- **Verification**: Verified clean build (`npx tsc --noEmit`), verified UI catalog check (`node scripts/verify-ui-catalog.js`), and ran Tier 1 of the Orb eval suite (5/5 passed ✅).

**Review and Update Help Pre-Alpha Page — 2026-06-04 (Session 51, Antigravity)**
- **Pre-Alpha Testing copy update (ORB-210)**: Removed references to the deleted onboarding seed projects (`WELCOME`, `ECO`) in the "Pre-Alpha Testing" tab of the Help sidebar, replacing them with generic project task scenarios.
- **UI Catalog Check compliance**: Updated the last updated line in `docs/ui-catalog.md` to satisfy the verification requirement in `node scripts/verify-ui-catalog.js`.
- **Verification**: Verified clean build (`npx tsc --noEmit`), verified UI catalog check (`node scripts/verify-ui-catalog.js`), and ran Tier 1 of the Orb eval suite (5/5 passed ✅).

**Remove Onboarding Sample Projects & Update Guided Tour — 2026-06-04 (Session 50, Antigravity)**
- **Removed onboarding sample projects/tasks (ORB-209)**: Disabled automatic seeding of projects (`WELCOME`, `HOME`, `ECO`) in `complete-onboarding.ts` and `resolve-user.ts`. Deleted `lib/onboarding-seeding.ts`.
- **Zero-Project UX implementation**:
  - Click/tap on the "No project selected" Orb state opens the project creation modal.
  - Disabled the "+ New" todo button on zero-projects, showing a helpful toast notification to create a project first.
- **Guided Tour updates (`components/OrbTour.tsx`)**: Reordered and matched the steps to the new 7-step sequence and copy specified by Stan.
- **Verification**: Verified clean build (`npx tsc --noEmit`), verified UI catalog script check (`node scripts/verify-ui-catalog.js`), and ran Tier 1 of the Orb eval suite (5/5 passed ✅).

**Clarify Comprehension Check Rules — 2026-06-04 (Session 49, Antigravity)**
- **Comprehension check rules updated in AGENTS.md.** Clarified that read-only tools are allowed in the first turn to gather check answers, resolving literal rule deadlocks.
- **Bumped version to v0.5.137** (package.json + lib/version.ts).
- **Documented changes in lib/changelog.ts.**
- **Ran Tier 1 eval suite (5/5 passed ✅).**

**Close ORB-173/197 + production push — 2026-06-03 (Session 47, Claude Code)**
- **Closed ORB-197 (Onboarding for Testers).** Guided tour verification.
- **Closed ORB-173 (Pre-Alpha Checklist).** Checklist gates verified.
- **Added changelog entries for v0.5.135 and v0.5.136.**
- **Bumped version to v0.5.136.**
- **Production push** of all accumulated changes (v0.5.128–v0.5.136).


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

- package.json (0.5.142 → 0.5.143)
- lib/version.ts (v0.5.142 → v0.5.143)
- app/actions/orb-converse.ts (filter observations by project owner)
- app/api/orb-eval/route.ts (filter observations by project owner)
- lib/changelog.ts (added v0.5.143 entry)
- docs/ui-catalog.md (updated last updated session tag)
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

`2026-06-04 — Antigravity (Gemini 3.5 Flash) — Session 53`

---

*Updated by AI at end of each session. Committed with session code changes.*
