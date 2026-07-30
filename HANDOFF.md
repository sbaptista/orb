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

- **Branch:** `main` after the ORB-364 release fast-forward.
- **Dev server:** user-started on localhost:3001.
- **Live URL:** https://orb-eight-lake.vercel.app
- **Version:** **0.6.259**.
- **Production maintenance:** off.
- **Database:** `scripts/migrations/20260729_eval_run_history.sql` is applied.
- **ORB-364:** closed. Knowledge Repository entry
  `2b74e034-0f4c-4a70-957b-035974854101`.

---

## Last Session Completed

**ORB-364 — eval cost, selection, and durable evidence — 2026-07-29
(Codex, GPT-5) — v0.6.259 — CLOSED**

The accepted full Tier 1 run fell from the 74-call / $1.1993 baseline to
60 calls / $0.9547, a 20.4% cost reduction. Fourteen duplicate serial cases
that had been labeled as Realtime analogues were removed. Ten distinct serial
capability cases remain under their historical ids but no longer claim to prove
OpenAI Realtime behavior.

A proposed second cache boundary was tested, not assumed. Moving run-invariant
context changed prompt order and caused four selected-project routing failures
(59/63). The change was reverted; the exact original prompt order and released
one-hour eval cache remain. The reverted four cases passed 4/4 focused. The next
full run passed 62/63; the remaining failure was a known live-backlog fixture
leak in `upfront-permission-still-emits-creates`. After freezing that case to
its intended ORB-only world, Stan ran it three times and it passed 3/3.

Every eval case now has a capability category. The common smoke suite contains
seven cross-cutting safety cases and measured $0.1055, down from $0.3444 for the
earlier 14-case smoke. The `serial-tool-contract` suite maps exactly one
representative case to every one of the 27 fully enabled serial tools and
validates that map against Orb's actual exported tool inventory. It contains
27 cases / 31 runs because `create_ticket` and `propose_adaptation` remain
statistical Tier 2 cases. Contract plus smoke is 31 unique cases / 35 runs.
The previously uncovered `get_preferences` case passed once, 1/1, at $0.0569
including its first cache write.

`orb_eval_runs` and `orb_eval_results` now persist the commit, selection,
per-case outcome, assertion failures, tool calls, provider/model, latency, and
estimated cost. `orb_model_requests.correlation_id` links provider-token evidence
to the parent eval run. Pacing occurs before expected model calls only; five
deterministic server cases no longer pay the 6.5-second delay.

Release gates are now risk-based:

- No Orb-conversation change: no model eval.
- Localized capability change: affected categories plus `smoke`.
- Serial tool inventory/schema change: `serial-tool-contract,smoke`.
- Shared prompt/context/provider/model/routing/authorization change: full Tier 1.
- Realtime-only change: direct Realtime schema, route/RPC, and DEV verification;
  serial cases are not proof.
- Tier 2 stays three runs with a 2/3 threshold.

Database impact is limited to two append-only local-eval evidence tables. There
is no Realtime subscription or user-facing write path. Pre/post health audits,
RLS policies, indexes, and a rolled-back structural insert were verified.

Validation: TypeScript passed; focused ESLint had zero errors and two existing
eval-route warnings; `git diff --check` passed; production build passed.

Detailed analysis: `docs/orb-364-eval-cost-plan.md`.

---

## Current Uncommitted Changes

*(none after the v0.6.259 release commit)*

---

## Active Risks / Unresolved Work

- **ORB-342 — serial/Realtime convergence.** The 27 serial and 33 Realtime
  tools are model-facing schemas, not independent domain capabilities. Three
  pending-mutation mechanisms still exist: serial todos are client-held,
  serial project/knowledge mutations use `orb_pending_mutations`, and Realtime
  uses the stronger row-locked, replay-safe `orb_realtime_proposals` RPC spine.
  Both model adapters should eventually translate into the same canonical
  operations and database transactions.
- **ORB-368 — Realtime voice lacks the project-health packet.** Voice cannot
  explain the orb's mood from the same evidence as text.
- **ORB-367 — seven pre-existing Tier 2 failures.** Address the class and decide
  which guarantees belong in deterministic tests before repairing individual
  cases.
- **ORB-365 — deterministic code regression tests.** Orb still lacks a
  conventional test framework for due-time math, urgency, reminders, routes,
  auth, RLS, and migrations.
- **ORB-363 — provider/ledger reconciliation and budgets.** Provider caps and
  the voice reserve still need decisions; Gemini and ElevenLabs remain
  unverified against invoices.
- `onMutation` in `UnifiedDashboard.tsx` refreshes todos but not projects after
  mutations; decide whether to fix separately or with ORB-342.
- Firefox Realtime voice remains experimental under ORB-330.

---

## Next Priorities

1. ORB-365 — introduce the free deterministic test layer.
2. ORB-363 — reconcile provider spend and configure meaningful caps/reserves.
3. ORB-367 — repair the Tier 2 maintenance discipline.
4. ORB-342 — converge serial and Realtime on canonical operations.
5. ORB-368 — give Realtime voice grounded project-health evidence.

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

`2026-07-29 — Codex (GPT-5)`

---

*Updated by AI at end of each session. Committed with session code changes.*
