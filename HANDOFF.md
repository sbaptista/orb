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

- **Branch:** `main` after the approved v0.6.282 release integration.
- **Dev server:** runs through the installed `orb-dev` launcher; Stan verified
  Mac, iPhone, and iPad access over localhost, Bonjour, and LAN IP.
- **Live URL:** https://orb-eight-lake.vercel.app
- **Local version:** **0.6.282** — ORB-375 Security Hardening Phase 1 deployment
  checkpoint. Stan explicitly authorized the commit and push on 2026-08-05.
- **Production maintenance:** off.
- **Database:** no schema change. The ORB-374 Knowledge Repository search is
  complete; ORB-375 remains open until containment and rotation acceptance.
- **ORB-374:** deferred. Its complete reviewed long-range plan is preserved.
- **ORB-375:** implementation and credential rotation are in progress.

---

## Last Session Completed

**ORB-375 — Security Hardening Phase 1 deployment checkpoint — 2026-08-05 (Codex, GPT-5.6 Sol)**

Implemented the approved immediate-containment extraction from deferred ORB-374.
The installed `orb-dev` launcher unlocks an owner-only encrypted environment,
creates network-specific TLS material, supplies only the current Bonjour/LAN
development origins, and starts Next.js without a repository `.env.local`.
Human-run helpers seal the initial environment and rotate one credential at a
time without recreating the complete plaintext bundle.

Stan verified encrypted-store creation, plaintext removal, launcher preflight,
and Orb access on Mac, iPhone, and iPad. Launcher checks and TypeScript pass.
Seven credentials completed localhost/production replacement, former-key
revocation, and post-revocation checks. Resend and Mistral replacements pass in
development; Vercel updates, production checks, revocation, and repeated checks
remain pending. ElevenLabs is paused while Stan decides whether to remove its
legacy TTS and usage paths instead of rotating the credential.

The complete reviewed ORB-374 plan and reviewer packets remain preserved. Eval:
not applicable — no Orb-conversation surface changed.

---

## Current Uncommitted Changes

*(none expected after the v0.6.282 release commit; `WIP.md` remains tracked
because ORB-375 rotation and acceptance are not complete)*

---

## Active Risks / Unresolved Work

- **ORB-375 is incomplete.** Resend and Mistral still need Vercel replacement,
  production verification, former-key revocation, and repeated checks.
- **ElevenLabs decision pending.** Its rotation is paused because Realtime uses
  OpenAI, but the legacy TTS adapter, Voice Settings option, usage monitor, and
  required environment variable remain deployed.
- **Three rotation groups remain untouched:** `DATABASE_URL`, coordinated
  `ORB_API_SECRET`/Helm `TODOS_API_SECRET`, and the VAPID public/private pair.
- **Same-user runtime isolation remains unverified.** The launcher removes
  plaintext-at-rest exposure but required secrets exist in the Next.js process
  environment after unlock.
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

1. Enter the replacement Resend and Mistral values in Vercel, redeploy, and run
   their production checks.
2. Revoke both former provider keys and repeat the production checks.
3. Decide whether to retire ElevenLabs; rotate it only if the deployed legacy
   capability is retained.
4. Rotate `DATABASE_URL`, coordinated Orb/Helm API secret, and the VAPID pair.
5. Complete ORB-375 acceptance, write resolution notes plus its Knowledge Repo
   entry, and remove the active claim with the closing commit.

---

## Key Current Decisions

- **ORB-374 is deferred.** Its preserved long-range plan is not authority to
  implement work beyond the explicit ORB-375 containment scope.
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

`2026-08-05 — Codex (GPT-5.6 Sol)`

---

*Updated by AI at end of each session. Committed with session code changes.*
