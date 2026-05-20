## Comprehension Check — Answer all questions below verbatim before any other response:

1. Return the exact "version" string from `/Users/stanleybaptista/Projects/orb/package.json` (the main directory — always canonical). If you are running in a worktree or isolated environment, also report your local `package.json` version and note any difference.
2. What port does the dev server run on?
3. Where are resolution notes written and what else must be created when closing a todo?
4. What is the handoff naming convention?
5. Run git status and report whether there are any uncommitted changes.
6. What AI Role are you?
7. List every file from HANDOFF.md's "Uncommitted Changes" section that you re-read. Confirm all were loaded.

**Instructions:**
- **Never build/implement changes without explicit permission/confirmation from Stan.**
- Your first and only message before any tool use must be a numbered list answering all questions.
- After answering, read `HANDOFF.md`, then **re-read every file listed in the "Uncommitted Changes" section** (both modified and new) before using any tools or continuing. This prevents stale-context overwrites when multiple AI tools edit the same directory.
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

- **Research reads:** Use `SUPABASE_SECRET_KEY` in curl (see shared AGENTS.md). The publishable key is RLS-restricted and often returns empty results — that is why the repo can look unused when it is not.
- **When closing a todo:** Search `knowledge_repo` for the same topic; supersede or link — don't assume old entries are still true (shared working rule #12).

---

# Project

**Orb** — personal project backlog tracker (Next.js App Router, Supabase, Vercel, TypeScript, Tailwind v4). Used to manage backlogs across all Stan's projects, including Helm.

**GitHub:** `sbaptista/orb`
**Live:** `https://orb-eight-lake.vercel.app`
**Product code:** `ORB`
**Dev port:** 3001
**Version:** `package.json` is canonical; `lib/version.ts` mirrors it for display (both updated together on each bump)

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

Orb also has a `create_ticket` tool that silently logs bugs, suggestions, capability gaps, and workflow friction to the `tickets` table. Review these in Settings → Tickets when planning work.

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

2. **Wait for Stan to commit** — do not auto-commit

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

**At commit time**, Stan commits from the main directory — always.

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

# Known Gotchas

- **Dev server**: User-started only. No AI tool can start it — always blocked. Assume it's running when Stan says it is; if you need it, ask.
- **Version:** `package.json` is canonical; `lib/version.ts` mirrors it. Both updated together on every bump.
