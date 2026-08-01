# HANDOFF.md

> Living session-to-session context for the Orb project.
> Every AI reads at session start. Every AI updates it at session end.
> Committed with each session's code changes.
>
> **History policy:** keep only current, load-bearing context. Durable lessons
> belong in the Knowledge Repository; implementation history belongs in git and
> `lib/changelog.ts`.

---

## App State

- **Branch:** `codex/orb-373-real-data`; v0.6.278 is committed locally pending
  Stan's review and explicit push approval.
- **Dev server:** user-started on localhost:3001.
- **Live URL:** https://orb-eight-lake.vercel.app
- **Version:** **0.6.278** — ORB-373 real-data AI Metrics implementation.
- **Production maintenance:** off.
- **Database:** ORB-373 Phase 0 and financial-import migrations are applied.
- **ORB-342:** closed. Knowledge Repository entry
  `7a0f52c3-7490-45e6-a984-af4b14c70f96`.

---

## Last Session Completed

**ORB-373 — AI Metrics real-data implementation — 2026-07-31 (Codex, GPT-5)**

Expanded the approved visual prototype into the production `/settings/metrics`
surface. Current Status and Providers now use persisted provider snapshots and
funding caps; History uses the real model-request ledger with Product/Evals/All
scope, 7/30/90/365-day ranges, provider comparison, and an accessible native
SVG chart.

Added two maintenance paths for financial data:

- one heterogeneous CSV import with required date/company/cost/type columns,
  optional model/notes/reference columns, preview classification, exact
  descriptor learning, duplicate protection, and atomic commit;
- todo-style New/Edit modals and inline Delete/Cancel for individual funding,
  bill, and subscription entries.

Phase 0 separates automated provider-consumption snapshots from financial
transactions. Provider caps persist independently and drive prepaid runway;
subscriptions remain operating costs without fabricated runway. No Realtime
subscription was added. Settings-focused performance telemetry covers history,
import preview/commit, and financial/subscription CRUD.

Mistral, OpenAI TTS, and ElevenLabs remain present. Verified usage evidence and
a provider-neutral runtime Model Registry proposal are documented separately;
runtime model activation is not part of this implementation and requires its
own approved todo.

Used the Settings/AI Metrics catalog family, `modal-center` via `EditorModal`,
todo `crud-card` lists, catalogued pills, standard inputs, and touch-sized
actions. Desktop interactions were inspected for all four sections, import,
New/Edit, and Delete/Cancel. Responsive CSS provides two-column tablet and
one-column phone layouts; actual iPad/iPhone device review remains with Stan.

Validation after the final import-safety fix: TypeScript passed once, focused
ESLint passed once, UI catalog verification passed once, and `git diff --check`
passed. `Eval: not applicable — no conversation surface changed`.

**Database impact:** two migrations applied. They add funding pools, provider
snapshots, import batches, descriptor rules, financial transactions, and three
RPCs with wrapped admin RLS and targeted fingerprint/reference/date/pool
indexes. Post-migration audits found no RLS init-plan issue or material new IO
regression. No Realtime/WAL reader is used.

---

## Current Uncommitted Changes

*(none after the v0.6.278 local release commit)*

---

## Active Risks / Unresolved Work

- **ORB-367 — seven pre-existing Tier 2 failures.** Address the class and decide
  which guarantees belong in deterministic tests before repairing individual
  cases.
- **ORB-365 — deterministic code regression tests.** Orb still lacks a
  conventional test framework for due-time math, urgency, reminders, routes,
  auth, RLS, and migrations.
- **ORB-373 remains open for review.** The production data model and UI are
  committed locally, but Stan expects further visual/information-architecture
  adjustments before push or closure.
- **Runtime provider/model activation is not implemented.** It is a separate
  control-plane project described in `docs/orb-model-registry-plan.md`; imported
  financial metadata must never activate executable runtime configuration.
- `onMutation` in `UnifiedDashboard.tsx` refreshes todos but not projects after
  mutations; decide whether to fix separately or with ORB-342.
- Firefox Realtime voice remains experimental under ORB-330.

---

## Next Priorities

1. Stan reviews the real-data `/settings/metrics` page on Mac, iPad, and iPhone
   and identifies the next visual or information-architecture changes.
2. Keep Mistral, OpenAI TTS, and ElevenLabs intact unless Stan separately
   authorizes retirement.
3. Create and approve a separate todo before implementing the runtime Model
   Registry/provider activation plan.
4. Push v0.6.278 only after Stan explicitly approves it; no model eval is
   required because no conversation surface changed.
5. ORB-365 and ORB-367 remain later quality priorities.

---

## Key Current Decisions

- **Be precise about evidence.** “Ruled out” means tested. A non-deterministic
  result needs three runs before it is called verified; otherwise report the
  sample size.
- **Risk-based evals, not one universal gate.** Selection follows the release
  rules recorded above and in `AGENTS.md`.
- **Serial and Realtime schemas may differ at the model boundary; database
  behavior should converge.** Voice-specific fact/proposal tools are adapters,
  not justification for duplicated validation, authorization, or writes.
  ORB-342 now enforces this for todo, project, and knowledge mutations.
- **Realtime voice is the production voice path.** OpenAI server VAD owns turn
  detection and interruption; the client does not send `response.cancel`.
- **Name-first project identifiers.** Project names are user-facing; codes are
  internal, immutable prefixes for todo addresses.
- **Todo identity:** UUID is permanent identity; project code + todo number is
  the current, never-recycled address; title is a non-unique search key.
- **Mutation safety is structural.** The server authorizes and confirms exact
  stored proposals; the model never owns the commit boundary.
- **Provider incidents use the shared incident pipeline**, not one-off logs.
- **Release bookkeeping is exclusive.** Hold the mandatory claim, reread the
  canonical files immediately before choosing a version, and verify the entire
  `origin/main..main` range before every push.
- **Git push always requires Stan's explicit in-chat approval.**
- **Orb identity:** Brownie temperament, butler intelligence.

---

## AI Tool Used Last Session

`2026-08-01 — Codex (GPT-5)`

---

*Updated by AI at end of each session. Committed with session code changes.*
