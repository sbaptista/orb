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

- **Branch:** `main` == `origin/main`. Nothing awaiting a push.
- **Dev server:** user-started on localhost:3001.
- **Live URL:** https://orb-eight-lake.vercel.app
- **Version:** **0.6.276** — pushed 2026-07-30.
- **Production maintenance:** off.
- **Database:** `scripts/migrations/20260729_orb_342_canonical_proposals.sql`
  is applied.
- **ORB-342:** closed. Knowledge Repository entry
  `7a0f52c3-7490-45e6-a984-af4b14c70f96`.

---

## Last Session Completed

**ORB-368 + ORB-372 — CLOSED 2026-07-30 (Claude Code, Opus 5) — v0.6.272→v0.6.276**

**ORB-368.** Voice can now explain the orb's mood. New `get_orb_state` fact tool — deliberately a tool, not session instructions, because a Realtime session is long-lived and anything seeded at creation describes the past. Computed on demand from the same `explainUrgency()` the dashboard and text packet use: one implementation, three surfaces. The **selected project is the default scope** (the orb you are looking at is that project's orb); `all_projects` is the explicit opt-out. KB `08aa6fb6`.

**ORB-372.** Closed on its last gap, paging, folded in since it lived in the same file. `list_todos` takes an offset and uses `.range()`; the packet carries the offset so the label states the real range. Verified: 1–5, 6–10, 11–12, "Last page", clean stop past the end.

**Three defects found by Stan during verification, all mine, all the same shape** — fixing one layer and leaving another that speaks: `#undefined` for a task code (`codeFor` written for a todo row, given an `UrgencyDriver`); answering "all projects you can see" when asked about the current one; and then, having required the project name, giving the model no way to know it — so voice asked Stan to type the name of the project on his own screen. **Fixing a scope bug by asking the user for information the system already has is not a fix.** The client had `currentProjectIdRef` all along.

**Unverified at close:** v0.6.276's default-scope change landed after the last live test. Closed on Stan's instruction; the check is asking why the current project is urgent and not being asked which project that is.

**ORB-339 + ORB-372 — 2026-07-30 (Claude Code, Opus 5) — v0.6.261→v0.6.270 — RELEASED**

**ORB-339 — CLOSED.** Serial had no server-side todo title resolution: `update_todo` took a code, so which code got picked was the model's unaided judgment, and Haiku picked wrong on near-exact titles. Assessed first whether ORB-342 had made it obsolete — it had not. ORB-342 converged what a mutation DOES; this is what a task NAME means, decided before a proposal exists. What ORB-342 did change was the fix's shape: the proven Realtime resolver could be **lifted** into the shared layer rather than written a second time. `lib/orb-operations/todo-reference.ts` now holds the policy alone (exact before fuzzy; accept only a uniquely stronger candidate; **a tie is ambiguous, never the first candidate**); row access and error reporting stay per channel deliberately. Verified three ways: 10/10 deterministic, Stan's live voice test, and a Tier 2 eval at 3 runs. KB `e70c50c0`. Title resolution is bounded at 2000 candidates paired with an exact count — it **refuses** rather than ranking a partial set, because a bare `.limit()` would silently return a confident wrong answer.

**ORB-372 — OPEN, retitled.** Six defects, one shape: the Orb stating something confidently untrue about itself. Orphaned Realtime calls never ended at OpenAI (409); the error message blaming the provider for our own fault and for quota exhaustion; a permission rule the server never enforced; the same misnomer again in the spoken results; a search that counted 12 and returned 10, dropping exactly the rows being hunted; and voice that could not show a table, then would not. All fixed and verified by Stan on localhost. KB `fbbe0293`. **Still open:** no paging beyond 200 results.

**Tooling.** The eval runner defaulted to a hardcoded LAN IP that broke on every DHCP lease and reported it as "Network error" — two full runs and a proposal to restart the dev server were spent on it. Now defaults to localhost, and the failure names the host. Eval category rules added for two new cases (ORB-364 requires them; one uncategorised id throws at module load and blocks the whole file). `allowedDevOrigins` pruned from six accumulated IP entries to two wildcards, verified against Next's own matcher.

**Key lesson (recorded in both KB entries).** Every defect this session was found by reading a recorded artifact; every wrong claim came from inferring off an artifact's surface — a blank claim ledger, a grep count, a commit subject line, a stale `git status`, and a matching result count. The sharpest instance: I reported "no incident ticket was written" three times as the top outstanding item. TICKETS-70 had recorded it hours earlier; my query had an operator-precedence bug. **A search returning nothing is evidence about the search, not about the world.** Also: a count matching is not the result being right — the truncated search was marked as passing because the number said 12.

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

1. ORB-368 — give Realtime voice grounded project-health evidence. Raised to the top: voice still cannot explain the orb's mood, and this session showed repeatedly that voice having less than text is drift rather than decision.
2. ORB-365 — introduce the free deterministic test layer.
3. ORB-363 — reconcile provider spend and configure meaningful caps/reserves.
4. ORB-367 — repair the Tier 2 maintenance discipline.
5. ORB-372 — paging beyond 200 results; the only remaining gap on an otherwise-fixed ticket.

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

`2026-07-30 — Claude Code (Opus 5)`

---

*Updated by AI at end of each session. Committed with session code changes.*
