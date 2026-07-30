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

- **Branch:** `main` after the ORB-342 release fast-forward.
- **Dev server:** user-started on localhost:3001.
- **Live URL:** https://orb-eight-lake.vercel.app
- **Version:** **0.6.260**.
- **Production maintenance:** off.
- **Database:** `scripts/migrations/20260729_orb_342_canonical_proposals.sql`
  is applied.
- **ORB-342:** closed. Knowledge Repository entry
  `7a0f52c3-7490-45e6-a984-af4b14c70f96`.

---

## Last Session Completed

**ORB-342 — canonical serial/Realtime mutation convergence — 2026-07-29
(Codex, GPT-5) — v0.6.260 — CLOSED**

Serial text and Realtime voice now share one mutation implementation beneath
their channel-specific model schemas. Todo, project, and Knowledge Repository
changes resolve into `orb_realtime_proposals`, authorize the current user
response, execute through `confirm_realtime_mutation`, and return the same
durable replay-safe receipt.

The browser no longer holds serial todo intent. Direct serial domain executors
were removed, and rich todo batches are atomic rather than sequential. The
shared boundary preserves ownership, five-minute expiry, target snapshots,
stale rejection, row locking, audit behavior, and replay protection. Existing
Realtime table/RPC names remain as transport-neutral implementation details for
migration safety; `orb_pending_mutations` is unused but retained for rollback.

The additive migration is applied. Rollback-only verification passed for
singular todo metadata, rich batches, replay, project creation, and knowledge
create/update. Database health was checked and the proposal table vacuumed.

Stan's full Tier 1 run passed 62/65. The memory case and one Gemini case passed
focused; the final Gemini strategic case exhausted three retries with verified
503 high-demand responses and was accepted as provider unavailability, not an
assertion result. Eval timing now excludes the intentional 6.5-second pacing
delay; actual request telemetry showed Claude median 1.8s / p95 3.5s and one
20.3s Gemini outlier. Direct “remember that” instructions now authorize the
offered-memory save immediately.

Stan manually accepted both channels. Serial proposed, waited for approval,
then created ORB-370 from the receipt. Realtime voice independently proposed,
waited for approval, then created ORB-371 through the same canonical path.

Validation: TypeScript, scoped ESLint, diff checks, production build, database
rollback verification, and manual serial/Realtime confirmation passed.

Detailed design: `docs/orb-342-operation-convergence-plan.md`.

---

## Current Uncommitted Changes

*(none after the v0.6.259 release commit)*

---

## Active Risks / Unresolved Work

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
- ORB-370 and ORB-371 are explicit ORB-342 acceptance-test todos and remain in
  the backlog until Stan chooses to delete them.

---

## Next Priorities

1. ORB-365 — introduce the free deterministic test layer.
2. ORB-363 — reconcile provider spend and configure meaningful caps/reserves.
3. ORB-367 — repair the Tier 2 maintenance discipline.
4. ORB-368 — give Realtime voice grounded project-health evidence.

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

`2026-07-29 — Codex (GPT-5)`

---

*Updated by AI at end of each session. Committed with session code changes.*
