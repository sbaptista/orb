# Orb verification transition

Status: local implementation, 2026-09-20. Mandatory paid release gates and
automatic Tier 2 repetition have been removed. All historical cases remain. The [contract](orb-interaction-contract.md),
[tool map](orb-interaction-tool-policy.md), and
[manual acceptance checklist](orb-interaction-scenarios.md) describe implementation and remaining acceptance gaps.

## Baseline

Source inventory at v0.6.331: 127 cases (85 Tier 1, 42 Tier 2). At that baseline, the
runner scheduled 211 case executions for both tiers. Eight definitions are
marked model-free, totaling 12 executions; the nominal primary-model count is
199 (79 Tier 1 + 120 Tier 2), before retries and auxiliary classification.
Smoke is 7 calls; serial-tool-contract plus smoke is 37 nominal calls. The
separate strategic manifest defines 60 jobs across two models when fully run.
These are static counts, not measured spending or evidence of passing tests.

The current endpoint does not execute requested domain tools. It defaults the
approval preference to allow and mirrors portions of production, so it cannot
establish transaction, delivery, or recovery guarantees. Voice-mode text cases
do not test hearing. The interaction verifier already covers some pure helpers;
the command-batch SQL verifier checks structure/privileges/function text, not
competing transactions. Source inspection is not integration acceptance.

## Replacement layers

| Layer | Intended verification | Paid model requests |
|---|---|---|
| D — deterministic | Shared validation, scope resolution, formatting, lifecycle transitions, permission rejection, model routing, and scripted transport delivery. | None |
| I — integration | Actual production RPCs in isolated database: stale proposals, identity, rollback, concurrent approvals, commit/stop ordering, replay, receipt recovery. | None |
| S1–S6 — manual acceptance | Optional conversations chosen by Stan; language interpretation and judgment. No automatic suite or repetitions. | Normal live-use charges; not a routine automated gate |
| X — diagnostic | Historical wordings for a specific unresolved issue. | Only with Stan’s approval of scope and budget |
| Audio/device | Scripted transport checks plus optional live microphone/turn-taking acceptance. | Live-use charges; paid diagnostics separately approved |

D and I are complementary. A scripted model or mocked database passing a test
cannot be reported as transaction correctness. Conversely, a rejected unsafe
tool call can demonstrate server safety while still exposing poor model
interpretation; record both outcomes.

## Rollout and acceptance

1. Approved P1–P3 recommendations are implemented in the shared engine: scoped
   reads, constrained joins, admin relay access, memory evidence, and unchanged
   direct-effect policies. The four responsibilities replace the principles list.
2. `npm run verify:interaction` exercises production helpers and confirmation
   orchestration with injected fake I/O. It makes no model/database requests.
3. `scripts/verify-orb-transactions.sql` is prepared for a local disposable
   migrated database with synthetic users. It checks real RPC refusal, replay,
   rollback, replacement, and stop versus acoustic interruption. Not executed:
   no PostgreSQL server or container runtime was found. Concurrency across
   connections and permission changes remain separate missing evidence.
4. Optional manual/device acceptance remains unrun. No paid diagnostic ran.
5. The old runner now refuses ordinary broad invocation. Paid use requires
   `--allow-paid --id <ids>`; both tiers default to one execution. `--runs` is
   explicit and is not a provider-call/dollar cap. Approval must cover the
   expected provider work, including repairs. No new paid runner was created.

Routine verification makes zero model API calls, including after interpretation,
provider/model, or shared-instruction changes. Those changes can warrant manual
review, but do not automatically trigger a paid suite. Tool schema/inventory
changes require offline schema/dispatch coverage for every exposed tool. A
specific unresolved language or audio question may justify a diagnostic only
with Stan's explicit scope and budget approval. Do not label model quality
verified merely because the deterministic checks pass.

Stan's latest instruction supersedes contrary automatic-paid-testing expectations.
The offline checks demonstrate boundary handling, not model judgment, real RLS
behavior, database concurrency, or audio understanding. Existing case disposition
below remains a proposal; the entire 127-case corpus has not been replaced.

## Proposed case disposition

The inventory below names every existing case once. It is a migration map,
not evidence that replacement tests exist. D/I destinations require execution
coverage; S destinations refer to optional manual observations, not automatic tests or
substitutes for deterministic evidence. X keeps explicitly budget-approved diagnostics outside the routine gate. Retire a paid
case only after the relevant replacement and any residual risk are reviewed.

Exact fixtures for multilingual approval, reminder/place extraction, bulk
operations, special roles, and knowledge visibility remain valuable diagnostics
even when their common lifecycle moves to D/I. The six families cannot establish
universal language coverage or all subjective adviser quality.

| Existing case | Proposed destination | Verification purpose |
|---|---|---|
| `create-default-project` | D/I; manual S1/S2/S3; X | Operation validation and execution; special extraction remains diagnostic. |
| `create-preserves-description` | D/I; manual S1/S2/S3; X | Operation validation and execution; special extraction remains diagnostic. |
| `update-preserves-description` | D/I; manual S1/S2/S3; X | Operation validation and execution; special extraction remains diagnostic. |
| `create-with-named-timezone-and-reminder` | D/I; manual S1/S2/S3; X | Operation validation and execution; special extraction remains diagnostic. |
| `create-with-city-that-is-not-an-iana-zone` | D/I; manual S1/S2/S3; X | Operation validation and execution; special extraction remains diagnostic. |
| `create-with-custom-month-reminder-lead` | D/I; manual S1/S2/S3; X | Operation validation and execution; special extraction remains diagnostic. |
| `batch-create-three-todos` | D/I; manual S1/S2/S3; X | Operation validation and execution; special extraction remains diagnostic. |
| `create-after-hallucinated-history` | D/I; manual S3/S5 | Receipt provenance and truthful presentation. |
| `confirmed-create-after-approval-tool` | D/I; manual S3/S4; X | Proposal binding and execution; unusual language remains diagnostic. |
| `delete-project-calls-tool` | D/I; manual S1/S2/S3; X | Operation validation and execution; special extraction remains diagnostic. |
| `delete-project-three-targets-builds-complete-command-batch` | D/I; manual S1/S2/S3; X | Operation validation and execution; special extraction remains diagnostic. |
| `bulk-delete-project-todos-calls-tools` | D/I; manual S1/S2/S3; X | Operation validation and execution; special extraction remains diagnostic. |
| `delete-first-action-set-resolves-by-ledger` | D | Already server-owned; move out of model runner. |
| `confirm-mutation-executes-on-yes` | D/I; manual S3/S4; X | Proposal binding and execution; unusual language remains diagnostic. |
| `pending-create-undercount-corrects-without-expanding` | D | Already server-owned; move out of model runner. |
| `confirm-mutation-doubled-affirmation` | D/I; manual S3/S4; X | Proposal binding and execution; unusual language remains diagnostic. |
| `confirm-mutation-typing-error` | D/I; manual S3/S4; X | Proposal binding and execution; unusual language remains diagnostic. |
| `confirm-knowledge-save-executes-on-yes` | D/I; manual S3/S4; X | Proposal binding and execution; unusual language remains diagnostic. |
| `confirm-ticket-create-executes-on-yes` | D/I; manual S3/S4; X | Proposal binding and execution; unusual language remains diagnostic. |
| `no-session-record-looks-up-before-delete` | D/I; manual S1/S2/S3; X | Operation validation and execution; special extraction remains diagnostic. |
| `upfront-permission-still-emits-creates` | D/I; manual S3/S4; X | Proposal binding and execution; unusual language remains diagnostic. |
| `confirm-mutation-not-called-on-decline` | D/I; manual S3/S4; X | Proposal binding and execution; unusual language remains diagnostic. |
| `confirm-mutation-not-called-with-nothing-pending` | D/I; manual S3/S4; X | Proposal binding and execution; unusual language remains diagnostic. |
| `permission-complaint-does-not-confirm` | D/I; manual S3/S4; X | Proposal binding and execution; unusual language remains diagnostic. |
| `explicit-sentence-approval-confirms` | D/I; manual S3/S4; X | Proposal binding and execution; unusual language remains diagnostic. |
| `non-english-confirmation-confirms` | D/I; manual S3/S4; X | Proposal binding and execution; unusual language remains diagnostic. |
| `disambiguation-pick-routes-to-delete` | D; manual S2 | Correction/ambiguity; real hearing remains separate. |
| `switch-project-partial-name-resolves` | D/I; manual S1/S2/S3; X | Operation validation and execution; special extraction remains diagnostic. |
| `restated-request-reproposes-not-confirms` | D/I; manual S3/S4; X | Proposal binding and execution; unusual language remains diagnostic. |
| `create-project-exact-name` | D/I; manual S1/S2/S3; X | Operation validation and execution; special extraction remains diagnostic. |
| `voice-create-first-project-without-selection` | D/I; manual S1/S2/S3; X | Operation validation and execution; special extraction remains diagnostic. |
| `rename-project-proposes` | D/I; manual S1/S2/S3; X | Operation validation and execution; special extraction remains diagnostic. |
| `create-explicit-project` | D/I; manual S1/S2/S3; X | Operation validation and execution; special extraction remains diagnostic. |
| `query-uses-tool` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `query-presentation-preserves-format-and-fields` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `conversational-no-tool` | D where structured; manual S6; X | Presentation and restraint; retain subjective wording as optional review. |
| `greeting-no-automatic-summary` | D where structured; manual S6; X | Presentation and restraint; retain subjective wording as optional review. |
| `knowledge-search-tool` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `knowledge-precise-read-after-update` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `query-projects-tool` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `query-users-admin-read` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `query-invitations-admin-read` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `query-tickets-admin-lookup` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `ticket-status-shorthand-followup-checks-live-tickets` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `general-bugs-question-checks-tickets-too` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `bugs-question-filters-todos-by-category` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `ticket-code-rejected-as-todo-mutation` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `query-projects-dormant` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `knowledge-entry-not-todo-cold-start` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `update-knowledge-correction-tool` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `update-knowledge-vague-reference-searches-first` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `update-knowledge-no-self-attribution` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `no-knowledge-delete-tool` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `repository-inspection-tool` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `explicit-strategic-read-routes-to-gemini` | D; X | Routing/calculations; subjective adviser quality remains diagnostic. |
| `mutation-stays-on-operational-route` | D; X | Routing/calculations; subjective adviser quality remains diagnostic. |
| `voice-status-question-stays-operational` | D; X | Routing/calculations; subjective adviser quality remains diagnostic. |
| `voice-provider-uses-context` | D; X | Routing/calculations; subjective adviser quality remains diagnostic. |
| `active-model-identity-kimi-is-server-stamped` | D | Already server-owned; move out of model runner. |
| `active-model-identity-haiku-is-server-stamped` | D | Already server-owned; move out of model runner. |
| `strategic-budget-preserves-operations` | D | Already server-owned; move out of model runner. |
| `one-model-strategic-route-stays-tool-free` | D; X | Routing/calculations; subjective adviser quality remains diagnostic. |
| `scope-transparency` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `distant-reminder-does-not-make-orb-urgent` | D; X | Routing/calculations; subjective adviser quality remains diagnostic. |
| `reminder-nudge-decline-dismisses` | D; X | Routing/calculations; subjective adviser quality remains diagnostic. |
| `reminder-nudge-decline-does-not-set-a-reminder` | D; X | Routing/calculations; subjective adviser quality remains diagnostic. |
| `admin-not-told-a-false-ownership-limit` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `ambiguous-todo-title-does-not-mutate-silently` | D; manual S2 | Correction/ambiguity; real hearing remains separate. |
| `realtime-orb-state-intent-analogue` | D; X | Routing/calculations; subjective adviser quality remains diagnostic. |
| `orb-mood-names-the-driving-task` | D; X | Routing/calculations; subjective adviser quality remains diagnostic. |
| `orb-window-uses-project-override-not-default` | D; X | Routing/calculations; subjective adviser quality remains diagnostic. |
| `orb-mood-calm-project-has-no-invented-cause` | D; X | Routing/calculations; subjective adviser quality remains diagnostic. |
| `project-health-count-status-definitions` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `cross-project-awareness` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `ambiguous-ui-referent-clarifies` | D; manual S2 | Correction/ambiguity; real hearing remains separate. |
| `refuses-unknown-feature` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `uses-display-name` | D where structured; manual S6; X | Presentation and restraint; retain subjective wording as optional review. |
| `project-list-hides-internal-code-tags` | D where structured; manual S6; X | Presentation and restraint; retain subjective wording as optional review. |
| `project-count-distinguishes-visible-from-active-task-projects` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `whats-new` | D where structured; manual S6; X | Presentation and restraint; retain subjective wording as optional review. |
| `mutation-approval` | D/I; manual S3/S4; X | Proposal binding and execution; unusual language remains diagnostic. |
| `strategic-guidance-scoping` | D; X | Routing/calculations; subjective adviser quality remains diagnostic. |
| `strategic-guidance-known-code` | D; X | Routing/calculations; subjective adviser quality remains diagnostic. |
| `resolve-duplicate-searches-first` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `no-lazy-escalation-on-lookup` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `exact-task-read-no-invented-blockers` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `mutation-no-premature-success` | D/I; manual S3/S5 | Receipt provenance and truthful presentation. |
| `ticket-no-premature-success` | D/I; manual S3/S5 | Receipt provenance and truthful presentation. |
| `mutation-no-code-fabrication` | D/I; manual S3/S5 | Receipt provenance and truthful presentation. |
| `close-todo-linked-ticket-tool` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `realtime-exact-title-update-analogue` | D/I; manual S1/S2/S3; X | Operation validation and execution; special extraction remains diagnostic. |
| `realtime-move-intent-analogue` | D/I; manual S1/S2/S3; X | Operation validation and execution; special extraction remains diagnostic. |
| `realtime-add-knowledge-intent-analogue` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `add-knowledge-does-not-claim-completion-before-confirm` | D/I; manual S3/S4; X | Proposal binding and execution; unusual language remains diagnostic. |
| `realtime-query-audit-intent-analogue` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `realtime-set-preference-intent-analogue` | D/I; manual S6; X | Persistence boundaries; judgment remains manual review. |
| `realtime-set-dormancy-intent-analogue` | D where structured; manual S6; X | Presentation and restraint; retain subjective wording as optional review. |
| `realtime-query-capabilities-intent-analogue` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `realtime-send-developer-intent-analogue` | D where structured; manual S6; X | Presentation and restraint; retain subjective wording as optional review. |
| `realtime-query-db-intent-analogue` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `realtime-query-db-schema-column-intent-analogue` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `memory-save-offered` | D/I; manual S6; X | Persistence boundaries; judgment remains manual review. |
| `memory-recall` | D/I; manual S6; X | Persistence boundaries; judgment remains manual review. |
| `get-preferences-tool` | D/I; manual S6; X | Persistence boundaries; judgment remains manual review. |
| `unsupported-commitment-no-false-promise` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `reflective-no-false-mutation` | D/I; manual S1/S2/S3; X | Operation validation and execution; special extraction remains diagnostic. |
| `approval-follow-through` | D/I; manual S3/S4; X | Proposal binding and execution; unusual language remains diagnostic. |
| `voice-list-voices` | D where structured; manual S6; X | Presentation and restraint; retain subjective wording as optional review. |
| `voice-exit-command` | D where structured; manual S6; X | Presentation and restraint; retain subjective wording as optional review. |
| `voice-garbled-input-clarifies` | D; manual S2 | Correction/ambiguity; real hearing remains separate. |
| `voice-project-state-uses-brief-summary` | D | Already server-owned; move out of model runner. |
| `voice-current-project-status-update-uses-brief-summary` | D | Already server-owned; move out of model runner. |
| `voice-owned-active-count-stays-grounded` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `voice-project-open-count-stays-scoped` | D/I; manual S5; X | Data scope, capability boundaries and factual presentation. |
| `project-role-correction-offers-to-remember` | D/I; manual S6; X | Persistence boundaries; judgment remains manual review. |
| `propose-adaptation-after-repeated-correction` | D/I; manual S6; X | Persistence boundaries; judgment remains manual review. |
| `voice-shared-history-recalls-text-turn` | D; manual S2/S6 | History delivery and interpretation of corrections. |
| `voice-upfront-permission-still-requires-later-confirmation` | D/I; manual S3/S4; X | Proposal binding and execution; unusual language remains diagnostic. |
| `voice-spelled-project-name-preserves-identifier` | D; manual S2 | Correction/ambiguity; real hearing remains separate. |
| `voice-confirmation-survives-unrelated-interruption` | D/I; manual S3/S4; X | Proposal binding and execution; unusual language remains diagnostic. |
| `hallucinated-proposal-history-new-create-calls-tool` | D/I; manual S3/S5 | Receipt provenance and truthful presentation. |
| `hallucinated-unbacked-proposal-confirmation-proposes-for-real` | D/I; manual S3/S4; X | Proposal binding and execution; unusual language remains diagnostic. |
| `premature-success-unbacked-receipt-not-repeated` | D/I; manual S3/S5 | Receipt provenance and truthful presentation. |
| `restated-request-lowercase-correction-reproposes` | D/I; manual S3/S4; X | Proposal binding and execution; unusual language remains diagnostic. |
| `switch-project-it-after-create-calls-client-action` | D/I; manual S1/S2/S3; X | Operation validation and execution; special extraction remains diagnostic. |
| `voice-merged-fragments-create-spelled-project` | D; manual S2 | Correction/ambiguity; real hearing remains separate. |
| `voice-bare-stop-nothing-pending-says-okay` | D | Already server-owned; move out of model runner. |
