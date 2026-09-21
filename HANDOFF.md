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

- **Branch:** `codex/interaction-safeguards`; HEAD `be540d7`. Uncommitted
  v0.6.335 fixes on top of it; no commit or push performed.
- **Version:** local `0.6.335`. Production was last reported as `0.6.331` on
  2026-09-17; not rechecked. `be540d7` (v0.6.334) is on this branch only —
  `main` has not moved and `origin/main..main` is empty.
- **Dev server:** runs through the installed `orb-dev` launcher; Stan verified
  Mac, iPhone, and iPad access over localhost, Bonjour, and LAN IP.
- **Live URL:** https://orb-eight-lake.vercel.app
- **Production maintenance:** off.
- **Installed launchers: IN SYNC — verified 2026-09-17** by
  `bash scripts/security/test-orb-launcher.sh` (**5 checked**; bytes, owner and
  mode asserted) after reinstalling `orb-agent` and `orb-agent-approve`. All
  five `root:wheel 755`. `orb-agent` joined the manifest on
  2026-09-06 after being installed root-owned.
  **2026-09-17: both were reinstalled and are in sync.** `orb-agent-approve`: the empty-body bug (`--config -` and
  `--data-binary @-` both read stdin; PGRST102) was fixed and the installed copy
  was reinstalled, so ORB-359 applied; the repo copy has since gained
  project-id resolution for the Knowledge entry (the tasks API select omits
  `product_id`, so agent-written entries landed with no project — ORB-359's
  entry `d6b410cc` still needs its project set by hand). `orb-agent`: status
  counted proposal FILES, so applied proposals inflated "proposals pending"
  for ever; repo copy now counts pending only (verified 0 by running the repo
  copy; the installed copy now also reports 0). The project-id resolution in
  `orb-agent-approve` is installed but unexercised — the next applied proposal
  is its first real test.
  **Standing note:** the copies in `/usr/local/orb-bin` are what run. Version
  control does not keep them in step — only that check does. **Run it after
  editing anything in `scripts/security/`, and reinstall before assuming a fix
  is live.**
  **What root ownership does NOT buy (corrected 2026-09-06):** it constrains
  what PATH *resolves*, not what an agent *executes*. `scripts/security/*` is
  owner-writable, promotion is a `sudo install` command an agent composes and
  Stan runs, and `bash scripts/security/orb-agent` reaches the database without
  PATH or sudo — tested. The check makes an unannounced change to the installed
  copy **detectable**. That is its whole value. Two separate divergences were found this way: `orb-secrets-seal`
  had been unable to re-seal the store for four weeks, and the R4-N1 decrypt fix
  sat un-installed until reinstalled.
- **Agent broker: IN SERVICE.** Standing credential at
  `~/Project-secrets/orb-agent/credential.pgpass` (mode 600), reaching
  `orb_agent_ro.<project-ref>` on the pooler, port 6543. `orb-agent status`
  reports ACCEPTED. Revoke with `ALTER ROLE orb_agent_ro NOLOGIN;` — pair with
  `pg_terminate_backend` to cut off an already-open connection.
- **`npm run lint` exits non-zero** on **6 pre-existing ESLint errors** in
  `app/prototype/voice/page.tsx`, unchanged since v0.6.17.
  `scripts/verify-handoff.js` and `scripts/verify-ui-catalog.js` both pass.
- **Database — applied migrations (state, not files to re-read).**
  `20260819_orb_agent_ro_role.sql`,
  `20260819b_orb_agent_ro_routine_privileges.sql`,
  `20260820_routine_least_privilege.sql`, `20260820b_anon_definer_sweep.sql`,
  `20260820c_is_admin_and_authenticated_lockdown.sql`,
  `20260820d_todos_agent_policy_fold.sql`,
  `20260903_orb_agent_ro_standing_credential.sql`, and the two 20260818
  statement-import/platform migrations and
  `20260906_orb_ticket_confirmation.sql` are all **applied**. The `anon` exposure
  is closed in production. Boundary verifier last run 2026-09-03: **50 passed,
  0 failed**.
- **Ticket confirmation migration:** Stan applied it 2026-09-06. Its closing
  query showed `create_ticket` in the proposal-kind constraint,
  `service_can_confirm_ticket = true`, and
  `authenticated_can_confirm_ticket = false`.
- **Todo full-field parity migration:**
  `scripts/migrations/20260906b_orb_todo_full_field_parity.sql` was applied by
  Stan on 2026-09-07. Stan also confirmed the rollback verifier and live
  acceptance were completed; detailed output/counts were not supplied.
- **Unified interaction migration:**
  `scripts/migrations/20260911_unified_orb_interactions.sql` is **applied**;
  Stan reported every verifier column true and completed unified-text
  acceptance. Unified voice acceptance remains open.
- **Intentional-interrupt migration:**
  `scripts/migrations/20260916_orb_intentional_interrupts.sql` is **applied**;
  Stan reported every verifier column true on 2026-09-16. Only
  `payload->>'reason' = 'stop'` now blocks `confirm_orb_command_batch` /
  `confirm_orb_mutation`.
- **Command-batch migration:**
  `scripts/migrations/20260912_orb_command_batches.sql` is **applied**. Stan
  reported every column from `verify-20260912-orb-command-batches.sql` true on
  2026-09-12. Live acceptance is in progress.
- **`~/Projects/shared` is now a git repository** (`02b0f46`) with **no remote
  configured**. It holds the shared `AGENTS.md` governing every project in
  `~/Projects`. Adding a remote is Stan's decision — it names credential
  variables and internal paths.
- **ORB-374:** deferred overall; Phase 1 items 4 and 7 are implemented by the
  broker.
- **ORB-375:** implementation and credential rotation still in progress.
## Uncommitted Changes

- `HANDOFF.md`
- `components/OrbConversation.tsx`
- `lib/changelog.ts`
- `lib/hooks/useRealtimeVoiceSpike.ts`
- `lib/orb-interaction/read-policy.ts`
- `lib/orb-model/approval-policy.ts`
- `lib/version.ts`
- `package.json`
- `scripts/verify-orb-interaction.ts`

---

## Last Session Completed

**2026-09-21 — Claude Code (Opus 5). Four defects fixed in the v0.6.334
interaction safeguards; v0.6.335 prepared, uncommitted.**

- **Approval grammar (`lib/orb-model/approval-policy.ts`).** `and` was a
  deterministic veto, so "go ahead and do it", "yes, go ahead and apply it" and
  "confirm and proceed" were all refused. The same filter gates the semantic
  fallback, so those phrasings had no path to approve anything. `and` removed as
  a veto; the approval act now matches a conjunction of two acts. The other
  vetoes (question, negation, qualifying condition, spelled identifier,
  retrospective framing, edit verbs) are unchanged and still deterministic.
- **Read allowlist (`lib/orb-interaction/read-policy.ts`).** `COLUMNS.tickets`
  contained `query_tickets` and `support`, harvested from a prose sentence in
  `lib/db-schema.ts`. `*` therefore expanded to a select PostgREST rejects, so
  any `query_db` on tickets without explicit columns failed. Both removed.
- **Dictation (`components/OrbConversation.tsx`).** A too-short recording and a
  send attempted mid-transcription both returned silently. Both now toast.
- **Voice status (`lib/hooks/useRealtimeVoiceSpike.ts`).** The transport-only
  path set `'thinking'` with no `armResponseWatchdog`, so a server turn that
  failed or was stopped left the UI on "Gathering data…" permanently. Watchdog
  now armed there at 45 s (provider path unchanged at 20 s).
- **Verified.** `npm run verify:interaction` and `npx tsc --noEmit` pass.
  ESLint on the five changed files: 0 errors, 6 pre-existing warnings in
  `OrbConversation.tsx`. New regression checks pin every `query_db` table's `*`
  expansion exactly and cover conjunction approvals in both directions; **both
  were proven to fail when the original defects were re-injected**, then pass
  once reverted.
- **Not verified.** No device acceptance, no live model call, no database
  operation, no build, no dev-server operation. The voice fixes are source-level
  only.
- **Attribution correction.** The "heard audio but could not verify speech"
  report that prompted this work was made against a browser bundle whose version
  was never confirmed. v0.6.334's own changelog claims to fix that symptom, so
  it may have been the pre-0.6.334 bug rather than anything new. Treat the cause
  as unestablished until it is reproduced on a confirmed v0.6.335 client.

## Active Risks / Unresolved Work

- **Project-switch loop — root-caused, NOT fixed.** Live log 2026-09-21:
  `[orbConverse] Blocked unverified completion claim … hasActed: false,
  speech: 'Switched to "Orb".'` The model reproduced the server's own
  confirmation sentence from history instead of calling `client_action`
  (straight quotes; the server writes curly). Two contributing defects, both
  outside the v0.6.334 diff and both still present:
  1. `lib/orb-interaction/types.ts:183` has no provenance category for a
     successful `client_action`. It is neither a stored proposal nor a database
     receipt, so it falls to `unbackedAssistantProvenance` and every **successful**
     switch is labeled `[Unverified … nothing was proposed or changed]`.
  2. `lib/orb-prompt.ts:106` instructs the model to say "Opening that project.",
     which `lib/orb-model/false-claim-guard.ts:60` flags as a switch claim
     (verified by running it). The compliant phrasing is itself a trap.
  The one-retry repair currently rescues most attempts; when it does not, the
  user gets "I have not made or proposed that change".
- **Non-admin knowledge reads moved from admin to the RLS client** in
  `app/actions/orb-converse.ts` (v0.6.334). That change deleted a comment
  recording a live bug fixed at that exact spot — cross-project entries with
  `product_id IS NULL` resolving and then returning empty because the RLS
  policy's join cannot match a null. Untested; needs a non-admin account.
- **"yes, remove it" is still refused** against a pending deletion. Edit verbs
  remain deterministic vetoes on purpose (see the comment in
  `lib/orb-model/approval-policy.ts`); loosening them is a policy decision for
  Stan, not a passing fix.
- **Bullet-list visual acceptance remains open.** The shared Markdown CSS now
  explicitly restores list markers, but Stan still saw no bullets before the
  requested hard refresh. The Browser plugin could not inspect localhost because
  its installed client references a missing browser-service bundle.

- **Unified interaction acceptance is open.** Unified text was accepted after
  the 20260911 migration and verifier passed. Runtime routing is now permanently
  unified; the prior separate launcher flags no longer exist. Required live evidence:
  mixed text/voice history across devices, text Stop and replacement, voice Stop
  and short/long barge-in, cross-modal proposal confirmation/rejection, same-turn
  bundled permission remaining a proposal, reconnect after commit before
  presentation acknowledgement, exact speech transcript agreement, and zero
  visible progress/phantom text. The short-speech acoustic thresholds are based
  on prior telemetry but are unverified on current Mac/iPad/iPhone sessions.
  **v0.6.326 fix for fabricated voice creates is unverified live.** Remaining
  known gaps: a nearby voice that passes authenticity still becomes a user turn
  (and a clear "stop"/"no" from it cancels); the dashboard auto-speak effect
  still skips a reply whose text equals the last spoken one (a repeated
  confirmation prompt is silent); production history of existing conversations
  contains fabricated messages, now labeled unverified rather than removed.

- **Generic command-batch acceptance is open.** The 20260912 migration and
  all-true structural verifier passed. Exercise one-item, multi-item,
  mixed-domain, decline, interrupted-confirmation, replay, and cross-modal
  confirmation cases. A command batch is capped at 20. Read-only requests,
  inter-command dependencies, and a transactional notification outbox remain
  outside this implementation slice.

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

0. Optional manual/device acceptance using docs/orb-interaction-scenarios.md.
   No automatic repetition or paid gate. Execute the prepared model-free SQL
   only when an isolated local test database is available. Cross-connection
   races, permission changes, implicit field corrections, offered-memory consent,
   semantic duplicates, and client acknowledgement still need evidence/work.
   See docs/orb-interaction-contract.md for limits. Commit only when Stan asks;
   never push without explicit approval.
0. **Security findings still open** — full detail in
   `docs/agent-enforcement-hardening.md`, reduced 2026-09-06 from a 1,820-line
   review transcript to a 120-line open-findings register. History at `6e47488`.
   - **R3-N2 — same-user post-unlock capture.** `orb-dev` hands every
     decrypted value to writable `node_modules`, npm lifecycle hooks and server
     code, and PATH order is set by owner-writable `~/.zshrc`, so the
     root-owned launchers protect the *files* but not which file is *reached*.
     Not fixable without a separate execution identity. **The available lever is
     blast-radius reduction (R4-N4), not isolation.**
   - **R4-N4 — org-admin credential narrowing.** `ANTHROPIC_ADMIN_API_KEY`,
     `OPENAI_ADMIN_API_KEY` and `GOOGLE_BILLING_CREDENTIALS_JSON_BASE64` are
     decrypted locally for a cron route that cannot run locally. **Removing them
     from `orb-dev`'s `required_environment` would narrow NOTHING** — the loader
     exports every name in the store. Needs a runtime allowlist in the loader,
     or removal from the local store plus matching `orb-secrets-seal`/`-set`
     changes. Not implemented; needs Stan's decision.
   - **R3-N1 — post-confirmation TOCTOU in `orb-agent-approve`.** The proposal
     path is reopened after the final hash check.
   - **F17** — deleted todos are reachable by anyone holding the standing
     credential outside the broker.
   - **R2-Q6** — the master store is AES-CBC with no MAC. Anyone able to write
     it can truncate or tamper with it undetected.
   - **Bash/deny-rule gap** — `.claude/settings.json` denies `Read()` on
     `Project-secrets/**`; Bash is not covered and can read the same files.
     Claude Code used this gap on 2026-09-05 to build a test. Needs a decision.
1. **6 pre-existing ESLint errors** in `app/prototype/voice/page.tsx` keep
   `npm run lint` non-zero. Unchanged since v0.6.17.
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
6. ORB-359's prior B1/A3 implementation gap is incorporated in v0.6.313.
   Retain the older plan only as design history; current acceptance and rollout
   are governed by `docs/orb-unified-interaction-architecture-plan.md`.
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

- **Evals stay strict on first-attempt imitation (2026-09-16, Stan).** The eval
  route does not mirror production's one-retry false-claim repair;
  `hallucinated-proposal-history-new-create-calls-tool` fails until the model
  calls the tool on its first attempt.
- **Only intent cancels (2026-09-16, Stan approved).** Sound pauses speech
  and resumes it; only Stop/bare stop words (`stop`) and new requests
  (`replacement`) are durable; only `stop` blocks a commit. Only the server
  writes proposal and receipt text; model history labels them.
- **Text and Realtime voice are transports, not separate agents.** Every trusted
  turn now uses one server history,
  coordinator, model/tool kernel, confirmation transaction, interrupt event,
  and response artifact. Realtime receives no business tools in normal sessions;
  its old tools are retained only as dormant rollback code. Slash commands
  remain the only intentional interface exception.
- **Mutation permission requires a distinct later event.** Permission bundled
  into the requesting turn can only create a proposal. Confirmation is scoped
  to user plus conversation and may cross text/voice; an interrupt ordered
  before commit rejects that confirmation, while a completed commit retains its
  durable receipt and presentation recovery.
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
  result must report its actual sample size. Do not automatically purchase
  repetitions to increase confidence.
- **Routine verification is model-free (2026-09-20, Stan).** No automatic paid
  suites, repetitions, or release gates. Paid diagnosis needs explicit scope
  and budget approval; historical eval policies are superseded.
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

`2026-09-21 — Claude Code (Opus 5)`

---

*Updated by AI at end of each session. Committed with session code changes.*
