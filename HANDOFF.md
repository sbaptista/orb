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

- **Branch:** `codex/orb-373-real-data`; v0.6.279 closes the reviewed ORB-373
  AI Metrics rebuild and is approved for production push.
- **Dev server:** user-started on localhost:3001.
- **Live URL:** https://orb-eight-lake.vercel.app
- **Version:** **0.6.279** — final reviewed ORB-373 AI Metrics structure.
- **Production maintenance:** off.
- **Database:** ORB-373 Phase 0 and financial-import migrations are applied.
- **ORB-373:** closed. Knowledge Repository entry
  `3b2801e3-e9dd-418f-9b06-4e0d03174ff0`.
- **ORB-342:** closed. Knowledge Repository entry
  `7a0f52c3-7490-45e6-a984-af4b14c70f96`.

---

## Last Session Completed

**ORB-373 — AI Metrics reviewed and closed — 2026-08-03 (Codex, GPT-5)**

The production `/settings/metrics` surface now has three reviewed sections:
Orb, Providers, and Controls. Orb is first and opens by default; it combines
the real request-ledger history charts, complete AI Request Log, and rate cards.
Providers retains consumption-source data, heterogeneous statement import, and
per-item funding/bill maintenance. Controls now contains funding caps only.

Added two maintenance paths for financial data:

- one heterogeneous CSV import with required date/company/cost/type columns,
  optional model/notes/reference columns, preview classification, exact
  descriptor learning, duplicate protection, and atomic commit;
- todo-style New/Edit modals and inline Delete/Cancel for individual funding,
  bill, and subscription entries.

Removed Current Status, including its runway and subscription-management
assembly. Provider APIs do not expose a reliable live prepaid-credit balance,
so cap-minus-estimated-use could not honestly answer how close a provider is to
running out. The durable Knowledge Repository entry records the resulting
boundary: Orb automates request-level estimated costs, while imported provider
credits, refunds, bills, and subscriptions remain manual reconciliation context.

Mistral, OpenAI TTS, and ElevenLabs remain present. Verified usage evidence and
a provider-neutral runtime Model Registry proposal are documented separately;
runtime model activation is not part of this implementation and requires its
own approved todo.

Used the established Settings/AI Metrics family: `s-page-wide`, catalogued
`pill` navigation, `SettingsCrudList`, accessible native-SVG charts, standard
Settings forms, and the existing import and todo-style CRUD assemblies. No new
UI family or CSS prefix was introduced.

Final validation: TypeScript passed once, focused ESLint passed once, UI catalog
verification passed once, version consistency passed once, and `git diff
--check` passed. `Eval: not applicable — no conversation surface changed`.

**Database impact:** two migrations applied. They add funding pools, provider
snapshots, import batches, descriptor rules, financial transactions, and three
RPCs with wrapped admin RLS and targeted fingerprint/reference/date/pool
indexes. Post-migration audits found no RLS init-plan issue or material new IO
regression. No Realtime/WAL reader is used.

---

## Current Uncommitted Changes

*(none after the v0.6.279 release commit)*

---

## Active Risks / Unresolved Work

- **ORB-367 — seven pre-existing Tier 2 failures.** Address the class and decide
  which guarantees belong in deterministic tests before repairing individual
  cases.
- **ORB-365 — deterministic code regression tests.** Orb still lacks a
  conventional test framework for due-time math, urgency, reminders, routes,
  auth, RLS, and migrations.
- **Runtime provider/model activation is not implemented.** It is a separate
  control-plane project described in `docs/orb-model-registry-plan.md`; imported
  financial metadata must never activate executable runtime configuration.
- `onMutation` in `UnifiedDashboard.tsx` refreshes todos but not projects after
  mutations; decide whether to fix separately or with ORB-342.
- Firefox Realtime voice remains experimental under ORB-330.

---

## Next Priorities

1. Keep Mistral, OpenAI TTS, and ElevenLabs intact unless Stan separately
   authorizes retirement.
2. Create and approve a separate todo before implementing the runtime Model
   Registry/provider activation plan.
3. ORB-365 and ORB-367 remain later quality priorities.

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

`2026-08-03 — Codex (GPT-5)`

---

*Updated by AI at end of each session. Committed with session code changes.*
