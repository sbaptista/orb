# ORB-325 Realtime Voice: End-to-End Code Flow

**Code snapshot:** v0.6.212, 2026-07-17
**Surface:** local DEV "Realtime voice spike," not the production/main Orb voice button (still allowlist-gated).
**Purpose:** code-reading map for the **provider-owned** turn-taking architecture.

> This supersedes the earlier (v0.6.210) version of this doc, which described a client-side manual turn/response state machine. That design was removed: it disabled the provider's own turn-taking and hand-rolled `response.create`/`response.cancel` from transcription events, which inevitably raced the provider's one-active-response rule and crashed the session (`response_cancel_not_active`, `conversation_already_has_active_response`). The current design lets the provider own turn-taking and interruption.

## 1. Two voice systems exist

1. **Main/legacy voice** — the normal Orb control; `handleOrbTap` in [`components/UnifiedDashboard.tsx`](../components/UnifiedDashboard.tsx#L649) → [`lib/hooks/useVoiceMode.ts`](../lib/hooks/useVoiceMode.ts). Still the production path.
2. **Realtime DEV spike** — the DEV panel button; `useRealtimeVoiceSpike` in [`lib/hooks/useRealtimeVoiceSpike.ts`](../lib/hooks/useRealtimeVoiceSpike.ts). OpenAI Realtime over WebRTC. The ORB-325 acceptance surface, and the decided long-term destination (replacement) once gates pass.

Starting either stops the other.

## 2. The core principle

**The provider owns turn-taking and interruption. The client never sends `response.cancel`, and never sends `response.create` for a user turn — except the single continuation after a tool result.**

Session config — [`app/api/orb-realtime/session/route.ts`](../app/api/orb-realtime/session/route.ts):
```ts
turn_detection: {
  type: 'server_vad',
  threshold: 0.65,          // volume gate for what counts as speech
  prefix_padding_ms: 300,
  silence_duration_ms: 450, // silence before a turn is considered ended
  create_response: false,   // provider does NOT auto-create (avoids empty responses
                            // created before the input item is in context)
  interrupt_response: true, // provider truncates its own audio on barge-in
}
```

- `interrupt_response: true` → the client never cancels; the provider truncates. Eliminates `response_cancel_not_active`.
- `create_response: false` → the provider doesn't auto-respond too early (which produced empty/lost responses). The **client** creates the response once the transcript is in context.
- No greeting: the data channel opens straight into `listening`.

## 3. The three (and only three) `response.create` sites

All guarded against `responseInFlightRef` — the provider allows exactly one active response, so we never create a second:

1. **On transcript** — `conversation.item.input_audio_transcription.completed` for the current turn: create the response now that the audio item + transcript are in context. If a response is still running, set `pendingCreateTurnRef` and defer.
2. **Deferred** — on a running response's `response.done`, if `pendingCreateTurnRef` matches the current turn, create it now.
3. **Tool continuation** — `executeToolBatch` sends exactly one `response.create` after all tool calls in a response have produced their `function_call_output`s.

There are **zero** `response.cancel` sends.

## 4. Parallel tool calls

A single `response.done` can carry several function calls (e.g. `client_action` + `get_task_count`, or three parallel `propose_delete_todo` calls from "delete test1, test2, test3"). `executeToolBatch`:
- runs every call via `executeToolCall` (each sends only its `function_call_output`),
- then sends **one** continuation `response.create` — forcing **every** canonical `spokenText` produced this turn verbatim, one after another (`tool_choice:'none'`, `tools:[]`), or a plain create the model synthesizes only when none produced canonical text.

Creating one `response.create` per tool (the pre-fix behavior) collided → `conversation_already_has_active_response`. A later bug (fixed 2026-07-19): the verbatim-forcing only applied when *exactly one* tool produced canonical text, so 2+ simultaneous proposals silently fell back to free-form narration and never told the user what was actually pending — see [`propose_todo_batch`](#7-mutation-safety-unchanged-still-strong) below for the complementary fix (giving the model one batch tool to call instead of N parallel singular ones in the first place).

## 5. Status model (truthful, audio-driven)

`off → connecting → listening → thinking → speaking → …`

| Event | Effect |
|---|---|
| data channel open | `listening` (no greeting) |
| `input_audio_buffer.speech_started` | new turn (`activeTurnId++`), abort in-flight tools, `listening`. Provider truncates its own audio. |
| `input_audio_transcription.completed` | show user transcript; `thinking`; create (or defer) the response |
| `response.created` | `responseInFlight = true` |
| `output_audio_buffer.started` | `speaking` (real audio start) |
| `output_audio_buffer.stopped` | `listening` (real audio end — **not** `response.done`) |
| `output_audio_buffer.cleared` | audio truncated by barge-in |
| `response.done` (calls) | run `executeToolBatch` |
| `response.done` (no calls) | settle turn; fire any deferred create |
| `error` | `stop('realtime_error')` + surface message |

Status is driven by the provider's `output_audio_buffer.*` events, so `speaking` reflects real playback, not the (earlier) `response.done`.

## 6. Runtime file map

| File | Responsibility |
|---|---|
| [`components/OrbDevPanel.tsx`](../components/OrbDevPanel.tsx) | DEV Start/Stop button + "Copy Realtime trace". |
| [`components/UnifiedDashboard.tsx`](../components/UnifiedDashboard.tsx) | Instantiates the hook; appends transcripts; refreshes after mutations; executes verified client actions; owns the DEV toggle + copy-trace callbacks. |
| [`lib/hooks/useRealtimeVoiceSpike.ts`](../lib/hooks/useRealtimeVoiceSpike.ts) | WebRTC peer/mic/audio/data channel; provider event handling; status; turn ids; the three guarded `response.create` sites; tool dispatch + batching; connection-generation/abort lifecycle; the always-on DEV trace. |
| [`lib/voice/silero-shadow.ts`](../lib/voice/silero-shadow.ts) | Self-hosted Silero V5 on the same mic stream. **Advisory telemetry only** — gates nothing. (`shouldSuppressPlaybackCoupledTurn` remains exported but is no longer used.) |
| [`app/api/orb-realtime/session/route.ts`](../app/api/orb-realtime/session/route.ts) | Auth + allowlist; session prompt/audio/VAD/tool contract; SDP exchange with OpenAI. |
| [`app/api/orb-realtime/turn/route.ts`](../app/api/orb-realtime/turn/route.ts) | Authenticates every tool call; reads live facts; builds proposals (including `propose_todo_batch`, 2026-07-19); enforces authorization grammar; invokes transactional confirmation RPCs; returns fact packets / proposals / receipts / client actions. |
| [`scripts/migrations/20260713_*`, `20260714_*`, `20260716_*`](../scripts/migrations/) | `orb_realtime_proposals` + the transactional `confirm_realtime_*` RPCs for todo/project/knowledge mutations. Applied. |
| [`scripts/migrations/20260719_realtime_batch_todo_mutations.sql`](../scripts/migrations/20260719_realtime_batch_todo_mutations.sql) | Adds `batch_todo_action` to the `orb_realtime_proposals` kind CHECK, the `confirm_realtime_batch_todo_mutation` RPC (create/update/delete/move, all-or-nothing, one audit row per operation, one combined receipt), and routes it through `confirm_realtime_mutation`. Applied and rollback-verified. |

## 7. Mutation safety (unchanged, still strong)

The DB is the commit boundary. A proposal is persisted before it is returned to the model; confirmation runs one transactional RPC that locks the proposal + target, stale-checks the row, writes one domain change + one audit event, stores a canonical receipt, and replays it on re-confirm. The model cannot authorize its own proposal — `confirm_todo_mutation` re-checks the actual current utterance via the shared grammar in [`lib/orb-model/mutation-authorization.ts`](../lib/orb-model/mutation-authorization.ts). Identity resolves to a row id, never free text; ambiguity fails closed.

**Batch todo mutations (2026-07-19):** when the user names 2+ todos for the same or related create/update/delete/move, the model calls `propose_todo_batch` once instead of N parallel singular proposals. The route resolves every operation sequentially and fails the whole batch closed on the first unresolvable reference or stale row — nothing is written and no proposal row is even inserted until every operation resolves cleanly. Confirmation runs `confirm_realtime_batch_todo_mutation` — one transaction, one row-lock per target, one audit event per operation, one combined replay-safe receipt (a compact "Deleted 3 todos in X." when every operation shares an action and project, an itemized sentence otherwise). Closing is deliberately excluded from batches — same scope as serial's `todo_action_transaction` — since it requires resolution notes and a knowledge entry per todo. This is intended as the start of a canonical shared proposal pattern for both engines; see ORB-342 for the fuller serial/Realtime convergence.

## 8. Diagnostics

An always-on (DEV, independent of the perf toggle) lifecycle trace in the hook records the ordered event/status timeline — event types, status transitions, `response.done calls=N turn=X active=Y`, tool calls, and `PROVIDER ERROR: {…}` — with no transcript or audio content. Read it live via `console.debug('[orb-rt …]')` or copy it from the DEV panel's **Copy Realtime trace** button (`getTrace()`).

## 9. Known open items (post-checkpoint)

- **Ambient false turns** are now a pure VAD-threshold tuning question (Silero is gathering device evidence), decoupled from reliability — worst case is a stray word, not a dead session.
- **`silence_duration_ms`** (450ms) can chop a natural mid-thought pause into separate turns; raising it (~750ms) gives crisper 1:1 turn-taking. Untuned pending Stan's call.
- Supported-browser (Safari/Chrome/Edge) acceptance of the typed capabilities, then the flip of the main voice button to Realtime (replacement), then production allowlist rollout. Firefox deferred (ORB-330).
