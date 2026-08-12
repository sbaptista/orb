# Claude Code — Active Claims

Written only by Claude Code. Rules: `docs/multi-agent-concurrency-protocol.md`.

## Active Claims

- **2026-08-12**
  Surface: Non-admin macOS development-account migration plan — Round 1 review + hold
  Files: docs/orb-non-admin-development-account-plan.md, ACTIVE_WORK/claude-code.md
  Intent: Record the Claude Code Round 1 review packet in the plan and mark the plan On Hold at Stan's direction.
  Long-running: no

- **2026-08-12**
  Surface: Release bookkeeping
  Files: HANDOFF.md, package.json, lib/version.ts, lib/changelog.ts, ACTIVE_WORK/claude-code.md
  Intent: v0.6.292 — documentation-only release for the review packet and hold notice.
  Long-running: no

## Stale claim notices

- **2026-08-12 — stale claims in `ACTIVE_WORK/codex.md`**
  Codex holds four claims timestamped 2026-08-11 (12:24, 12:24, 12:54, 13:03 HST).
  The 12:54 claim (`docs/orb-non-admin-development-account-plan.md`) and the 13:03
  claim (Release bookkeeping) are both `Long-running: no` and are therefore stale
  under §2, and both overlap the surfaces claimed above.

  The §2 confirmation step does **not** pass cleanly: the claimed files do carry
  uncommitted diffs from Codex (`HANDOFF.md`, `package.json`, `lib/version.ts`,
  `lib/changelog.ts`, and the untracked plan document — Codex's v0.6.291 record,
  never committed). Proceeding anyway was Stan's explicit in-chat direction on
  2026-08-12, with edits deliberately constrained to be additive:

  - the plan document is appended to; existing sections 1–23 are unchanged apart
    from the Status line, which Stan directed be changed to On Hold;
  - `lib/changelog.ts` receives a **new** v0.6.292 entry above Codex's v0.6.291
    entry, which is left byte-for-byte intact;
  - `package.json` and `lib/version.ts` advance 0.6.291 → 0.6.292, so Codex's
    uncommitted v0.6.291 record still maps to exactly one release state;
  - `ACTIVE_WORK/codex.md` is not touched.

  Codex's stale claims were not deleted or edited. Reported to Stan in session.
