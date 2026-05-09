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
5. **Every git push gets a version bump — no exceptions.**
6. **Handoff is written silently to `~/Downloads/`. No narration about the act of writing it.**
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

At session start, state which role you will perform:

| Role | Responsibilities |
|------|-----------------|
| **AI1** (Planner) | Collaborate on decisions, design architecture, propose solutions for approval, generate handoff files, maintain session activity log |
| **AI2** (Implementer) | Write code, execute approved plans, verify results |

One AI can perform both roles. If you are acting as both, state it explicitly.

---

# Localhost & Versioning

| Project | Localhost URL | Dev Port |
|---------|--------------|---------|
| Helm | `https://localhost:3000` | 3000 |
| Orb | `https://localhost:3001` | 3001 |

LAN access at `https://192.168.86.90:3001` — configured in `next.config.ts` `allowedDevOrigins`.

Version bumps happen continuously as changes are made locally. Git pushes happen only when Stan decides enough changes have accumulated for a release. The version in `package.json` is the canonical source; `lib/version.ts` mirrors it for display. Both files are updated together on each bump — `lib/version.ts` is a static `VERSION` string, not a dynamic import, so remember to update both.

**Bump protocol:** AI only bumps the patch (third node, e.g. `0.3.2→0.3.3`). Stan explicitly indicates when to bump minor (middle) or major (top) nodes.

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

Orb also has a `report_friction` tool that logs capability gaps and interaction friction to the `orb_friction` table. Review these observations when planning work.

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

# Handoff File Conventions

Handoff files live in `~/Downloads/` with naming pattern `orb-handoff-YYYYMMDD[N].md` where `[N]` is a letter suffix (a, b, c...). Find the latest:

```bash
ls ~/Downloads/orb-handoff-*.md
```

The handoff is the session onboarding document. It contains:
- 8 comprehension questions (AI must answer to prove it read the file)
- Current session completed work + uncommitted changes
- App state (version, branch, dev server status)
- Open backlog (fetch-live instruction — never list inline)

Everything else (rules, APIs, roles, localhost setup) is in this file (`AGENTS.md`). Do not duplicate it in the handoff.

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
