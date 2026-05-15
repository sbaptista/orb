## Comprehension Check — Answer all questions below verbatim before any other response:

1. Return the exact "version" string from `/Users/stanleybaptista/Projects/orb/package.json` (the main directory — always canonical). If you are running in a worktree or isolated environment, also report your local `package.json` version and note any difference.
2. What port does the dev server run on?
3. What is the ORB API base URL and how is it authenticated?
4. Where are resolution notes written and what else must be created when closing a todo?
5. What is the handoff naming convention?
6. Run git status and report whether there are any uncommitted changes.
7. What AI Role are you?

**Instructions:**
- Your first and only message before any tool use must be a numbered list answering all questions.
- After answering, read `HANDOFF.md` before using any tools or continuing.
- Do not summarize. Do not say "ready." Do not ask "what do you need?" Answer every question directly.
- If you cannot answer all accurately, do not proceed — say exactly which you're uncertain of.
- When providing git commands or terminal scripts to the user, ALWAYS concatenate them with `&&` (e.g., `git add -A && git commit -m "..." && git push`) rather than listing them on separate lines, as the user's terminal environment requires it.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project

**Orb** — personal project backlog tracker (Next.js App Router, Supabase, Vercel, TypeScript, Tailwind v4). Used to manage backlogs across all Stan's projects, including Helm.

**GitHub:** `sbaptista/orb`
**Live:** `https://orb-eight-lake.vercel.app`
**Version:** `package.json` is canonical; `lib/version.ts` mirrors it for display (both updated together on each bump)
**Dev port:** 3001

---

# Working Rules

0. **Never build without Stan's explicit go-ahead.**
1. **Plan first. Wait for confirmation. Then build.**
2. **Never propose a plan and immediately build in the same response.**
3. **Stan sets the pace.**
4. **Schema-first.** Query `information_schema.columns` before writing any insert code.
5. **Every local change gets a version bump — no exceptions.** Git pushes bundle several versions. The dev server always shows the current local version so Stan can confirm changes loaded.
6. **Handoff lives in the main directory as `HANDOFF.md`.** Updated silently — no narration about the act of writing it.
7. **Localhost-first development.** All implementation and testing on `localhost:3001`.
8. **Every new form field gets a deliberate label and placeholder text at build time — not deferred.**
9. **Closing a todo means writing `resolution_notes` AND creating a Knowledge Repo entry — always both.**
10. **Resolution notes and Knowledge Repo entries start with a timestamp followed by the AI tool and model used — e.g. `2026-05-08 — OpenCode (big-pickle)`. Then the notes themselves.**

---

# Agent Integrity Rules

These rules are non-negotiable. They override convenience, speed, and user-pleasing instincts.

1. **Never fabricate success.** If you call an API and the response does not confirm the action succeeded, say so. If you are unsure whether an endpoint supports a field or operation, check `docs/api-spec.yaml` or read the route handler before attempting it. Guessing and reporting success is the worst possible behavior.

2. **Say what you cannot do.** If the user asks for something the API does not support, say "the API doesn't support that" and suggest the workaround. Never silently skip the action or pretend it happened.

3. **Verify after mutating.** After any POST, PATCH, or DELETE, read the response body. Confirm the fields you intended to change actually changed. If the response doesn't include the field you tried to set, that field is not supported — report it.

4. **Consult the spec first.** The canonical API capabilities are in `docs/api-spec.yaml`. Read it before attempting an operation you haven't done before in this session. The curl examples below are shortcuts, not the source of truth.

5. **Known limitations** (keep this list current):
   - PATCH does not accept `product_code` — you cannot move a task between products. Workaround: POST a new task in the target product, then DELETE the original.
   - PATCH does not accept `todo_number` or `created_at` — these are immutable.
   - DELETE is a soft delete (`deleted_at` timestamp). There is no hard delete.
   - `closed_at` is managed automatically by the server based on `status`. Do not try to set it directly.

---

# AI Roles

**Default model:** One integrated tool performs **both AI1 (planning/architecture) and AI2 (implementation)**. This is the most efficient workflow—no handoff friction, no copy-paste, no context loss.

## When using a single integrated tool

**Integrated tools (can do both roles):**
- Claude Code
- Gemini CLI / Gemini Code Assist
- Antigravity (when stable)
- Perplexity Computer (cost-prohibitive for regular use)

**At session start, state:**
> "Acting as AI1+AI2 (both roles)"

**Workflow:**
1. Plan → get approval → implement → test → commit
2. Update HANDOFF.md at session end
3. No role-switching, no intermediate handoffs

## When forced to split roles

**Split only when:**
- All integrated tools are throttled/unavailable
- Task is purely research/design with no immediate implementation
- Browser-only AI is the only available option

**AI1-only tools (planning/architecture/research):**
- Browser Perplexity
- ChatGPT web
- Any browser-based AI without filesystem/IDE integration

**Pattern when split:**
1. **AI1** writes plan + architecture into HANDOFF.md under new section:
   ```
   ## Approved Plan (for AI2)
   [detailed implementation plan]
   ```
2. **AI2** reads HANDOFF.md, implements plan, removes plan section when complete, updates HANDOFF.md
3. Both note in HANDOFF: `Reason for split: [tool limitation | all integrated tools throttled]`

**Never split by choice.** Splitting is a fallback, not the norm.

## Tag-team rotation strategy

**Primary tools (use until limits):**
- **Claude Code** — complex architecture, multi-file refactors, production-quality work
- **Gemini (Pro/Ultra)** — simpler tasks, rapid prototyping, large-context analysis, research + code generation

**Switch by difficulty tier (usage conservation):**
- Gemini for: straightforward features, bug fixes, refactors, prototyping
- Claude Code for: complex architecture, cross-file consistency, gnarly edge cases
- Both do AI1+AI2; switching is by task complexity, not role

**AI1-only fallback (rare):**
- Browser Perplexity — when all integrated tools are throttled AND task is research/planning with no immediate coding
- Pattern: Perplexity writes plan into HANDOFF.md → Claude Code/Gemini implements next session

**Perplexity Computer:** Technically capable (AI1+AI2), but cost-prohibitive for regular rotation.

# Session Workflow

## At session start

1. **Read both files from the main directory:**
   - `/Users/stanleybaptista/Projects/orb/AGENTS.md` → understand the system
   - `/Users/stanleybaptista/Projects/orb/HANDOFF.md` → understand current state

2. **Answer the comprehension check** (already at top of AGENTS.md)

3. **Declare role:** `"Acting as AI1+AI2 (both roles)"`

4. **Optional: Fetch live backlog** (see HANDOFF.md for curl command)

5. **Work:** Plan → approve → implement → test

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

---

# Localhost & Versioning

| Project | Localhost URL | Dev Port |
|---------|--------------|---------|
| Helm | `https://localhost:3000` | 3000 |
| Orb | `https://localhost:3001` | 3001 |

LAN access at `https://192.168.86.90:3001` — configured in `next.config.ts` `allowedDevOrigins`.

Version bumps happen on every local change — no exceptions. Git pushes only happen when Stan decides enough changes have accumulated for a release, so they naturally bundle several versions. The version in `package.json` is the canonical source; `lib/version.ts` mirrors it for display (both updated together on each bump). `lib/version.ts` is a static `VERSION` string, not a dynamic import, so remember to update both files.

**Bump protocol:** AI only bumps the patch (third node, e.g. `0.3.2→0.3.3`). Stan explicitly indicates when to bump minor (middle) or major (top) nodes.

## Working Directory

The source of truth is always `/Users/stanleybaptista/Projects/orb/` (the **main directory**). All AI tools — regardless of how they operate — must read and write files there.

- **Direct-edit tools** (Gemini CLI, Antigravity) edit the main directory natively. No extra steps needed.
- **Worktree-based tools** (Claude Code Desktop) run in an isolated copy (`.claude/worktrees/<name>`). Files there may be behind the main directory. Before asking Stan to test, patch main:
  ```bash
  git diff > /tmp/orb-patch.patch && git -C /Users/stanleybaptista/Projects/orb apply /tmp/orb-patch.patch
  ```

**At commit time**, Stan commits from the main directory — always.

---

# Git Production Pushes

```
git add -A && git commit -m "feat: description of changes" && git push
```

Before committing, review what `git add -A` would stage — run `git status` and `git diff --cached` first to catch any unintended files.

---

# Orb Agent Contract

Orb's tool definitions and integrity rules live in `lib/orb-contract.ts`. This is the single source of truth for what Orb can and cannot do. When adding or changing Orb capabilities, update this file — the tool definitions in `app/actions/orb-converse.ts` are imported from it.

The REST API contract for external agents (curl, developer AIs) is in `docs/api-spec.yaml`. The two interfaces share the same data model but differ in authentication, addressing, and deletion behavior. See the spec's `x-orb-agent-contract` note for details.

Orb also has a `create_ticket` tool that silently logs bugs, suggestions, capability gaps, and workflow friction to the `tickets` table. Review these in Settings → Tickets when planning work.

---

# ORB API — AI Access

Stan's todo backlog is queryable and writable during any session. Use this proactively:
- Fetch open todos at the start of a session to understand what's pending
- Post new todos as they come up during work without waiting for Stan to ask

**Base URL:** `https://orb-eight-lake.vercel.app`  
**Auth header:** `Authorization: <secret>`  
**Secret:** stored in `.env.local` as `ORB_API_SECRET` — read it with Bash if needed  
**Kill switch:** `ORB_API_ENABLED` must be `true` (it is)  
**Full spec:** `docs/api-spec.yaml` — consult before attempting unfamiliar operations

## Network Access

The curl examples below require outbound DNS resolution to `orb-eight-lake.vercel.app` (ORB API) and `livwkbnkdlrbmzgythys.supabase.co` (Supabase REST). Terminal-based AI tools (e.g. Claude Code) running natively on Stan's machine have full network access and can use these directly.

**Sandboxed AI environments** (e.g. Gemini Antigravity, or any tool that cannot resolve external hosts) cannot execute these calls. If you cannot reach the API:
1. **Try a test call first** — `curl -s "https://orb-eight-lake.vercel.app/api/tasks?product=ORB"` — if it fails with a DNS or connection error, you are sandboxed.
2. **Fall back to providing content** — write the resolution notes and knowledge repo entry text in your response. Stan can close the todo manually via the Orb conversational interface or terminal.
3. **Do not attempt localhost** — the dev server on `localhost:3001` is user-started and must not be restarted or relied upon as an API endpoint.

## Fetch todos for a product

```bash
curl -s "https://orb-eight-lake.vercel.app/api/tasks?product=HELM" \
  -H "Authorization: $(grep ORB_API_SECRET /Users/stanleybaptista/Projects/orb/.env.local | cut -d= -f2)"
```

Replace `HELM` with `ORB` for this project's backlog. Product codes are case-insensitive.

## Post a new todo

```bash
curl -s -X POST "https://orb-eight-lake.vercel.app/api/tasks" \
  -H "Authorization: $(grep ORB_API_SECRET /Users/stanleybaptista/Projects/orb/.env.local | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"product_code":"HELM","title":"Your title here","description":"Optional","priority_value":1}'
```

`priority_value` is optional. Omit it if unknown. Title and product_code are required.

## Update a todo

```bash
curl -s -X PATCH "https://orb-eight-lake.vercel.app/api/tasks/<id>" \
  -H "Authorization: $(grep ORB_API_SECRET /Users/stanleybaptista/Projects/orb/.env.local | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated title",
    "status": "done",
    "priority_value": 2,
    "resolution_notes": "Describe what was done to fix it — populate when closing a todo, not before.",
    "urls": "https://example.com\nhttps://example2.com"
  }'
```

All fields are optional. `urls` accepts either a JSON array or a newline-separated string. `resolution_notes` is for post-fix documentation — what was done, not what needs doing.

**Cannot update:** `product_code`, `todo_number`, `created_at`, `closed_at`. See spec for details.

## Delete a todo

```bash
curl -s -X DELETE "https://orb-eight-lake.vercel.app/api/tasks/<id>" \
  -H "Authorization: $(grep ORB_API_SECRET /Users/stanleybaptista/Projects/orb/.env.local | cut -d= -f2)"
```

Soft delete — sets `deleted_at`, does not destroy the row.

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

# Knowledge Repository

The `knowledge_repo` table stores distilled lessons, decisions, and resolution notes from closed todos. Use the Supabase REST API directly (the ORB API does not expose knowledge endpoints).

**Supabase URL:** `https://livwkbnkdlrbmzgythys.supabase.co`
**Service role key:** stored in `.env.local` as `SUPABASE_SECRET_KEY` — use as `apikey` header for write operations (bypasses RLS). For read-only, use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Read knowledge entries

```bash
curl -s "https://livwkbnkdlrbmzgythys.supabase.co/rest/v1/knowledge_repo?select=*,projects(code,name)&order=created_at.desc" \
  -H "apikey: $(grep NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY /Users/stanleybaptista/Projects/orb/.env.local | cut -d= -f2)"
```

Filter by product:
```bash
curl -s "https://livwkbnkdlrbmzgythys.supabase.co/rest/v1/knowledge_repo?product_id=eq.<uuid>&select=title,content,created_at&order=created_at.desc" \
  -H "apikey: $(grep NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY /Users/stanleybaptista/Projects/orb/.env.local | cut -d= -f2)"
```

## Write a knowledge entry

```bash
curl -s -X POST "https://livwkbnkdlrbmzgythys.supabase.co/rest/v1/knowledge_repo" \
  -H "apikey: $(grep SUPABASE_SECRET_KEY /Users/stanleybaptista/Projects/orb/.env.local | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "product_id": "<uuid>",
    "origin_todo_id": "<uuid or null>",
    "title": "Short insight title",
    "content": "Full distilled lesson or decision"
  }'
```

Product IDs are in the `projects` table. Query them:
```bash
curl -s "https://livwkbnkdlrbmzgythys.supabase.co/rest/v1/projects?select=id,name,code" \
  -H "apikey: $(grep NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY /Users/stanleybaptista/Projects/orb/.env.local | cut -d= -f2)"
```

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

# Handoff File Conventions

The handoff is `/Users/stanleybaptista/Projects/orb/HANDOFF.md` — a single living file in the repo root, committed with each session's code changes.

It contains:
- App state (branch, dev server status)
- Last session completed work + uncommitted changes
- Key decisions
- Next priorities
- AI tool used last session

The version is not tracked in HANDOFF.md — `package.json` in the main directory is always canonical. Everything else (rules, APIs, roles, localhost setup) is in this file (`AGENTS.md`). Do not duplicate it in the handoff.

---

# Multi-Platform Design

Orb targets three platforms:
- **Mac** — desktop/laptop, full viewport, keyboard + mouse/trackpad
- **iPad** — tablet, touch input, mid-sized viewport
- **iPhone** — mobile, touch input, narrow viewport

All three must provide a fully functional experience. The product uses responsive techniques (CSS media queries, flexible layouts, touch-friendly hit targets). When making design or implementation decisions, assume:

- **Ageing eyes** — text must be legible at a comfortable reading distance on all screen sizes. Avoid tiny fonts, low-contrast text, and dense layouts that require zooming.
- **Potential motor skill limitations** — interactive elements (buttons, links, form controls) must have adequate hit targets (at least 44pt minimum per Apple HIG). Avoid interactions that require fine precision, multi-tap sequences, or rapid repeated gestures.
- **Touch-first on mobile** — hover-only interactions are unacceptable. All functionality must work via tap on iPad and iPhone.

Test design decisions across all three form factors. When in doubt, err on the side of larger, more spacious, and more forgiving layouts.
