# ORB-374 WIP — AI-tool local-file security hardening

## Current status

The complete reviewed ORB-374 plan remains preserved in
`docs/orb-374-ai-tool-local-access-security-plan.md` and checkpoint commit
`8984117`. Stan deferred that broad program on 2026-08-04 and authorized only
the extracted **ORB-375 — Security Hardening Phase 1** scope: development launcher,
13-credential rotation, and filesystem isolation.

Tracked Phase 1 implementation is underway:

- `scripts/security/orb-dev` implements the fixed-purpose human launcher.
- `scripts/security/orb-secrets-seal` creates and verifies encrypted-at-rest
  environment storage without deleting the recoverable plaintext source.
- `next.config.ts` now accepts only the launcher-supplied current Bonjour host
  and IPv4 address instead of permanent subnet wildcards.
- `package.json` routes dev startup through launcher-provided TLS paths and adds
  `npm run test:security-launcher`.
- `docs/security-hardening-phase-1.md` records scope, rotation list, acceptance,
  and the remaining same-user runtime limitation.
- Stan created and verified the encrypted environment, removed both plaintext
  paths, passed `orb-dev --check`, and successfully loaded Orb through the
  launcher on Mac, iPhone, and iPad using localhost, Bonjour, and LAN IP.
- `orb-secrets-set VARIABLE_NAME` now supports one-at-a-time human rotations
  without recreating the complete plaintext environment on disk.
- Resend and Mistral replacement keys passed their development checks before
  revocation. Their Vercel updates, production checks, former-key revocation,
  and post-revocation checks remain pending. ElevenLabs rotation is paused
  while Stan decides whether to retire the deployed legacy adapter and monitor.

Shell syntax/helper tests and `npx tsc --noEmit` passed. No model eval is
applicable because no Orb-conversation surface changed. The current dev server
has not been restarted or disturbed.

## Design decisions

- Define the threat model and best practices before judging the current state.
- Separate verified evidence, inference, and untested assumptions throughout.
- Preserve multi-round AI review in an append-only Comments section with tool,
  model, date, time, and timezone on every review round.
- Keep a single document maintainer: other AIs send structured review comments
  to Stan, who passes them to Codex for attributed import and controlled edits.
- Imported Perplexity Round 1 (reviewed the 2026-08-03 17:54 HST draft),
  recorded 17 recommendations and dispositions, and updated the controlled
  plan at 2026-08-03 18:08 HST.
- Imported Claude Code Round 1 (reviewed the 2026-08-03 18:08 HST draft),
  preserved both external review packets under `docs/orb-374-reviews/`, and
  updated the controlled plan at 2026-08-03 18:31 HST.
- Imported Gemini Round 1 (reviewed the 2026-08-03 19:00 HST draft), preserved
  its complete packet at `docs/orb-374-reviews/gemini-r1.md`, and updated the
  controlled plan at 2026-08-03 19:13 HST.
- Imported Mistral Vibe Round 1 (reviewed the 2026-08-03 19:13 HST draft),
  preserved its complete packet at `docs/orb-374-reviews/mistral-vibe-r1.md`,
  and updated the controlled plan at 2026-08-03 19:29 HST. Its supplied 20:15
  HST timestamp and stale checkpoint-commit citation are preserved with notes.
- Claude's review exposed two Phase 1 structural blockers: shared instructions
  falsely attest to a Claude push gate that is absent in Orb, and mandatory
  curl/psql examples expand secrets into process arguments. The plan now
  requires artifact-tested controls and broker migration without breaking the
  backlog, Knowledge Repository, migration/health, or human-run eval workflows.
- Stan activated the interim restriction immediately. It is currently an
  operating rule, not a fully enforced technical boundary, and does not itself
  approve Phase 0 implementation.
- Claude completed the section 14.1 Knowledge Repository search through an
  approved-egress path: 276 entries searched, 51 matched, and none covers the
  core ORB-374 subject. The search/reconciliation leg is complete.
- The approved-plan Knowledge write must supersede short ID `fa737536` and link
  `99a3f5e1`, `8c3bfdf4`, `a6fd2877`, `18b4b90a`, and `2bd5f167`, resolving
  their full UUIDs before writing.
- Orb's own `query_repository` and `query_db` tools are now in scope. Source
  review verified deny-by-default reader controls and the database tool's
  allowlists, 200-row cap, regular-user RLS, and explicit admin bypass; Phase 2
  requires deterministic negative tests.
- The planned production read-only identity does not currently exist. It must
  be created through a migration with explicit grants and RLS tests, not an
  environment-only gate or existing key selection.
- Secret delivery is channel-neutral: argv is known unsafe, but environment,
  inherited child processes, stdin, logs, temporary files, and local sockets
  must each be tested rather than presumed safe.
- Tier B benchmarking now enforces the proposed memory cap and samples
  `vm_stat` and swap usage during cold Next.js compilation on the 16 GB Mac.
- Phase 0 rotation now requires an explicit consumer chain for every shared
  credential before revocation. Plan approval and decision 1 gate Phase 0;
  decisions 2–5 gate their applicable later phases.
- One Codex rendering event is verified for A-03; repetition and the exact
  local/provider retention planes for that output remain unverified. Do not
  search for real secret values to settle retention.
- Phase 0 must use a harmless-canary-tested, human-controlled secret delivery
  method and must test for silent/default/cached/legacy fallback after rotation.
- Tier A grants one exact worktree root per session. Secondary-worktree access
  substitutes a separately claimed root rather than broadening to both.
- The new read-only DB identity requires effective-privilege/role-escalation
  tests. Orb admin `query_db` access requires a durable audit event and must be
  structurally unreachable by non-admin users.
- Phase 3 creates the versioned isolation benchmark harness before the pilot;
  `scripts/security/benchmark-isolation.sh` is a proposed, not existing, path.
- Stan owns risk and tool-enable decisions; the assigned security maintainer
  performs each claimed installation/update delta audit and records its trigger.
- Until ORB-375 acceptance, normal AI development is stopped; only its exact
  controlled containment workflow is permitted.
- Do not begin implementation until Stan approves the planning document.
- After approval, persist the approved plan and pertinent review comments to
  the Knowledge Repository before implementation begins.
- Use a three-tier isolation model: restricted native workspace, disposable
  Linux development container, and disposable VM for the highest-risk work.
- Benchmark on the actual M5/10-core/16-GB Mac before selecting resource limits
  or making an isolation tier the normal workflow.
- Treat external media only as an encrypted storage/custody layer. Prefer an
  external USB4/Thunderbolt NVMe SSD for active VM/container disks; do not use
  HDD or SDXC as the active sandbox disk.
- Begin implementation with containment and credential rotation because secret
  values were rendered into an AI-tool transcript during the audit.

## Immediate next steps

1. ORB-374 is deferred and ORB-375 exists as the reduced implementation todo.
2. `orb-dev` and `orb-secrets-seal` are installed under `~/.local/bin`; external
   directories/files are owner-only and the broken repository symlink is gone.
3. Stan rotates the 13 credentials in their provider consoles, updates hosted
   consumers, and uses `orb-secrets-set` for each localhost replacement.
4. Coordinate `ORB_API_SECRET` with Helm's equal `TODOS_API_SECRET`; rotate
   VAPID as a key pair and renew browser push subscriptions on all platforms.
5. Update unsafe `.env.local` and inline-secret instructions in both Orb and
   shared `AGENTS.md`; the shared file is outside Codex's writable sandbox.
