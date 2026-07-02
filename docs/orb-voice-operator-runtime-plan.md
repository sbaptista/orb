# Orb Voice Operator Runtime Plan

Status: proposed; first runtime pass implemented in v0.6.108.
Date: 2026-06-30.
Related: ORB-299, ORB-304, `docs/orb-voice-speech-channel-plan.md`, `docs/orb-action-transaction-thesis.md`.

## Implementation Status

v0.6.108 implemented the first runtime pass:

- Displayed transcript text and spoken TTS text can now differ.
- Voice mode derives shorter operator-style spoken text from longer transcript answers.
- Bulk confirmation speech points to the transcript for exact items.

v0.6.113 replaced streaming speech reconciliation with speak-once-per-turn:

- Voice speaks each Orb response exactly once, after the response completes. The screen carries streaming progress; voice never chases the stream.
- This removed the per-response spoken-character tracking and shrink recovery from v0.6.108–v0.6.109. That mechanism assumed spoken text only ever grows with a stable prefix, but the server deliberately replaces streamed narration with deterministic text (mutation confirmations, phantom-code corrections) — the "recovery" re-spoke replaced text and was the source of the repeated speech heard on all platforms, worst on iPhone/iPad where slower per-sentence TTS meant the doomed narration was still playing when the replacement landed.
- The speech queue is now one utterance per response: derive once, chunk for output, drain, hand the mic back. Fewer TTS API calls per turn (one instead of one per sentence) and a structurally deterministic mic handback on iOS.
- Removed dead paths: `speakStatus`/status mode (no call sites) and the unread `prevStreamingRef`.
- Trade-off accepted: first audio waits for stream end. The "Gathering data..." visual state covers the wait; if latency proves unacceptable in device testing, a bounded early-speech special case can be reconsidered — but measured first.

v0.6.116 implemented the Phase 4 confirmation itemization:

- Deterministic confirm messages ("Confirm: delete N todos from X?") now append the exact target list — code and title per operation — capped at 10 lines with an "…and N more (total)" tail for large sets. Voice keeps speaking the compact summary; the transcript now genuinely carries the audit detail it points to.

Remaining work:

- Formalize the full `VoiceRuntimeState` type and move all voice state labels to it.
- Add visual current-spoken-chunk highlighting.
- Add ORB-304 timing instrumentation for voice start, first audio, transcript recognition, model response, TTS playback, and mic return.
- Consider a dedicated visual confirmation panel for large bulk actions.

## Thesis

Voice is appropriate for Orb, but not as a screen reader for a complex dashboard.

The right product model is: **voice is an operator for the dashboard**. It should understand intent, act through the same verified application paths as text, speak compact confirmations and outcomes, and let the screen/transcript carry detail.

The current pain comes from treating voice as a thin audio layer over the text conversation. Text rendering, TTS playback, microphone recognition, transcript persistence, greeting behavior, and recovery timers each have partial ownership of a turn. That makes the app vulnerable to timing races, especially on iPhone/iPad Safari.

## Product Contract

### Voice Is For Intent And Command

Good voice interactions:

- "Create a task called fix iPhone voice startup."
- "Move ORB-299 to in progress."
- "Delete the five test todos."
- "Rename that last task to ..."
- "What did I just create?"
- "Is it done?"
- "Give me a summary."

Voice should be allowed to initiate CRUD, answer short state questions, confirm stored actions, and acknowledge outcomes.

### The UI Is For Inspection And Correction

Voice should not read long inventories, large candidate lists, dense descriptions, URLs, metadata, or bulk target sets. If the user needs to inspect details, Orb should put them on screen and speak a short pointer.

Example:

Spoken:

> I'm going to delete 5 test todos from Test 2. See the transcript for the exact todos. Confirm?

Transcript:

```text
Confirm delete 5 todos from Test 2:
- TEST-1 — ...
- TEST-2 — ...
- TEST-3 — ...
- TEST-4 — ...
- TEST-5 — ...
```

For very large sets:

Spoken:

> I'm going to delete 1,000 archived todos. I listed the exact set on screen. Confirm?

The spoken response must not serialize the whole set. The transcript or a visual confirmation panel carries the audit detail.

### Text Is For Precision And Detail

Text mode remains the best place for:

- long descriptions;
- URLs;
- exact titles;
- multi-field edits;
- reflective planning;
- detailed status reads;
- correction after uncertain voice transcription.

Voice can hand the user to text/UI when precision matters:

> I found several possible matches. Pick one on screen.

## Heard vs Displayed Contract

Orb needs to distinguish three related but different facts:

1. **Displayed** — text is visible in the transcript.
2. **Queued** — speech has been accepted by the voice runtime for playback.
3. **Heard** — playback completed or failed visibly.

The application must not treat a voice turn as complete just because transcript text exists. The microphone should only return after the spoken turn reaches a terminal state:

- `heard`;
- `speech_failed`;
- `interrupted_by_user`.

The transcript may appear ahead of speech, but the UI should make that relationship legible. A later enhancement can visually mark the sentence or chunk currently being spoken.

## Runtime Shape

Voice mode should have one explicit turn state machine and one owner for microphone state.

Suggested states:

```text
idle
starting
speaking_greeting
listening
recognizing
submitting
thinking
speaking_answer
awaiting_confirmation
recoverable_error
stopped
```

Only the voice runtime transitions between listening/speaking states. Dashboard effects should render state, not infer state by timers.

### State Rules

- `starting` unlocks audio and loads current TTS config.
- `speaking_greeting` may use client-generated greeting text for speed, but it must be queued and completed through the same speech runtime as any other spoken response.
- `listening` is entered only by the voice runtime after speech completes.
- `recognizing` owns Web Speech API events and transcript buffering.
- `submitting` submits recognized text once.
- `thinking` waits for the server/model response.
- `speaking_answer` speaks the voice summary, not necessarily the full transcript.
- `awaiting_confirmation` leaves the mic available for yes/no/correction, but the stored transaction remains app-owned.
- `recoverable_error` presents a clear action such as "Tap Listen to try again" or "Switch to text."
- `stopped` is entered only by explicit user stop/exit.

### Non-Rules

- No dashboard-level "Ready" recovery timer should start microphone recognition.
- No automatic browser-TTS fallback when API TTS is configured.
- No separate greeting speech path that bypasses the runtime.
- No separate CRUD path for voice.

## Spoken Response Policy

Voice responses should be shorter than transcript responses.

Default spoken shape:

```text
Headline. One useful detail. Pointer to transcript when needed.
```

Examples:

- Project state: "Orb has 10 active tasks, 3 in progress. ORB-299 is the heavy one. I put the breakdown on screen."
- Bulk delete confirmation: "I'm going to delete 5 test todos from Test 2. See the transcript for the exact todos. Confirm?"
- Ambiguity: "I found a few possible matches. Pick one on screen."
- Mutation success: "Done. Created 5 todos."
- Complex analysis: "Short answer: yes, that approach makes sense. I put the caveats on screen."

The transcript can contain the full response. The spoken response should not attempt to be a full readout.

## CRUD Contract

Voice CRUD uses the same application truth as text CRUD:

- same `handleSubmit`;
- same `orbConverse`;
- same tool definitions;
- same pending action transaction;
- same confirmation execution;
- same verified action-set ledger.

The model interprets. The app stores and executes the exact transaction. The UI displays the target set. Voice speaks the compact summary.

If a command is ambiguous:

1. Do not guess.
2. Show the candidates visually.
3. Speak a short instruction.

Example:

> I found three possible "test" projects. Pick one on screen.

If the user references prior session actions:

- Resolve deterministically from the session action ledger when possible.
- If the ledger is missing or ambiguous, perform a fresh lookup or ask for clarification.
- Do not fabricate continuity across devices, browser profiles, or cleared sessions.

## iOS / iPadOS Contract

iOS and iPadOS are first-class voice targets, not degraded desktop variants.

The runtime must explicitly account for:

- AudioContext must be unlocked from user gesture.
- API TTS should play through the unlocked audio path.
- SpeechRecognition may be `continuous=false` and may end after pauses.
- Recognition start calls must be serialized.
- Empty recognition start/end loops must stop with a recoverable error.
- The mic must not start while TTS is loading or playing.

Test iPhone Safari, iPad Safari, and at least one iOS Chromium browser separately. They may share WebKit but differ in prompts and user-visible permission behavior.

## UI Contract

The voice UI should make state obvious without crowding the transcript.

Required visible states:

- Starting
- Speaking
- Listening
- Thinking
- Confirming
- Error
- Stopped

The transcript must never be truncated just because voice mode is active. It can scroll off the top of the viewport. The Orb can sit top-right or as an overlay, but it must not hide essential transcript content.

The screen should carry exact details for:

- candidate matches;
- bulk target lists;
- action transaction details;
- long summaries;
- warnings and failures.

## Migration Plan

### Phase 0: Stop The Patching Loop

Freeze additional one-off voice timing fixes unless they are needed to keep the app usable. Treat current voice symptoms as architecture signals, not independent bugs.

Decide whether to keep, revert, or isolate the experimental `v0.6.106-v0.6.107` edits before the runtime rebuild.

### Phase 1: Instrument The Current Runtime

Before rebuilding, add low-overhead development logging or metrics for:

- voice start tapped;
- TTS config loaded;
- audio unlocked;
- speech queued;
- first audio started;
- audio completed;
- recognition start requested;
- recognition actually started;
- transcript interim/final received;
- text submitted;
- model first response;
- speech answer started;
- speech answer completed;
- mic returned.

This belongs with ORB-304's broader time-to-interactive instrumentation. No Realtime subscription is needed.

### Phase 2: Define `VoiceRuntime`

Move voice orchestration into a single hook/module, for example:

```ts
type VoiceRuntimeState =
  | 'idle'
  | 'starting'
  | 'speaking_greeting'
  | 'listening'
  | 'recognizing'
  | 'submitting'
  | 'thinking'
  | 'speaking_answer'
  | 'awaiting_confirmation'
  | 'recoverable_error'
  | 'stopped'
```

The runtime owns:

- AudioContext unlock;
- TTS config snapshot for the current voice session;
- speech queue;
- playback completion/failure;
- Web Speech recognition lifecycle;
- transcript buffer;
- mic handoff.

The dashboard owns:

- rendering;
- selected project and UI context;
- calling shared submit;
- displaying transcript/action details.

### Phase 3: Split Spoken Text From Display Text

Server/client responses should expose or derive:

```ts
{
  displayText: string
  spokenText: string
}
```

If a separate field is too large a first step, derive spoken text deterministically for known cases:

- broad project summaries;
- mutation confirmations;
- mutation successes;
- ambiguity prompts;
- long analysis.

Do not ask TTS to read the full display text by default.

### Phase 4: Confirmations And Bulk Actions

Update confirmation presentation:

- spoken summary by count and project;
- transcript lists exact targets;
- destructive actions include "see the transcript/list on screen";
- large sets use a capped visible preview plus count, with full details available if needed.

This keeps voice concise while preserving trust.

### Phase 5: Platform Verification

Stan-run checks on localhost:

- Mac browser: start voice, hear greeting, ask summary, mic returns.
- iPad Safari: same, with timing observed against transcript.
- iPhone Safari: same, with no repeated mic permission notices.
- iPhone Chrome/Edge: record whether voice is supported, degraded, or blocked.
- Change API voice in Settings, start voice without reload, confirm greeting and answer use the new voice.
- Trigger API TTS failure, confirm no mixed voice fallback.
- Voice CRUD: create, update, delete one item.
- Voice bulk CRUD: create 5, delete them, delete first 5 from two batches.
- Ambiguous project command: show candidates, speak "pick one on screen."
- Stop during TTS and during model thinking.

## Eval Impact

The Orb eval suite cannot test browser audio timing, iOS permissions, or whether speech was actually heard.

Eval should cover only conversation policy:

- voice broad summaries are short;
- greetings do not volunteer backlog summaries;
- bulk confirmation speech summarizes and points to transcript/screen;
- ambiguous voice commands clarify instead of guessing;
- unsupported durable voice promises are refused honestly.

Runtime correctness needs browser/device verification and, later, development instrumentation.

## Database Impact

No schema change is required for the runtime redesign.

If ORB-304 adds persistent flow metrics later, answer the database impact questions at that time. For this voice runtime plan:

- no new table;
- no new Realtime subscription;
- no high-frequency writes;
- no index needed.

## Open Questions

1. Should the spoken text be generated by the model, deterministically derived by the app, or a hybrid?
2. Should voice confirmations use a dedicated visual confirmation panel instead of ordinary transcript cards?
3. How long should voice remember recent action sets after tab refresh?
4. Should "pick one on screen" support tap-only selection, spoken selection by ordinal, or both?
5. Should voice mode have a separate terseness preference from text mode?

## Decision Log

- Decision: Voice is an operator for the dashboard, not a narrator or screen reader.
- Decision: CRUD remains appropriate for voice, but voice speaks compact summaries while the UI/transcript carries exact target details.
- Decision: The application owns transactions; the model interprets intent.
- Decision: The mic returns only after speech completion, explicit failure, or user interruption.
- Decision: Stop chasing individual timing symptoms until the runtime contract is explicit.
