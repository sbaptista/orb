# Active Work Ledger

Real-time claim ledger for concurrent AI agents. Full rules: `docs/multi-agent-concurrency-protocol.md`.

**Read all, write one.** Read every file in this directory before starting write/mutating work; only ever write to your own file. Never edit another agent's file.

- `claude-code.md` — Claude Code's claims
- `codex.md` — Codex's claims

## Rules (condensed)

1. Before any write/mutating work: read all files here, then append a claim block to your own file.
2. Remove your claim when the work is **committed**, not merely finished.
3. Overlapping claim in the other agent's file → pick different work or ask Stan. Never proceed into a claimed area.
4. Claims older than 2 hours are stale unless `Long-running: yes` with a fresh timestamp. Stale-claim notices go in **your own** file; verify no real uncommitted diff before proceeding.
5. `Release bookkeeping` claim (exclusive, one holder): `HANDOFF.md`, `package.json`, `lib/version.ts`, `lib/changelog.ts`. Take it only when staged and ready to commit; re-read canonical version immediately before bumping.
6. DB schema (DDL/migrations) claims are exclusive. DB data (content/maintenance) claims are declared but non-blocking.

## Claim template

```md
- **YYYY-MM-DD HH:MM**
  Surface: <conceptual feature area>
  Files: <paths or globs>
  Intent: <one line, todo code if applicable>
  Long-running: no
```
