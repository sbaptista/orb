# Orb Action Transaction Thesis

Status: canonical implementation completed by ORB-342.
Original approximation: v0.6.84, 2026-06-29.
Canonical convergence: 2026-07-29.

## Thesis

Orb requires a product-level transaction record for confirmable actions.

Provider/model instrumentation can help a model choose tools and follow instructions, but it cannot own Orb-specific truth: which records were targeted, which operation is waiting for approval, which writes actually completed, or what the user may hear as a verified outcome.

## Canonical implementation

Serial text and Realtime voice retain channel-appropriate model tool schemas, then translate those calls into the same operation spine:

1. The server resolves names/codes to accessible row ids and snapshots mutable target state.
2. It persists the exact intent in `orb_realtime_proposals`. The historical table name is retained for deployment compatibility; `channel` distinguishes serial and Realtime proposals.
3. The shared authorization grammar evaluates the trusted current user utterance. Upfront permission still creates the proposal before confirming it.
4. `confirm_realtime_mutation` dispatches to the domain transaction. The historical RPC name is also retained for compatibility.
5. The transaction locks the proposal and target rows, rejects stale state, performs the domain write and audit write atomically, stores a canonical receipt, and returns that receipt on replay without writing twice.

The browser may temporarily retain a signed proposal id or a one-release legacy compatibility shape, but it never owns new mutation intent. New serial proposals are server-held.

## Covered operations

- Todos: create, update, soft-delete, move, close, and all-or-nothing create/update/delete/move batches.
- Projects: create, update, and permanent delete.
- Knowledge Repository: create and update.

Closing remains singular because every close requires its own resolution notes and Knowledge Repository entry. Batch todo operations preserve serial's richer metadata fields while using Realtime's atomic receipt boundary.

Preferences, memories, dormancy, tickets, adaptation proposals, developer messages, and client navigation are authenticated commands but are not confirmable CRUD transactions in ORB-342.

## Action sets versus proposals

The session action-set ledger still records verified result codes so follow-ups such as "delete the first five" can resolve a previously created set. It is a conversational reference ledger, not the mutation authority.

`orb_realtime_proposals` is the mutation authority. It survives a dropped response, supports replay, and is safe across browsers/devices because the intent and receipt live in the database.

## Verification

`scripts/verify-orb-342.sql` executes inside a transaction and rolls every write back. It verifies:

- a serial-only todo field is applied inside canonical confirmation;
- a repeated confirmation returns the same receipt without a second write;
- a rich create/update batch preserves metadata atomically;
- project creation uses the same dispatcher;
- Knowledge Repository create/update use the same dispatcher.

Conversational evals continue to verify that the models select the expected tools and confirmation tool. They do not substitute for direct database transaction verification.

## Database impact

ORB-342 adds no table and no Realtime subscription. It adds `channel` and `summary` to the existing proposal table plus a partial `(user_id, channel, created_at DESC)` index for pending lookup. Mutations add one proposal insert and one receipt update per confirmed action; proposal and target confirmation lookups are primary-key based.
