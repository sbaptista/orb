# Unified Orb interaction: handoff to Claude

**Status (2026-09-16): not production-ready.** Stan's latest authenticated voice test on v0.6.324 still did not create the requested project. The project also did not appear in Change Project. Do not treat the refresh work in v0.6.324 as a fix for this report: a missing database write cannot be repaired by list projection. Codex did not obtain the live proposal, event, batch, or receipt rows for this attempt, so the failure stage is unproven.

## Goal and decisions

Text and Realtime voice are intended to be capture/render adapters around one durable conversation, `orbConverse` agent kernel, tool inventory, mutation authorization, command-batch transaction, response artifact, interruption ordering, and presentation-recovery path. Slash commands are the intentional exception. A mutation request can only propose; approval must be a distinct later user event. A committed effect and receipt must survive interruption. `/clear` closes the current conversation and starts another. Server history is durable across devices; raw audio and hidden reasoning are not stored. Realtime renders exact supplied speech with tools disabled in normal sessions. Stan requested that the former Realtime agent tools remain available in source as dormant rollback assets. The public unified-mode flags were removed; plain `orb-dev` uses the shared path.

The architecture and acceptance criteria are in `docs/orb-unified-interaction-architecture-plan.md`. The diagram work preceded implementation and is not proof that the code obeys it.

## What Codex implemented

- Added `orb_conversations`, ordered `orb_conversation_events`, and per-client acknowledgements via `scripts/migrations/20260911_unified_orb_interactions.sql`; user reported its verifier all true. `lib/orb-interaction/conversation-store.ts` owns durable turns, history projection, interrupt/control events, response artifacts, and receipt recovery. `app/actions/orb-interaction.ts` exposes load, clear, acknowledgement, and interrupt actions.
- Added transactional ordered command batches through `scripts/migrations/20260912_orb_command_batches.sql`; user reported its verifier all true. One or many mutation calls are prepared, confirmed in a distinct turn, executed in one RPC, and returned as ordered receipts. `lib/orb-operations/command-batches.ts`, `command-batch-contract.ts`, and `confirmation.ts` implement the server side. The pending batch TTL was extended to 30 minutes for conversational detours.
- Routed typed input and trusted Realtime transcripts through `UnifiedDashboard.handleSubmit` → `orbConverse`. The Realtime session route is transport-only in normal use, and `useRealtimeVoiceSpike` captures trusted speech and renders the final response text. Legacy Realtime prompt/tool executor remains dormant in source, not exposed by a launcher flag.
- Added explicit spoken spelling context (for example, “T-E-S-T numeral one” → model-facing `TEST1`) while retaining the raw durable transcript. Added typo-tolerant bare confirmation handling and categorized eval cases.
- Added Silero-based acoustic checks for voice turns, shared interruption events, suppression of the specific benign no-active-response cancellation error, and response-ID-aware exact-speech checking. Partial transcripts are accepted only for a response marked interrupted; a completed mismatch remains an error.
- Removed the browser-only conversation fallback and passive locally generated status/project messages that could surface as ghost text. Updated the UI catalog, capability matrix, changelog, and deterministic interaction verifier.
- v0.6.324 added committed project rows (`newProject`/`newProjects`) to live and durable response artifacts, immediate project-list projection, and refresh-before-acknowledgement during startup recovery. This code passed static checks; it **did not resolve Stan's voice-create report**.

## Observed working behavior

- Stan reported the unified-interaction and command-batch SQL verifiers all true. These are schema/privilege checks, not end-to-end voice proof.
- Stan reported text project create and multi-project create/delete working in a prior test, including confirmation and immediate project-list refresh after subsequent fixes.
- Codex's TypeScript, deterministic `npm run verify:interaction`, changed-file ESLint (zero errors, existing warnings), UI-catalog verifier, handoff verifier, and `git diff --check` each passed once on v0.6.324. This is not authenticated runtime verification.

## Observed failures and open questions

1. **Critical: voice project create still fails in Stan's latest test.** Stan explicitly says no project was created on v0.6.324. The earlier v0.6.324 diagnosis concentrated on receipt-to-list propagation and was incomplete. Determine whether the trusted transcript reached `handleSubmit`, whether a durable `mutation_proposed` event and `orb_command_batches` row exist, whether the later confirmation transcript reached a *new* durable user event, whether `confirm_orb_command_batch` ran, and whether it returned a receipt or an error. Only then diagnose dropdown refresh.
2. Prior voice test: a request for spelled `TEST1` was heard/modelled as “test one”; an unrelated speaker interrupted the pending confirmation; “OK” led to repeated confirmation, and Realtime reported `Cancellation failed: no active response found`. The spelling, TTL, and cancellation-race code has not been shown by Stan to resolve the full scenario.
3. Prior voice interruption produced `Exact speech transcript mismatch` because a partial transcript was compared with the full planned speech. v0.6.323 changed matching by provider `response_id`; direct retest result is not established.
4. The read-only `orb-agent` broker returned `credential: INDETERMINATE` because the Supabase pooler hostname failed DNS resolution. This is not evidence of a bad credential or database state. Codex did not inspect live records, call direct CRUD, run model evals, or run an authenticated voice session.
5. The static `verify:interaction` checks structural helpers and history projection; they do not exercise microphone capture, streaming server actions, proposal persistence, SQL confirmation, receipt delivery, or actual project-list behavior. The two new `scripts/eval-cases.ts` cases are model-selection checks, not end-to-end voice tests. Stan's `orb-dev --eval-t1` and `orb-dev --eval-t2` gates remain outstanding for this uncommitted change set.

## Investigation starting point

Use one fresh, uniquely named test project in voice, preserving the exact transcript and visible Orb replies. Compare with the same sequence typed. Inspect the ordered conversation events, pending/executed batch, proposal rows, and project row for that name through authorized means. Instrument each boundary with the same `conversationId`, `turnId`, `userEventId`, batch/proposal ID, and receipt ID; do not log raw audio or hidden reasoning. In particular, inspect `components/UnifiedDashboard.tsx` (`voiceSendRef`, `handleSubmit`, `handleStop`, stream loop), `lib/hooks/useRealtimeVoiceSpike.ts` (trusted transcript/barge-in), `app/actions/orb-converse.ts` (proposal and early confirmation branches), `lib/orb-mutations.ts` (`getPendingMutation`), and both confirmation RPCs in the applied migration files. Verify that the server returns a committed receipt before Orb says “Created”. A list-only patch cannot establish that.

Keep the latest user report as the acceptance test: voice request → explicit proposal → later voice confirmation → actual database project row → immediate Change Project entry, without changing the selected project unless required. Repeat with typed confirmation of a voice proposal and voice confirmation of a typed proposal. Test interruption before proposal, before commit, and after commit. Report sample sizes honestly; do not call a single passing run a fix.

## Repository state at handoff

The local branch is `codex/voice-command-contract`. The change set is committed locally for Claude's inspection; no push was authorized. Stan owns production release. `docs/orb-381-model-cost-comparison-plan.md` is separate planning work and is included only because Stan asked to commit everything Codex had done. All Codex claims in `ACTIVE_WORK/codex.md` were removed for the handoff. Check current `git status`, commit, and live app version rather than assuming they match this document.
