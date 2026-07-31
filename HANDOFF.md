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

- **Branch:** `main`; v0.6.277 is committed locally pending the Tier 1 gate and
  authorized push.
- **Dev server:** user-started on localhost:3001.
- **Live URL:** https://orb-eight-lake.vercel.app
- **Version:** **0.6.277** — ORB-373 visual prototype release.
- **Production maintenance:** off.
- **Database:** `scripts/migrations/20260729_orb_342_canonical_proposals.sql`
  is applied.
- **ORB-342:** closed. Knowledge Repository entry
  `7a0f52c3-7490-45e6-a984-af4b14c70f96`.

---

## Last Session Completed

**ORB-373 — AI cost observability visual prototype — 2026-07-30 (Codex, GPT-5)**

Implemented the first reviewable prototype from
`docs/ai-cost-observability-plan.md` Revision 2 at
`/prototype/ai-cost-observability`. It is development-only and uses static
sample data; it does not query or mutate the database, call providers, import
statements, alter accounting, save settings, or deliver warnings.

The prototype has four sections:

- **Current Status:** prepaid API runway, ElevenLabs quota runway, recurring
  subscriptions without false runway, freshness, and a concise “what changed”
  explanation.
- **History:** product/eval scope filters, time ranges, provider comparison,
  and an accessible native-SVG trend chart with direct labels plus a
  screen-reader data table.
- **Providers:** separate runtime consumption, funding, and operating-spend
  lanes; reconciliation divergence; and a routine “3 rows need a home”
  statement-import review.
- **Controls:** runway/quota warning thresholds, push/email channels, model
  roles, routing, and cost assumptions. Legacy spend caps remain absent from
  the proposed interface.

Used the standard Settings and AI Metrics families (`s-card`,
`s-section-title`, `pill`, form controls, `metrics-details-*`, and
`metrics-reconciliation-*`). The only proposed reusable primitive is
`metrics-chart-*`. Prototype composition classes are explicitly temporary and
must be promoted, refactored, or removed before ORB-373 closes.

Validation: TypeScript passed, focused ESLint passed, `git diff --check`
passed, all four section interactions were inspected, the import review opened
correctly, and responsive geometry was checked at Mac (four runway columns),
iPad (two columns), and iPhone (one column with no body overflow). This is one
visual review pass, not production verification.

**DB impact:** none in the prototype. The real implementation still begins with
the exclusive Phase 0 schema claim because `orb_cost_reconciliations` currently
mixes purchases, provider consumption, and overlapping snapshots.

**Performance instrumentation:** not required for this static visual prototype.
The production Settings implementation will require `settings`
instrumentation under the ORB-309 focus-area model.

---

## Current Uncommitted Changes

*(none after the v0.6.277 release commit)*

---

## Active Risks / Unresolved Work

- **ORB-367 — seven pre-existing Tier 2 failures.** Address the class and decide
  which guarantees belong in deterministic tests before repairing individual
  cases.
- **ORB-365 — deterministic code regression tests.** Orb still lacks a
  conventional test framework for due-time math, urgency, reminders, routes,
  auth, RLS, and migrations.
- **ORB-373 remains a prototype.** No production data model, import,
  classification, provider balance, warning, or consolidated Settings behavior
  has been implemented.
- `onMutation` in `UnifiedDashboard.tsx` refreshes todos but not projects after
  mutations; decide whether to fix separately or with ORB-342.
- Firefox Realtime voice remains experimental under ORB-330.

---

## Next Priorities

1. Stan reviews the ORB-373 prototype and identifies any information-architecture
   or visual changes.
2. Incorporate prototype feedback before touching the production data model.
3. Begin ORB-373 Phase 0 with an exclusive DB schema claim, canonical health
   queries before/after, and the production instrumentation plan.
4. ORB-365 — introduce the free deterministic test layer.
5. ORB-367 — repair the Tier 2 maintenance discipline.

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

`2026-07-30 — Codex (GPT-5)`

---

*Updated by AI at end of each session. Committed with session code changes.*
