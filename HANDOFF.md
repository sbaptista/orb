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

- **Branch:** `codex/orb-373-real-data`; ORB-374 planning is in progress.
- **Dev server:** not used for the ORB-374 documentation checkpoint.
- **Live URL:** https://orb-eight-lake.vercel.app
- **Local version:** **0.6.281** — documentation-only ORB-374 planning
  checkpoint. No push is authorized; production remains at v0.6.280.
- **Production maintenance:** off.
- **Database:** no ORB-374 database change. The required ORB-374 Knowledge
  Repository topic search remains pending through an agent with approved egress.
- **ORB-374:** in planning/review. The plan is not approved and implementation
  is not authorized.

---

## Last Session Completed

**ORB-374 — security-hardening plan checkpoint — 2026-08-03 (Codex, GPT-5.6 Sol)**

Created `docs/orb-374-ai-tool-local-access-security-plan.md` as a draft policy,
audit, and implementation plan for AI tools with local-file access. It covers
least privilege, prompt injection, secret handling, deterministic approvals,
network egress, transcript retention, supply-chain controls, recoverability,
and a hardware-aware Tier A/B/C isolation model for the M5/16 GB Mac. It also
evaluates encrypted external NVMe, HDD, and SDXC storage.

The verified audit found critical current-state issues: the shared secret file
and parent directories are readable by other local accounts; the complete file
contents—all 17 entries—were rendered into an AI transcript; multiple AI tools
retain world-readable records or broad durable approvals; and no verified
secret-prevention gate exists locally. No credential or control has yet changed.

Perplexity and Claude Code reviewed the plan through Stan. Their complete
packets are preserved under `docs/orb-374-reviews/`; Codex remains the single
document maintainer. Claude identified two Phase 1 structural blockers:

- shared documentation falsely attests that Claude's push permission was
  removed from a tracked policy file, while Orb's ignored local policy still
  allows `git push`;
- canonical Orb/shared agent commands expand secrets into process arguments,
  while required backlog, Knowledge Repository, migration/health, and eval
  workflows lack brokered replacements.

The plan now requires artifact-tested controls, exact worktree boundaries,
safe audit enumeration, coordinated multi-plane credential rotation, preserved
mandatory workflows, full reviewer packets, and explicit conflict disposition.
The Knowledge Repository search failure was corrected from a host-wide claim to
a Codex-sandbox limitation; Claude offered to run the required topic search.

Stan approved this local checkpoint commit only. He has not approved the plan,
implementation, a push, or activation of the proposed interim operating
restriction. `Eval: not applicable — documentation only; no Orb-conversation
surface changed`.

---

## Current Uncommitted Changes

*(none expected after the v0.6.281 local checkpoint commit; ORB-374 remains an
active planning claim with `WIP.md` intentionally retained)*

---

## Active Risks / Unresolved Work

- **ORB-374 plan is not approved.** No implementation may begin until Stan
  approves the plan and the approved plan plus pertinent comments are written
  to the Knowledge Repository.
- **Verified credential exposure remains uncontained.** All 17 environment
  entries entered an AI transcript; every secret-bearing member requires
  classification, coordinated consumer updates, rotation, and old-key failure
  verification after approval.
- **Interim restriction decision pending.** Stan has not decided whether the
  proposed freeze on normal AI development takes effect immediately or only
  when the plan is approved.
- **Knowledge search pending.** Claude can perform the required ORB-374 topic
  search through its approved-egress path and return the result packet to Stan.
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

1. Stan decides when the proposed interim ORB-374 operating restriction becomes
   binding.
2. Have Claude run section 14.1's required Knowledge Repository topic search;
   import and reconcile the results through the controlled review process.
3. Continue review until Stan explicitly approves the plan. Then write the
   approved plan and all pertinent comments to the Knowledge Repository before
   beginning Phase 0.
4. Do not push the v0.6.281 checkpoint without Stan's separate explicit
   approval.

---

## Key Current Decisions

- **ORB-374 is proposed policy, not yet binding policy.** The local checkpoint
  preserves the review record but does not approve or activate it.
- **One document maintainer.** Reviewers send complete attributed packets to
  Stan; Codex preserves them, controls edits, and records dispositions.
- **Model judgment is not a security boundary.** Enforce safety through OS
  permissions, deny-read and network policy, scoped credentials, deterministic
  approval brokers, and independent tests.
- **Review packets are authoritative.** Summaries in the plan are navigational;
  full packets live under `docs/orb-374-reviews/` with redactions documented.
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

`2026-08-03 — Codex (GPT-5.6 Sol)`

---

*Updated by AI at end of each session. Committed with session code changes.*
