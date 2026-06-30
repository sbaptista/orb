# Orb Action Transaction Thesis

Status: first approximation implemented in v0.6.84.
Date: 2026-06-29.

## Thesis

Orb requires a product-level transaction record for actions.

Provider/model instrumentation can help the model choose tools and follow instructions, but it cannot own Orb-specific truth: which records were targeted, which operations are waiting for approval, which writes actually completed, and what the user is allowed to hear as a verified outcome.

## First Approximation

The first approximation is intentionally small and shared by both text and voice:

- Text and voice still enter the same `orbConverse` path.
- Todo mutation tool calls are collected into one pending action transaction for the turn.
- Verified todo action batches are recorded as session action sets, including the actual task codes.
- Action sets are kept in memory and mirrored to `sessionStorage` with the conversation transcript, so same-tab reloads can recover references such as "the first five" or "delete them."
- A pending action can contain one or many operations.
- The app returns deterministic confirmation language from that pending action.
- A bare affirmation executes exactly the stored operations before another model call.
- A decline cancels the pending action.
- A status question such as "is it set?" while an action is pending gets a deterministic "not yet" answer and keeps the pending action available.
- The Orb may still interpret user intent and choose tools, but it no longer narrates todo mutation success before verified execution.

Project mutations keep the existing server-held `orb_pending_mutations` flow for now.

## Why This Is Not Yet a Workflow Engine

This pass deliberately does not add new database tables or persistent transaction history. It tests whether a short-lived action transaction in the shared conversation path removes the observed failure mode:

- "add three" should not create two records while holding one for confirmation.
- "confirm" should not re-interpret the request.
- text and voice should share action truth.
- questions about a pending action should not accidentally execute it.

If this works, persistence can be considered only for cases that need recovery across refreshes, devices, or longer gaps.

The current action-set ledger is not a durable cross-device journal. It survives same-tab reloads through `sessionStorage`, but not a different device, browser profile, or cleared transcript. If the network fails after database writes complete but before the final action-set response reaches the client, the database remains true but the session ledger may be incomplete. In that case Orb should fall back to clarification or a fresh lookup rather than guessing.

## Verification Targets

Stan-run voice/text checks:

- Text: ask to add three todos; confirm; verify exactly three are created.
- Voice: ask to add three todos; confirm; verify exactly three are created and the spoken result matches the transcript.
- Text and voice: ask to update one todo; before confirming, ask "is it set?"; Orb should say not yet and keep the confirmation available.
- Text and voice: decline a pending action; verify no write occurred.
- Batch partial failure, if reproducible: verify successes and failures are reported separately.

Eval coverage:

- `batch-create-three-todos` checks that the model emits three `create_todo` calls for a three-todo request.

## Tune Or Abandon

Tune the thesis if:

- batch operations stop duplicating or losing items;
- confirmation executes exactly the stored operations;
- voice becomes shorter without hiding action truth;
- latency stays roughly flat because no extra model turn is added for confirmation.

Abandon or replace the thesis if:

- the transaction layer duplicates existing tool results without reducing errors;
- ambiguity still relies mostly on model memory;
- latency or code complexity climbs faster than reliability improves;
- text and voice require divergent action paths.

## Database Impact

No schema change.

No new query pattern, table, Realtime subscription, or high-frequency write path was added in the first approximation. Todo execution uses the same Supabase insert/update/delete calls as the existing shared conversation path. Session action sets are browser `sessionStorage`, not database writes.
