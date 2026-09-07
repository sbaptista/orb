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

- **Branch:** `codex/voice-command-contract`; pushed `main` is `cf6fda9`, with
  one local post-deployment handoff commit still to push. The v0.6.307 Voice
  contract and preceding `8c51efb` hardening-doc cleanup are deployed.
- **Version:** **0.6.307** locally and in production, verified through
  `/api/version` on 2026-09-06; maintenance is off.
- **Dev server:** runs through the installed `orb-dev` launcher; Stan verified
  Mac, iPhone, and iPad access over localhost, Bonjour, and LAN IP.
- **Live URL:** https://orb-eight-lake.vercel.app
- **Production maintenance:** off.
- **Installed launchers: IN SYNC — verified 2026-09-05** by
  `bash scripts/security/test-orb-launcher.sh` (4 checked; bytes, owner and mode
  asserted) and an independent `diff`. All four `root:wheel 755`.
  **Standing note:** the copies in `/usr/local/orb-bin` are what run. Version
  control does not keep them in step — only that check does. **Run it after
  editing anything in `scripts/security/`, and reinstall before assuming a fix
  is live.** Two separate divergences were found this way: `orb-secrets-seal`
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
- **`~/Projects/shared` is now a git repository** (`02b0f46`) with **no remote
  configured**. It holds the shared `AGENTS.md` governing every project in
  `~/Projects`. Adding a remote is Stan's decision — it names credential
  variables and internal paths.
- **ORB-374:** deferred overall; Phase 1 items 4 and 7 are implemented by the
  broker.
- **ORB-375:** implementation and credential rotation still in progress.
## Uncommitted Changes

Path-only projection of `git status --short`. Enforced by
`node scripts/verify-handoff.js`. Rules: `docs/handoff-conventions.md` §3.3.

- `docs/orb-381-model-cost-comparison-plan.md` — separate Codex ORB-381 claim;
  exclude from this change.

---

## Last Session Completed

**2026-09-06 — Codex (GPT-5). Voice command contract, v0.6.307 deployed.**

- Every exposed conversational C/U/D now persists a proposal on the requesting
  turn and requires explicit approval in a distinct later turn in both text and
  Realtime: todo/project CRUD, Knowledge C/U, and ticket C, plus todo move/close.
  Request-turn permission and saved allow/session preferences cannot execute.
  Automated deterministic incident tickets remain direct and outside this
  conversational contract. Capability scope is unchanged; audit is read-only.
- Added admin-only `query_users` and `query_invitations` to text and Realtime.
  Both call `lib/orb-operations/admin-directory.ts`, expose bounded safe fields,
  and remain excluded from generic `query_db`. Live Voice testing found their
  packet rows were discarded while Orb claimed a table was visible. They now
  share one packet-to-Markdown formatter with todo lists and enter the same
  `OrbConversation` Markdown renderer used by text; no Voice table component
  or duplicate directory query was added.
- Database path audit: todo/project/knowledge mutation commits converge on the
  shared proposal store and confirmation entry point; ticket C and the new
  directory reads also converge across channels. Existing todo/project/Knowledge/ticket/audit
  read adapters remain channel-specific, so all database access does not yet use
  one universal path.
- Verification passed once: `npx tsc --noEmit`; focused ESLint with zero errors
  and six pre-existing warnings; `git diff --check`. Contract generation passed
  once. Stan's first model run: Tier 1 **69/69**; mutation-safety Tier 2 passed
  five of six cases initially, with `create-after-hallucinated-history` at
  **0/3** because the model corrected an old unsupported completion instead of
  processing the latest create. The matching latest-request prompt rule was
  added and Stan's focused rerun passed **3/3**. Those results predate the ticket
  extension. Stan then applied its migration and authenticated text acceptance
  passed for users/invitations reads and separate-turn Knowledge C/U. The ticket
  C also passed in text (`TICKETS-73`) and Realtime (`TICKETS-74`); Realtime
  Knowledge C/U passed; and the user/invitation tables rendered correctly after
  the shared display-path fix. Read-only broker verification found the Voice
  Knowledge entry with content `second version`, found `TICKETS-74`, and found
  no rejected suggestion ticket. The post-extension Tier 1 run had one failure:
  `repository-inspection-tool` called the correct tool but omitted explicit
  `source: local`. The v0.6.306 baseline already had the same optional schema
  and assertion, so this was not introduced by the Voice diff. `source` is now
  required in the canonical schema; generation, TypeScript, focused ESLint, and
  `git diff --check` passed once. Its focused rerun passed **1/1**; Stan stopped
  the accidentally started full Tier 1 rerun. Mutation-safety Tier 2 then passed
  **3/6**: the historical-claim case, ambiguous-title case, and legacy
  `mutation-approval` case missed the 2/3 threshold. The last case contradicted
  the current tool-first/server-confirm contract and is now a Tier 1 exact-delete
  routing assertion; the ambiguity fixture now uses duplicate exact titles.
  Stan's minimal rerun passed: historical claim **2/3**, ambiguous title **3/3**,
  and revised mutation approval **1/1**. All required model gates are complete.
## Active Risks / Unresolved Work

- **Text and Realtime do not share one universal read adapter.** Canonical
  mutations and the new users/invitations reads share database functions, but
  existing todo, project, Knowledge, ticket, and audit reads still use
  channel-specific adapters. This was verified by tracing each `.from(...)`
  call site; no claim of universal path parity should be made.

- **🔴 Realtime voice — the transcription vocabulary hint is load-bearing for
  authorization. VERIFIED STILL LIVE 2026-09-05** against the current regexes
  in `lib/orb-model/mutation-authorization.ts`:

  | `app/api/orb-realtime/session/route.ts:59` hint | Result |
  |---|---|
  | current (`… Cancel. Stop. …`) | negation guard fires → rejected |
  | `Cancel. Stop.` removed | **AUTHORIZES the pending mutation** |
  | hint dropped entirely | no approval act → rejected |

  On non-speech audio the transcriber can reproduce its own `prompt` as a
  phantom transcript; `useRealtimeVoiceSpike.ts:774` accepts any non-empty
  transcript as genuine user speech and forwards it as the authorization
  utterance. `Cancel`/`Stop` match the `NEGATION` guard, which runs before the
  approval check — that is the only reason phantoms fail.
  **Mitigation so far: a warning comment at the line (v0.6.306). Not a fix.**
  Deleting the hint outright is safe in any order; narrowing it is not, until
  phantom transcripts are rejected at the boundary rather than by the accidental
  content of a vocabulary hint.
  Related, same review, unverified: `useRealtimeVoiceSpike.ts:638` discards the
  canonical receipt when a completed write resolves after the user has started a
  new turn — the write commits and Orb never says so.

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

0. **Security findings still open** — full detail in
   `docs/agent-enforcement-hardening.md`; §16 lists what Round 4 closed.
   - **R3-N2 / §15.6 — same-user post-unlock capture.** `orb-dev` hands every
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

`2026-09-06 — Codex (GPT-5)`

---

*Updated by AI at end of each session. Committed with session code changes.*
