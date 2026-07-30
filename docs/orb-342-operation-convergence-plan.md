# ORB-342 — Canonical Orb Operation Convergence

**Status:** implemented; awaiting Stan's conversational/manual acceptance  
**Scope:** serial text and Realtime voice mutation execution  
**Decision:** keep channel-specific model tools as adapters; converge proposal resolution, authorization, database execution, and receipts behind one canonical operation service.

## 1. Problem

Orb currently has three mutation mechanisms:

1. Serial todo mutations store the complete proposed intent in the browser as `PendingMutation` and execute batches one operation at a time in `orb-converse.ts`.
2. Serial project and knowledge updates store a different pending shape in `orb_pending_mutations` and execute TypeScript writes from `lib/orb-mutations.ts`.
3. Realtime mutations store resolved proposals in `orb_realtime_proposals`, confirm them with a signed capability token, and execute a row-locked transactional RPC with stale checks and a durable replay-safe receipt.

This creates two kinds of drift:

- The same domain change has multiple implementations and therefore different safety, audit, and atomicity guarantees.
- The serial and Realtime model contracts evolve separately, so adding a capability to one does not automatically make the underlying operation available to the other.

The Realtime proposal/confirm/RPC path is the strongest existing boundary and becomes canonical.

## 2. Architectural boundary

The model-facing schemas do **not** need to be identical. Text and voice have different interaction constraints, naming, and response shapes. They do need to translate into the same canonical operation.

```text
Serial tool call ─┐
                  ├─> channel adapter ─> canonical proposal service
Realtime tool ───┘                              │
                                                v
                                     orb_realtime_proposals
                                                │
                                shared authorization + confirmation
                                                │
                                                v
                                  confirm_realtime_mutation RPC
                                                │
                                                v
                              domain write + audit + durable receipt
```

The existing database names retain `realtime` for migration compatibility. They become transport-neutral implementation details; renaming a working table and RPC would add deployment risk without improving behavior.

## 3. Canonical contract

Every confirmable mutation becomes a stored proposal with:

- a generated proposal id;
- the authenticated user id;
- a canonical `kind`;
- resolved target ids rather than model-authored names;
- normalized parameters plus optimistic-lock snapshots;
- a five-minute expiry;
- an optional source (`serial` or `realtime`) for diagnostics;
- a stored receipt after execution.

The canonical service exposes four responsibilities:

1. **Resolve and propose** — validate input, resolve human references to accessible rows, snapshot target state, and persist the exact intent.
2. **Issue/read a signed capability** — the browser may hold a signed proposal id, but never the mutation intent.
3. **Authorize** — evaluate the trusted current user utterance using the existing shared authorization grammar.
4. **Confirm** — invoke the single database dispatcher and return its durable receipt, including replay status.

Both channels may use upfront permission. In that case they still create the durable proposal first and immediately confirm that exact stored proposal.

## 4. Operation coverage

The first complete convergence covers every existing confirmable domain mutation:

| Domain | Canonical kinds |
|---|---|
| Todo | `create_todo`, `update_todo`, `delete_todo`, `move_todo`, `close_todo`, `batch_todo_action` |
| Project | `create_project`, `update_project`, `delete_project` |
| Knowledge | `add_knowledge`, `update_knowledge` |

Preferences, memories, dormancy, tickets, adaptation proposals, and developer messages are authenticated commands but are not currently confirmable destructive mutations. They remain outside this proposal transaction in ORB-342. Their read/write handlers can later move into shared operation modules without changing this safety boundary.

## 5. Compatibility rules

- Preserve the serial `ORB_TOOLS` names and Realtime `propose_*` names so prompt behavior and provider schemas do not churn together.
- Preserve serial support for descriptions, priorities, due dates/reminders, and resolution notes by extending the canonical proposal/RPC parameters before removing the legacy executor.
- Preserve Realtime close semantics: closing requires resolution notes and creates the associated knowledge record transactionally.
- Preserve serial response fields (`refresh`, `mutatedProductId`, `mutationType`, `newProject`) by deriving them from canonical receipts.
- A batch is all-or-nothing. No serial fallback may execute batch items sequentially.
- A confirmation may be replayed safely; the stored receipt is returned without a second domain write.
- Ambiguous references and stale target snapshots fail closed.

## 6. Migration sequence

1. Extract signing, proposal persistence, proposal resolution, and confirmation into `lib/orb-operations/`.
2. Make the Realtime route call that service with no intended behavior change.
3. Extend the canonical SQL dispatcher for serial-only todo fields and transport-neutral receipt metadata.
4. Replace serial browser-held todo intent with a signed canonical proposal reference.
5. Replace serial `orb_pending_mutations` project/knowledge handling with the same canonical proposal reference.
6. Remove the obsolete TypeScript executors and old pending table access after every caller has migrated.

The old `orb_pending_mutations` table is not dropped in the first deployment. It becomes unused and can be removed in a later cleanup after production verification, avoiding an irreversible rollback dependency.

## 7. Database impact

- **New query pattern:** serial confirmation will insert into `orb_realtime_proposals` and confirm by primary key, matching the existing Realtime pattern. Existing primary-key and `(user_id, created_at DESC)` indexes cover it.
- **Realtime/WAL:** no `postgres_changes` subscription is added.
- **Write frequency:** one proposal insert and one proposal receipt update per confirmed mutation, matching current Realtime behavior. This occurs per user action, never per render or keystroke.
- **New table:** none.
- **New queried columns:** a transport/source diagnostic column may be added but will not be used in `WHERE` or `JOIN`, so it needs no index.
- **RLS:** the existing proposal table remains service-role-only; the authenticated user is rechecked inside the security-definer confirmation functions.

The pre-change health audit found existing high cumulative sequential reads on `todos`, `orb_model_requests`, `knowledge_repo`, and `projects`, but the top disk-reading statements were effectively cache-resident. ORB-342 does not add broad scans to confirmation; proposals are addressed by primary key and target rows by primary key. Existing bloat above 20% was observed on several small auth/metrics tables and is not attributable to this change.

## 8. Performance instrumentation

No new telemetry system is needed. Existing serial submit measurements and Realtime turn measurements already enclose the operation call. Both adapters will add canonical receipt/replay metadata to those existing measurements so comparisons remain available under the existing `dashboard-clicks`/conversation and `voice` focus areas. The convergence removes serial's sequential batch round trips, so batch confirmation should become one RPC.

## 9. Verification

- TypeScript and production build must pass.
- Static tests must verify token ownership/expiry, proposal normalization, receipt mapping, and no remaining serial direct todo/project/knowledge executor.
- `scripts/eval-cases.ts` must cover serial proposal creation, confirmation, upfront permission, and batch behavior using the new canonical path.
- Stan runs `npm run eval:t1`; the AI does not run model evals.
- Manual acceptance covers Mac, iPad, and iPhone for text and voice confirmation, including replay/duplicate confirmation and stale-target rejection.

## 10. Implemented outcome

- `lib/orb-operations/` now owns proposal capabilities, persistence, confirmation, and serial todo normalization.
- Every application insert into `orb_realtime_proposals` goes through `persistOrbMutationProposal`.
- Serial todo/project/knowledge confirmation and Realtime confirmation both invoke `confirmOrbMutation`, which calls the same database dispatcher.
- The direct todo/project/knowledge executors were removed from `orb-converse.ts` and `lib/orb-mutations.ts`.
- Serial Knowledge Repository creates are now confirmed proposals instead of immediate unreceipted writes.
- `scripts/verify-orb-342.sql` passed with all writes rolled back: singular serial metadata, replay, rich atomic batch, project create, knowledge create, and knowledge update.
- The production build and TypeScript checks pass. The repository-wide lint still has pre-existing errors in `app/prototype/voice/page.tsx`; all ORB-342 runtime files pass scoped lint (the contract generator reports its four existing warnings).
