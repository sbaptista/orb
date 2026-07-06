# Orb Eval CLI — Manual Selection Plan

Status: **implemented** (2026-07-06). Stan approved all three items (`--help`, `--list`, multi-select `--id`) plus skipping the version bump.
Date: 2026-07-06.
Related: ORB-271.

## Implementation notes

All three shipped in `scripts/orb-eval.ts`, plus the AGENTS.md Orb Eval Suite section updated in the same change. `--help` and `--list` verified directly (no dev server or network needed, no API cost); the unmatched-id error path was also verified directly (exits before any network call). A real multi-id run against the model was not executed by the AI — that's Stan's to run, per the standing rule.

## Problem

ORB-271: running the eval suite is costly (usage-wise) for AI tools to do on Stan's behalf, and Stan wants to run it manually himself. The todo floats a Settings → Development UI, then immediately notes the existing terminal interface may already be sufficient if it gains two things: a help system describing the params, and a way to select specific cases to run instead of whole suites.

Decision carried from the prior conversation turn: go with the terminal path, not a new Settings UI page. This plan is CLI-only.

## Research summary (current state, verified against source)

`scripts/orb-eval.ts` (542 lines) is the runner. It's mature — a June 2026 knowledge-repo entry documents a prior reliability fix (retry + backoff + cool-off delay for socket exhaustion under sustained sequential runs).

Current CLI surface, verified at `main()` (lines 347–354):
```ts
const args = process.argv.slice(2)
const tierFilter = args.includes('--tier') ? parseInt(args[args.indexOf('--tier') + 1]) : null
const idFilter = args.includes('--id') ? args[args.indexOf('--id') + 1] : null
```
- `--tier <1|2>` — filter to a tier.
- `--id <case-id>` — filter to exactly one case (exact string match against `EvalCase.id`).
- No `--help`. The top-of-file JSDoc comment (lines 2–15) documents usage but is never printed at runtime — it's source-only.
- No way to select more than one specific case without running a whole tier or the whole suite.

npm scripts (`package.json`): `eval`, `eval:t1`, `eval:t2` — all tier-level, no case-level convenience script.

AGENTS.md's "Orb Eval Suite" section already documents `npm run eval -- --id <case-id>` as the single-case invocation — this doc will need a matching update once multi-select ships, or it goes stale immediately (exactly the drift pattern from ORB-306/307 — the fix is to update the doc in the same change, not treat CLI behavior and its description as separately maintained).

## Proposed steps

1. **`--help` / `-h`**: print usage text and exit 0 before any network/env setup. Content = the existing header comment, upgraded from source-only to actual output, so the two can't drift (comment becomes the single source; `--help` reads/prints the same string, or the comment is replaced by a `USAGE` constant that both the header and `--help` reference).

2. **Multi-select `--id`**: accept a comma-separated list — `--id case-a,case-b,case-c`. Change:
   ```ts
   const idArg = args.includes('--id') ? args[args.indexOf('--id') + 1] : null
   const idFilters = idArg ? idArg.split(',').map(s => s.trim()).filter(Boolean) : null
   if (idFilters) cases = cases.filter(c => idFilters.includes(c.id))
   ```
   Also: if any requested ID doesn't match a known case, report which ones were unmatched (today, a typo in the single-id form just silently yields zero cases with a generic "no test cases match" — with multi-select that same typo would silently run fewer cases than intended without saying which one was wrong). Keeps `--tier` and `--id` composable exactly as today (both filters already AND together).

3. **`--list`** (new, optional — confirm you want it): print every case ID grouped by tier, so cases are discoverable without opening `eval-cases.ts` first. This is the practical prerequisite for "one-offs" — you need to know the IDs before you can select them. Cheap to add alongside `--help`.

4. **Update AGENTS.md's Orb Eval Suite section** in the same change to describe `--help`, `--list`, and multi-value `--id` — keeping the doc and the CLI behavior from silently diverging, per the lesson from ORB-306/307.

5. **`package.json`**: no new script strictly required — `--help`/`--list`/multi-`--id` all work through the existing `npm run eval -- <flags>` passthrough. Could add `"eval:list": "npx tsx scripts/orb-eval.ts --list"` as a convenience if useful; optional.

## Open question — version bump

This only touches a dev-only CLI script (`scripts/orb-eval.ts`) and a docs file — no app code, nothing a tester or production user ever sees or is affected by. Proposing to treat this like the Object Capability Matrix work earlier this session ("no version bump — documentation/process work only, no user-facing app change"), rather than bumping per the usual "every local change" rule. Flagging this explicitly rather than assuming, since that rule is phrased as "no exceptions."

## Verification plan

Not app UI — no browser/Mac/iPad/iPhone testing applies; this is a Node CLI tool.
- `npx tsc --noEmit` after the change.
- I can verify `--help` and `--list` myself directly (no network call, no dev server needed, no Anthropic API cost — they exit before touching either).
- I will NOT run a real `--id a,b` invocation myself, since that hits the model and costs usage — same standing rule as the rest of the eval suite. Stan verifies the actual multi-select filtering behavior when next running it.

## Approval

Not yet approved. Waiting on Stan's go-ahead before writing any code, and on the two open questions above (add `--list`? skip the version bump?).
