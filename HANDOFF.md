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

- **Branch:** `codex/voice-command-contract`; the v0.6.325 handoff is committed
  locally, not pushed. The production deployment was not checked this session.
- **Version:** **0.6.325** in the main directory.
- **Dev server:** runs through the installed `orb-dev` launcher; Stan verified
  Mac, iPhone, and iPad access over localhost, Bonjour, and LAN IP.
- **Live URL:** https://orb-eight-lake.vercel.app
- **Production maintenance:** off.
- **Installed launchers: IN SYNC — verified 2026-09-06** by
  `bash scripts/security/test-orb-launcher.sh` (**5 checked**; bytes, owner and
  mode asserted). All five `root:wheel 755`. `orb-agent` joined the manifest on
  2026-09-06 after being installed root-owned.
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

None.

---

## Last Session Completed

**2026-09-16 — Codex (GPT-5.6 Sol). Local commit and Claude handoff, v0.6.325.**

- Removed both public unified-interaction launcher flags from executable code.
  Text and trusted Realtime transcripts now always use the same durable history,
  `orbConverse` kernel, mutation confirmation/batching, interruption events,
  receipts, and client refresh handling.
- Realtime is permanently transport-only in normal sessions: it receives no
  business tools and only transcribes trusted speech or renders canonical exact
  response text. The former Realtime prompt, tool schemas, and client executor
  remain compiled as dormant rollback assets per Stan's direction; reactivation
  requires a source change rather than a launcher setting.
- Removed the browser-session conversation fallback and the local passive
  project/urgency message generators. Visible history now comes only from the
  durable coordinator, eliminating the remaining ghost-message branch.
- The first unified-voice test exposed exact spelling loss, fragile confirmation
  timing around an unrelated interruption, and a visible provider cancellation
  race. Explicit `T-E-S-T numeral one` now supplies exact model context `TEST1`
  without rewriting history; command batches remain pending for 30 minutes;
  only the provider's harmless no-active-response cancellation error is ignored.
- The next interruption test exposed exact-speech verification comparing a
  deliberately truncated utterance with the full planned response. Expected
  speech is now keyed to OpenAI's provider `response_id`; a partial transcript
  is discarded only when trusted acoustic evidence marked that same response
  interrupted. Uninterrupted mismatches remain fatal.
- Project-create acceptance then exposed a receipt-consumption gap: the live
  result depended on a second browser read, and reconnect recovery acknowledged
  committed receipts without applying their refresh scopes. Committed response
  artifacts now carry every created project row; live and recovered receipts
  project those rows into both project collections before acknowledgement and
  then reconcile normally. This is shared by text and voice and supports
  multi-project batches. Existing selection is preserved unless deleted or empty.
- **Stan's subsequent voice test still did not create a project.** The stage of
  failure remains unknown; the receipt/list projection above did not fix it.
  Full implementation, evidence, failures, and next diagnostic steps are in
  `docs/orb-unified-interaction-claude-handoff-2026-09-16.md`.
- Updated the deterministic runtime contract, matching Tier 1/Tier 2 case
  descriptions plus exact-spelling/intervening-confirmation Tier 1 cases,
  architecture plan, capability matrix, changelog, and version.
  `npx tsc --noEmit`, `npm run verify:interaction`, focused ESLint (0 errors), UI
  catalog verification, handoff verification, and `git diff --check` passed once
  after release bookkeeping. No model eval or authenticated Realtime acceptance was run by
  Codex. The required user gates are `orb-dev --eval-t1`, `orb-dev --eval-t2`,
  and direct voice create/delete/current-project refresh acceptance.

- Committed the accumulated work locally, including separate Codex ORB-381
  planning, and removed all Codex active claims. No push was authorized or run.
## Active Risks / Unresolved Work

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
  **Critical:** Stan's v0.6.324 voice-create test did not create a project.
  Do not start with another dropdown-only fix; trace transcript, proposal,
  confirmation event, transaction, and receipt in order.

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

0. Claude: diagnose the actual failed voice project-create transaction using
   the evidence checklist in `docs/orb-unified-interaction-claude-handoff-2026-09-16.md`.
   Then restart with plain `orb-dev`, hard-refresh the browser, and complete direct
   unified-voice acceptance: create, update, delete, current-project fallback,
   mixed-domain, decline, interruption, replay, and cross-modal confirmation.
   Verify the project dropdown updates immediately and no provider/ghost reply
   appears. After manual acceptance Stan runs the
   shared mutation-authorization gate through the launcher:
   `orb-dev --eval-t1`. Continue unified voice acceptance and its three-run Tier
   2 gate separately with `orb-dev --eval-t2`. Do not invoke the underlying npm
   eval scripts directly.
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

`2026-09-16 — Codex (GPT-5.6 Sol)`

---

*Updated by AI at end of each session. Committed with session code changes.*
