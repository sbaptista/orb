# ORB-359 — Realtime Confirmation Integrity Plan

**Status:** Drafted 2026-08-13 by Claude Code (Opus 5). **Implementation is NOT
authorized.** Stan approved writing this document only. Section 7 lists the
decisions he must make before any code is written; section 10 lists what is
blocked on evidence that does not yet exist.

**Todo:** ORB-359 — "Voice interaction seems to lose track of confirmation"
(`01e4755c-cf55-4ed2-aa25-b28955536e22`), status *in progress*, reported
2026-07-23 from a live session with a since-deleted test user.

**Related:** `docs/orb-325-realtime-voice-flow.md` (the flow map — see §4 below
on its scope), `lib/orb-model/mutation-authorization.ts` (the shared
authorization grammar), ORB-330 (Firefox), ORB-342 (canonical operation spine).

---

## 1. Symptom

In a live cooking session the user created six todos by voice. Repeatedly:

- A sentence the user never spoke appeared in the transcript as their own
  utterance: *"Orb. Confirmed. Confirm. Yes. Cancel. Stop. Todo. Project."*
- Orb answered confirmations with *"I couldn't verify that safely. That
  response did not explicitly approve the pending change."*
- Confirmed creations were sometimes never announced, leaving the user unable to
  tell whether a todo existed. The reported project numbering skipped a value.

The user's own summary — that the Orb "loses track of confirmation" — is an
accurate description of the experience and a misleading description of the
cause. Nothing lost track. Orb was answering a question the user never asked.

---

## 2. Root cause

Two independent defects that compound. Both are verified by reading the code;
neither has been reproduced in a controlled test.

### Defect A — the transcription prompt is emitted as user speech

`app/api/orb-realtime/session/route.ts:59` configures input transcription with a
vocabulary hint:

```ts
transcription: { model: 'gpt-4o-mini-transcribe', prompt: 'Orb. Confirmed. Confirm. Yes. Cancel. Stop. Todo. Project.' }
```

That string is **verbatim** the phantom utterance in the transcript, including
punctuation and capitalization.

For the Whisper / `gpt-4o-*-transcribe` family, `prompt` is not an instruction.
It is injected as prior-context text — conditioning tokens representing "the
transcript of the audio immediately preceding this segment," reusing the
long-form decoding path the model was trained on. The decoder is an
autoregressive language model over text with audio entering by cross-attention.
When the audio contains speech, cross-attention dominates and the hint only
nudges vocabulary and spelling, which is the intended and useful effect. When
the audio contains **no** speech, cross-attention contributes nothing, the
language-model prior runs unopposed, and the highest-probability continuation of
the context is to reproduce the context. The model is not malfunctioning.

The `Dziękuję` line elsewhere in the same transcript is the same artifact with
the *training* prior rather than the prompt supplying the fallback — non-speech
audio in subtitle corpora is overwhelmingly followed by closing boilerplate.
Two fallbacks, one cause. Their co-occurrence is corroboration that these
segments were genuinely empty rather than misheard speech.

**Why it lands on confirmation specifically.** The hint contains approval tokens
and decline tokens in one sentence, which splits the two halves of the system
against each other:

- The **model** sees `Confirmed. Confirm. Yes.` beside a pending proposal and
  calls `confirm_todo_mutation`. Correct behavior given what it was shown.
- The **server** rejects it. `NEGATION` in
  `lib/orb-model/mutation-authorization.ts:31` matches `cancel|stop`, so
  `failsMutationApprovalGuards` short-circuits all three predicates — bare
  affirmation, explicit approval, and the semantic fallback. The 409 at
  `app/api/orb-realtime/turn/route.ts:1366` is surfaced to the user as *"I
  couldn't verify that safely."*

The guard did its job. It was handed a sentence Orb manufactured.

**Nothing downstream filters it.** `lib/hooks/useRealtimeVoiceSpike.ts:774`
gates on `message.transcript?.trim()` and nothing else. Any non-empty string is
accepted as genuine user speech: rendered to the transcript, stored in
`currentUtteranceRef` — which becomes the `trustedUtterance` sent to the server
as the authorization utterance — and used to fire `response.create`.

`app/api/orb-realtime/session/route.ts:21` already sets
`include: ['item.input_audio_transcription.logprobs']`. Per-token logprobs are
requested from the provider on every transcription and **no code reads them**.
The discriminator is on the wire and discarded.

### Defect B — a committed mutation is silently unreported when its turn is abandoned

`confirm_todo_mutation` is deliberately exempted from the tool abort controller
(`useRealtimeVoiceSpike.ts:581`) so a mutation in flight is never torn up. That
is correct. But when the confirm resolves after the user has started a new turn:

- `useRealtimeVoiceSpike.ts:636` — `onMutation()` fires, so the dashboard
  refreshes.
- `useRealtimeVoiceSpike.ts:638` — `if (turnId !== activeTurnIdRef.current)`
  returns early, discarding `exactText` (the canonical spoken receipt).
- `executeToolBatch` returns on the same check before any `response.create`.

**The write commits and Orb never says so.** The row appears; the user is told
nothing. Combined with Defect A's spurious rejection message, the user cannot
distinguish "created silently" from "refused."

This is not an exotic race. Barge-in is an intentional product feature
(§4), so turn abandonment is a *normal, expected event*. The code treats
abandonment as "discard everything in flight," which is right for a read and
wrong for a completed write.

### Confidence ledger

| Claim | Status |
|---|---|
| The prompt string is the source of the phantom utterance | **Verified** — verbatim match, code read |
| The phantom deterministically fails `authorizesPendingMutation` via `cancel\|stop` | **Verified** — regex read |
| The transcript acceptance gate is non-empty-string only | **Verified** — code read |
| logprobs are requested and never consumed | **Verified** — code read, repo-wide grep |
| A committed mutation's receipt is dropped when its turn is superseded | **Verified** — code read |
| Prompt-as-prior-context regurgitation on non-speech audio | **Established model behavior**, not reproduced against `gpt-4o-mini-transcribe` here |
| VAD threshold / padding / far-field reduction manufacture the empty segments | **Inferred from config, untested** |
| Defect B actually fired in the reported session | **Unverifiable.** The numbering gap was the only evidence; the project was hard-deleted with its test user. Claim withdrawn. |
| Shape of the provider's logprobs payload | **Unknown** — see §10 |

---

## 3. Sequencing hazard — read before touching the prompt

**Narrowing the prompt to remove `Cancel. Stop.` would convert a loud failure
into a silent unauthorized mutation.** This is the most important finding in
this document and it inverts the obvious fix.

Trace the hypothetical hint `Orb. Confirmed. Confirm. Yes. Todo. Project.`
through `authorizesPendingMutation`:

- `isBareMutationAffirmation` — still false; the regex is anchored `^…$` and
  `Orb`, `Todo`, `Project` are not affirmation tokens.
- `failsMutationApprovalGuards` — **now passes.** No `?`, no `NEGATION` match
  (the negation words are gone), no retrospective framing.
- `MUTATION_APPROVAL_ACT` — matches `\bconfirm\b`.
- Result: **authorized.** The phantom silently confirms whatever proposal is
  pending.

Today, `Cancel. Stop.` inside the hint is the only reason phantom confirmations
fail loudly instead of committing. It is load-bearing by accident.

**Therefore:** the prompt must not be narrowed before the boundary rejection
(§5, A1) is in place. Dropping the prompt entirely is safe in any order;
narrowing it is not.

---

## 4. Why this is architectural, not a slip

An earlier voice generation (`lib/hooks/useVoiceMode.ts`, still in the tree)
was half-duplex — walkie-talkie turn-taking. It was structurally immune to
Defect A for two independent reasons:

1. It uses the **browser** Web Speech API (`useVoiceMode.ts:259`). That API has
   no `prompt` parameter. There is no hint string to leak.
2. Recognition does not resume while Orb speaks — `speakingRef.current` is
   checked at every resume site (`useVoiceMode.ts:362` and following). Ambient
   noise and Orb's own audio have no open microphone to trigger.

Realtime moved turn ownership from the client to the provider's server VAD. Two
things became possible the moment the microphone stayed open: Orb's own voice
echoing into it (already known — it is why `threshold` went 0.65 → 0.8 on
2026-07-17) and ambient audio manufacturing a user turn. Same root, different
symptoms.

`docs/orb-325-realtime-voice-flow.md` §9 anticipated the second one and scoped
it: *"worst case is a stray word, not a dead session."* That was a defensible
risk acceptance **for the DEV prototype the document describes**. The prototype
was then promoted in place — same file, same `useRealtimeVoiceSpike` name — and
`handleOrbTap` now calls it unconditionally
(`components/UnifiedDashboard.tsx:718`), with no user allowlist left in the
session route. The code moved to production and the risk acceptance stayed
behind. It was also wrong on its own terms: the stray word is not arbitrary, it
is drawn from a fixed string deliberately loaded with confirmation vocabulary.

**Constraint set by Stan, 2026-08-13:** Realtime was chosen to make voice feel
like a normal conversation, and barge-in is an intentional part of that. **No
remediation may trade away barge-in.** Losing context and echoing prompts are
not acceptable. Reverting to half-duplex is therefore out of scope (§6).

---

## 5. Proposed remediation

Layered, in dependency order. Each layer is independently valuable; none is a
substitute for another.

### B1 — never silently swallow a committed mutation *(no dependencies)*

When a tool call returns a receipt for a mutation that actually committed
(`result.receipt && !result.replayed`, the signal already used to trigger
`onMutation()`), its canonical spoken text must survive turn abandonment
instead of being discarded at `useRealtimeVoiceSpike.ts:638`.

Design constraints:

- **Do not speak immediately.** The turn was abandoned because the user is
  talking. Interrupting them to announce a receipt trades one rudeness for
  another. Queue the text and deliver it on the next response.
- **Deliver once.** A queued receipt must not be replayed if the model already
  reported the same commit.
- **Bound the queue.** A receipt that has aged out of relevance is noise; decide
  a discard horizon rather than letting it accumulate.
- Barge-in behavior itself must not change.

This is the highest-value change and the only one with no external dependency.
It fixes the half of the user's experience that reads as "lost track."

### A1 — reject a transcript that is the hint string *(prerequisite for A2)*

Whatever the hint says, any hint can leak. A transcript equal to the configured
prompt is never user speech and must not become a turn: not rendered, not stored
as `currentUtteranceRef`, and not used to fire `response.create`.

Design constraints:

- **Whole-transcript match only, never substring.** A genuine bare `"Confirm."`
  must always pass. Matching a substring would silently destroy real
  confirmations — a worse failure than the one being fixed.
- Normalize conservatively (case, surrounding punctuation/whitespace) and no
  further until there is evidence of variant forms.
- The prompt string currently lives only in the session route. It must move to a
  shared module so client and server agree on what to reject; a divergent copy
  reintroduces the bug silently.
- Log the rejection so the phantom rate is measurable rather than invisible.

### A2 — decide the prompt's content *(blocked on A1 if narrowing; see §3)*

Three options, for Stan in §7. Note the asymmetry: we know exactly what the hint
costs (this defect) and have **never measured what it buys**. It was added on
reasoning about a failure mode, not on an observed rate.

Note also that the hint and the semantic classifier in
`authorizesPendingMutation` are complementary, not redundant: the hint helps
*recognition* (getting the right words out of audio), the classifier helps
*interpretation* (understanding words already transcribed). If ASR mangles
"confirmed" into another script, the classifier only ever sees mangled text.
Dropping the hint has a real cost.

### A3 — logprobs gate on hallucinated transcripts *(blocked on §10)*

The only layer that addresses phantom turns as a **class** rather than this
particular phantom. A transcript hallucinated over empty audio should carry
materially different token logprobs than genuine speech. The data is already
requested and discarded.

Cannot be designed until the payload shape is observed. A threshold invented
against an assumed shape would be untestable and would risk rejecting real
speech — strictly worse than no gate.

---

## 6. Explicitly rejected

- **Revert to half-duplex.** Eliminates the class, but gives up barge-in, which
  Stan has ruled out. The hooks are also not drop-in alternatives:
  `useVoiceMode` feeds the serial `orb-converse` path with its own tool set,
  while the Realtime hook carries the typed Realtime tool contract. Reverting
  means surrendering a tool surface.
- **A special higher bar while a proposal is pending** (floated in discussion,
  withdrawn). If phantom turns stop entering and committed mutations are always
  reported, this solves a problem the other layers have already closed. It adds
  a second authorization mode to maintain for no remaining benefit.
- **Tuning VAD alone.** `threshold` was already raised once for the echo half of
  this same root cause. Tuning changes the *rate* of empty segments and cannot
  make the hallucination path unreachable.

---

## 7. Decisions required from Stan

1. **Prompt content (A2):** drop the hint entirely / narrow it to approval
   vocabulary *after* A1 lands / keep it as-is and rely on A1 + A3.
   **Recommendation: drop it entirely.** Its benefit is unmeasured, its cost is
   demonstrated, and dropping is the only option that is order-independent.
2. **Scope of the first change:** land B1 alone (it has no dependencies and
   fixes the worst of the user experience), or B1 + A1 together.
3. **Whether to pursue A3 at all,** given it requires the capture in §10 and a
   temporary instrumentation change to obtain it.
4. **Whether `docs/orb-325-realtime-voice-flow.md` should be corrected** in the
   same change — its `threshold: 0.65`, its session-route allowlist line, and
   its §9 risk acceptance all describe the pre-promotion world.

---

## 8. Verification plan

Per `AGENTS.md`, this is an Orb-conversation surface, so eval coverage is
mandatory **in the same change** as any code.

- **Eval cases:** new/updated cases in `scripts/eval-cases.ts` with the category
  resolver extended. Tier 1 for any tool-contract change; Tier 2 for changed
  speech/policy behavior (three runs, 2/3 — never reduced to two).
- **Realtime is not covered by serial analogues.** `AGENTS.md` is explicit:
  serial cases do not prove Realtime behavior. Direct route/RPC verification
  plus a documented DEV acceptance pass is required.
- **Gate selection:** A1 and B1 do not change the tool inventory or schemas, so
  the affected categories plus cross-category sentinels
  (`npm run eval:t1 -- --suite smoke --category <category>`) is the expected
  gate. If A2 changes the session prompt, that is a shared/global conversation
  surface and full Tier 1 (`npm run eval:t1`) applies instead.
- **AI tools do not run model evals.** The exact command and result go to Stan,
  and the result is recorded in the handoff verbatim
  (e.g. `Tier 1 smoke+voice 19/19`).
- **Deterministic checks** for the A1 matcher — in particular that a bare
  `"Confirm."`, `"confirmed"`, and every token in the hint *individually* still
  pass, and only the whole string is rejected. This is testable without a model
  call and must not be left to the eval suite.
- **Platforms:** Mac, iPad, and iPhone per the multi-platform rule. B1's queued
  announcement needs a live barge-in test on at least one touch device — the
  behavior it fixes only occurs when the user interrupts.
- **Baseline first.** Before attributing any eval failure to this work, confirm
  whether it fails on `main` too (ORB-367 has seven known pre-existing Tier 2
  failures).

---

## 9. Impact analysis

**Database (design-time, per `AGENTS.md`):** no new query pattern, no new table,
no new column, no Realtime/`postgres_changes` subscription, no change to write
frequency. B1 reuses the receipt already returned by the existing confirm RPC;
A1 and A3 act before any server call. **No schema change and no index is
required.** If implementation drifts toward persisting queued receipts, that
becomes a new table and this section must be revisited before building.

**Performance instrumentation (per the build rule):** required. This changes a
voice interaction path, which is an existing flow in
`docs/object-capability-matrix.md` Part 2, and the reported symptom is a
user-visible reliability failure. Use the ORB-309 `voice` focus area. Minimum
signals: phantom-transcript rejection count (A1), and deferred-receipt
queue/deliver/discard outcomes (B1) — both are needed to know whether the fix
worked in the field rather than only in a test. `docs/object-capability-matrix.md`
Part 2 must be updated in the same change.

**UI catalog:** no new UI pattern is anticipated. B1 delivers through the
existing transcript/speech path. If any visible affordance is added, the
catalog must be consulted first and updated in the same change.

**Release:** patch bump in `package.json` and `lib/version.ts` with a
`lib/changelog.ts` entry, under the mandatory exclusive Release bookkeeping
claim.

---

## 10. Blocked on evidence

**A3 cannot be designed without a real logprobs payload.**

The capture needs the raw `conversation.item.input_audio_transcription.completed`
event, including its logprobs, for a phantom transcript. Constraints:

- The DEV panel's **Copy Realtime trace** will not carry it — that trace
  deliberately records event types and status only, with no transcript or audio
  content (`orb-325-realtime-voice-flow.md` §8). It *will* show the phantom turn
  being created and the turn-abandonment timing for B1.
- Obtaining the payload therefore requires a temporary raw-event log in the
  client handler. **That is itself a code change requiring Stan's approval**,
  and it will put transcript content into the console — acceptable for a local
  DEV capture, not something to leave in.
- Reproduction likely needs a noisy environment rather than pure silence: the
  reported session was a kitchen. A loud non-speech transient clears
  `threshold: 0.8`, opens a segment, and `far_field` noise reduction then strips
  what little signal there was.

Until that capture exists, A3 is unspecified and must not be estimated,
scheduled, or implemented.

---

## 11. Approval

- [ ] Stan has made the §7 decisions
- [ ] Stan has approved implementing a specific layer
- [ ] Stan has approved the temporary instrumentation for the §10 capture (A3 only)

**No implementation may begin until the relevant boxes are checked.**
