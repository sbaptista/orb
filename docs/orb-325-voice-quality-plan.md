# ORB-325 — Voice Interaction Rethink

**Status:** Architecture review in progress. Further symptom-level voice patches are paused. Firefox input works and several Safari defects were corrected, but the extended Safari conversation failed the interaction-quality gate.

## Decision to make

The question is no longer whether individual browsers can capture and play audio. It is whether Orb can provide a coherent voice interaction that is materially easier than text for short operational work.

Voice stays as a full conversational mode only if the complete turn—recognition, interpretation, routing, tools, response, speech, interruption, and microphone return—can be predictable and fast. If that cannot be achieved, narrow the product to a reliable voice-operator or dictation surface instead of preserving a broad but clunky promise.

No implementation follows from this document without Stan's explicit approval.

## Evidence from the Safari transcript

The 2026-07-12 Mac/Safari session was correlated with `orb_model_requests`, tickets, and the persisted survey state. Provider timing is available. No matching client voice-stage rows were present; Performance telemetry and its `voice` focus are opt-in, so either may have been disabled during this run.

| Turn | Model work | TTS provider work | What happened |
|---|---:|---:|---|
| “What should I do next” | Gemini **75,437 ms** | First chunk **3,028 ms**; second chunk **3,545 ms** | Minimum time to first audio was about **78.5s**, excluding context assembly, decode, and playback. The response also inserted an unsolicited survey. |
| User accepted the survey | Haiku **8,595 ms** | **4,361 ms** | A simple transition to question 1 took at least ~13s before audio could begin, excluding context assembly and decode. |
| Question 1 answer | Haiku **9,950 ms**, 2 tools | **2,654 ms** | Correctly created TICKETS-48 and advanced to question 2. |
| User clarified “continue asking the questions” | Haiku **9,831 ms**, 2 tools | **3,509 ms** | Re-created question 1 as TICKETS-49 instead of merely resuming question 2. |
| Ambiguous “second strategic guidance” phrase | Gemini **50,562 ms** | none played | Latest-message lexical routing treated survey wording as a strategic request. The user stopped it, but the provider request still completed. |
| “What is the second question” | Haiku **2,804 ms** | **4,293 ms** | Correct answer, but still roughly 7s before accounting for playback. |
| “Yes” to question 2 | Haiku **10,123 ms**, 3 tools | **3,947 ms** | Created duplicate Ambient feedback TICKETS-50 and legitimate Strategic feedback TICKETS-51. |
| Question 3 answer | Haiku **10,942 ms**, 5 tools | **3,828 ms** | Replayed prior answers into TICKETS-52/53, then created legitimate TICKETS-54 and completed the survey. |

The final preferences are internally consistent (`survey_stage=completed`, `survey_completed=true`), but the side effects are not: four of seven feedback tickets are duplicates. This is state-machine and idempotency failure, not merely awkward wording.

## Complete issue inventory

### Voice-specific failures

- **Serial latency:** Orb waits for the complete model response before beginning TTS. That avoids repeated or contradicted streaming speech, but model latency is converted directly into silence.
- **Speech adds another serial boundary:** API TTS generation, audio decoding, playback, and microphone return occur after the answer is complete. Long answers are chunked; later chunks may prefetch, but playback remains sequential.
- **Interruption is presentation-only:** stopping a response prevents it from being spoken, but does not currently abort the in-flight provider request. The 50.562s Gemini call completed after the user stopped it.
- **Recognition ambiguity has higher cost:** a possibly mistranscribed or simply ambiguous phrase can launch an expensive, long-running route before clarification. The original audio was not retained, so this case cannot honestly be classified as an STT defect.
- **Voice cannot recover by scanning:** text users can inspect partial output and correct an input before committing to a long exchange. Voice users wait through a serial turn and must spend another turn repairing it.
- **Internal progress narration is intrusive:** transcript thoughts such as “Preparing strategic read,” “Noting observation,” and “Saving preference” expose machinery without providing a useful conversational response.

### Shared conversation failures amplified by voice

- **Context-blind routing:** `routeOrbRequest` classifies only the latest input with lexical patterns. It does not give an active workflow—such as survey question 2—precedence over a phrase containing “strategic guidance.”
- **Prompt-driven survey state machine:** the survey is a mandatory prompt block, while `create_ticket` and `set_preference` remain unrestricted generic tools. The server does not enforce one legal transition and one response side effect per stage.
- **No idempotency boundary:** repeated feedback calls create new tickets. Nothing rejects a duplicate stage response or a replay of an earlier stage.
- **Text-only conversation history:** the client sends visible user/assistant text back to the model, not durable tool-call/result history. The model sees claims such as “saved” and prior questions but lacks a trustworthy event record of which actions already executed.
- **Oversized context for simple turns:** the operational survey turns sent roughly **55k–56.5k input tokens**. The strategic turns sent roughly **36k input tokens**. `buildOrbContext` assembles broad backlog, audit, knowledge, preferences, users, tickets, UI, release, and policy context even when the active exchange only needs one survey stage.
- **Unsolicited workflow takeover:** the survey's `MUST` rule appended a three-question process to a direct next-step request. Voice made the interruption especially burdensome.
- **False process narration:** the final response said it would “save all three responses now” even though prior answers had already been saved—and replayed—on earlier turns.
- **Data pollution:** the defect wrote four duplicate tickets, so it affected persisted records as well as conversational quality.

### Previously observed contributors

- Repeated greetings when re-entering voice.
- Recognized input disappearing too early.
- Generic microphone-permission recovery.
- Flattened confirmation lists in the transcript.
- Pending-set count confusion and accidental expansion.
- Lost pending state causing duplicate confirmation.
- Internal project-code leakage and stale post-switch counts.

Several of these individual defects are now corrected, but their variety is itself evidence that the full voice turn lacks one explicit orchestration contract.

## Current architecture

```text
microphone
  -> browser recognition OR recorded-audio/server STT
  -> visible transcript
  -> shared handleSubmit
  -> broad context assembly
  -> latest-input router
       -> Haiku operational loop + generic tools
       -> Gemini strategic one-shot
  -> final transcript response
  -> spoken-text derivation
  -> API/browser TTS chunks
  -> playback
  -> microphone return
```

Voice is primarily a wrapper around the text conversation engine. It adds recognition and serialized output, but the shared engine is not currently aware enough of voice latency, active conversational workflows, or interruption semantics.

## External voice benchmarks

The useful benchmark is the interaction contract, not an unsupported guess about another product's private implementation.

- **Perplexity Comet Voice Mode** documents a persistent hands-free session that begins listening when opened, keeps context across tabs, and provides separate microphone and speaker controls. Its public documentation does not identify the underlying STT/model/TTS architecture, so Orb must not claim that Perplexity uses a particular pipeline. Source: [Comet Voice Mode](https://www.perplexity.ai/help-center/comet/en/articles/13860420-voice-mode).
- **ChatGPT Voice** uses natively multimodal models for direct audio exchange. Its integrated interface speaks while showing streamed text in the same thread; the Live experience can listen and speak at the same time so interruption and turn-taking feel more natural. Source: [ChatGPT Voice Mode FAQ](https://help.openai.com/en/articles/8400625-voice-mode-faq) and [ChatGPT release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes).
- **OpenAI Realtime API** provides low-latency WebRTC/WebSocket/SIP sessions with native speech-to-speech, text and audio inputs/outputs, function calling, transcript events, server VAD (500ms silence by default), and semantic VAD. Source: [Realtime API reference](https://platform.openai.com/docs/api-reference/realtime) and [Realtime models](https://developers.openai.com/api/docs/models/how).

These benchmarks expose the main difference from Orb: mature voice systems do not require every turn to finish a discrete STT request, then a full text-agent request, then a discrete TTS request before the user hears anything. They either use native audio interaction or overlap the stages tightly enough that speech and transcript advance together.

### What Orb already tried—and why this is not the same proposal

The Knowledge Repository records a clear progression:

1. **Web Speech dictation:** browser `SpeechRecognition` appended finalized text to the input. This was simple one-shot input, not continuous voice conversation. KB `46ce5b31`.
2. **Pseudo-realtime streaming TTS (v0.6.55+):** Orb streamed text from the normal LLM, detected completed sentences or clauses, issued a separate API TTS request for each chunk, queued independent audio elements, and tried to reconcile later final text. It reduced first-speech latency on good runs but produced two-voice behavior, filler speech, repeat/re-greeting errors, stop races, empty gaps between TTS calls, stale React closures, late audio resuming after Stop, and mic self-capture. KB `3ee86b10`, `04b931f1`, and `dce4f079`.
3. **Single queue/operator runtime (v0.6.77–v0.6.111):** Orb consolidated output into one runtime, separated displayed/spoken text, made the app own exact mutation transactions, and treated displayed/queued/heard as different states. This improved correctness but still used browser/server STT + text LLM + discrete TTS. KB `467d7b95`, `0586b02c`, and `ba3454f0`.
4. **Current full-response speech:** Orb waits for the final response before speaking. This was a deliberate predictability trade: it prevents partial narration from being repeated or contradicted, but converts the entire model/tool duration into silence.

A native Realtime spike is therefore **not** permission to restore sentence-level `speakStreaming()` on top of the current text stream. That rejected design had three independently advancing histories—LLM text, TTS chunks, and browser playback—with client-only cancellation. A genuine realtime session instead produces audio and its transcript as one provider conversation item, supports provider-level response cancellation/audio truncation, and owns turn detection inside the audio session.

The durable lessons that must survive either future path are:

- Orb's application—not the model—owns authorization, exact pending mutations, confirmation, verified outcomes, and action-set references.
- Displayed, generated, queued, played, heard, interrupted, and microphone-ready are distinct states.
- One authoritative audio path per session; never mix API and browser voices as fallback.
- Stop must cancel provider generation, queued/playing audio, late client updates, and mic self-capture—not merely stop rendering new transcript chunks.
- The voice runtime owns microphone handoff. Dashboard recovery timers must not guess when speech ended.
- Transcript detail and spoken detail may differ, but they must derive from the same completed conversation item so they cannot contradict each other.

### Architectural implication for Orb

The bounded voice operator should be evaluated in two forms:

1. **Optimized serial operator:** retain the current browser/server STT → Orb operational engine → TTS shape, but use shorter turn detection, intent-sized context, strict routing, concise answers, real cancellation, and structural workflow gates.
2. **Realtime voice operator:** maintain a persistent WebRTC audio session with native audio input/output and concurrent transcript deltas. Realtime function calls would still terminate at Orb's existing server-side authorization, mutation confirmation, identifier provenance, and idempotency gates; a voice model never receives direct database authority. Long strategic work remains a separate bounded/asynchronous path rather than blocking the live audio session.

The realtime form is a larger architectural change but is closer to the smooth Perplexity/ChatGPT interaction the user is comparing against. The optimized serial form is lower-risk but may have a latency floor that cannot meet the product gate. A short technical spike should compare both before committing to a full rebuild.

## Product direction to evaluate

The recommended experiment is a **bounded voice operator**, not unrestricted parity with text:

- Voice is optimized for short status questions, concise CRUD, confirmations, corrections, and navigation.
- Active workflow state takes precedence over keyword routing.
- Proactive surveys and other multi-question workflows do not begin in voice mode. They can be offered in text or opened explicitly by the user.
- A simple turn uses only the context packet needed for that intent.
- Strategic analysis is explicit and interruptible. Voice acknowledges immediately, applies a hard response-time boundary, and can offer the completed detail on screen rather than holding the microphone workflow indefinitely.
- Side effects are server-governed and idempotent; the model cannot replay prior stages.
- Transcript and speech are deliberately different surfaces: the transcript carries inspectable detail, while speech carries one short result or question.

Two fallbacks remain valid if the bounded operator does not meet the gate:

1. **Dictation plus optional read-aloud:** voice fills the normal text input; the user submits and inspects as text.
2. **Output-only voice:** Orb reads selected short responses but does not promise continuous hands-free conversation.

## Proposed acceptance budgets

These are starting gates for discussion, not yet approved product requirements:

- Recognition completion to visible submitted transcript: target **≤2.5s** after silence.
- Simple operational response to first audible answer: target **≤5s**, hard failure above **8s**.
- Tool/confirmation response to first audible answer: target **≤8s**, hard failure above **12s**.
- Strategic request: audible acknowledgement **≤1s**; substantive result target **≤12s**, hard boundary **20s**.
- Stop/interruption: playback stops immediately and the provider request is actually aborted; no continued model cost or later stale response.
- One user utterance produces at most one assistant answer, one legal workflow transition, and the intended number of side effects.
- Microphone returns exactly once after the answer, visible failure, or explicit interruption.

The 75.437s strategic call and 8–11s model-only survey turns fail these proposed budgets by wide margins.

## Rethink sequence

### Phase 0 — freeze and preserve evidence

- Do not add more phrase-specific patches while the orchestration contract is unresolved.
- Do not replace those patches with canned responses. Orb's language should remain fluid; deterministic structure belongs underneath it in workflow state, routing precedence, authorization, confirmation, idempotency, cancellation, and verified tool outcomes. The structure must be strong enough that natural wording cannot make the interaction fall apart.
- Keep TICKETS-48–54 as evidence until Stan separately authorizes cleanup; do not silently dismiss or delete them.
- Use the transcript and model ledger as a fixed regression scenario.

### Phase 1 — make the interaction observable and replayable

- Ensure controlled tests explicitly enable Performance telemetry with the `voice` focus; the current opt-in instrumentation produced no client-stage rows for this Safari run.
- Add a single correlated voice-turn identifier across recognition, conversation/model request, each TTS chunk, playback, interruption, and mic return.
- Record route decision and active workflow state without recording transcript content.
- Build focused replay/eval cases from this transcript. Do not require the full paid Tier 1 suite for every iteration; use the smallest representative case set, with Stan running the requested cases.

### Phase 2 — define orchestration boundaries

- Represent active multi-turn workflows as server-controlled state, not prose instructions alone.
- Give active workflow resolution precedence over general strategic keyword matching.
- Enforce legal stage transitions and idempotent side effects before any tool reaches the database.
- Preserve tool outcomes as structured turn state rather than relying on assistant narration in text history.
- Make cancellation propagate to the provider call.
- Spike a persistent Realtime/WebRTC operator against the optimized serial path using the same fixed transcript scenarios and latency budget. Do not choose based on demo smoothness alone; confirm tool correctness, transcript fidelity, interruption, cost, and browser support.

### Phase 3 — reduce time and cognitive load

- Create intent-sized context packets instead of loading the full operational prompt for every voice utterance.
- Remove automatic surveys from voice mode.
- Add a fast deterministic path only where the answer can be grounded without model interpretation.
- Bound strategic work and decide whether long strategic results belong primarily on screen.
- Replace internal tool labels with at most one user-meaningful status signal.

### Phase 4 — controlled device matrix

Run the same short script on Mac, iPad, and iPhone across Safari, Chrome, Edge, and Firefox. Record capability state, recognition path, recognized text, first-audio time, interruption behavior, completion, and microphone return. Include “Orb,” a short status question, a correction, a mutation requiring confirmation, and an explicit strategic request.

## Required regression coverage for any implementation

- Active survey question 2 + phrase containing “strategic guidance” stays in the survey workflow and does not route to Gemini.
- Repeating or clarifying a survey question produces no duplicate ticket.
- Answering question 2 creates exactly one Strategic Guidance ticket and no Ambient Orb ticket.
- Answering question 3 creates exactly one Friction & Bugs ticket and no earlier-stage tickets.
- Voice stop aborts the underlying provider request and cannot later speak or append its result.
- Voice strategic routing observes the approved latency/fallback policy.
- Existing CRUD confirmation and pending-set cases remain green.

## Impact decisions

- **Performance instrumentation:** required. Existing stage events are useful but were not active in the failed Safari run; correlation and cancellation evidence are missing.
- **Database:** this review makes no schema or data change. A future survey-idempotency implementation may add a lookup keyed by reporter and survey stage/response identity; that is a new query pattern and must be checked for an index before implementation. No Realtime subscription is justified.
- **UI catalog:** no visual implementation in this review. Any new progress or strategic-result surface must first select an existing catalog pattern.
- **Orb eval:** any routing, workflow, cancellation-policy, or defined speech change requires matching cases in `scripts/eval-cases.ts` in the same implementation.

## Exit criteria

Keep full voice conversation only if the bounded operator passes the approved latency and correctness gates across the supported browser matrix and is clearly easier than using the text input for its intended short interactions. Otherwise narrow the feature honestly to dictation/read-aloud rather than continuing symptom-by-symptom repairs.
