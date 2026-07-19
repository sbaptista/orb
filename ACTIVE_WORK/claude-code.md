# Claude Code — Active Claims

Written only by Claude Code. Rules: `docs/multi-agent-concurrency-protocol.md`.

## Active Claims

- **2026-07-19 (built, rollback-verified, awaiting Stan's commit approval — nothing committed since 3c3e008/v0.6.218)**
  Surface: ORB-325 Realtime voice — mutation-authorization hardening (transcription hint, multilingual confirmation fallback, confabulation-honesty fix) + batch todo mutations (ORB-342 convergence follow-up filed, not attempted). Bundled as v0.6.219.
  Files: app/actions/orb-converse.ts, app/api/orb-eval/route.ts, app/api/orb-realtime/session/route.ts, app/api/orb-realtime/turn/route.ts (propose_todo_batch), lib/hooks/useRealtimeVoiceSpike.ts (multi-proposal narration fix + batch dispatch), lib/orb-model/mutation-authorization.ts (semantic fallback), lib/orb-prompt.ts, lib/orb-realtime/types.ts, scripts/eval-cases.ts, scripts/migrations/20260719_realtime_batch_todo_mutations.sql (new, applied), docs/object-capability-matrix.md, docs/orb-325-realtime-voice-flow.md, package.json, lib/version.ts, lib/changelog.ts, HANDOFF.md
  Intent: (a) fixed executeToolBatch silently falling back to free-form narration when 2+ proposals exist in one turn (root cause of "delete test1/2/3" never announcing what was pending); (b) gave Realtime a genuine batch todo-mutation proposal (create/update/delete/move, matching serial's todo_action_transaction flexibility) using Realtime's own robust DB-backed proposal/confirm pattern — explicitly intended as the start of the canonical shared pattern per Stan, not a Realtime-only feature. ORB-342 tracks the fuller serial/Realtime convergence as a separate, larger design decision, not attempted now. Migration applied and rollback-verified live (mixed batch, uniform batch, replay, stale-item all-or-nothing rejection); test rows cleaned up.
  Long-running: no — done pending Stan's review; will close this claim once committed.
