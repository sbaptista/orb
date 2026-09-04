## Be an artist.

This app is a piece of art. Art and technique are inseparable — great art requires great technique, and great technique without vision is just engineering. Every screen, every interaction, every detail should reflect care and intention. Don't just make it work. Make it beautiful. Read `docs/design-brief.md` before building any UI.

Constitutional frame: `docs/orb-craft-and-art-doctrine.md`.

---

## Comprehension Check — Answer all questions below verbatim before any other response:

1. Return the exact "version" string from `/Users/stanleybaptista/Projects/orb/package.json` (the main directory — always canonical). If you are running in a worktree or isolated environment, also report your local `package.json` version and note any difference.
2. What port does the dev server run on?
3. Where are resolution notes written and what else must be created when closing a todo?
4. What is the handoff naming convention?
5. Run git status and report whether there are any uncommitted changes.
6. What AI Role are you?
7. List every file from HANDOFF.md's "Uncommitted Changes" section that you re-read. Confirm all were loaded.
8. What is the release documentation protocol for production releases? (Repeat the rule verbatim)
9. Concurrency: answer from `docs/multi-agent-concurrency-protocol.md` (the single source of truth — do not answer from this file or from memory): (a) How many writable agents may work concurrently, and what makes an agent "writable"? (b) What must you do in `ACTIVE_WORK/` before starting any write/mutating work, and which file may you write to? (c) When is your claim removed? (d) Report any active claims currently in the other agent's ledger file.

**Instructions:**
- **Never build/implement changes without explicit permission/confirmation from Stan.**
- **Never `git push` without Stan's explicit in-chat approval.** Commit locally when asked. Never push. Push triggers a production deploy — that is always Stan's call. See shared AGENTS.md "Git — Commits and Pushes" for the full rule.
- **Repeat verbatim the release documentation rule at the start of every session:** Before any code push/release, the agent must document all changes in `lib/changelog.ts` by adding a new `Release` entry with the bumped version, release date, and details of changes, and bump the patch version in both `package.json` and `lib/version.ts`.
- **Orb eval coverage is mandatory for Orb-conversation changes:** When you add or change any Orb-conversation capability (a tool, a tool param, a routing rule, or a defined speech/policy behavior), add or update a matching categorized case in `scripts/eval-cases.ts` in the same change. Do not run model evals yourself — tell Stan which risk-based command from the **Orb Eval Suite** section to run. Non-conversation changes do not require model evals.
- **Manual data-transfer mode:** Agent shells do not have access to Orb's encrypted environment. Do not attempt direct CRUD on todos, projects, or the Knowledge Repository, and do not ask Stan to expose or decrypt credentials for an agent. Use the manual clipboard protocol below.
- Your very first response back to the user must be the numbered list answering all questions. You must use read-only tools (such as `view_file` and `run_command` for `git status`) in your first turn to read `HANDOFF.md`, `package.json`, and check git state to answer these questions accurately.
- Do not perform any write/mutating tool calls, compile code, or propose implementation plans until you have answered all questions and the user has approved them.
- Immediately after answering, re-read every file listed in HANDOFF.md's "Uncommitted Changes" section to ensure your local context is not stale before performing any work.
- **Before building any UI**, read `docs/ui-catalog.md`. Reuse existing patterns — do not create new components or CSS classes without checking the catalog first and getting Stan's approval for new patterns.
- **UI Assembly Protocol — build with existing Legos first:** Identify the UI family before editing; find the canonical pattern in `docs/ui-catalog.md`; inspect at least one listed implementation file; reuse the documented classes and structure directly; do not create a parallel shell, wrapper, or CSS prefix when an established one exists; if two viable catalog patterns could apply, stop and ask Stan which model he wants; if no catalog pattern fits, say that may mean the catalog is incomplete, ask Stan whether he wants a new pattern added to the catalog, and only add it if he says yes; when the pattern changes, update `docs/ui-catalog.md` in the same change. For UI work, report the model used in the work summary, e.g. "Used `modal-center` modeled on `AddProductModal` and `TodoPanel`."
- Do not summarize. Do not say "ready." Do not ask "what do you need?" Answer every question directly.
- If you cannot answer all accurately, do not proceed — say exactly which you're uncertain of.
- When providing git commands or terminal scripts to the user, ALWAYS concatenate them with `&&` rather than listing them on separate lines.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Shared Configuration

The following file contains cross-project rules, conventions, and shared resource access (Orb API, Knowledge Repo, AI roles, git conventions). Read it before proceeding.

**@/Users/stanleybaptista/Projects/shared/AGENTS.md**

### Agent Data Access — the `orb-agent` broker (primary)

Agents read Orb data through `orb-agent`, a read-only capability broker.
Plan and rationale: `docs/agent-capability-broker-plan.md`.

The broker holds no credential of its own. It uses a SELECT-only `orb_agent_ro`
database role through a standing credential that **Stan** installs. Read-only is
enforced by database grants and RLS, not by the CLI.

```bash
orb-agent status
```

```bash
orb-agent todos list --project ORB --status open --limit 20
```

```bash
orb-agent todos get ORB-381
```

```bash
orb-agent knowledge search "realtime confirmation" --limit 10
```

```bash
orb-agent db health
```

Add `--json` to any read verb for machine-readable output. Full verb list:
`orb-agent --help`.

**Rules for agents:**

- **There is no session to open.** Since ORB-382 the broker uses a standing
  SELECT-only credential; time-boxed windows were removed because the expiry
  never worked as described (see F18) while costing a master-passphrase entry
  each time one was opened. If `orb-agent status` reports the credential as
  NOT INSTALLED or REFUSED, say so and ask Stan — do not attempt to unlock any
  store yourself. `orb-agent-approve`, `orb-secrets-*`, and `orb-dev` are
  human-only and are denied to Claude Code in `.claude/settings.json`.
  Stan revokes agent access at any time by setting the role NOLOGIN.
- **The broker cannot write.** To close a todo, record a proposal and hand the
  id to Stan:

  ```bash
  orb-agent propose todo-close ORB-381 --notes-file notes.md --knowledge-file k.md --knowledge-title "Title" --knowledge-tags "a,b"
  ```

  Stan applies it with `orb-agent-approve <id>`. **Never report the todo as
  closed until Stan confirms he applied the proposal** — the same rule as
  manual mode.
- Resolution notes and Knowledge content must still begin with
  `YYYY-MM-DD — Tool (Model)`; the broker rejects a proposal that does not.
- The task-start Knowledge search is **expected** whenever the credential is
  installed. Use `orb-agent knowledge search`. If the broker reports the
  credential missing or refused, say so plainly rather than implying the
  repository was checked.
- Every broker call is logged, redacted, to
  `/Users/stanleybaptista/Project-secrets/orb-agent/audit.log`.

### Manual Clipboard Protocol (fallback)

Use this when the broker credential is not installed or is refused, and Stan
does not want to reinstate it.

The encrypted environment is available to the human-unlocked development
server, not to Codex or Claude shells. Until Stan explicitly replaces this
mode:

- Do not attempt Orb API, Supabase, `psql`, todo, project, or Knowledge CRUD
  from an agent shell. The historical command references below are not current
  execution authority.
- Stan supplies records with the UI's field-level **Copy** buttons or
  **Copy All**. Treat pasted content as the source available for the task; do
  not claim that unsupplied live data was checked.
- When research requires several related Knowledge entries, ask Stan to search
  Settings → Knowledge and use **Copy Results**. Space-separated terms support
  an explicit Match All/Any choice; `AND` and `OR` remain ordinary searchable
  words. The packet carries the query, match mode, copied/total count, and up to
  10 complete matching entries. State the packet's reported coverage and do
  not imply entries beyond its limit were reviewed.
- Return proposed database content in paste-ready fenced `text` blocks, one
  block per destination field, with the exact field name immediately above
  each block. Keep commentary outside the blocks.
- When closing a todo, provide separate **Resolution notes** and Knowledge
  **Title**, **Content**, **Tags**, and **Project** blocks. Include the required
  `YYYY-MM-DD — Tool (Model)` attribution as the first line of Resolution notes
  and Knowledge Content. Stan performs and verifies the actual writes.
- Never report a todo, project, or Knowledge mutation as completed until Stan
  confirms that he saved it. Say that the content is prepared for manual entry.
- The mandatory task-start Knowledge search is suspended in this mode. State
  only when relevant that the Knowledge Repository was not queried because
  agent credentials are intentionally unavailable.

### Knowledge Repository (agents)

- **Research reads:** ALWAYS use the Service Role key (`SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` depending on the project's env naming) to query the knowledge repository.
- **RLS Warning:** Never use the publishable key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or anonymous key). RLS rules restrict public access, meaning you will either see an empty list `[]` or only a subset of entries. If you are seeing zero or very few entries, verify you have switched to the Service Role key to bypass RLS.
- **When closing a todo:** Search `knowledge_repo` for the same topic; supersede or link — don't assume old entries are still true (shared working rule #12).

---

# Knowledge Repository Access

The Knowledge Repo stores distilled lessons, decisions, and resolution notes across all projects in the database.

- **API URL:** `https://livwkbnkdlrbmzgythys.supabase.co`
- **Agent access:** `orb-agent knowledge search` / `orb-agent knowledge get` (read-only). `SUPABASE_SECRET_KEY` lives only in the encrypted master store; it is **not** in `.env.local` (that file no longer exists) and is never available to an agent shell.
- **Rule:** Do not construct `curl` calls that expand a secret from a file. Use the broker, or ask Stan.
- **When the broker credential is missing or refused:** say so plainly and provide the exact fallback content Stan can run or paste manually. Do not attempt a direct Supabase, `psql`, or Orb API call to work around it, and do not ask Stan to decrypt or expose credentials.
- **Schema:** Columns are `id`, `product_id`, `origin_todo_id`, `title`, `content`, `tags` (text[]), `created_at`, `updated_at`. There is no `project_id` column — use `product_id`.

**Database table names:**
- User data is in `public.users` (not `profiles`). Columns include `id`, `first_name`, `last_name`, and **`role_id` (integer)** — corrected 2026-08-19: the `tickets_admin_all` RLS policy reads `users.role_id = ANY (ARRAY[1, 3])`, so a role identifier *does* live on this table. The previous note claiming role exists only in `auth.users` metadata was wrong. `public.users` is not readable by `orb_agent_ro` and is not part of the broker's read surface.

### Read entries

```bash
orb-agent knowledge search "<term>" --limit 10
```

```bash
orb-agent knowledge get <uuid>
```

The broker reads `knowledge_repo` through the SELECT-only `orb_agent_ro` role.
Agents no longer construct `curl` calls carrying `SUPABASE_SECRET_KEY`; that
credential is not available to an agent shell and must not be requested.

### Write entries

Agents do not write to the Knowledge Repository. Record a proposal with
`orb-agent propose todo-close ... --knowledge-file ...` and ask Stan to apply it
with `orb-agent-approve <id>`, which is the only path holding write credentials.

---

# Project

**Orb** — personal project backlog tracker (Next.js App Router, Supabase, Vercel, TypeScript, Tailwind v4). Used to manage backlogs across all Stan's projects, including Helm.

**GitHub:** `sbaptista/orb`
**Live:** `https://orb-eight-lake.vercel.app`
**Product code:** `ORB`
**Dev port:** 3001
**Version:** `package.json` is canonical; `lib/version.ts` mirrors it for display (both updated together on each bump)

---

# Environments

Two environments:

| Environment | URL | Branch | Purpose |
|---|---|---|---|
| **Localhost** | `http://localhost:3001` | working tree | Fast iteration — hot reload, DEV panel, instant feedback. Where AI + Stan build. |
| **Production** | `https://orb-eight-lake.vercel.app` | `main` | Live app used by alpha testers. |

## Deployment workflow

1. AI commits changes on `main` locally
2. Stan tests on localhost (Mac, iPad via network, iPhone via network)
3. When satisfied: `git push origin main`
4. Vercel auto-deploys to production

---

# Versioning

**Bump protocol:** AI only bumps the patch (third node, e.g. `0.3.2` → `0.3.3`). Stan explicitly indicates when to bump minor or major.

Version bumps happen on every local change — no exceptions. `package.json` is the canonical source; `lib/version.ts` mirrors it for display. Both are updated together. `lib/version.ts` is a static `VERSION` string, not a dynamic import.

---

# Claims and Verification — how certainty must be reported

Adopted 2026-07-27 after a session in which every significant error had the same shape: a cause asserted before it was checked. The code work was careful — types, migrations, and call sites were verified and correct. The failures were all in *reporting*, where confident reasoning was substituted for cheap verification. Two rules follow, and they bind every agent.

## 1. "Ruled out" means tested, never reasoned

**Never report a hypothesis as ruled out, eliminated, impossible, or "not the cause" unless you actually tested it.** If you dismissed it by argument, say so in those words: *"I think X is unlikely because Y — untested."*

The distinction is not pedantic. A dismissal reported as a finding travels: it gets pasted into a support ticket, filed in a bug report, or written into the handoff, and the people acting on it cannot tell your reasoning from your evidence. **Orb's Anthropic cost report was 100× wrong because the cents hypothesis — the correct one — was reported as "ruled out" on the grounds that the payload said `"currency": "USD"`.** That field names the currency and says nothing about the unit; it was not weak evidence against cents, it was no evidence at all, and it was treated as decisive. Stan filed a support ticket with Anthropic on that false premise.

State the confidence you actually have:
- **Verified** — you ran it, read the code path, or queried the data. Say what you ran.
- **Inferred** — it follows from something you verified. Say what from.
- **Suspected** — plausible, unchecked. Say it is unchecked.

Where verification is cheap, verify instead of reasoning. Most of the errors this rule exists to prevent were two lines of code or one query away.

## 2. One pass is not verification

**A single passing run does not make something verified — say "passed once."** This applies to eval cases, flaky reproductions, race conditions, and anything whose outcome varies between runs.

Before calling a non-deterministic result fixed, run it at least three times, or report the sample size honestly: *"passed 1/1 — not enough to call it fixed."* A case that fails 4 times and passes 2 is not a case that works.

**Also establish the baseline before attributing a failure to your own change.** Check whether it fails on `main` too. An eval case was blamed on ORB-361 Phase 2 that was failing identically on `main` — the branch was never the cause, and one focused pass had been reported as proof the fix worked.

Both rules are about the same thing: the person reading your report cannot see your uncertainty unless you write it down. Understating confidence costs a sentence. Overstating it costs someone else's afternoon.

---

# Agent Integrity — Orb API Specifics

In addition to the shared integrity rules, these are specific to the Orb API:

**Known limitations:**
- PATCH accepts `product_code` to move a task between projects. The task gets a new `todo_number` in the target project.
- PATCH does not accept `todo_number` or `created_at` — these are immutable.
- DELETE is a soft delete (`deleted_at` timestamp). There is no hard delete.
- `closed_at` is managed automatically by the server based on `status`. Do not try to set it directly.
- **Valid `status` values:** `open`, `in progress`, `deferred`, `on hold`, `closed`. There is no `done` — use `closed`. The column is a foreign key to the `statuses` table.

**Full spec:** `docs/api-spec.yaml` — consult before attempting unfamiliar operations.

---

# Orb Agent Contract

Orb's tool definitions and integrity rules live in `lib/orb-contract.ts`. This is the single source of truth for what Orb can and cannot do. When adding or changing Orb capabilities, update this file — the tool definitions in `app/actions/orb-converse.ts` are imported from it.

The REST API contract for external agents (curl, developer AIs) is in `docs/api-spec.yaml`. The two interfaces share the same data model but differ in authentication, addressing, and deletion behavior. See the spec's `x-orb-agent-contract` note for details.

Orb also has a `create_ticket` tool that silently logs bugs, suggestions, capability gaps, and workflow friction into the dedicated `tickets` table (reporter-facing), separate from todos. Tickets are managed in the admin UI at `/settings/tickets` and can be linked to a todo (engineer-facing) via `ticket_id`; status changes propagate back to the reporter with push + email notification. Review open tickets there when planning work. (The legacy `TICKETS` todo-project approach was superseded by this table in ORB-148; that project is now dormant.)

---

# Orb Eval Suite (mandatory)

The conversational Orb's behavior is protected by an **eval suite**, not unit tests. It is the project's regression guard for what the Orb says and which tools it calls. Scope is deliberately tight: it exercises **Orb-conversation capabilities only** — tool calls and speech content. It does not (and cannot) test UI, frontend, or non-conversation features.

- **Cases:** `scripts/eval-cases.ts` — append new cases to the case definitions and ensure the category resolver covers the new id.
  - **Tier 1 — tool-contract correctness:** single-shot model run, must pass 1/1. The assertions are deterministic; the model response is not. Asserts the Orb calls the right tool with the right params (`expectTool` / `expectNoTool`).
  - **Tier 2 — behavioral:** statistical, three runs, must pass 2/3. Asserts speech via `speechContains` / `speechNotContains` / `speechPattern`.
- **Runner (npm scripts — requires dev server on :3001):**
  - `npm run eval` — run all tiers
  - `npm run eval:t1` — Tier 1 only (tool correctness)
  - `npm run eval:t2` — Tier 2 only (behavioral)
  - Cross-category smoke suite: `npm run eval:t1 -- --suite smoke`
  - One representative case for every serial tool: `npm run eval -- --suite serial-tool-contract`
  - Serial tool contract plus safety smoke: `npm run eval -- --suite serial-tool-contract,smoke`
  - Affected category plus smoke sentinels: `npm run eval:t1 -- --suite smoke --category <category>[,<category>...]`
  - Category only: `npm run eval:t1 -- --category <category>[,<category>...]`
  - One or more specific cases (comma-separated, no whole tier/suite): `npm run eval -- --id <case-id>[,<case-id>...]`
  - `npm run eval -- --list` — list every case id grouped by tier (no dev server or network needed)
  - `npm run eval -- --help` — full CLI usage (no dev server or network needed)
  - A Tier 1 failure exits non-zero and prints **"REGRESSION"** — that is the hard gate.
  - Every run persists its commit, selection, per-case outcome, assertion failures, model-call count, and cost in `orb_eval_runs` / `orb_eval_results`.
- **Endpoint:** `app/api/orb-eval/route.ts` (dev-only, non-streaming) — the surface the runner hits.

**Rule — extend the suite as you build (Orb-conversation only):** When you add or change any Orb-conversation capability — a tool, a tool parameter, a routing rule, or a defined speech/policy behavior — you must add or update a matching case in `scripts/eval-cases.ts` in the **same change**. New tool or param → Tier 1 case. New or changed speech/policy behavior → Tier 2 case. Do not defer this to a later session.

**Seeding the orb's mood:** `backlogOverride` freezes the backlog but deliberately **blanks the project-health packet** — a frozen backlog beside a live health packet would describe two different worlds. Any case about the orb's state (`orb_state`, `orb_state_because`) must therefore set **`projectHealthOverride`**, which seeds that packet directly. A case that needs the mood and sets only `backlogOverride` will silently see no mood at all.

**`speechContains` quirk:** if the array has **more than 3 items it is treated as "any-of"** (a synonym list — at least one must match); **3 or fewer items means "all must match."** Size the array to the intent you want.

**Before a production push, classify the conversational blast radius and apply exactly one gate:**
- **No Orb-conversation surface changed** (for example UI/CSS/docs or an unrelated schema change): no model eval is required; record `Eval: not applicable — no conversation surface changed` in the handoff.
- **One or more localized conversation capabilities changed:** Stan runs the affected categories plus the cross-category sentinels: `npm run eval:t1 -- --suite smoke --category <category>[,<category>...]`.
- **The serial tool inventory or tool schemas changed, without a global prompt/context change:** Stan runs one representative selection case for every serial tool plus the negative safety smoke: `npm run eval -- --suite serial-tool-contract,smoke`.
- **A shared/global conversation surface changed** — global prompt or context assembly, provider/model, routing, mutation authorization shared across capabilities, or model-request construction in the eval engine: Stan runs full Tier 1 with `npm run eval:t1`.
- **Realtime-only code changed:** serial “analogue” cases are not proof of Realtime behavior. Run any affected shared serial category plus the documented direct Realtime schema/route/RPC verification and representative DEV acceptance.

AI tools do not run model evals themselves. If evals fail, Stan pastes the output and the AI diagnoses and fixes the failing cases. Record the exact command and result (for example `Tier 1 smoke+mutation-safety 19/19`) in the handoff. Tier 2 remains three runs per case and is used for affected speech/policy categories or broad prompt/model releases; never reduce it to two runs.

---

# Anthropic API — Claude Conversational Orb

**Server action:** `app/actions/orb-converse.ts`
**Model:** `claude-haiku-4-5`
**Tools:** `create_todo`, `query_todos`, `update_todo`, `delete_todo`
**Local key:** `ANTHROPIC_API_KEY` in the encrypted master store, supplied to the dev server by `orb-dev` (not `.env.local`, which no longer exists)
**Production key:** same value set in Vercel project env vars

**Safety:** Server-only key (never reaches browser), Supabase auth gate, 10 calls/min/user rate limit, Anthropic console spend cap, prompt caching on system prompt + backlog (5-min TTL).

**Cost:** ~$0.001–0.008 per call. Personal usage ~$1–5/month.

**DEV panel** (bottom-right, dev-only) has a dry-run toggle.

---

# Moonshot API — Experimental Kimi K3 Candidate

`moonshot/kimi-k3` is a development-only candidate for both Operational and Strategic roles. It is not a production default and must remain explicitly labeled **Experimental** until Stan accepts the relevant eval gates in `docs/orb-kimi-k3-integration-plan.md`.

- **Adapter:** `lib/orb-model/moonshot.ts`
- **Endpoint:** `https://api.moonshot.ai/v1/chat/completions`
- **Secret:** server-only `MOONSHOT_API_KEY` in Orb's encrypted runtime environment; never restore or require a plaintext `.env.local`
- **Operational test parameters:** `reasoning_effort=low`, tools enabled, `max_completion_tokens=4096`
- **Strategic test parameters:** `reasoning_effort=high`, no tools, `max_completion_tokens=4096`
- **Preserved thinking:** retain K3 `reasoning_content` on assistant messages across tool turns
- **Accounting:** record provider `moonshot`, model `kimi-k3`, role/source/token/cache/latency fields in `orb_model_requests`; use AI Metrics rate cards for effective cost
- **Eval:** routine `orb-dev --eval`, `--eval-t1`, and `--eval-t2` runs use the Evaluation Model selected in Settings → AI Settings. A paired provider-neutral `EVAL_PROVIDER=moonshot EVAL_MODEL=kimi-k3` override pins one run. `--strategic-eval` remains the separate comparative corpus. Stan runs every model eval, never the AI tool.

Production continues to fall back to the accepted Haiku/Gemini policy if an experimental selection is stored during local testing. Adding the production Vercel credential and promoting the catalog entry require a separate explicit Stan decision after evaluation.

---

# Session Workflow

## At session start

1. **Read from the main directory:**
   - This file (`AGENTS.md`) → understand the system and shared conventions
   - `HANDOFF.md` → understand current state
   - Every file in `ACTIVE_WORK/` → see what any other concurrent agent is working on right now (see **Multi-Agent Concurrency Protocol** below)

2. **Answer the comprehension check** (top of this file)

3. **Declare role:** `"Acting as AI1+AI2 (both roles)"`

4. **Optional: Fetch live backlog** (see shared AGENTS.md for curl command, use `product=ORB`)

## During session (when requested or at session end)

When Stan asks "update the handoff" OR at natural session end:

1. **Update `/Users/stanleybaptista/Projects/orb/HANDOFF.md`** with:
   - Current version (if bumped)
   - Complete list of uncommitted changes (file-by-file)
   - "Last Session Completed" — what was done this session (replaces prior)
   - "Key Lesson" (if applicable)
   - "Next Priorities"
   - "AI Tool Used Last Session" (`YYYY-MM-DD — Tool (model)`)

2. **Request permission to commit & push** — ask Stan for permission/approval before executing the git commit and push command (do not commit/push silently).

3. **Do not narrate** the update — just do it silently

**Usage patterns:**
- Mid-session: "Update the handoff" → checkpoint progress
- Session end: "Update the handoff, we're done" → final state
- Crash recovery: Uncommitted HANDOFF.md shows last state

## Working Directory

The source of truth is always `/Users/stanleybaptista/Projects/orb/` (the **main directory**). All AI tools must read and write files there.

- **Direct-edit tools** (Gemini CLI, Antigravity) edit the main directory natively.
- **Worktree-based tools** (Claude Code Desktop) run in an isolated copy (`.claude/worktrees/<name>`). Before asking Stan to test, patch main:
  ```bash
  git diff > /tmp/orb-patch.patch && git -C /Users/stanleybaptista/Projects/orb apply /tmp/orb-patch.patch
  ```

**At commit time**, the AI runs the commit and push commands from the main directory, asking Stan for permission/approval through the tool execution prompt.

---

# Handoff File Conventions

The handoff is `/Users/stanleybaptista/Projects/orb/HANDOFF.md` — a single living file in the repo root, committed with each session's code changes.

It contains:
- App state (branch, dev server status)
- Last session completed work + uncommitted changes
- Key decisions
- Next priorities
- AI tool used last session

The version is not tracked in HANDOFF.md — `package.json` in the main directory is always canonical.

---

# Direct SQL Access (psql) — Stan only

`psql` is installed via `libpq` at `/opt/homebrew/opt/libpq/bin/psql`. It is used
for DDL migrations that the Supabase REST API cannot handle.

**Agents cannot run these.** `DATABASE_URL` lives only in the encrypted master
store and is never available in an agent shell. Do not construct commands that
read it from `.env.local` — that file no longer exists, and `orb-dev` refuses to
start while it does.

When an agent needs a migration applied, it writes the `.sql` file under
`scripts/migrations/` and gives Stan the command to run:

```bash
/opt/homebrew/opt/libpq/bin/psql "$DATABASE_URL" -f scripts/migrations/whatever.sql
```

Agents read database state with `orb-agent db health` instead.

---

# Multi-Platform Design

Orb targets three platforms:
- **Mac** — desktop/laptop, full viewport, keyboard + mouse/trackpad
- **iPad** — tablet, touch input, mid-sized viewport
- **iPhone** — mobile, touch input, narrow viewport

All three must provide a fully functional experience. When making design or implementation decisions, assume:

- **Ageing eyes** — text must be legible at a comfortable reading distance on all screen sizes. Avoid tiny fonts, low-contrast text, and dense layouts that require zooming.
- **Potential motor skill limitations** — interactive elements must have adequate hit targets (at least 44pt minimum per Apple HIG). Avoid interactions that require fine precision.
- **Touch-first on mobile** — hover-only interactions are unacceptable. All functionality must work via tap on iPad and iPhone.

Test design decisions across all three form factors. When in doubt, err on the side of larger, more spacious, and more forgiving layouts.

---

# UI Component Catalog

**Before building any UI, read `docs/ui-catalog.md`.** It documents every existing pattern — page layouts, buttons, tables, modals, form fields, nav bars, responsive rules, and z-index stack. Reuse existing patterns. If none fits, propose the new pattern to Stan before creating it. Never create parallel CSS classes for things that already have established patterns.

**UI Assembly Protocol — build with existing Legos first:** Identify the UI family before editing; find the canonical pattern in `docs/ui-catalog.md`; inspect at least one listed implementation file; reuse the documented classes and structure directly; do not create a parallel shell, wrapper, or CSS prefix when an established one exists; if two viable catalog patterns could apply, stop and ask Stan which model he wants; if no catalog pattern fits, say that may mean the catalog is incomplete, ask Stan whether he wants a new pattern added to the catalog, and only add it if he says yes; when the pattern changes, update `docs/ui-catalog.md` in the same change. For UI work, report the model used in the work summary, e.g. "Used `modal-center` modeled on `AddProductModal` and `TodoPanel`."

**When you add, rename, or remove a UI pattern**, update `docs/ui-catalog.md` in the same commit. New classes get a row in the relevant table. Renamed classes get updated. Removed/deprecated patterns get marked with **Status: Deprecated** or deleted. The catalog must stay in sync with `globals.css` — never leave it stale.

---

# Object Capability Matrix — Maintenance Rule

**File:** `docs/object-capability-matrix.md` — the standing audit of every domain object's surface (DB table, Orb conversational tool, `query_db` fallback, REST API, Settings UI, Help, Print, test coverage) plus a separate matrix for cross-cutting critical-path performance (login, dashboard load, voice start, etc.).

**Why this exists:** Built 2026-06-30 after Tickets was found to have create-only Orb access — no read, update, or delete tool — a gap that went unnoticed because CRUD coverage was being verified one object at a time instead of audited as a whole. The same failure mode applies beyond CRUD: a reported problem in one flow (e.g. login latency) is a signal to audit the whole class of flows, not a ticket to patch the one instance. See `[[project_systematic_quality_audits]]` in memory.

**Rule — extend the matrix as you build:**
- **New DB table, Orb tool, REST endpoint, or Settings page** → add/update the relevant row and cell in Part 1 (Object Capability Matrix) in the same change.
- **New critical user-facing flow, or a flow found to have a latency problem** → add/update the relevant row in Part 2 (Flow/Performance Matrix) in the same change. A single slow flow is grounds to audit related flows, not just fix the one reported.
- **Do not assume a blank cell is intentional.** If an object or flow has no coverage on some surface and the reason isn't already documented, ask Stan rather than guessing — record the answer in the matrix once given.
- Do not defer this to a later session, same as the UI catalog and eval suite rules above.

---

# Performance Instrumentation — Build Rule

Every new feature or meaningful behavior change must decide whether performance instrumentation is required before implementation. State the decision in the implementation plan or work summary.

Instrumentation is required when the change does any of the following:
- Adds or changes a user-clickable/tappable workflow, route transition, form submit, modal open/save/delete flow, bulk action, search/filter/sort/pagination path, voice interaction, login/auth step, or Settings page.
- Adds or changes initialization work on route load, dashboard mount, Settings mount, app shell/provider mount, or background startup.
- Adds a new server action, API route, Supabase query/RPC, model/TTS call, file/network request, or any sequential async chain that affects perceived user response.
- Adds platform-dependent behavior where Mac, iPad, and iPhone may differ in latency, rendering cost, touch handling, or network behavior.
- Touches an existing flow already listed in `docs/object-capability-matrix.md` Part 2 or `docs/orb-309-initialization-performance-plan.md`.
- Is reported by Stan as slow, sluggish, delayed, stuck, or slow to initialize.

Instrumentation is usually not required for copy-only changes, static documentation, purely visual CSS tweaks with no new interaction or loading path, type-only refactors, or dead-code deletion. If uncertain, instrument or explicitly ask Stan before building.

When instrumentation is required:
- Use the ORB-309 focus-area model (`auth`, `dashboard-init`, `dashboard-clicks`, `settings`, `voice`, `background`) rather than turning on every measurement indiscriminately.
- Capture platform dimensions for Mac, iPad, and iPhone analysis.
- Update `docs/object-capability-matrix.md` Part 2 when adding a new critical flow or changing performance coverage.
- Use existing Settings/UI catalog patterns for any performance telemetry UI; do not invent parallel tables, search controls, modals, or CSS.

---

# Known Gotchas

- **Dev server**: User-started only. The dev server runs on `0.0.0.0:3001` with `--experimental-https` so iPad and iPhone can reach it over the local network. No AI tool can replicate this setup. **Do not:** run `npm run dev`, call `preview_start`, kill processes on port 3001 (`lsof -ti :3001 | xargs kill`), or otherwise start/stop/restart the dev server. Assume it's running when Stan says it is; if you need it started, ask Stan.
- **Version:** `package.json` is canonical; `lib/version.ts` mirrors it. Both updated together on every bump.

---

# Production Releases & "What's New"

Before any production release or code push, you must document all changes in the "What's New" release documentation file.
- **File:** `/Users/stanleybaptista/Projects/orb/lib/changelog.ts`
- **Action:** Bump the patch version in both `package.json` and `lib/version.ts`, and add a new entry to the `CHANGELOG` array in `lib/changelog.ts` with the new version string, release date, and detailed bullet points describing the changes.
- **Eval gate:** Apply the risk-based production gate in the **Orb Eval Suite** section above. Full Tier 1 is required for shared/global prompt/context/model changes; serial tool inventory/schema changes run the serial-tool-contract plus smoke suites; localized conversation changes run their categories plus smoke; non-conversation releases record eval as not applicable.
- **Verification:** Ensure that clicking the "Update" button in the client forces a tab refresh and fetches the new server version cleanly.

---

# Multi-Agent Concurrency Protocol (two writable agents)

Two AI tools (currently Claude Code and Codex) may work in the main directory **at the same time**. This is governed by **`docs/multi-agent-concurrency-protocol.md`** — adopted 2026-07-02, binding, and the **single source of truth** for all concurrency rules (ceiling, `ACTIVE_WORK/` claim ledger, release bookkeeping, branch policy, arbitration, DB claims). Read that file before doing any write/mutating work when another agent may be active. Rules are deliberately not restated here — do not rely on memory or summaries; when in doubt, re-read the protocol doc.

---

# WIP & Multi-Agent Transition Protocol (Resilience to Usage Caps)

When working on complex tasks, an agent's usage limits may expire mid-session, leaving the workspace in an incomplete state. To prevent losing valuable context, design plans, and code drafts locked in the expired chat history, apply these mitigation strategies:

1. **Write a `WIP.md` at key milestones**:
   Immediately after aligning on a plan, designing an architecture, or completing a sub-task, write a brief `WIP.md` in the repository root detailing:
   - **Current status**: What has been implemented so far.
   - **Design decisions**: Crucial choices, API specifications, or database schema additions.
   - **Immediate next steps**: Exact instructions for the next agent to resume work.
   - Delete `WIP.md` only at the very end of the session when staging the final `HANDOFF.md` commit.

2. **Commit draft code to a local WIP branch**:
   If you have written significant uncommitted changes, you can stage and commit them to a local scratch branch (e.g., `wip/feature-name`) with a descriptive message. The incoming agent can inspect the branch diff to see exactly where you left off.

3. **Use Scratch Files for complex code drafts**:
   Save raw code drafts, research summaries, or temporary API responses in the `scripts/` or `scratch/` directory. Do not leave them only in the chat history.

---

# Database Health

Database health is a first-class concern. Problems do not announce themselves — they accumulate silently and surface as Supabase budget warnings or throttling. Two mandates apply at all times:

## 1. Design-Time Impact Analysis (mandatory before implementing any feature)

Before writing code for any feature that touches the database, answer these questions:

| Question | Why it matters |
|---|---|
| Does this add a new query pattern? | May need a new index |
| Does this use `postgres_changes` / Realtime? | WAL reader is always-on disk IO — avoid unless multi-user sync is genuinely needed |
| Does this write frequently (every render, every keystroke)? | High write frequency → dead tuple bloat → autovacuum pressure |
| Does this add a new table? | Needs RLS policies using `(SELECT auth.uid())` wrapper, not bare `auth.uid()` |
| Does this add a column queried in WHERE or JOIN? | May need an index |

**Rule:** If the answer to any of these is yes, explicitly state the DB impact in the implementation plan and include any required indexes or schema notes.

**Realtime rule:** `postgres_changes` subscriptions cause continuous WAL decoding. One subscription consumed 80% of all DB query time (1M WAL reads/day) on this project. Only use Realtime if the feature genuinely requires multi-device or multi-user live sync. For single-user views, `useVisibilityRefetch` (tab-focus refetch) is always sufficient and generates zero continuous DB load.

## 2. Periodic Health Review (run at the start of any session where DB changes are made)

Agents run the canonical inspection set through the broker:

```bash
orb-agent db health
```

It reports the same four checks the project has always used — sequential scan
audit, dead row bloat, top disk-reading queries, and the RLS initplan check —
against the read-only role.

**Flags:**

- any user table with `seq_tup_read` > 100k and low `idx_scan` needs an index;
- `dead_pct` > 20% on any table → ask Stan to run
  `VACUUM ANALYZE public.<table>;` (outside a transaction block);
- any query with `cache_hit_pct` < 95% or dominating `disk_blks`;
- **any** row from the RLS initplan check = a policy evaluating `auth.uid()`
  per row; rewrite it with `(SELECT auth.uid())`.

If the disk-read section reports UNAVAILABLE, the role was not granted
`extensions.pg_stat_statements`. That section is then **unmeasured, not clean** —
say so rather than reporting a pass, and ask Stan to run it from the master
credential if it matters.

### Supabase dashboard
- **Observability → Overview → Disk IO** — if > 50%, run the queries above before doing more work.
- **Observability → Query Performance** — sort by Time Consumed. Any non-Supabase-internal query taking > 5% of total time is worth investigating.

## Index conventions

| Pattern | When to use |
|---|---|
| `CREATE INDEX ON todos (product_id, status) WHERE deleted_at IS NULL` | Composite partial — for filtered queries with multiple WHERE clauses |
| `CREATE INDEX ON projects (created_by) WHERE deleted_at IS NULL` | FK columns used in RLS subqueries |
| `CREATE INDEX ON audit_log (user_id)` | FK columns used in RLS or JOIN |
| `CREATE INDEX ON audit_log (created_at DESC)` | ORDER BY columns in paginated views |

Name indexes descriptively: `idx_<table>_<columns>` or `idx_<table>_<columns>_<condition>`.

---

## Be an artist.

Every decision you make — a color, a spacing value, a word in an error message, the way a panel opens — is a brushstroke. The user may never notice any single one. But they will feel the whole.
