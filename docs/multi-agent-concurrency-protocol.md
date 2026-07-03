# Multi-Agent Concurrency Protocol

**Status:** Adopted 2026-07-02 by Stan. Binding on all writable AI agents working in this repo.
**Amended 2026-07-02** (post-adoption polish, requested by Codex, approved by Stan): clarified claim-file commit semantics in §2 — claims are working-tree signals, not audit records.
**Origin:** `docs/multi-agent-concurrency-protocol-proposal.md` — drafted by Claude Code, refined to consensus with Codex, approved by Stan. Consult the proposal only for history/rationale.
**Single source of truth:** this file holds ALL concurrency rules. `AGENTS.md` ("Multi-Agent Concurrency Protocol") and `ACTIVE_WORK/README.md` are thin pointers to this file and deliberately restate nothing. Any change to the protocol is made **here only** — never introduce rule text, summaries, or templates in the pointer files, or they will drift.

This protocol lets two AI tools (currently Claude Code and Codex) work in the Orb main directory **at the same time** without corrupting each other's work. The goal is not to prevent all overlap — it is to make overlap visible early enough to avoid it.

---

## 1. Concurrency ceiling: 2 writable agents

- At most **2 writable agents** may work concurrently. A *writable* agent is one that edits repo files, runs evals, mutates DB state, or touches the dev server.
- **Read-only research/analysis agents do not count** against the ceiling and may run alongside freely.
- Do not add a third writable agent. The serialized lanes (release bookkeeping, dev server, DB migrations, Stan's verification bandwidth) mean a third agent reduces real throughput rather than adding it. Scaling past 2 requires real isolation — per-agent worktrees/branches, per-agent dev-server ports, and an explicit merge/release coordinator — which is future scope, not current practice.

## 2. Active Work Ledger — `ACTIVE_WORK/`

Root-level directory, tracked in git:

```text
ACTIVE_WORK/
  README.md        — thin pointer to this document (no rule text)
  claude-code.md   — Claude Code's claims only
  codex.md         — Codex's claims only
```

**Rule: read all, write one.** Every agent reads every file in `ACTIVE_WORK/` before starting write/mutating work, but only ever writes to its own file. Never edit another agent's file, for any reason. Real-time visibility comes from reading each other's files on disk — a claim is visible the instant it is written, committed or not.

**Before starting any write/mutating work:**

1. Read every file in `ACTIVE_WORK/`.
2. Append a claim block to your own file: timestamp, **Surface** (conceptual feature area — Orb features routinely span actions/components/CSS/docs/changelog, so file paths alone are not enough), **Files** (paths/globs), one-line **Intent**, and `Long-running: yes/no`.
3. Remove your claim block in the **same commit that completes the claimed work** (not just when finished in memory).

**Claim-file commit semantics:** claims are **real-time working-tree signals, not permanent audit records**. A claim normally exists only uncommitted while work is active — the other agent reads it from disk, so it never needs its own commit. The commit that completes the work removes the claim as part of that commit, leaving the agent's claim file back at `*(none)*` in committed state. If a long-running claim spans several small commits, intermediate commits may incidentally include the active claim — harmless, but not required or relied upon. Do **not** make separate claim/release commits; v1 deliberately keeps no audit history of claims (if that is ever wanted, it would require dedicated claim/release commits — not recommended).

**Claim block format:**

```md
- **2026-07-02 14:10**
  Surface: Knowledge Repo Orb tools
  Files: lib/orb-contract.ts, app/actions/orb-converse.ts, scripts/eval-cases.ts
  Intent: ORB-302 — add update_knowledge/delete_knowledge tools
  Long-running: no
```

**Overlap rule:** if another agent's file shows a claim overlapping the surface/files you want to touch, pick different work or ask Stan to arbitrate (§5). Do not proceed into a claimed area.

**Stale claims:** a claim older than **2 hours** is stale, unless marked `Long-running: yes` with a timestamp refreshed within the last 2 hours. On finding a stale claim:
- Do **not** delete or edit it — it lives in the other agent's file.
- Write a `Stale claim notice` entry in **your own** file.
- Confirm the claimed files have no actual uncommitted diff from the other agent (`git status` / `git diff` against what the claim describes) before proceeding.
- Mention the stale claim when reporting back to Stan.

## 3. Release Bookkeeping claim

`HANDOFF.md`, `package.json`, `lib/version.ts`, and `lib/changelog.ts` are touched by nearly every session regardless of feature area, so they get a dedicated exclusive claim type: `Release bookkeeping`. Only one agent may hold it at a time. Procedure for the holder:

1. Take the claim only once your feature work is staged and ready to commit.
2. Immediately before editing, re-read the canonical `package.json` version and run `git status --short` — never trust what you read at session start.
3. Bump the patch version from whatever is canonical *at that moment*, write the changelog entry, update `HANDOFF.md`, commit promptly, then release the claim.

Do not hold this claim while feature work is still in progress, and do not leave it held with an uncommitted working tree.

## 4. Branch policy

`main` stays the default working branch for both agents. A short-lived task branch is **required** (not optional) for high-risk work: DB migrations, broad refactors, dependency upgrades, generated/bulk rewrites, or any change expected to span more than one major feature area.

A branch alone does not solve same-directory collisions — both agents still share one checked-out working tree — so the Active Work Ledger claim is required either way. Branching and claiming are complementary, not substitutes.

## 5. Conflict arbitration

If you hit an overlapping claim and Stan isn't actively watching both sessions:

1. Pick different, non-overlapping work first.
2. If your task genuinely cannot proceed without the claimed area, stop before editing and leave a concise note for Stan. Do not wait indefinitely; do not guess at the other agent's intent.
3. The first agent's claim wins by default, unless it is stale under §2.

## 6. Dev server and eval suite — single consumer

Only one agent at a time may run the eval suite (`npm run eval:t1`/`t2`, via Stan per the existing rule that AI tools don't run evals themselves) or perform `.next`-affecting operations. Before requesting an eval run, check `ACTIVE_WORK/` for any claim implying active dev-server use. The existing gotchas still apply: never start/stop/restart the dev server, never `rm -rf .next` yourself.

## 7. Database claims: schema vs. data

- **DB schema** — DDL via `psql` (`scripts/migrations/*.sql`). Exclusive: requires a claim, blocks any overlapping claim, no concurrent schema work between agents.
- **DB data** — maintenance/content writes (merging duplicate todos, Knowledge Repo entries, etc.). Declare in the ledger when they touch shared task/knowledge state, but they do not block unrelated source work.

## 8. Commits stay small and frequent

Commit in smaller units tied to one claim at a time rather than one large end-of-session commit covering unrelated areas. This shortens the window a claim blocks the other agent and keeps the ledger honest.

---

## Relationship to existing session workflow

- `HANDOFF.md` remains the historical session-end record; `ACTIVE_WORK/` is the real-time signal. They do not replace each other.
- The session-start checklist gains one step: read every file in `ACTIVE_WORK/` (after `AGENTS.md` and `HANDOFF.md`) before doing any write/mutating work.
- All existing rules stand unchanged: no build without permission, no push without approval, version bump on every change, eval suite currency, UI catalog, capability matrix, and the WIP.md protocol for usage-cap resilience.
