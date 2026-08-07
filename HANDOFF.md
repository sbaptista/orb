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

- **Branch:** `main`. (The prior entry named
  `codex/orb-375-retire-elevenlabs`; the working tree has been on `main`
  since at least this session's start.) The v0.6.283 release commit and
  production push were explicitly authorized by Stan on 2026-08-05.
- **Unpushed:** the v0.6.284 range on `main` (`git log origin/main..main`) —
  push gate, `knowledge_repo` trigger, handoff, and release bookkeeping.
  Verified to contain no other agent's commits. Awaiting Stan's push.
- **Dev server:** runs through the installed `orb-dev` launcher; Stan verified
  Mac, iPhone, and iPad access over localhost, Bonjour, and LAN IP.
- **Live URL:** https://orb-eight-lake.vercel.app
- **Local version:** **0.6.288** — AI capability-broker proposal checkpoint.
  v0.6.287 restored Account to the nav on Settings.
  Earlier this session: v0.6.286 made cron endpoint auth fail closed; v0.6.285
  restored the AI usage check on a daily Vercel Cron; v0.6.284 was push-gate
  hardening plus the `knowledge_repo.updated_at` trigger. v0.6.283 was the
  ORB-375 retirement of the deployed ElevenLabs runtime dependency.
- **Production maintenance:** off.
- **Database:** one schema change this session — a `BEFORE UPDATE` trigger on
  `knowledge_repo` so `updated_at` tracks edits (migration
  `scripts/migrations/20260805_knowledge_repo_updated_at.sql`, applied and
  verified). The ORB-374 Knowledge Repository search is complete; ORB-375
  remains open until containment and rotation acceptance.
- **ORB-374:** deferred. Its complete reviewed long-range plan is preserved.
- **ORB-375:** implementation and credential rotation are in progress.

---

## Last Session Completed

**AI capability broker proposal checkpoint — 2026-08-07 (Codex, GPT-5.6 Sol)**

Released locally as **v0.6.288**. **Eval: not applicable — no conversation
surface changed.** Added `docs/orb-ai-capability-broker-plan.md` as the
controlled draft and decision record for restoring safe AI access to todo and
Knowledge Repository operations without restoring agent-readable secrets.
The draft recommends a transport-neutral Orb Capability Service with a hosted
MCP adapter, distinct Codex and Claude Code identities, least-privilege scopes,
idempotent receipts, fail-closed authorization, audit, revocation, staged
read-only-to-mutation rollout, and human fallback. It explicitly blocks
implementation until Stan records the applicable final decisions and marks the
document approved.

The first planned acceptance workflow is durable and independently verified:
Codex creates and reads one ORB todo, closes it through the atomic resolution
notes + Knowledge entry path, updates and rereads that entry, and Claude Code
verifies the resulting todo, Knowledge, and audit records through its own
identity. No todo was created during this planning session; the earlier browser
attempt found no authenticated production session. No broker, database, API,
credential, or application behavior was changed.

**Prior session:**

**Push gate hardening + `knowledge_repo.updated_at` — 2026-08-05 (Claude Code,
Opus 5)**

Released as **v0.6.284**. **Eval: not applicable — no conversation surface
changed.** (Stan initially chose no bump; reversed before the push so v0.6.283
would not map to two different commits, per the 2026-07-29 ambiguity lesson.)

The documented Claude Code push gate was wrong in both file and mechanism. It
named `.claude/settings.local.json` as "tracked in repo" — that file is
auto-added to the user's *global* git excludes and is rewritten by Claude Code
on every "always allow" click, so it is neither tracked nor trustworthy. The
mechanism was mere absence from an allowlist, which yields a *prompt*, not a
gate. Evidence it failed: `Bash(git push *)` was found back in Orb's allowlist,
re-added with no commit or diff after a 2026-06-01 entry recorded its removal —
undetected for ~2 months.

Now enforced as a `permissions.deny` rule in a **tracked** `.claude/settings.json`
in both Orb (`17071de`) and Helm (`73783b1`), with `.gitignore` reworked to
`.claude/*` + `!.claude/settings.json` (a negation cannot re-include a file
under an excluded *directory*). Deny is evaluated before allow across every
settings scope, so it overrides any allow that drifts back into the local file.
Orb's gate is **verified**: `git push --dry-run` blocked silently, no dialog —
distinguished from a declined prompt, which looks identical in tool output.

**The gate initially blocked three of its own commits.** `Bash(git * push *)`
matched `git commit -m "…push gate…"`, because Claude Code's `*` spans argument
boundaries including inside quoted strings. Isolated by controlled test (two
`git commit --dry-run` calls differing only in whether the message contained
"push"), fixed by anchoring to `Bash(git push)` / `Bash(git push *)` only
(`5b9b136`, Helm `2f4a3b6`). Cost: `git -C <path> push` now prompts instead of
hard-blocking. **Never reintroduce mid-wildcard deny patterns.**

`shared/AGENTS.md` corrected — enforcement row, session-start check, the
anchoring rule, and an honest known-gap note (wrapper stripping does not cover
`npx`, `docker exec`, `devbox run`, etc., so the gate is defence in depth, not
an absolute barrier).

`knowledge_repo.updated_at` never advanced — the table was created without the
trigger its peers carry, so `updated_at` was a copy of `created_at` and every
hand-edited entry looked untouched. Fixed and verified firing (`9a9a944`).
Seven other tables share the gap (`orb_ai_funding_pools`, `orb_ai_policy`,
`orb_financial_descriptor_rules`, `orb_financial_transactions`, `orb_memory`,
`orb_preferences`, `system_settings`) — **left alone by Stan's explicit
decision, not oversight.**

Knowledge Repo: entry `7b4247ee` records the full model; a SUPERSEDED banner
was added to `fa737536` preserving its original text, since its *rule* stands
and only its enforcement description was obsolete.

**AI usage check restored (v0.6.285).** A GitHub email ("Orb usage check: All
jobs were cancelled") revealed the ORB-353 spend-threshold check had **silently
stopped running** — its `*/15` GitHub Actions workflow was having its runs
cancelled. Moved to a daily Vercel Cron in `vercel.json` and **deleted**
`.github/workflows/usage-check.yml`. The workflow only ever existed because
sub-daily cron is unavailable on this Vercel plan; at daily cadence that reason
disappears, which also removes the Actions-minutes exposure, the duplicated
`CRON_SECRET` GitHub repository secret, and cron config split across two
systems. Verified before moving: `reminders` and `usage-check` have
byte-identical `Bearer ${CRON_SECRET}` auth and `reminders` already ran under
Vercel Cron. Accepted regression: a breach is reported up to ~24h later rather
than ~15 minutes — acceptable because every consumer of these provider keys is
interactive, so nothing accrues while nobody is working.

**Both cron endpoints were unauthenticated in production — now closed.** While
looking for `CRON_SECRET` to trigger the check manually, an unauthenticated
`GET /api/cron/usage-check` returned **HTTP 200**, proving the variable was not
set in Vercel despite `docs/orb-353-ai-usage-warning-plan.md` recording it as
done on 2026-07-22. `/api/cron/reminders` was the sharper exposure — it sends
push and email to users. Stan set `CRON_SECRET` in Vercel; the same request now
returns **HTTP 401**, verified after redeploy. Whether it was never set or was
lost during ORB-375 is **untested**. The manual run also returned
`{"checked":7,"warned":[]}` — so despite the monitor being down for an unknown
period, no threshold had been crossed unreported.

**Cron auth now fails closed (v0.6.286).** Both routes previously used
`if (process.env.CRON_SECRET && ...)`, so a missing variable skipped
authentication entirely instead of refusing to serve — the flaw that let the
exposure above pass an ORB-374 security review, since the code *looks* like it
authenticates. Now `if (!secret || authHeader !== ...)`: a missing secret
breaks the cron loudly rather than opening the endpoint quietly. An
environment-conditional bypass (e.g. "skip auth outside production") was
deliberately *not* added: a conditional inside an auth guard is precisely what
caused the original problem.

**Account restored to the nav on Settings (v0.6.287).** `AppNav.tsx` wrapped
the Account item in `!onSettings`, hiding it on every `/settings*` route. The
Settings sidebar has no Account entry either, so from anywhere in Settings the
account page was unreachable without returning to the Dashboard first.
**The omission was deliberate and documented** — `docs/ui-catalog.md` said of
the Settings layout: "no Account item". Claude Code initially reported the
opposite, having read the general "every page" line and missed the
Settings-specific one eleven lines below; the catalog is now updated to record
Stan's decision to change it. Settings itself remains a non-link current-page
item while in it — confirmed with Stan as intended, not part of the change.

**Cron execution verified 2026-08-07.** Vercel's Cron Jobs view lists both
`/api/cron/reminders` and `/api/cron/usage-check` at `0 12 * * *`, and a
Vercel-initiated run of `usage-check` returned **GET 200**. That closes the last
open item from the cron work: scheduler -> auth header -> check now verified end
to end, rather than inferred from a correct-looking config. Note the 12:00 is
UTC (~05:00 local), and that Vercel's log-search window must bracket the run
time — a 30-minute evening window shows no cron requests and proves nothing.

Verified against production after deploy — **no auth 401, wrong token 401,
valid token 200 with `{"checked":7,"warned":[]}`**. Both the deny and the allow
path were exercised: three 401s alone would not have distinguished a working
guard from one rejecting everything, including Vercel's own scheduler. The
now-unused `CRON_SECRET` GitHub repository secret was deleted by Stan.

**Prior session (Codex, GPT-5.6 Sol) — ORB-375 ElevenLabs runtime retirement**
shipped as v0.6.283: adapter, Voice Settings option, usage polling, and
encrypted-launch requirement removed; historical records intact; Stan verified
Voice Settings, AI Metrics, and Realtime voice. Eval: Tier 1 voice + smoke
**11/11**, Tier 2 voice **6/6**.

---

## Current Uncommitted Changes

*(none after the v0.6.288 proposal checkpoint commit. The long-running
capability-broker planning claim remains tracked during review, and `WIP.md`
remains tracked because ORB-375 rotation and acceptance are not complete.)*

---

## Active Risks / Unresolved Work

- *(closed 2026-08-07 — the cron-execution item is resolved; see Last Session
  Completed. Both jobs are registered and a Vercel-initiated invocation of
  `/api/cron/usage-check` returned **GET 200**, so scheduler, auth, and check
  are verified end to end.)*
- **Local dev note (from the v0.6.286 fail-closed change):** both cron routes
  now return 401 when `CRON_SECRET` is unset, and it is *not* in the encrypted
  local environment. To exercise `/api/cron/reminders` or `/api/cron/usage-check`
  locally, add `CRON_SECRET` to the encrypted env and pass a matching
  `Authorization: Bearer` header. A strict guard was chosen over an
  environment-conditional bypass deliberately — a conditional in an auth guard
  is what caused the original exposure.
- **`ELEVENLABS_API_KEY` is gone from the encrypted local environment**
  (confirmed 2026-08-05 by listing variable names). The Vercel half of that
  ORB-375 step was not checked.
- **The eval runner must inherit the encrypted environment** — `.env.local` was
  intentionally removed by the ORB-375 containment release, so agents cannot
  read secrets directly and must hand Stan the `orb-dev`/`openssl` command.
- **Helm's push gate is unverified — accepted by Stan on 2026-08-05. This is a
  closed decision, not pending work; do not reopen it as a task.** The rule is
  committed and byte-identical to Orb's, which was verified firing. What was
  never observed is it firing in a *Helm-rooted* session: project settings load
  from the session's own project, so a block seen from an Orb session is Orb's
  rule and proves nothing. If it ever becomes worth closing, run
  `git push --dry-run origin main` from a Helm session — a **silent** block
  means the rule fired; a dialog means it did not match.
- **ORB-375 is incomplete.** Resend and Mistral rotation and post-revocation
  checks are complete. ElevenLabs still needs the clean v0.6.283 production
  deployment verified before its Vercel/local variables and two provider keys
  are removed and post-revocation checks are repeated.
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

1. Have Claude Code review `docs/orb-ai-capability-broker-plan.md`; preserve its
   complete attributed packet, record dispositions, and leave final decisions
   to Stan in the document's decision register.
2. Do not implement the capability broker until Stan marks the applicable
   decisions Decided and the document Approved.
3. Verify v0.6.283 in production: Voice Settings exposes only Browser and
   OpenAI, AI Metrics loads, and OpenAI Realtime voice works.
4. Delete `ELEVENLABS_API_KEY` from Vercel and the encrypted local environment,
   delete both ElevenLabs provider keys, then repeat the three checks.
5. Rotate `DATABASE_URL`, coordinated Orb/Helm API secret, and the VAPID pair.
6. Complete ORB-375 acceptance, write resolution notes plus its Knowledge Repo
   entry, and remove the active claim with the closing commit.

---

## Key Current Decisions

- **Capability-broker work is planning-only.** Codex maintains the controlled
  draft and imports attributed review packets; Claude Code reviews; Stan makes
  and records every final decision. No implementation is authorized yet.
- **Capabilities, not credentials.** The current proposal preserves ORB-375
  containment by putting bounded todo and Knowledge operations behind trusted
  server-side authorization instead of restoring environment access.
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
- **ElevenLabs is retired, not rotated.** No deployed runtime, Settings control,
  usage poller, or required credential remains; historical accounting and
  incident records remain intact.
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
- **Security controls fail closed, never open.** No conditional inside an auth
  guard — a missing secret must refuse service, not skip the check. Applies
  beyond cron: if absence of configuration is indistinguishable from success,
  the control is decorative.
- **Verify both directions.** A control that rejects bad input is only half
  tested; exercise the accept path too, or "rejects everything" passes as
  "works".
- **A "Done" line in a plan doc is not evidence.** `docs/orb-353-…` recorded
  `CRON_SECRET` as set in Vercel on 2026-07-22; it was not, and both cron
  endpoints stayed open. Verify controls by exercising them, not by reading
  what a document claims about them.
- **Git push always requires Stan's explicit in-chat approval.** Structurally
  enforced by a `permissions.deny` rule in the tracked `.claude/settings.json`.
  Deny patterns must be **anchored at the start of the command**; mid-wildcard
  forms like `Bash(git * push *)` match any git command whose arguments merely
  contain "push", including commit messages.
- **A safety rule cannot live in a file the agent writes to.** That is why the
  gate moved out of `.claude/settings.local.json`.
- **Orb identity:** Brownie temperament, butler intelligence.

---

## AI Tool Used Last Session

`2026-08-07 — Codex (GPT-5.6 Sol)`

---

*Updated by AI at end of each session. Committed with session code changes.*
