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

- **Branch:** `main`.
- **Unpushed:** none after the authorized v0.6.296 push.
- **Dev server:** runs through the installed `orb-dev` launcher; Stan verified
  Mac, iPhone, and iPad access over localhost, Bonjour, and LAN IP.
- **Live URL:** https://orb-eight-lake.vercel.app
- **Local version:** **0.6.296** — experimental Kimi K3 provider integration,
  independent Evaluation model selection, provider-neutral eval pacing and
  accounting, and deterministic active-model identity reporting.
- **Production maintenance:** off.
- **Database:** Stan applied
  `scripts/migrations/20260815_orb_evaluation_model_policy.sql`; it adds the
  independent Evaluation provider/model policy columns. Kimi is selected for
  Evaluation locally. No production model promotion was made.
- **ORB-374:** deferred. Its complete reviewed long-range plan is preserved.
- **ORB-375:** implementation and credential rotation are in progress.

---

## Last Session Completed

**Experimental Moonshot Kimi K3 integration and model-truth fix — 2026-08-15
(Codex, GPT-5.6 Sol)**

Released as **v0.6.296**. Orb now has a provider-neutral Moonshot adapter for
`moonshot/kimi-k3`, including preserved reasoning content across tool turns,
normalized usage and cache accounting, Operational tool execution, and
tool-free Strategic reads. Kimi remains explicitly **Experimental** and is
available only in development; production filters it from Settings and policy
validation and continues to use the accepted Haiku/Gemini configuration until
Stan separately approves promotion and installs a production credential.

Settings → AI Settings now persists **Evaluation Model** independently of the
Operational and Strategic choices. Stan applied the migration, selected Kimi
through the UI, reloaded the page, and verified that a no-override eval used
`moonshot/kimi-k3`. The selectors reuse the existing `s-card`, `s-form`, and
`.select` family and were verified locally on desktop and a 390×844 viewport.
AI Metrics now recognizes Moonshot funding caps, rate cards, request labels,
and reconciliations. Existing Settings and accounting instrumentation covers
the changed load/save paths; no new telemetry family was required.

Both eval runners now handle provider rate limits generically. A 429 can supply
either a retry interval or an RPM ceiling; the runner derives a conservative
delay and slows the remaining run without any Kimi-specific behavioral
exception. Kimi completed the full Tier 1 suite twice at **63/65**. The two
failures moved between runs: the first missed a precise Knowledge read and an
approved todo update; the second repeated `add_knowledge` instead of calling
`confirm_mutation` and omitted `source: local` from `query_repository`. The
unchanged focused pair then passed three consecutive Kimi runs. Stan accepted
63/65 for experimental use and explicitly declined provider-specific assertion
exceptions.

The 30-run Strategic assessment produced **27/27 tool-free strategic calls**
and **3/3 correct Operational controls**. Strategic-only cost was $0.2162 total,
$0.0080 average, and $0.0175 maximum, projecting to about $2.40 for 300 monthly
interactions against the $24 role budget. Kimi's reported cumulative spend of
$1.81641 reconciled to Orb's displayed run estimates within approximately
$0.00024 (0.013%). Recurring quality weaknesses are unsupported effort or
dependency extrapolations and inconsistent insight closers; the live parser now
accepts an unambiguous matching typed closer while raw eval output remains
unmodified for review.

Live use exposed a separate integrity defect: once Claude had identified itself
in conversation history, Kimi repeated that it was Claude despite the request
ledger proving Moonshot handled the later turns. Direct active-model questions
are now intercepted before context assembly or provider invocation and answered
from the current environment's server-read policy. The answer names the active
role, model, provider, and development/production environment. Local browser
verification reported the selected Kimi configuration correctly. Two model-free
Tier 1 cases cover Kimi and Haiku and reject the opposite identity.

**Verification:** TypeScript passed; changed-file ESLint had no errors (two
pre-existing unused-import warnings remain in `app/api/orb-eval/route.ts`);
`git diff --check`, deterministic Moonshot adapter checks, encrypted-launcher
checks, and UI-catalog verification passed. Stan ran the required Tier 1
provider-routing plus smoke gate: **13/13 passed**. The broad build reached the
intentional encrypted-environment guard in the agent shell because it cannot
access `OPENAI_API_KEY`; the user-run evals exercised the unlocked application
path. Full lint remains blocked only by six pre-existing errors in
`app/prototype/voice/page.tsx`.

**Prior session:**

**ORB-359 Realtime confirmation integrity — diagnosis and plan — 2026-08-13
(Claude Code, Opus 5)**

Released locally as **v0.6.295**. **Documentation only — no application code,
database, credential, dev-server, or production state changed. Performance
instrumentation: not applicable, no code path changed. Eval: not applicable — no
Orb-conversation surface changed.**

`docs/orb-359-realtime-confirmation-integrity-plan.md` records the diagnosis of
ORB-359 ("Voice interaction seems to lose track of confirmation") and a layered
remediation plan. **Implementation is not authorized**; §7 holds the four
decisions Stan must make and §11 is an unchecked approval gate.

**Two compounding defects, both verified by reading code, neither reproduced.**

*Defect A — the transcription prompt is emitted as user speech.*
`app/api/orb-realtime/session/route.ts:59` sets a vocabulary hint,
`'Orb. Confirmed. Confirm. Yes. Cancel. Stop. Todo. Project.'`, which is
**verbatim** the phantom utterance appearing seven times in the reported
transcript. For this model family `prompt` is prior-context conditioning text,
not an instruction; on non-speech audio the audio cross-attention contributes
nothing and the decoder reproduces its own context. The `Dziękuję` line is the
same artifact drawn from the training prior instead. Nothing filters it:
`useRealtimeVoiceSpike.ts:774` accepts any non-empty transcript as genuine user
speech, and it becomes the `trustedUtterance` sent to the server as the
authorization utterance.

*Defect B — a committed mutation is silently unreported.* `confirm_todo_mutation`
is correctly exempt from the tool abort controller, but when it resolves after
the user has started a new turn, `useRealtimeVoiceSpike.ts:638` discards the
canonical receipt text while `onMutation()` has already refreshed the dashboard.
The write commits and Orb never says so. Because barge-in is an intentional
feature, turn abandonment is a normal event, not an edge case — the code treats
it as "discard everything in flight," which is right for a read and wrong for a
completed write.

**The most important finding is a sequencing hazard (§3).** Narrowing the hint to
remove `Cancel. Stop.` would convert a loud failure into a **silent unauthorized
mutation**: with the negation words gone, `failsMutationApprovalGuards` passes
and `MUTATION_APPROVAL_ACT` matches `\bconfirm\b`, so the phantom would
authorize whatever proposal is pending. `Cancel. Stop.` inside the hint is
currently the only reason phantom confirmations fail loudly rather than
committing — load-bearing by accident. Dropping the hint entirely is safe in any
order; narrowing it before the boundary rejection lands is not.

**Constraint recorded from Stan:** Realtime and barge-in were deliberate choices
to make voice feel conversational. No remediation may trade them away, so
reverting to the half-duplex `useVoiceMode` path is out of scope. The plan notes
the two hooks are not drop-in alternatives anyway — `useVoiceMode` feeds the
serial `orb-converse` tool set, not the typed Realtime contract.

**One claim was withdrawn.** An earlier inference that the reported session's
missing project number proved Defect B fired that day is **unverifiable** — the
"Cook Dinner" project belonged to a deleted test user and was hard-deleted with
it. Defect B remains verified as a reachable code path; the evidence that it
actually fired is gone.

**Also found and recorded:** `app/api/orb-realtime/session/route.ts:21` already
requests `include: ['item.input_audio_transcription.logprobs']` and **no code
reads them** — the discriminator for hallucinated transcripts is on the wire and
discarded. The logprobs gate (A3) is deliberately left unspecified because the
payload shape has never been observed; designing a threshold against an assumed
shape would risk rejecting real speech.

`docs/orb-325-realtime-voice-flow.md` accurately describes the **DEV prototype**
it was written about. That prototype was promoted in place — same file, same
`useRealtimeVoiceSpike` name — and `handleOrbTap`
(`components/UnifiedDashboard.tsx:718`) now calls it unconditionally with no
user allowlist left in the session route. Its §9 risk acceptance
("worst case is a stray word, not a dead session") became a production risk
acceptance without being re-decided. Whether to correct that document is
decision §7.4.

**Prior session:**

**Manual Todo/Project/Knowledge transfer bridge — 2026-08-12
(Codex, GPT-5.6 Sol)**

Released locally as **v0.6.294**. TodoEditor, Settings Projects, Settings
Knowledge, and the Unified Dashboard List pane's Project modal now provide
field-level **Copy** controls and **Copy All** formatted output. Copy All uses
the form's current values, so unsaved edits are included; edit records add the
stable identifiers available to that surface. After Stan's first acceptance
pass, Copy All moved into each modal header beside Close, field Copy controls
adopted the compact `btn-sm` modifier, and failed first Clipboard API writes now
fall back to a hidden textarea before reporting an error.

All catalogued centered modals are now movable by dragging the non-interactive
part of their headers with mouse, pen, or touch. Movement is constrained to an
8px viewport margin, header controls remain clickable, and reopening a modal
starts it centered rather than persisting an old position.

Orb's tracked `AGENTS.md` and the machine-shared
`/Users/stanleybaptista/Projects/shared/AGENTS.md` now define manual
data-transfer mode. Agent shells do not receive encrypted credentials and do
not attempt direct todo, project, Knowledge, Supabase, `psql`, or Orb API CRUD.
Stan supplies copied records; agents return paste-ready fenced field blocks and
wait for Stan to confirm that writes were saved. Todo closure content includes
separate attributed Resolution notes and Knowledge Title, Content, Tags, and
Project blocks.

Settings → Knowledge also supports the former multi-entry research workflow.
Space-separated literal terms use a visible **All terms** (default) or **Any
term** choice; `AND` and `OR` remain ordinary searchable words. The mode applies
identically to the table and **Copy Results**. Copy Results re-runs the search
and exports the 10 newest complete matches with query, mode, and explicit
`Copied N of total` coverage. Agent instructions tell tools to request this
packet for topic research and never imply that matches beyond the reported
bound were reviewed. Because this action re-runs a server search, it records
Settings performance telemetry for latency, match mode, term count,
copied/total coverage, and failure outcome.

Stan created **ORB-378** from the first paste-ready Todo field blocks. It
describes the manual clipboard bridge and remains open pending Stan's final
live verification and manual closure. Codex prepared the required Resolution
notes and Knowledge fields in chat; do not report either database write as
complete until Stan confirms saving them.

**Verification:** `npx tsc --noEmit` passed; UI catalog verification passed;
focused ESLint had no errors (two pre-existing TodoEditor unused-variable
warnings). The literal-term helper passed 6/6 deterministic checks, including
cross-field All, Any, and ordinary-word `AND` / `OR` cases. Full `npm run lint`
still fails only on the six pre-existing `app/prototype/voice/page.tsx` errors.
Authenticated visual verification remains blocked: the latest in-app browser
attempt reached Orb's Maintenance Mode sign-in screen, and an earlier attempt
hit a local certificate-name error after switching DEV users. Stan's first live
pass identified the initial clipboard failure and layout sizing issues; the
corrections compile and await his follow-up live check. Movable-modal behavior,
All/Any Knowledge search, and the bounded Copy Results packet are also awaiting
Stan's live Mac/iPad/iPhone check. No production state was changed.

Used the existing `EditorModal` / `modal-center`, `pf-*` / Settings input,
`flex-row`, `btn-outline`, and `btn-sm` patterns. **Performance instrumentation:
local field/record copy and pointer movement require none; multi-entry Knowledge
Copy Results records its server-search timing and outcome. Eval: not applicable
— no Orb-conversation surface changed.**

**Prior session:**

**Non-admin development-account plan reviewed and put on hold — 2026-08-12
(Claude Code, Opus 5)**

Released locally as **v0.6.292**. **Performance instrumentation: not applicable
— documentation-only. Eval: not applicable — no conversation surface changed.**

**Stan has stopped work on the whole class of environment-isolation approaches
for AI tooling — non-admin macOS accounts, Docker, and VMs alike.**
`docs/orb-non-admin-development-account-plan.md` is marked **ON HOLD as of
2026-08-12** with a hold notice at the top. Sections 1–23 are preserved
unchanged as the historical record. **None of its section 6 decisions need
answers, and no Round 2 review is wanted — do not reopen it as a task.**

The completed Claude Code Round 1 review is recorded *inside* the plan as
section 24 rather than as a separate file under
`docs/orb-non-admin-development-account-reviews/`, at Stan's direction, so the
direction is wrapped up in one document. The deviation from the plan's own
section 21 is noted in the document.

**The review's baseline claims were verified against the live machine rather
than reasoned about, and that changed the outcome.** The plan's central security
claim was false as configured: `/Users/stanleybaptista` is `0750` group `staff`,
macOS gives new local accounts `staff` as their primary group, and `~/Projects`,
`~/.claude`, and `~/.codex` are `0755` beneath it — so a new Standard account
would have read nearly all of Stan's project work and both AI tools' histories
by default. Fifteen findings were recorded with severity, evidence
classification, risk, and recommendation; the verdict was *Re-review required*,
now moot.

**Section 25 isolates the five findings that outlive the plan** — read that
section, not the phase structure, if isolation work is ever revived. Two are
worth acting on independently of any migration: tightening
`/Users/stanleybaptista` to `0700` (one command, no second account exists yet),
and the observation that the push gate is policy string-matching rather than
capability denial, with a read-only credential the unused structural control.

Also verified in passing: **FileVault is On** (`fdesetup status`, no elevation
needed) — section 4 had recorded it unverified because one tool's sandbox
blocked the check, which is a tool limitation recorded as a property of the
system.

**Knowledge Repository:** Stan created the entry himself on 2026-08-12 from
content supplied in session — *"macOS home is group-readable: any second local
account sees every project by default"*, covering the `0750`/`staff` finding,
the remediation if a second account is ever created, and the `test ! -r`
false-pass trap. **No entry ID was captured in this session** — the agent could
not write to or read back the repo (`.env.local` is absent by ORB-375
containment), so no ID is recorded here rather than inventing one. Look it up by
title if it is needed later.

No account, application, permission, credential, GitHub, Vercel, database,
dev-server, or production state changed at any point.

**Concurrency note:** Codex's claims on the plan document and on Release
bookkeeping were dated 2026-08-11, `Long-running: no`, and therefore stale. The
§2 confirmation step did *not* pass cleanly — those files carried Codex's
uncommitted v0.6.291 work — so the edits were deliberately additive: the plan
was appended to, a **new** v0.6.292 changelog entry was added above Codex's
untouched v0.6.291 entry, and `ACTIVE_WORK/codex.md` was not modified. A stale
claim notice is recorded in `ACTIVE_WORK/claude-code.md`. Proceeding was Stan's
explicit in-chat direction.

**Prior session:**

**Non-admin development-account migration plan — 2026-08-11 (Codex, GPT-5.6
Sol)**

Prepared `docs/orb-non-admin-development-account-plan.md` as a controlled,
implementation-blocked plan for moving routine Orb development into the
Standard macOS identity **Dev E. Loper**, short name `developer`, home
`/Users/developer`. It covers recovery, FileVault, verified account isolation,
administrator-owned Codex and Claude enforcement, independent Git/release
boundaries, fresh AI authentication, local Safari/Chrome/Edge profiles,
encrypted launcher and TLS migration, Mac/iPhone/iPad acceptance, rollback,
and the final disposition of the administrator-account clone.

The plan contains a complete Claude Code Round 1 review protocol and exact
copy/paste prompt. Implementation remains blocked until Claude's packet is
preserved, comments are dispositioned, Stan decides the open questions, the
plan is marked Approved, exact managed-policy/launcher/TLS/Git/secret/deletion
procedures are reviewed, and Stan authorizes the first phase.

**Performance instrumentation: not applicable — documentation-only planning
checkpoint. Eval: not applicable — no conversation surface changed.** No
account, software, permission, credential, GitHub, database, dev-server, or
production state changed.

**Prior session:**

**AI access + instruction architecture planning checkpoint committed and
handoff refreshed — 2026-08-11
(Codex, GPT-5.6 Sol)**

Committed locally as **v0.6.289** in `652e766`; nothing was pushed. Preserved
Claude Code's complete three-round
review of the capability-broker proposal and its dispositions, plus Stan's
initial responses in the decision worksheet. Added
`docs/orb-ai-local-unlock-plan.md` as a smaller draft replacement direction: a
password-unlocked local Unix-socket service and fixed-purpose command surface
shared by shell-capable AI tools. It records the weaker shared identity and
same-user isolation boundary explicitly. No implementation is authorized.

Added `docs/orb-instruction-architecture-proposal.md`, a separate draft for
consolidating developer and runtime guidance into constitutions, capability
contracts, conditional playbooks, live context, deterministic enforcement, and
reference/history layers. It includes rule-admission tests, an auditable
crosswalk, migration phases, success measures, and a controlled review process.
No active instructions changed.

The handoff refresh and release bookkeeping are committed as **v0.6.290**.
**Performance instrumentation: not applicable —
documentation-only planning checkpoint. Eval: not applicable — no conversation
surface changed.** No
application code, credentials, database state, API behavior, dev-server state,
or production configuration changed.

**Prior session:**

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

**None after the v0.6.296 release commit.** The completed Kimi, active-model
identity, and Release bookkeeping claims are removed in that commit.

`ACTIVE_WORK/claude-code.md` remains `*(none)*`. Codex's separate long-running
instruction-architecture proposal claim remains stale and unchanged; its stale
notice remains in Codex's ledger because this release does not complete or
enter that surface.

---

## Active Risks / Unresolved Work

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

0. **Nothing is owed on the non-admin account plan.** It is on hold as of
   2026-08-12 and is not a task. Two of its findings are separable and can be
   acted on any time Stan wants, independently of it: tighten
   `/Users/stanleybaptista` from `0750` to `0700`, and consider a read-only Git
   credential as the structural complement to the policy-based push gate.
   Neither is scheduled.
1. Use Kimi experimentally in the Operational, Strategic, and Evaluation roles;
   compare live quality, latency, and AI Metrics cost before deciding whether
   to promote it beyond development.
2. **ORB-359 — make the four §7 decisions** in
   `docs/orb-359-realtime-confirmation-integrity-plan.md`. Recommended first
   move is **B1** (never silently swallow a committed mutation): it has no
   dependencies, needs no provider evidence, and fixes the half of the reported
   experience that actually reads as "lost track." **Do not narrow the
   transcription prompt before the boundary rejection lands — see §3.** A3
   (logprobs gate) stays unspecified until a raw payload is captured, which
   itself needs Stan's approval for temporary instrumentation (§10).
3. Stan chose manual clipboard CRUD for now. Test Copy/Copy All on Mac, iPad,
   and iPhone across Todo, Settings Projects, Settings Knowledge, and the
   dashboard List project modal. In Settings Knowledge, also verify `Claude
   security` with both All terms and Any term, plus the bounded 10-entry Copy
   Results packet. The local-unlock and larger broker documents remain
   historical planning, not active implementation priorities.
4. Review `docs/orb-instruction-architecture-proposal.md` with Orb and Claude
   Code; preserve complete attributed packets and leave all final decisions to
   Stan. Do not change active instructions before its gates are satisfied.
5. Do not implement the instruction-architecture planning track until Stan
   explicitly approves it.
6. Verify v0.6.283 in production: Voice Settings exposes only Browser and
   OpenAI, AI Metrics loads, and OpenAI Realtime voice works.
7. Delete `ELEVENLABS_API_KEY` from Vercel and the encrypted local environment,
   delete both ElevenLabs provider keys, then repeat the three checks.
8. Rotate `DATABASE_URL`, coordinated Orb/Helm API secret, and the VAPID pair.
9. Complete ORB-375 acceptance, write resolution notes plus its Knowledge Repo
   entry, and remove the active claim with the closing commit.

---

## Key Current Decisions

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
- **Orb identity:** Brownie temperament, butler intelligence.

---

## AI Tool Used Last Session

`2026-08-15 — Codex (GPT-5.6 Sol)`

---

*Updated by AI at end of each session. Committed with session code changes.*
