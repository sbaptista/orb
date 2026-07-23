# Codex — Active Claims

Written only by Codex. Rules: `docs/multi-agent-concurrency-protocol.md`.

## Active Claims

- **2026-07-21 22:32 HST**
  Surface: Zero-project Orb conversation and Realtime voice
  Files: components/UnifiedDashboard.tsx, scripts/eval-cases.ts, app/api/orb-eval/route.ts
  Intent: ORB-356 — allow text and voice conversation before a project exists while preserving project-specific mutation guards
  Long-running: no

- **2026-07-21 23:01 HST**
  Surface: Todo category UI deferral
  Files: components/TodoEditor.tsx, components/UnifiedDashboard.tsx, docs/ui-catalog.md, docs/object-capability-matrix.md
  Intent: Hide project categories from new/edit todo modals and remove their unused dashboard initialization fetch
  Long-running: no

- **2026-07-21 23:29 HST**
  Surface: Orb conversational intent routing
  Files: lib/orb-prompt.ts, docs/api-spec.yaml, lib/orb-contract.ts, scripts/eval-cases.ts
  Intent: Make exact-title knowledge corrections, vague knowledge references, and explicit developer relays deterministic after the Tier 1 regression run, including the canonical generated tool contract
  Long-running: no

- **2026-07-21 23:29 HST**
  Surface: Release bookkeeping
  Files: HANDOFF.md, package.json, lib/version.ts, lib/changelog.ts
  Intent: Record the Tier 1 routing repair as v0.6.227 and preserve the 72/75 verification result pending focused rerun
  Long-running: no

- **2026-07-21 23:35 HST**
  Surface: ORB-356 closure and Knowledge Repository
  Files: DB data — todos, knowledge_repo
  Intent: Close ORB-356 with verified zero-project text/Realtime behavior and reconcile durable knowledge for the same topic
  Long-running: no
