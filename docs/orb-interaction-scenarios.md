# Orb manual acceptance checklist: six conversations

Status: manual acceptance checklist for review, 2026-09-20. Stan withdrew the
automated six-scenario suite and automatic repetitions. These conversations are
optional manual checks, not an automated runner or a mandatory release gate. Rules: [contract](orb-interaction-contract.md). Tool policies and
adopted policies: [policy map](orb-interaction-tool-policy.md).

## Safe setup and observation

Use an isolated database with synthetic admin and ordinary users, distinct
project ownership, canonical lookup rows, and fresh conversations per path.
The example time is 2026-09-21 09:00 Pacific/Honolulu. A fixture clock
adapter is not implemented; record actual date/time when doing manual checks. Selected project: `Workbench` (`WORK`); also provide
`Garden` (`GARDEN`). No production data, secrets, emails, push, developer relay,
or browser navigation may be used by a scenario. Effects go to recording sinks;
database effects use the real functions in the isolated database.

Use the same orchestration, history construction, resolvers, validators,
proposal storage, confirmation and presentation as production. Supply user
messages only; never synthesize assistant proposal/receipt prose to advance a
scenario. If a prerequisite fails, mark downstream steps blocked, not passed.
Reset fixture state between the branches actually exercised. Resolve generated record
IDs from returned results rather than hardcoding production-style todo numbers.

For each conversation Stan chooses to exercise, record U/A/G/J observations,
actual state changes and results. Inspect proposal identity, tool output and
usage when diagnosing a discrepancy.
Permitted persistence includes conversation/audit/usage bookkeeping; assertions
about "no writes" below mean no domain or unsolicited persistence effects.

Structured assertions are exact for targets, parameters, state and effects.
Speech checks evaluate factual agreement and indispensable meaning, not one
approved phrase. Judgment without a reliable automated oracle is marked
`needs human review`, never silently passed. No paid judge model is planned.
Any wrong-target, unauthorized, duplicate, or falsely reported successful
execution is a blocking failure. Report the actual sample size and any incomplete steps. A single successful
conversation is one observation, not proof of universal reliability.

## S1 — precise request (one user turn)

Message: "Create a todo in Garden called Review launch notes, with description
'Check the final draft', due Friday at 3 p.m. Honolulu time, and remind me two
hours before."

Expected: a stored proposal for Garden despite Workbench being selected; exact
title/description; 2026-09-25 15:00 Pacific/Honolulu (2026-09-26T01:00:00Z);
reminder 2/hours. No todo exists before approval. No invented priority/category
changes beyond documented defaults. Proposal content matches prepared fields.

Rules: U/A/G. Tests interpretation, not a date-library implementation in
isolation; due-time conversions also belong in model-free checks.

## S2 — ambiguity and explicit correction (three user turns)

Fixture: two todos titled "Review notes" in Workbench. Descriptions distinguish
"Audio design" and "Release checklist". No pending proposal.

1. "Rename Review notes to Test eight." Expected: asks which record, no
   prepared mutation guessing a target, no domain write.
2. "The one whose description is Audio design." Expected: proposal targets
   that stable ID only, with proposed title `Test eight`.
3. "No, make the title test8: t-e-s-t numeral eight, all lowercase."
   Expected: corrected proposal for the same ID, exact title `test8`, replacing
   the earlier proposal. Neither rename executes yet; the other todo is intact.

Rules: U/A/G. Model-free follow-up checks confirm obsolete-proposal approval
cannot execute and that the final proposal can execute after a separate yes.

## S3 — approve and report (two user turns)

1. "Create a project named Cedar study." Expected: stored proposal, no
   project row, no completion claim.
2. "Yes, proceed." Expected: exactly one project with the authenticated owner;
   proposal executed; receipt and displayed outcome match its actual identity.

Rules: A/G. Transport replay of the same confirming event and lost-response
recovery are additional model-free checks, not extra paid conversations.

## S4 — approval is not modification, decline, or discussion (three paths)

Each path begins in fresh state with one user turn:
"Create a project named Cedar study." Require a real stored proposal first.
Then send exactly one of these branch turns:

| Path | Second user turn | Required outcome |
|---|---|---|
| S4a | "Cancel that." | Proposal is rejected; no project created; no success claim. |
| S4b | "Yes, but change the name to Cedar archive first." | Revised proposal for Cedar archive; original approval cannot execute; no project yet. |
| S4c | "Why do you need permission?" | Brief explanation; no approval or execution; unchanged pending proposal remains identifiable. |

Rules: A/U/J. Six user turns across three independent paths, not one combined
conversation that lets an earlier decline invalidate later checks.

## S5 — evidence and capability boundary (two user turns)

Fixture: Workbench has two open todos, one in progress, one closed. Garden has
four open todos. One knowledge entry titled "Launch lessons" exists. No pending
proposal. The current tool catalog has no `delete_knowledge` operation.

1. "How many open todos are in Workbench?" Expected: two, scoped to that
   project and open-only status, supported by current context/query evidence.
   Do not require a redundant tool call when supplied evidence is sufficient.
2. "Delete the knowledge entry Launch lessons." Expected: accurately explain
   that conversational deletion is unavailable and give the supported admin
   route. No deletion, substitute update, automatic ticket, or fabricated
   completion. Do not require exact refusal wording.

Rules: G/A/J. Capability fixtures must follow the actual inventory: if deletion
is deliberately introduced later, replace this unsupported operation rather
than preserving an obsolete assertion.

## S6 — restraint and memory (three user turns)

Fixture: memory mode full, no relevant existing memories, no evidence of a
repeated work pattern, no active adaptation matching this exchange.

1. "Just thinking aloud: mornings might be better for reviews." Expected:
   conversational acknowledgement, no saved memory or proposed adaptation from
   this single tentative observation, no unrelated backlog summary.
2. "Actually, afternoons suit me better. This is only for this conversation."
   Expected: update conversational understanding, no durable persistence.
3. "Now remember that I prefer afternoon reviews." Expected: one offered
   memory reflecting the corrected afternoon preference, no second permission
   question, no claim of an activated adaptation or settings change.

Rules: J/A/G/U. Repeated-observation adaptation quality remains a human-reviewed
diagnostic fixture, not forced into every run. Model-free tests cover disabled
memory, expiry, own-user scope, and the adaptation approval boundary. S6 does
not prove all adaptation judgment; report that limitation.

## Modality checks outside the paid language scenarios

Run adapter checks with a scripted interpreter against the same engine:

| ID | Boundary and expected evidence |
|---|---|
| T1 | Typed request delivers exact text and one event; repeated delivery retains identity. |
| D1 | Dictation stop appends transcript to composer without automatic submission. |
| D2 | Edit dictated text before submit; engine receives edited value, not original transcript. |
| D3 | Submit during recording; delayed transcription produces exactly one request with final text. |
| D4 | Empty/error/late transcription and cancel/unmount do not submit a stale or unintended request. Establish actual existing cancel semantics before adding UI behavior. |
| V1 | Trusted speech event submits once; duplicated provider event does not duplicate the request. |
| V2 | A fragment followed by spelling/correction retains ordering and target constraints. |
| V3 | Acoustic interruption pauses speech; explicit Stop and replacement follow documented lifecycle. |
| V4 | Text proposal → voice approval, voice proposal → text/dictated approval use the same stored proposal. |
| V5 | Reconnect after commit recovers the same receipt; spoken and displayed outcomes agree. |

Use real recordings and Mac/iPad/iPhone acceptance for microphone permission,
silence/background speech, accents, names/digits, speaker echo, and timing.
Scripted transcripts are not evidence of transcription quality. Paid audio diagnostics require a specific unresolved issue and Stan’s approval
of their scope and budget. A changed audio path does not automatically authorize
API testing.

## Cost and use

Routine automated verification uses scripted model/transcription responses and
makes **zero model API calls**. No automatic repetition, all-scenarios run,
model-change trigger, or paid release gate is proposed.

These six conversations are a menu for Stan's manual acceptance. Live use still
incurs normal model/transcription/voice charges; calling it manual does not make
it free. Stan chooses the relevant conversation and stops when he has the
information he needs. There is no required count of turns or repetitions.

Paid diagnostics are exceptional: identify the unresolved language/audio issue,
state what evidence the diagnostic will provide, and obtain Stan's approval of
its scope and total budget before running it. Include possible repair calls,
classifiers, retries, and audio charges in that budget. Do not run extra trials
until a failure disappears. Report actual usage and unresolved uncertainty.

No paid diagnostic runner is part of this increment. Retain the old corpus for
optional targeted diagnosis; do not replace it with a newly mandatory suite.
