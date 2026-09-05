# HANDOFF.md

> **Written by one AI tool for the next one.** It exists so a tool starting a
> session can get up to speed on the state of development. Write for the tool
> that reads it cold: current facts it can act on, no narrative. Stan reads it
> occasionally but rarely — not the intended reader, but not never either.
> Every AI reads this in full at session start, so **length is a direct cost**.
>
> **Before writing anything here, read `docs/handoff-conventions.md`** — the
> single source of truth for what belongs in each section and how to update it.
> No rules are restated in this header, so it cannot drift.

---

## App State

- **Branch:** `main`.
- **Pushed:** v0.6.298 through **v0.6.301 are pushed** (`630c271`, 2026-09-03)
  and deployed by Vercel. Four versions went out together, including v0.6.299,
  whose headline feature v0.6.301 removes — so the deployed changelog shows the
  session mechanism introduced and withdrawn in one batch. Nothing is
  outstanding.
- **Dev server:** runs through the installed `orb-dev` launcher; Stan verified
  Mac, iPhone, and iPad access over localhost, Bonjour, and LAN IP.
- **Live URL:** https://orb-eight-lake.vercel.app
- **Local version:** **0.6.304** — handoff purpose/conventions documented in
  `docs/handoff-conventions.md` (single source of truth) and enforced by
  `scripts/verify-handoff.js`, which fails when they are broken. **v0.6.298–0.6.303 are pushed and live**
  (`a562929`); v0.6.304 and the doc commits after it are **committed, unpushed**.
- **🔴 `npm run lint` currently FAILS**, by design. `scripts/verify-handoff.js`
  reports twelve `Prior session:` blocks in this file — the defect it was built
  to catch. `docs/handoff-conventions.md` §3.4 says the latest session
  *replaces* the prior entry. Removing them applies that rule rather than
  deciding anything new, but deletes ~800 lines of 1,191 and **needs Stan's
  authorisation**. Until then, lint fails on this one check only.
- **Installed launchers: IN SYNC (verified 2026-09-03).** Stan reinstalled all
  three diverged copies; `npm run test:security-launcher` reports "Installed
  launchers match the repository (4 checked)" and an independent `diff` of each
  agrees. All four remain `root:wheel 755`.
  **Standing note:** the copies in `/usr/local/orb-bin` are what actually run,
  and version control does not keep them in step — only that test does. Run it
  after editing anything in `scripts/security/`. `orb-secrets-seal` had drifted
  since 2026-08-05 (it still required the removed `ELEVENLABS_API_KEY`, so the
  version on PATH could not re-seal the store) and nothing noticed for four
  weeks.
- **Production maintenance:** off.
- **Database:** Stan applied
  `scripts/migrations/20260818_statement_import_catalog_models.sql` and
  reported success. Stan also applied
  `scripts/migrations/20260818_model_request_platform.sql` and reported
  “Success. No rows returned.” Historical request rows deliberately remain
  `unknown`; no production model promotion was made.
- **Database — applied migrations (state, not files to re-read).** All of
  `20260819_orb_agent_ro_role.sql`, `20260819b_orb_agent_ro_routine_privileges.sql`,
  `20260820_routine_least_privilege.sql`, `20260820b_anon_definer_sweep.sql`,
  `20260820c_is_admin_and_authenticated_lockdown.sql`,
  `20260820d_todos_agent_policy_fold.sql` and
  `20260903_orb_agent_ro_standing_credential.sql` are **applied**. The `anon`
  exposure is closed in production. Moved here from Uncommitted Changes on
  2026-09-03: naming them under that heading told the next agent to re-read
  them, which was never the intent.
- **Database — DONE 2026-09-03.**
  `scripts/migrations/20260903_orb_agent_ro_standing_credential.sql` is
  **applied**; Stan set a standing password and installed the pgpass line.
  Verifier returned **50 passed, 0 failed**. The role reports
  `expiry_stamp infinity`, `can_log_in true`, `connection_limit 4`,
  `bypasses_rls false`, `inherits false`.
- **🟢 THE BROKER IS IN SERVICE.** The first successful end-to-end read in its
  history happened 2026-09-03. **The pooler question is answered:** a custom role
  *does* authenticate through Supabase's transaction pooler, as
  `orb_agent_ro.<project-ref>` on `aws-1-us-west-1.pooler.supabase.com:6543`.
  That had been the one untested step since 2026-08-19.
- **DONE 2026-09-03:** the obsolete `/usr/local/orb-bin/orb-agent-session` was
  removed by Stan. The four remaining launchers (`orb-agent-approve`, `orb-dev`,
  `orb-secrets-seal`, `orb-secrets-set`) are all `root:wheel`, all
  passphrase-bearing, and all denied to Claude Code.
- **ORB-374:** still deferred overall, but its Phase 1 items 4 and 7 (narrow
  brokers; removing inline-secret instructions from both `AGENTS.md` files) are
  now implemented by the capability broker.
- **ORB-375:** implementation and credential rotation are in progress.

---

## Uncommitted Changes

Path-only projection of `git status --short`. Enforced by
`node scripts/verify-handoff.js`. Rules: `docs/handoff-conventions.md` §3.3.

- `docs/orb-381-model-cost-comparison-plan.md` — untracked. Codex's ORB-381
  planning file, under its separate claim. Not mine; exclude from any commit.

---

## Last Session Completed

**ORB-382 — removed time-boxed agent sessions — 2026-09-03 (Claude Code, Opus 5)**

Released locally as **v0.6.301**. Stan's judgement, after reviewing the complete
functionality of both `orb-dev` and `orb-agent`: the session ceremony was
obstacle rather than protection. `orb-agent-session` is deleted;
`orb_agent_ro` moves to a standing credential.

**Why it went, in order of weight.** (1) The window was never the boundary —
Layer 1 is SELECT on eight tables with no write grant anywhere, and the broker's
own header always said so. (2) Its expiry did not behave as described: F18
established that the server-side stamp gates logins only, natural expiry fires
no event, and a held connection survived to the next mint or explicit `--end`.
(3) It was the only read path that unlocked the master store, so every window
spent a master-passphrase entry — the F8 exposure the castle model ranks
highest. The control consumed the asset it existed to protect.

**Design.** One standard pgpass line, mode 600, carrying host/port/db/user as
well as the password, so there is no second file to drift. The password still
reaches psql only through `PGPASSFILE`. `cmd_status` now reports what the
*database* says — it attempts a real `SELECT 1` — rather than trusting a local
file's claim, and prints the exact install command when the credential is
absent. Revocation is `ALTER ROLE orb_agent_ro NOLOGIN;`.

**Documented rather than glossed:** `NOLOGIN` is an authentication-time check
exactly like `VALID UNTIL`. It stops new connections and does **not** sever an
open one; cutting off a live session needs a `pg_terminate_backend` sweep as
well. That distinction is written into the migration, the plan, and §14 of the
hardening doc, because the previous design's central claim failed on precisely
this point and the same mistake was available again.

**Accepted cost.** A leaked standing credential stays valid until revoked or
rotated, with no automatic bound. This is a real reduction in defence-in-depth,
taken deliberately.

**Two bugs I introduced and caught by running things:** `cmd_status` initially
called `require_credential` inside an `if` with stderr suppressed — but `fail`
calls `exit`, so a bad-permissions file would have exited silently showing the
user nothing. And the suite's `status | grep -q` checks failed spuriously under
`set -o pipefail`: `grep -q` exits on first match and closes the pipe, so the
broker's remaining output takes SIGPIPE and the pipeline reports failure. The
second one only surfaced because the suite was actually run rather than assumed
green.

**Verification — what was and was not established.** Offline suite **62/62
across three runs**; `npx tsc --noEmit` clean; launcher helper test passes;
`orb-agent status` exercised directly against a scratch root. The session
section was replaced with *absence* checks, and they are labelled in the file as
proving only that a string is gone. **The database side is unproven.** Neither
`NOLOGIN` revocation nor the SELECT-only boundary is tested by any of the above
— that needs the migration applied plus
`scripts/migrations/verify-orb-agent-ro.sql`, and the broker has still never
completed a single end-to-end live read.

**Eval:** not applicable — no Orb-conversation capability, tool, routing rule,
prompt, or defined speech behavior changed.

**Live verification, all run by Stan or against the live database this session:**

| Test | Result |
|---|---|
| Offline suite | 62/62, three runs |
| `npx tsc --noEmit` | clean |
| Boundary verifier | **50 passed, 0 failed** with the inverted expiry assertion |
| Live reads — status, todos list, todos get, knowledge search, db health | all pass |
| `NOLOGIN` revocation | read refused, `FATAL`, exit 2; `status` reported REFUSED |
| `LOGIN` restoration | reads returned, exit 0 |

**Three defects found by running things rather than assuming.** `cmd_status`
called a function that `exit`s on failure from inside an `if` with stderr
suppressed — a bad-permissions credential file would have shown the user
nothing. The suite's `status | grep -q` checks failed spuriously under
`set -o pipefail`, because `grep -q` closes the pipe on first match and the
writer takes SIGPIPE. And the migration's attribute-restating line was refused
by Supabase (see below); it was a no-op nicety and was deleted.

**Supabase gotcha worth remembering.** `ALTER ROLE ... NOSUPERUSER` requires
superuser **even to set it off**, and Supabase's `postgres` is not one. Note the
asymmetry: `CREATE ROLE ... NOSUPERUSER` *is* permitted for a `CREATEROLE` role,
which is why the original role migration applied cleanly while a later `ALTER`
restating the same attributes did not. Assert attributes in the verifier, not by
restating them in a migration.

**Misleading error worth remembering.** Supavisor reports `NOLOGIN` as
`FATAL: (EAUTHQUERY) user not found in the database`. The role exists and was
readable seconds earlier; only `rolcanlogin` changed. Check
`pg_roles.rolcanlogin` before believing that wording.

**ORB-382 is closed.** Stan applied the resolution notes and the Knowledge entry
on 2026-09-03 and confirmed both were saved.

**Loose ends closed afterwards, as v0.6.302** — see Uncommitted Changes above
for detail. Three fixes: the psql/`DATABASE_URL` instructions that handed every
agent a command expanding to an empty connection string; `db health` printing
bare table names across multiple schemas, which over-stated a bloat finding
(four of five flagged tables were `auth.*`, Supabase's to vacuum, not ours);
and `shared/AGENTS.md` — which governs the push gate for every project in
`~/Projects` — being under no version control whatsoever.

**The bloat finding, corrected.** Only three `public` tables exceed the ratio,
holding 47, 35 and 29 dead rows respectively. That is kilobytes.
`orb_eval_runs` has never auto-vacuumed because it has not reached its trigger
of 56 dead rows, which is correct behaviour rather than neglect. The actionable
defect was the alarm rule, not the tables.

**Fresh-eyes re-read of `orb-dev` (2026-09-03), findings not otherwise
recorded:**

- **PATH ordering defeats the root-owned-launcher mitigation.** F8 was recorded
  as mitigated because the launchers and their directory are `root:wheel` and
  unwritable. Both facts are true; the conclusion does not follow. `~/.zshrc`
  (**mode 644, owner-writable**) prepends `~/.local/bin`,
  `~/.antigravity-ide/…/bin` and — via Homebrew — `/opt/homebrew/bin`
  (**`drwxrwxr-x`, group `admin`, writable**) *in front of* the
  `/usr/local/orb-bin` entry that `path_helper` appends at position 15.
  `which -a orb-dev` resolves correctly **today**, so nothing is shadowing it —
  but that is a fact about the current filesystem, not a control. One file
  written into `~/.local/bin`, with no `.zshrc` edit and no sudo, captures the
  master passphrase on the next invocation. This is Codex's R3-Q5, still open.
  Root ownership protects the launcher *files*; it does not govern which file
  is *reached*. **Not fixed — the honest options are "document accurately" or
  "stop calling F8 mitigated", and that is Stan's call.**
- Same applies inside the script: `exec /usr/bin/env npm run dev` resolves npm
  through that PATH. `npm` itself is `/usr/local/bin/npm` (root-owned, not
  writable) at position 6, behind three writable directories. `package.json`
  already defines a `prebuild` script, so npm lifecycle hooks are in active use
  and an added `predev` would not look out of place in a diff (R3-N2).
- `load_encrypted_environment` exports **every** name in the store, not only
  the fifteen required. The required list is a floor, not a ceiling.
- `orb-dev --check` takes no passphrase and touches no secret — it is purely a
  filesystem/network posture check. It is nonetheless caught by the blanket
  `Bash(orb-dev *)` deny, so an agent cannot use it to verify posture. Not
  necessarily wrong, but worth a deliberate decision rather than an accident.

*Session history before 2026-09-03 was removed on 2026-09-03 under
`docs/handoff-conventions.md` §3.4 — "Last Session Completed" replaces the prior
entry rather than being prepended to it. Twelve chained blocks had accumulated,
687 lines. That history is in `git log` and `lib/changelog.ts`, both queryable
precisely. Two live constraints found inside it — the Realtime `Cancel. Stop.`
sequencing hazard and open ORB-378 — were migrated to Active Risks first; they
were the only record of either.*

---

## Active Risks / Unresolved Work

- **🔴 Realtime voice — sequencing hazard in the mutation-approval hint.**
  Migrated here 2026-09-03 from the trimmed session history; it was the only
  record. Narrowing the confirmation hint to remove the words `Cancel. Stop.`
  would convert a loud failure into a **silent unauthorized mutation**: with the
  negation words gone, `failsMutationApprovalGuards` passes and
  `MUTATION_APPROVAL_ACT` matches `\bconfirm\b`, so a phantom transcript would
  authorize whatever proposal is pending. `Cancel. Stop.` inside the hint is
  currently the only reason phantom confirmations fail loudly rather than
  committing — **load-bearing by accident**. Dropping the hint entirely is safe
  in any order; narrowing it before the boundary rejection lands is not.
  Related, same review: `useRealtimeVoiceSpike.ts:774` accepts any non-empty
  transcript as genuine user speech, and `:638` discards the canonical receipt
  when a completed write resolves after the user has started a new turn — the
  write commits and Orb never says so.
- **ORB-378 is open and awaiting Stan's manual closure.** Codex's; it describes
  the manual clipboard bridge and needs Stan's live verification. Codex prepared
  Resolution notes and Knowledge fields in chat. Neither database write should
  be reported as complete until Stan confirms saving them. Migrated here
  2026-09-03 from the trimmed session history.

- **Kimi K3 is experimental and development-only.** It passed the accepted
  evidence above but did not achieve deterministic 65/65 Tier 1 behavior.
  Production promotion, a Vercel `MOONSHOT_API_KEY`, and changing any production
  model default require a separate explicit decision. Do not infer promotion
  from the presence of the adapter or catalog entry.
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

0. **✅ COMPLETE 2026-09-03 (ORB-382, v0.6.301).** The broker is in service and
   the boundary is verified 50/50. Steps (a)-(f) below are retained as the
   historical record of how it was brought up; **none of them is outstanding.**
   The only remaining action is the `sudo rm` of the obsolete installed
   launcher, noted in App State above.
   Both SQL files are written for the **Supabase SQL Editor** (no psql
   meta-commands, no `DATABASE_URL` needed) and also run under psql:
   a. **DONE 2026-08-19.** All eight tables already had RLS enabled, so all
      eight `agent_ro: select` policies were created; `pg_stat_statements` was
      granted and `pg_read_all_stats` was refused (see above).
   b. **DONE 2026-08-19** — password set via
      `ALTER ROLE orb_agent_ro WITH PASSWORD '<random>'`. For a future rotation:
      generate locally with `openssl rand -base64 32`, and clear the SQL Editor
      afterwards since it retains recent queries.
   b2. **DONE 2026-08-19** — the `tickets` agent policy was changed from
      `deleted_at IS NULL` to `true`. See "RLS OR-evaluation finding" below.
      The committed migration already encodes this for a fresh setup.
   c. **DONE 2026-08-19 — 36 passed, 0 failed, BOUNDARY VERIFIED.** Rerun
      `scripts/migrations/verify-orb-agent-ro.sql` after any policy or grant
      change; every row must read PASS.
   d. **OBSOLETE — sealing was removed in v0.6.299.** The direct host
      `db.<ref>.supabase.co` is IPv6-only without the IPv4 add-on, which blocked
      the original flow. Option C derives host, port, database, and the correct
      `<role>.<project-ref>` username from the master `DATABASE_URL`, so nothing
      is typed and the pooler form is handled automatically.
   e. **SUPERSEDED by ORB-382 (v0.6.301) — there is no session to open.**
      The sequence is now: apply
      `scripts/migrations/20260903_orb_agent_ro_standing_credential.sql`, set a
      standing password with `\password orb_agent_ro`, then install the pgpass
      line (`orb-agent status` prints the exact format). Then ask Claude to run
      `orb-agent status`, `orb-agent todos list --project ORB --status open`,
      `orb-agent knowledge search "<term>"`, and `orb-agent db health`.
      **Still never run against the live database** — the broker is verified
      offline (62/62) and has never completed an end-to-end read.
   f. Then confirm revocation: `ALTER ROLE orb_agent_ro NOLOGIN;` should make
      the next read fail, and `LOGIN` should restore it. Re-run
      `scripts/migrations/verify-orb-agent-ro.sql`; the section A row is now
      "no leftover expiry stamp" and should PASS with no stamp set.
1. **🔴 CODEX HAS NO PUSH GATE — TESTED AND CONFIRMED 2026-08-19. Highest
   priority.** Codex ran `git push --dry-run origin main` with **no approval
   prompt, exit 0**. `git ls-remote` independently confirmed the remote did not
   move, so nothing was deployed — **the only thing that prevented a production
   deploy was the `--dry-run` flag in the command string.**

   Root cause verified: `trust_level = "trusted"` overrides
   `approval_policy = "untrusted"`, and it is set on **both**
   `/Users/stanleybaptista/Projects/orb` and its parent
   `/Users/stanleybaptista/Projects` — the parent covers every sibling project
   including Helm. **This is not push-specific: Codex runs any shell command in
   those trees unprompted**, including overwriting `~/.local/bin/orb-dev` with a
   passphrase-capturing version.

   By contrast, Claude Code's deny rule was verified by exercise the same day
   and refused even the harmless `--dry-run` form outright.

   Actions, in order:
   a. Remove **both** `trust_level = "trusted"` entries from
      `~/.codex/config.toml` (removing only the Orb entry leaves the parent in
      force). Tool-specific, immediate.
   b. Move to an SSH key whose passphrase is never added to `ssh-agent` or the
      login keychain — the only tool-agnostic gate. Caveats: `git credential
      reject` clears `github.com` for all repos including Helm, and `gh` CLI
      holds separate auth that must be checked independently.
   c. `sudo chown root:wheel` the launchers in `~/.local/bin` so a non-root
      process cannot trojan the passphrase prompt.
   d. Re-test after each change. A control is verified by exercising it.
2. Verify the v0.6.297 Vercel deployment, then spot-check AI Metrics → Orb on
   Mac/iPad/iPhone: Platform values, all/date/search/empty CSV exports, filtered
   row counts/IDs, collapsed-log availability, and Numbers/Excel opening.
3. Stan has the prepared encompassing Knowledge Repository entry. Do not report
   it saved until he confirms the manual write.
4. **Nothing is owed on the non-admin account plan.** It is on hold as of
   2026-08-12 and is not a task. Two of its findings are separable and can be
   acted on any time Stan wants, independently of it: tighten
   `/Users/stanleybaptista` from `0750` to `0700`, and consider a read-only Git
   credential as the structural complement to the policy-based push gate.
   Neither is scheduled.
5. Use Kimi experimentally in the Operational, Strategic, and Evaluation roles;
   compare live quality, latency, and AI Metrics cost before deciding whether
   to promote it beyond development.
6. **ORB-359 — make the four §7 decisions** in
   `docs/orb-359-realtime-confirmation-integrity-plan.md`. Recommended first
   move is **B1** (never silently swallow a committed mutation): it has no
   dependencies, needs no provider evidence, and fixes the half of the reported
   experience that actually reads as "lost track." **Do not narrow the
   transcription prompt before the boundary rejection lands — see §3.** A3
   (logprobs gate) stays unspecified until a raw payload is captured, which
   itself needs Stan's approval for temporary instrumentation (§10).
7. Stan chose manual clipboard CRUD for now. Test Copy/Copy All on Mac, iPad,
   and iPhone across Todo, Settings Projects, Settings Knowledge, and the
   dashboard List project modal. In Settings Knowledge, also verify `Claude
   security` with both All terms and Any term, plus the bounded 10-entry Copy
   Results packet. **Manual clipboard mode is now the documented fallback, not
   the primary path** — once priority 0 is complete, agents read through
   `orb-agent` and manual transfer is only for what the broker does not cover
   or for when no session is open.
6. Review `docs/orb-instruction-architecture-proposal.md` with Orb and Claude
   Code; preserve complete attributed packets and leave all final decisions to
   Stan. Do not change active instructions before its gates are satisfied.
7. Do not implement the instruction-architecture planning track until Stan
   explicitly approves it.
8. Verify v0.6.283 in production: Voice Settings exposes only Browser and
   OpenAI, AI Metrics loads, and OpenAI Realtime voice works.
9. Delete `ELEVENLABS_API_KEY` from Vercel and the encrypted local environment,
   delete both ElevenLabs provider keys, then repeat the three checks.
10. Rotate `DATABASE_URL`, coordinated Orb/Helm API secret, and the VAPID pair.
11. Complete ORB-375 acceptance, write resolution notes plus its Knowledge Repo
   entry, and remove the active claim with the closing commit.

---

## Key Current Decisions

- **Platform and performance share one environment owner.** Do not add another
  user-agent/viewport classifier for model accounting; both consumers use
  `collectClientEnvironment()` so changes cannot drift.
- **AI Metrics CSV is a safe ledger export, not a settings backup.** It follows
  Request Log filters, excludes user/response/raw-provider content, and fails
  above 100,000 rows instead of truncating.
- **Stan owns the encompassing Knowledge entry.** Keep complete implementation
  notes, but do not write Knowledge until final acceptance and Stan's manual
  save.
- **Kimi K3 is an experimental development candidate, not a production
  promotion.** Its Operational evidence is accepted at 63/65 twice without
  weakening provider-neutral assertions. Evaluation selection is independent
  from live Operational and Strategic selection.
- **Model identity is server-stamped.** Orb must report the current
  environment's selected model from policy, never rely on a provider's
  self-identification or contaminated conversation history.
- **Environment-isolation approaches for AI tooling are on hold (2026-08-12).**
  No further work on non-admin macOS accounts, Docker, or VMs. This is a
  direction decision, not a gate further review can satisfy. It does not affect
  ORB-375 containment, the existing push gate, or the same-account local-unlock
  draft.
- **Verify baselines; don't reason about them.** The non-admin plan's central
  security claim was false as configured, and four commands showed it. A
  separate row in that plan recorded FileVault as "unverified" when the command
  needs no elevation and one tool's sandbox was the only obstacle — a tool
  limitation written down as a property of the system.
- **AI operational access is manual for now.** Stan transfers Todo, Project,
  and Knowledge content through visible clipboard controls and performs every
  database mutation himself. Agent shells remain credential-free. The
  local-unlock and larger broker plans are preserved as history, not scheduled.
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
- **A local file lifetime is not a credential expiry.** The first session
  design deleted `session.pgpass` at expiry while the database password stayed
  valid indefinitely — anything that read the file during a window kept working
  access. Option C fixes this with `ALTER ROLE ... VALID UNTIL`, which Postgres
  enforces. When something is called an expiry, ask what refuses the request
  after it passes.
- **Test the control, do not read the table.** On 2026-08-19 both push gates
  were exercised for the first time. Claude Code's held; Codex had none at all,
  and had been the second writable agent for months. Neither fact was
  discoverable from the documentation, which asserted universal coverage.
- **Per-tool gates do not compose; a table of them invites false confidence.**
  The push-gate table omitted Codex entirely while asserting universal coverage.
  A control that must be re-implemented per tool, in that tool's own config, is
  a control that silently lapses with every new tool. Prefer gates at the shared
  layer both tools must pass through — the credential, the database grant, the
  OS account — over gates each tool applies to itself.
- **Verify a control by exercising it, including the credential path.**
  `git credential fill` answering non-interactively is the kind of fact that a
  documentation table will never reveal.
- **Orb identity:** Brownie temperament, butler intelligence.

---

## AI Tool Used Last Session

`2026-09-03 — Claude Code (Opus 5)`

---

*Updated by AI at end of each session. Committed with session code changes.*
