# WIP — Voice Mode Examination (handoff for Codex)

> Status: **MAPPING phase. No voice code changed yet.** Baseline = v0.6.76 (pushed).
> Author: Claude Code (Opus 4.8), 2026-06-28. Handing off to Codex.
> Goal (Stan): "Examine voice as it is just as you did with text." Verify CRUD works in
> voice, then audit for redundant code / path consolidation — voice was patched
> whack-a-mole style just like text was, so expect the same kind of cleanup.

---

## 0. Read first

- `AGENTS.md` (root) — conventions, comprehension check, git/push rules, eval mandate.
- This session shipped **project CRUD via propose → confirm → execute** (text). The same
  organizing principle applies to voice: **deterministic code owns correctness; the Orb
  owns judgment.** See `HANDOFF.md` → "Last Session Completed" and "Key Lessons".
- Do NOT start the dev server (Stan-only, port 3001). Do NOT run evals (Stan runs them).
- Voice testing browsers: Chrome/Safari/Edge only (Comet is unreliable for voice).

---

## 1. How voice works today (end-to-end)

### Entry / wiring (`components/UnifiedDashboard.tsx`)
- `const voice = useVoiceMode(ttsConfig)` — line ~204.
- `ttsConfig` loads async via `getTtsConfig()` (from `@/app/actions/orb-ai-settings`), line ~197;
  on failure falls back to `{ provider: 'browser', ... }` (the config-race fix from v0.6.75).
- `voice.setOnSend(...)` → `voiceSendRef` → `handleSubmit(text)` (lines ~483–490). This is how a
  finished utterance becomes an Orb request.
- **Greeting:** `handleOrbTap()` (line ~492) starts the conversation, pushes a greeting message,
  and calls `voice.speak(greeting)` — a one-shot, client-side (no model call).
- **Auto-TTS effect** (lines ~518–534): watches `messages`; when the last Orb message is
  streaming (or just finished), calls `voice.speakStreaming(lastOrb.text, done)`. This is the
  main "speak the response as it streams" path.
- **Progress cues:** `scheduleVoiceProgressCue(thought)` (line ~440) → `speakStatus(thought)`
  after a 1400ms delay, but only if not already speaking/listening. `clearVoiceProgressCue()`
  fires when real speech arrives. Driven from the chunk loop in `handleSend` (~1102–1103).
- **Stop:** `handleStop()` (line ~453) → `cancelSpeech()`, aborts the request, resumes listening.
- The request passes `uiContext.voiceMode = voice.voiceActive` to `orbConverse` (line ~1098), which
  is what triggers the server-side **hybrid deterministic confirm** (see §3).

### The hook (`lib/hooks/useVoiceMode.ts`, 672 lines) — three layers
- **Layer 3 — Recognition** (`createRecognition`/`startRecognition`/`stopRecognition`/`teardown`):
  one `SpeechRecognition` instance reused per session. iOS is non-continuous (`capabilities.speech.continuous`),
  so `onend` auto-resumes with an 800ms delay + one retry (lines ~295–313). Rapid-end detection
  (3 immediate ends → "not working in this browser", lines ~271–280). Silence timer (2s) finalizes
  an utterance and calls `onSendRef`.
- **Layer 1 — Output** (`playChunk`): API TTS via `synthesizeSpeech` (server action `app/actions/orb-tts.ts`)
  decoded through a unlocked `AudioContext`; **falls back to browser `speechSynthesis` in 3 places**
  (no cfg / no AudioContext / catch). `playBrowserTts` is the browser path.
- **Layer 2 — Queue** (`drain` + `queueRef`): single queue, single drain loop, prefetch of the next
  chunk for API TTS (tagged by provider to discard stale prefetch — a v0.6.74 fix).
- **Three speak entry points:** `speak` (one-shot full), `speakStatus` (one-shot, no auto-resume,
  for progress cues), `speakStreaming` (sentence-extraction during generation). They share
  `beginSpeaking` + `drain` but each re-implements queue setup.
- **Reset paths:** `reset(keepActive)` shared by `cancelSpeech` (keep active) and `exitVoiceMode`.
- Text utils at top: `stripMarkdown`, `chunkText`/`splitAtBoundaries`, `truncateForSpeech`
  (`LONG_RESPONSE` truncation appears in both `speak` and `speakStreaming`).
- `lib/hooks/useCapabilities.ts` (153 lines) — platform/browser/speech-API detection, drives
  `supportsVoice`, `continuous`, and warnings.

### Other voice surfaces
- `components/OrbConversation.tsx` (846 lines) — voice UI (traffic-light states, transcript, warnings).
- `components/settings/SettingsVoice.tsx` — voice picker + preview (uses AudioContext; iPhone fix).
- `app/prototype/voice/page.tsx` — a prototype page (verify if still used / dead).

---

## 2. Whack-a-mole residue — consolidation candidates (audit these)

These are *hypotheses* to verify, not confirmed bugs. Map before cutting (as we did with text).

1. **Three speak entry points with overlapping queue setup** (`speak`, `speakStatus`,
   `speakStreaming`). Likely collapsible to one core "enqueue + drain" with thin wrappers. The
   `spokenChars === 0 && !q.playing` first-call detection in `speakStreaming` is subtle and fragile.
2. **Two parallel speech drivers** that must coordinate: the `messages` effect (speakStreaming) and
   the progress-cue path (speakStatus). The "clear cue when speech arrives" handshake
   (`clearVoiceProgressCue` vs `scheduleVoiceProgressCue`, guarded by `voiceSpeakingRef`/`voiceListeningRef`)
   is exactly the kind of cross-path timing the text rework removed by making flow structural.
3. **`LONG_RESPONSE` truncation duplicated** in `speak` and `speakStreaming`.
4. **Browser-TTS fallback in 3 spots** inside `playChunk` — consider one fallback decision point.
5. **Prefetch logic in 2 places** (`drain` sets `prefetchRef`, `playChunk` consumes it). Tagged by
   provider after a stale-audio bug. Verify it can't double-fetch or leak across cancels.
6. **Reliability patches layered over time:** 30s stuck-speaking safety timeout, rapid-end detection,
   iOS 800ms + retry auto-resume, `genRef` generation counter, `cancelledRef`. Each was a fix; together
   they're a lot of interacting guards. Worth a single clear state model.
7. **Ref-mirroring in the dashboard** (`cancelSpeechRef`, `speakStatusRef`, `resumeListeningRef`,
   `voiceSpeakingRef`, `voiceListeningRef`, `voiceActiveRef`) to dodge effect-dep churn — works, but
   signals the effect/callback coupling is complex.

---

## 3. What to verify (functional, before refactoring)

1. **CRUD in voice** with the NEW project flow:
   - create / rename / delete by voice → propose ("Want me to go ahead?") spoken → "yes"/"go" →
     **deterministic** "Done — …" spoken instantly (the hybrid confirm: server short-circuits and
     `stream.done`s a templated line when `uiContext.voiceMode` is true — see
     `app/actions/orb-converse.ts` confirm_mutation block). Confirm this lands and is spoken via
     the `messages`→`speakStreaming(text, done=true)` effect.
   - Ambiguity ("delete Test" with duplicates) → Orb asks which → user says the code/name by voice.
   - Decline ("no") → nothing happens, no leaked "pending/holding" language.
2. **Latency** — Stan's explicit concern. Measure where voice time goes: recognition silence window
   (2s), model generation, TTS synthesis round-trip, AudioContext decode. The hybrid confirm removes
   one model turn on confirmations; general latency is model+TTS. Note quick wins vs structural.
3. **Stop reliability** mid-speech and mid-generation (handleStop → cancelSpeech + abort).
4. Cross-platform: iPhone Safari (non-continuous), iPad, Mac Chrome/Safari. (Stan tests on device.)

---

## 4. Recommended approach (mirror the text rework)

1. **Map** the full voice path end-to-end (this doc is the start) — confirm the two-driver
   coordination and the three speak entry points before touching them.
2. **Verify** CRUD + latency in voice (Stan drives the device tests; you instrument/inspect).
3. **Consolidate**: aim to reduce the speak entry points to one core path and remove cross-path
   timing handshakes, the way text went from six mechanisms to two. Keep the deterministic spine
   (recognition → queue → output) and let the Orb's content flow through one channel.
4. **Eval impact:** voice behavior that is *conversational* (tool calls / speech policy) is covered by
   the eval suite — extend it per the mandate if you change a tool/param/policy. Pure audio/timing is
   not eval-testable; verify on device.
5. Version-bump + changelog per protocol on any user-facing change. Don't push without Stan's OK.

---

## 5. File map

| File | Role | Lines |
|---|---|---|
| `lib/hooks/useVoiceMode.ts` | Core hook: recognition, queue, output, 3 speak APIs | 672 |
| `lib/hooks/useCapabilities.ts` | Platform/browser/speech detection | 153 |
| `components/UnifiedDashboard.tsx` | Wiring: setOnSend, speakStreaming effect, progress cues, stop | ~204–545, ~1098–1184 |
| `components/OrbConversation.tsx` | Voice UI (traffic-light, transcript, warnings) | 846 |
| `components/settings/SettingsVoice.tsx` | Voice picker + preview | — |
| `app/actions/orb-tts.ts` | `synthesizeSpeech` server action (API TTS) | — |
| `app/actions/orb-ai-settings.ts` | `getTtsConfig` (provider/model/voice per user) | — |
| `app/actions/orb-converse.ts` | Server: `uiContext.voiceMode`, hybrid deterministic confirm | confirm_mutation block |
| `app/prototype/voice/page.tsx` | Prototype — verify if dead | — |

---

## 6. Context carried from the text rework (so the principle is consistent)

- **Correctness vs judgment** is the organizing split. Deterministic spine (recognition/queue/output,
  and on the server: resolve→pending→execute) must be reliable; the Orb's words ride on top.
- The project mutation flow is **server-held** (`orb_pending_mutations`, consumed-on-load). Voice
  confirmations go through the same `confirm_mutation` path; the only voice-specific bit is the
  deterministic spoken "Done" to avoid an extra model round-trip.
- **Eval cases must use controlled context** (`backlogOverride`, `pendingSummary`, `__UNIQUE__`) —
  never live DB state. Same rule applies to any voice-conversation cases you add.
- Tier 1 evals: **27/27 green** at handoff.
