# Orb interaction contract

Status: local implementation, 2026-09-20; not committed or deployed. The four
responsibilities now govern the shared prompt. Coverage and limitations below
distinguish implemented safeguards from untested runtime guarantees.
The current tool contract remains in `lib/orb-contract.ts` and `lib/orb-prompt.ts`;
Stan’s latest instruction supersedes mandatory paid testing for this work:
routine verification is model-free; paid diagnostics need explicit scope and
budget approval. The old corpus remains available for targeted diagnosis. Do not inject this document into the model prompt wholesale.

Companions: [tool policy map](orb-interaction-tool-policy.md),
[manual acceptance checklist](orb-interaction-scenarios.md), and
[verification transition](orb-eval-transition.md).

## Four rules

| ID | Rule | Observable contract | Enforcement owner |
|---|---|---|---|
| U | Understand the request | Resolve action, target identity, scope, and supplied parameters. Preserve explicit spelling and corrections. Clarify when competing interpretations change the operation. Never widen an unresolved scope. | Model interprets; shared resolvers and command preparation validate. |
| A | Respect authorization | Distinguish permission to access a resource from authorization to perform this particular action. Execute only a supported operation for the authenticated user under the tool's declared confirmation policy. | Server access checks, proposal state, and database transaction. |
| G | Stay grounded | Present retrieved facts with their actual scope and completeness. Describe proposed changes from stored proposals and completed changes from successful results. Missing evidence is not evidence of absence. | Query handlers, response artifacts, receipts, and presentation. |
| J | Exercise judgment | Ask only questions needed for a correct outcome. Keep discussion distinct from action and temporary context distinct from persistence. Do not invent observations or future capabilities. | Model judgment within server-enforced capability and persistence boundaries. |

These are four responsibilities, not four prompts. A permission check cannot
repair the wrong target; a correct target cannot authorize its own mutation;
a tool request cannot prove execution; a grammatical transcript cannot prove
the microphone heard the intended words.

## Operation lifecycle

For operations requiring confirmation:

1. Accept a user event with conversation, turn, and delivery identity.
2. Interpret the request and resolve its targets against authorized records.
3. Validate parameters and store the complete proposal, including expected
   target state and a proposal identity/version. Render its confirmation from
   that stored data.
4. Classify the next relevant input as approval, decline, modification,
   question/discussion, or unresolved. Classification may use a model for
   language; it cannot bypass server checks.
5. Approval binds to the exact current proposal that was presented. A later
   correction replaces it and makes authorization of the earlier version
   unusable. An unrelated question neither confirms nor silently changes it.
6. Recheck actor, target permissions, expiry, expected record state, and
   interruption state at execution. Use transaction-level replay protection.
7. Store the result before presenting success. A lost response must recover
   the existing result rather than submit a new operation.

Direct writes follow the explicit policies in the tool map. This contract does
not add a second confirmation to every preference, memory, or navigation action.
Every effect still needs validated arguments, an authorized scope, and an
outcome that distinguishes attempted, completed, and failed execution.

## Corrections and interruption

- Represent an explicit corrected value as a constraint on a named field.
  Do not merely append a stronger prompt and assume the model honored it.
  Before preparing a command, compare its interpreted value with that
  constraint. If the field or target remains unclear, clarify; never apply a
  global text replacement across unrelated fields.
- An approval containing a modification is not approval of the old proposal.
  Recompute and present the changed proposal before its execution.
- Speech playback, interpretation, and execution are separate states.
  Acoustic interruption may pause speech; it is not proof of cancellation.
- Stop before commit prevents the uncommitted operation when its cancellation
  wins the transaction ordering. Stop after commit cannot undo the result;
  present the committed outcome and offer a supported reversal if requested.
- Do not claim exactly-once behavior for email, push, or client navigation
  based on a database receipt alone. External effects need their own delivery
  evidence and replay policy.

## Text, dictation, and live voice

All accepted requests enter the same business engine. Preserve source metadata
without creating a second authority path. Current durable modality is only
`text | voice`; dictation enters as text. A test adapter can label its source
without pretending production already persists a separate dictation modality.

| Interface | Boundary to verify separately |
|---|---|
| Text | Exact submitted text, stable submission identity, history, selected project, and authenticated user reach the shared engine. |
| Dictation | Device dictation uses the text composer. The app’s own dictation button remains disabled; retained code for mic stop transcribes into the composer; editing changes what is submitted. The existing submit-while-recording path waits for transcription and submits once. Empty/failed transcription, repeated clicks, late responses, and cancel behavior must not create unintended requests. |
| Live voice | Accepted speech produces one user event; fragments/corrections retain order. Background sound must not become authority. Speech pause, explicit stop, replacement, reconnect, and text/voice crossover preserve the correct proposal and result. |

The local Silero verifier records frame-stream freshness as well as speech
probability. A classifier that initialized but stopped receiving frames is no
longer authoritative: the turn may use the existing high-confidence provider
fallback, and the client restarts Silero. Missing or weak provider confidence
still fails closed. This prevents a stale “ready” state from rejecting every
later utterance while retaining the independent acoustic boundary.
If fresh Silero frames report no speech while the provider supplies a
high-confidence transcript, the disputed turn remains rejected but the client
also restarts Silero so a desynchronized classifier cannot lock the rest of the
session.

Audio correctness requires actual audio/device evidence. Text transcripts test
interpretation only. Compare spoken semantic content with the response
artifact; harmless pronunciation differences are not database discrepancies.

## What exists and what is still missing

Local source and model-free evidence; no paid model or live-device acceptance:

| Area | Existing implementation | Remaining evidence or work |
|---|---|---|
| Shared path | `lib/orb-interaction/runtime.ts`; `components/UnifiedDashboard.tsx` submits to `orbConverse`. | Adapter tests for all three entry paths, including dictation submit timing. |
| Voice admission | Silero speech evidence admits healthy turns; stale frame delivery uses provider confidence ≥ 0.80 and restarts Silero. Model-free boundary cases pass. | Confirm recovery on real Mac/iPad/iPhone microphones and inspect telemetry if the warning recurs. |
| Spelling | Shared project name/code guard validates explicit letter-by-letter spelling before holding a tool call; unclear fields are rejected for clarification. | Other field types, implicit corrections, and multi-turn binding still require model interpretation; no global replacement. |
| Proposal binding | `lastShownProposalMatches`, conversation events, command batches, expected-state fields. | Exercise complete lifecycle, stale replacements, and cross-device races. |
| Approval | Pure approval policy rejects mixed corrections/conditions before the injected semantic adapter; raw user text is classified at most once per turn. | Offline checks include an always-approving fake adapter. Multilingual interpretation still uses the existing live classifier; no live classifier was tested. |
| Execution | Production confirmation orchestration now uses tested I/O adapters; missing receipts fail, secondary log failure preserves committed success, replay is forwarded. | `scripts/verify-orb-transactions.sql` exercises actual RPCs in a disposable local database, but was not run: PostgreSQL server/container runtime unavailable. Multi-connection races remain uncovered. |
| Reporting | Server proposal/receipt text, response artifacts, model false-claim guard. | Verify final and streaming presentation; navigation needs client outcome evidence. |
| Memory | Mode/track/category/content validation; autonomous evidence requires quotes from two distinct server-recorded user messages; exact duplicate lookup and expiry retained. | Evidence establishes recorded observations, not correctness of an inference. Semantic duplicate detection and offered-track consent remain model judgments; duplicate check is not atomic. |

## Remaining acceptance work

1. Run the prepared SQL checks only against a disposable local migrated database
   with synthetic users and external integrations disabled. No production SQL
   or credential is needed by the agent. Add separate multi-connection race and
   permission-change evidence before claiming those guarantees.
2. Exercise relevant optional manual conversations and actual audio/device
   behavior. The retained dictation code has generation/empty-transcript guards;
   its button remains disabled. No new UI pattern was introduced.
3. Extend shared deterministic boundaries when a new category needs enforcement.
   Do not replace language interpretation with an endless phrase blacklist.
4. Retire historical cases only where accepted replacement evidence exists.
   No paid suite, repetition requirement, or paid release gate is reinstated.

Design precedent checked through the read-only Knowledge broker:
`bd59aa9a-0720-4865-b85c-961ad8412418` (eval endpoint drift) and
`ed6dd06c-238d-49d0-8839-3a3c60b9133b` (server-owned proposals/receipts).
The source inspection agrees that a separate imitation of production behavior
is the wrong basis for execution guarantees.
