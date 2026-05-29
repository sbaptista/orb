## Comprehension Check — Answer all questions below verbatim before any other response:

1. Return the exact "version" string from `/Users/stanleybaptista/Projects/orb/package.json` (the main directory — always canonical). If you are running in a worktree or isolated environment, also report your local `package.json` version and note any difference.
2. What port does the dev server run on?
3. Where are resolution notes written and what else must be created when closing a todo?
4. What is the handoff naming convention?
5. Run git status and report whether there are any uncommitted changes.
6. What AI Role are you?
7. List every file from HANDOFF.md's "Uncommitted Changes" section that you re-read. Confirm all were loaded.
8. What is the release documentation protocol for production releases? (Repeat the rule verbatim)

**Instructions:**
- **Never build/implement changes without explicit permission/confirmation from Stan.**
- **Repeat verbatim the release documentation rule at the start of every session:** Before any code push/release, the agent must document all changes in `lib/changelog.ts` by adding a new `Release` entry with the bumped version, release date, and details of changes, and bump the patch version in both `package.json` and `lib/version.ts`.
- **Knowledge Repository Access:** The knowledgebase is stored in the database (`knowledge_repo` table). Always query it at the start of a task using the `SUPABASE_SECRET_KEY` (service role) to bypass Row Level Security (RLS) constraints. See the **Knowledge Repository Access** section below for connection details and query examples.
- Your first and only message before any tool use must be a numbered list answering all questions.
- After answering, read `HANDOFF.md`, then **re-read every file listed in the "Uncommitted Changes" section** (both modified and new) before using any tools or continuing. This prevents stale-context overwrites when multiple AI tools edit the same directory.
- **Before building any UI**, read `docs/ui-catalog.md`. Reuse existing patterns — do not create new components or CSS classes without checking the catalog first and getting Stan's approval for new patterns.
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

### Knowledge Repository (agents)

- **Research reads:** ALWAYS use the Service Role key (`SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` depending on the project's env naming) to query the knowledge repository.
- **RLS Warning:** Never use the publishable key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or anonymous key). RLS rules restrict public access, meaning you will either see an empty list `[]` or only a subset of entries. If you are seeing zero or very few entries, verify you have switched to the Service Role key to bypass RLS.
- **When closing a todo:** Search `knowledge_repo` for the same topic; supersede or link — don't assume old entries are still true (shared working rule #12).

---

# Knowledge Repository Access

The Knowledge Repo stores distilled lessons, decisions, and resolution notes across all projects in the database.

- **API URL:** `https://livwkbnkdlrbmzgythys.supabase.co`
- **Key:** `SUPABASE_SECRET_KEY` (service role) located in `/Users/stanleybaptista/Projects/orb/.env.local`
- **Rule:** Bypasses RLS to guarantee complete results. Never query using the publishable/anon key.

### Query all entries:
```bash
curl -s "https://livwkbnkdlrbmzgythys.supabase.co/rest/v1/knowledge_repo?select=*,projects(code,name)&order=created_at.desc" \
  -H "apikey: $(grep SUPABASE_SECRET_KEY /Users/stanleybaptista/Projects/orb/.env.local | cut -d= -f2)" \
  -H "Authorization: Bearer $(grep SUPABASE_SECRET_KEY /Users/stanleybaptista/Projects/orb/.env.local | cut -d= -f2)"
```

### Search by topic/keyword:
```bash
curl -s "https://livwkbnkdlrbmzgythys.supabase.co/rest/v1/knowledge_repo?or=(title.ilike.*<term>*,content.ilike.*<term>*)&select=id,title,created_at,content&order=created_at.desc" \
  -H "apikey: $(grep SUPABASE_SECRET_KEY /Users/stanleybaptista/Projects/orb/.env.local | cut -d= -f2)" \
  -H "Authorization: Bearer $(grep SUPABASE_SECRET_KEY /Users/stanleybaptista/Projects/orb/.env.local | cut -d= -f2)"
```

---

---

# Project

**Orb** — personal project backlog tracker (Next.js App Router, Supabase, Vercel, TypeScript, Tailwind v4). Used to manage backlogs across all Stan's projects, including Helm.

**GitHub:** `sbaptista/orb`
**Live:** `https://orb-eight-lake.vercel.app`
**Staging:** `https://orb-staging-azure.vercel.app`
**Product code:** `ORB`
**Dev port:** 3001
**Version:** `package.json` is canonical; `lib/version.ts` mirrors it for display (both updated together on each bump)

---

# Environments

Three environments, each with a distinct role:

| Environment | URL | Branch | Purpose |
|---|---|---|---|
| **Localhost** | `http://localhost:3001` | working tree | Fast iteration — hot reload, DEV panel, instant feedback. Where AI + Stan build. |
| **Staging** | `https://orb-staging-azure.vercel.app` | `staging` | Pre-production verification. Accessible from any device, anywhere. Test here before merging to main. |
| **Production** | `https://orb-eight-lake.vercel.app` | `main` | Live app used by alpha testers. Only receives code that passed staging. |

## Deployment workflow

1. AI commits changes on `main` locally
2. Push to `staging` branch: `git push origin main:staging`
3. Vercel auto-deploys to staging URL
4. Stan tests on any device (Mac, iPad, iPhone)
5. When satisfied, push to `main`: `git push origin main`
6. Vercel auto-deploys to production

**Rule:** Never push directly to `main` for production without testing on staging first, unless the change is trivially safe (docs, HANDOFF.md only, etc.).

---

# Versioning

**Bump protocol:** AI only bumps the patch (third node, e.g. `0.3.2` → `0.3.3`). Stan explicitly indicates when to bump minor or major.

Version bumps happen on every local change — no exceptions. `package.json` is the canonical source; `lib/version.ts` mirrors it for display. Both are updated together. `lib/version.ts` is a static `VERSION` string, not a dynamic import.

---

# Agent Integrity — Orb API Specifics

In addition to the shared integrity rules, these are specific to the Orb API:

**Known limitations:**
- PATCH accepts `product_code` to move a task between projects. The task gets a new `todo_number` in the target project.
- PATCH does not accept `todo_number` or `created_at` — these are immutable.
- DELETE is a soft delete (`deleted_at` timestamp). There is no hard delete.
- `closed_at` is managed automatically by the server based on `status`. Do not try to set it directly.

**Full spec:** `docs/api-spec.yaml` — consult before attempting unfamiliar operations.

---

# Orb Agent Contract

Orb's tool definitions and integrity rules live in `lib/orb-contract.ts`. This is the single source of truth for what Orb can and cannot do. When adding or changing Orb capabilities, update this file — the tool definitions in `app/actions/orb-converse.ts` are imported from it.

The REST API contract for external agents (curl, developer AIs) is in `docs/api-spec.yaml`. The two interfaces share the same data model but differ in authentication, addressing, and deletion behavior. See the spec's `x-orb-agent-contract` note for details.

Orb also has a `create_ticket` tool that silently logs bugs, suggestions, capability gaps, and workflow friction as todos in the `TICKETS` project. Review these on the Tickets project board when planning work.

---

# Anthropic API — Claude Conversational Orb

**Server action:** `app/actions/orb-converse.ts`
**Model:** `claude-sonnet-4-6`
**Tools:** `create_todo`, `query_todos`, `update_todo`, `delete_todo`
**Local key:** `ANTHROPIC_API_KEY` in `.env.local`
**Production key:** same value set in Vercel project env vars

**Safety:** Server-only key (never reaches browser), Supabase auth gate, 10 calls/min/user rate limit, Anthropic console spend cap, prompt caching on system prompt + backlog (5-min TTL).

**Cost:** ~$0.001–0.008 per call. Personal usage ~$1–5/month.

**DEV panel** (bottom-right, dev-only) has a dry-run toggle.

---

# Session Workflow

## At session start

1. **Read both files from the main directory:**
   - This file (`AGENTS.md`) → understand the system and shared conventions
   - `HANDOFF.md` → understand current state

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

# Direct SQL Access (psql)

`psql` is installed via `libpq` at `/opt/homebrew/opt/libpq/bin/psql`. Use it for DDL migrations (CREATE TABLE, ALTER TABLE, etc.) that the Supabase REST API cannot handle.

**Connection string:** stored in `.env.local` as `DATABASE_URL` (transaction pooler, port 6543).

## Run a migration

```bash
/opt/homebrew/opt/libpq/bin/psql "$(grep DATABASE_URL /Users/stanleybaptista/Projects/orb/.env.local | cut -d= -f2-)" -f scripts/migrations/whatever.sql
```

## Run ad-hoc SQL

```bash
/opt/homebrew/opt/libpq/bin/psql "$(grep DATABASE_URL /Users/stanleybaptista/Projects/orb/.env.local | cut -d= -f2-)" -c "SELECT ..."
```

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

**When you add, rename, or remove a UI pattern**, update `docs/ui-catalog.md` in the same commit. New classes get a row in the relevant table. Renamed classes get updated. Removed/deprecated patterns get marked with **Status: Deprecated** or deleted. The catalog must stay in sync with `globals.css` — never leave it stale.

---

# Known Gotchas

- **Dev server**: User-started only. No AI tool can start it — always blocked. Assume it's running when Stan says it is; if you need it, ask.
- **Version:** `package.json` is canonical; `lib/version.ts` mirrors it. Both updated together on every bump.

---

# Production Releases & "What's New"

Before any production release or code push, you must document all changes in the "What's New" release documentation file.
- **File:** `/Users/stanleybaptista/Projects/orb/lib/changelog.ts`
- **Action:** Bump the patch version in both `package.json` and `lib/version.ts`, and add a new entry to the `CHANGELOG` array in `lib/changelog.ts` with the new version string, release date, and detailed bullet points describing the changes.
- **Verification:** Ensure that clicking the "Update" button in the client forces a tab refresh and fetches the new server version cleanly.

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

Run the following canonical inspection queries before and after any migration or schema change. Takes under 2 minutes.

### Sequential scan audit (primary IO driver)
```bash
/opt/homebrew/opt/libpq/bin/psql "$(grep DATABASE_URL /Users/stanleybaptista/Projects/orb/.env.local | cut -d= -f2-)" -c "
SELECT relname AS table_name, seq_scan, seq_tup_read, idx_scan,
  CASE WHEN seq_scan = 0 THEN NULL ELSE round(seq_tup_read::numeric / seq_scan, 0) END AS avg_rows_per_scan
FROM pg_stat_user_tables WHERE seq_scan > 0
ORDER BY seq_tup_read DESC LIMIT 15;"
```
**Flag:** any user table with seq_tup_read > 100k and low idx_scan count needs an index.

### Dead row bloat
```bash
/opt/homebrew/opt/libpq/bin/psql "$(grep DATABASE_URL /Users/stanleybaptista/Projects/orb/.env.local | cut -d= -f2-)" -c "
SELECT relname, n_live_tup, n_dead_tup,
  CASE WHEN n_live_tup = 0 THEN NULL ELSE round(100.0 * n_dead_tup / n_live_tup, 1) END AS dead_pct,
  last_autovacuum, last_vacuum
FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 10;"
```
**Flag:** dead_pct > 20% on any table → run VACUUM ANALYZE public.<table>; (outside a transaction block).

### Top disk-reading queries
```bash
/opt/homebrew/opt/libpq/bin/psql "$(grep DATABASE_URL /Users/stanleybaptista/Projects/orb/.env.local | cut -d= -f2-)" -c "
SELECT round(total_exec_time::numeric,0) AS total_ms, calls,
  shared_blks_read AS disk_blks,
  round(100.0 * shared_blks_hit / NULLIF(shared_blks_hit+shared_blks_read,0),1) AS cache_hit_pct,
  left(query, 120) AS query_snippet
FROM extensions.pg_stat_statements
WHERE shared_blks_read > 0
ORDER BY shared_blks_read DESC LIMIT 10;"
```
**Flag:** any query with cache_hit_pct < 95% or disk_blks dominating the list.

### RLS initplan check (auth.uid() must always be wrapped in SELECT)
```bash
/opt/homebrew/opt/libpq/bin/psql "$(grep DATABASE_URL /Users/stanleybaptista/Projects/orb/.env.local | cut -d= -f2-)" -c "
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND ((qual ILIKE '%auth.uid()%' AND qual NOT ILIKE '%(select auth.uid()%')
    OR (with_check ILIKE '%auth.uid()%' AND with_check NOT ILIKE '%(select auth.uid()%'))
ORDER BY tablename, policyname;"
```
**Flag:** any result = a policy evaluating auth.uid() per-row. Rewrite with (SELECT auth.uid()).

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
