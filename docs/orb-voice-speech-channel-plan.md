# Orb Voice Speech Channel Plan

Status: approved and implemented in v0.6.77.
Date: 2026-06-29
Version target: v0.6.77.

## Purpose

Voice mode should keep the same correctness boundary as text mode: shared server-side CRUD paths own data changes, while voice mode owns input timing, output timing, and spoken presentation. The next voice pass should reduce speech-path complexity without forking CRUD behavior.

## Current Findings

Voice mode is already reasonably layered in `lib/hooks/useVoiceMode.ts`:

- Recognition: a single `SpeechRecognition` instance per voice session.
- Queue: one `queueRef` and one `drain()` loop.
- Output: `playChunk()` chooses API TTS or browser speech.

The fragile part is above the queue. There are three public speech entry points:

- `speak(text)` for complete one-shot utterances, such as the voice greeting.
- `speakStatus(text)` for short progress cues that must not auto-resume listening.
- `speakStreaming(text, done)` for incremental Orb responses while server speech streams in.

Those three entry points represent useful semantic contracts, but they each perform their own queue setup. In parallel, `UnifiedDashboard` has two speech drivers:

- The messages effect routes Orb responses into `speakStreaming`.
- The delayed progress-cue path routes tool/thought labels into `speakStatus`.

That cross-path timing is the voice equivalent of the old text CRUD tangle: it works, but the coordination is spread across refs, timers, queue state, and message streaming.

## Suspected Voice Mismatch

The likely cause of hearing two voices is not that `speak()` alone uses an old voice. All three speech entry points eventually call `playChunk()`, which reads `cfgRef.current`.

The likely causes are:

1. `UnifiedDashboard` loads `ttsConfig` once on mount via `getTtsConfig()`. If Settings changes the provider, model, or API voice later, the mounted dashboard does not refresh its config.
2. API TTS currently falls back silently to browser TTS on failure. That can mix an API voice and a browser voice in one session.
3. `voice.setVoice()` only changes the browser/localStorage voice name. It does not update API provider voice IDs, so conversational voice switching should be audited separately before changing behavior.

Silent fallback should be removed. A clear recoverable voice error is better than changing voices unexpectedly.

## Implementation Result

Implemented in v0.6.77:

- `speak`, `speakStatus`, and `speakStreaming` now route through one internal speech channel in `useVoiceMode`.
- Dashboard TTS config refreshes after Settings voice changes and before voice mode speaks the greeting.
- API TTS failures no longer silently fall back to browser TTS.
- Spoken progress cues were removed; thought/progress labels remain visual-only.
- Voice CRUD continues to use the same shared `handleSubmit` and `orbConverse` paths as text CRUD.

## Non-Goals

- Do not fork project or todo CRUD for voice.
- Do not change project mutation execution semantics.
- Do not migrate todo CRUD to the new propose/confirm/execute flow in this pass unless Stan explicitly expands scope.
- Do not change conversational `set_voice` behavior without a separate approval and eval update.
- Do not run the Orb eval suite from the agent; Stan runs `npm run eval:t1`.

## Shared CRUD Requirement

Voice CRUD must use the same server action and tool paths as text:

- Voice recognition submits text into `handleSubmit(text)`.
- `handleSubmit` calls `orbConverse(...)` for both typed and spoken input.
- Project mutations use the same project tools, same server-held pending mutation table, and same `confirm_mutation` execution path.
- Voice-specific behavior is limited to `uiContext.voiceMode`, voice metadata, and the deterministic spoken success line after a confirmed project mutation.

If CRUD behavior changes later, it should change once in the shared server path and benefit both modes.

## Proposed Implementation

1. Keep the three public semantic APIs.

   Preserve `speak`, `speakStatus`, and `speakStreaming` because they express three different timing contracts:

   - Complete utterance, auto-resume after drain.
   - Short status cue, no auto-resume.
   - Incremental streamed response, auto-resume only after final drain.

2. Add one internal speech channel API.

   Route all three public methods through one internal queue setup function, for example:

   ```ts
   enqueueSpeech({
     mode: 'full' | 'status' | 'stream',
     text,
     done,
     autoResume,
   })
   ```

   This function owns cleaning, truncation policy, queue mutation, spoken character tracking, `beginSpeaking`, and `drain()` invocation. The public methods become thin wrappers that select mode and timing behavior.

3. Refresh TTS config when voice settings change.

   Add a same-tab client event after `SettingsVoice` successfully saves a new config. `UnifiedDashboard` listens for the event and reloads `ttsConfig` with `getTtsConfig()`.

   Also refresh `ttsConfig` when voice mode starts, before speaking the greeting, so a changed voice is picked up even if the user returns from Settings without remounting the dashboard.

4. Remove silent API-to-browser fallback.

   If API TTS fails while an API provider is selected:

   - Stop the current speech drain cleanly.
   - Clear pending prefetch.
   - Set `ttsError` with a user-facing recoverable message.
   - Do not call browser `speechSynthesis` automatically.

   Browser TTS remains the normal path only when the configured provider is `browser`.

5. Keep progress cues conservative.

   Progress cues should become visual-only once the main response channel is reliable. Tool/thought labels can still appear in the UI, but they should not compete with spoken responses.

6. Support both browser and API voice switching, with a separate design.

   Conversational voice switching should eventually support both browser voices and API voices. Browser voice names and API voice IDs live in different worlds, so this should be designed deliberately instead of extending the current `voice.setVoice()` behavior in place.

## Database Impact

No schema change.

The plan reuses existing `users.tts_provider`, `users.tts_model`, and `users.tts_voice_id` reads/writes. It adds only low-frequency refresh reads after settings changes or voice-mode start. No new table, no Realtime subscription, no high-frequency write path, and no new index needed.

## Eval Impact

Pure audio timing and TTS playback are not covered by the Orb eval suite.

No eval change is required if this pass only refactors the voice hook, refreshes TTS config, and changes client-side TTS failure handling.

Eval update is required if the pass changes any Orb-conversation capability, tool parameter, routing rule, or defined speech/policy behavior. In particular, changing conversational `set_voice` behavior would require a matching case in `scripts/eval-cases.ts`.

## Verification Checklist

Stan verifies on localhost; the agent does not start or stop the dev server.

- Change API voice in Settings, return to Orb, start voice mode, and confirm the greeting uses the new voice.
- Ask a normal question and confirm streamed speech uses the same voice.
- Trigger project create, rename, and delete by voice. Confirm proposal speech, spoken approval, deterministic success speech, refresh behavior, and listening resume.
- Confirm declined voice mutations do not execute and do not mention internal pending/held mechanics.
- Trigger or simulate API TTS failure and confirm there is no surprise browser voice fallback.
- Stop during model generation.
- Stop during TTS playback.
- Confirm browser TTS still works when provider is intentionally set to `browser`.
- Measure latency components: silence window, model first speech, first TTS request, decode/play, and resume listening.

## Decisions And Open Questions

- Decision: Progress cues should become visual-only.
- Decision: Conversational voice switching should support both browser voices and API voices, but this needs a separate design and eval coverage because it changes voice-conversation behavior.
- Open question: Should the dashboard subscribe to a broader settings-change event for future runtime preferences, or keep this narrowly scoped to TTS config?

Potential runtime preferences include settings that affect live behavior without a page reload, such as voice provider/model/voice/rate, Orb personality or openness level, memory level, routing/model policy visibility, theme/display density, notification preferences, or future accessibility settings. A broad event is useful if several settings need instant same-tab updates; a narrow TTS-only event is simpler and lower-risk for this voice pass.
