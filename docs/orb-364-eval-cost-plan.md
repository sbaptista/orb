# ORB-364 — Eval Suite Cost and Coverage Plan

## Verified baseline

- Tier 1 originally contained 77 logical cases. Three returned deterministically without a main model call, leaving 74 main calls plus one nested multilingual authorization-classifier call.
- Latest clean Tier 1 model ledger: about 13.5 minutes and $1.1993.
- Tier 2 contains 37 cases at three runs each. Two cases are deterministic server summaries, leaving 105 expected main model calls.
- The fixed 6.5-second runner delay applied after every request, including model-free cases.
- The request ledger stored cost and response text but not a suite/run identity, git commit, assertion outcome, tool names/parameters, or failure reason.

### Tier 1 cost by functional family

| Family | Calls | Cost | Share |
|---|---:|---:|---:|
| Todo/project creation and mutation | 23 | $0.3814 | 31.8% |
| Realtime-named serial analogues | 24 | $0.2834 | 23.6% |
| Provider/routing/budget/voice context | 5 | $0.2191 | 18.3% |
| Queries, knowledge, tickets, repository | 15 | $0.2154 | 18.0% |
| Remaining safety, memory, and voice | 7 | $0.1003 | 8.3% |

## Findings

The largest safe saving is selection, not weakening assertions:

1. Non-conversation releases cannot affect model tool selection or speech and need no model eval.
2. Localized conversation changes need their affected categories plus cross-category safety sentinels.
3. Shared prompt/context/tool-contract/router/provider/model changes can affect every case and still require full Tier 1.
4. Tier 2 remains statistical at three runs. Two runs cannot establish a majority.

The 24 cases named `realtime-…-analogue` did not execute the OpenAI Realtime engine, its tool schemas, proposal route, or confirmation RPC. Fourteen duplicated tool families already covered by ordinary serial cases; ten protected distinct serial capability or semantic boundaries.

## One-case-per-tool analysis

The idea is useful for one narrow purpose—checking that every tool remains
selectable—but it is not a complete release strategy and does not reduce the
combined serial-plus-voice surface by itself:

- A fully enabled serial operational turn exposes 27 tools. Tier 1 previously
  had direct selection evidence for 24; `create_ticket` and
  `propose_adaptation` existed only in Tier 2, and `get_preferences` had no
  direct case.
- OpenAI Realtime exposes 33 different tool schemas. Only 14 names overlap
  exactly with serial, and even those names run through a different model,
  prompt, schema, route, and server transaction path.
- One scenario for every serial and Realtime tool would therefore mean 60 tool
  scenarios before adding any no-tool, refusal, object-boundary, authorization,
  provider-routing, batch-count, or parameter-inference checks. That is roughly
  the same call count as the accepted 60-call Tier 1 run, not a reduction.
- The serial eval endpoint cannot test Realtime tool selection. Relabeling
  serial calls as voice coverage would preserve cost while providing false
  confidence.

The adopted design keeps one-per-tool as an explicit serial contract audit and
keeps incident cases available by category. It does not replace negative safety
or direct Realtime verification.

## Implemented design

### 1. Prompt caching — tested boundary

The released one-hour stable-prefix cache remains eval-only. A proposed second
boundary required moving run-invariant context ahead of selected-project scope.
The first full run was 59/63: all four failures routed ORB-default creates to
ADELESADUL. The second boundary was therefore rejected and the exact original
dynamic prompt order restored. Content equality is not behavioral equality when
the order of instructions changes.

Production conversation caching remains unchanged.

### 2. Risk-based selection

Every case receives one category and optional suite membership. The runner supports:

- `--suite smoke`
- `--suite serial-tool-contract`
- `--category <name>[,<name>...]`
- existing `--tier` and `--id` filters

Suites accept comma-separated values and compose by union with categories; tier
and id narrow the selected set.

The smoke suite now contains seven cross-cutting sentinels: current-project
creation, create approval follow-through, mutation decline, conversational
no-tool behavior, knowledge/tool separation, ticket-versus-todo mutation
safety, and exact grounded task reads. On the accepted full-run evidence these
seven calls cost $0.1055. The original 14-case smoke cost $0.3444; two Gemini
routing cases alone cost $0.1681 and now stay in the provider-routing category
instead of taxing every localized change.

The `serial-tool-contract` suite contains exactly one representative case for
each of the 27 tools available on a fully enabled serial operational turn. Two
judgment-based tools (`create_ticket` and `propose_adaptation`) retain their
statistical Tier 2 cases, so the suite performs 31 model runs. A new
`get-preferences-tool` case closes the only completely uncovered serial tool.
The suite validates its own map at module load so a missing case or mismatched
expected tool fails immediately.

Twenty-four of the contract suite's cases were present in the accepted full
run and cost $0.3049. Stan ran the new preference-read case once; it passed
1/1 at $0.0569, including a 36,704-token first cache write. The six runs
contributed by the two Tier 2 cases do not yet have persisted measurements, so
no exact total is claimed. Running `serial-tool-contract,smoke` adds only four
non-overlapping smoke calls to the contract audit.

### 3. Realtime analogue consolidation

Fourteen duplicate serial analogues were removed. Ten distinct capability cases remain under their historical ids, explicitly documented as serial evidence rather than Realtime execution proof.

Tier 1 was reduced from 77 to 63 cases and expected main model calls from 74 to
60. Using the measured run, the removed calls account for $0.1626. Adding the
previously missing `get_preferences` contract case brings the retained inventory
to 64 Tier 1 cases, but it is not added to every release gate: ordinary
localized changes use smoke plus affected categories, and serial schema/tool
inventory changes use the contract plus smoke suites.

The full rerun also confirmed a previously documented ORB-367 flake:
`upfront-permission-still-emits-creates` passed focused and failed full under
identical code because it read the live multi-project backlog while testing
upfront authorization. It now uses an ORB-only fixture; project selection is
outside that case's asserted behavior.

### 4. Durable evidence

`orb_eval_runs` and `orb_eval_results` persist:

- Git commit and exact selection.
- Per-case category, pass/fail, completed runs, and assertion failures.
- Tool calls and speech excerpt.
- Provider/model, model-call count, latency, and estimated cost.

`orb_model_requests.correlation_id` carries the parent eval-run UUID, joining cost evidence to assertion outcomes without adding another model-ledger index.

The first persisted full run correctly recorded 63 results, 59 passes, four
failures with exact assertion text, 60 model calls, and $0.8427 total estimated
cost. Its cache experiment was behaviorally invalid, so that cost is evidence
that persistence works—not the accepted post-fix cost baseline.

The accepted post-revert full run passed 62/63 with 60 model calls at $0.9547.
The only failure was the known live-backlog fixture leak in
`upfront-permission-still-emits-creates`; after freezing that case to its
intended ORB-only world, Stan ran it three times and it passed 3/3. The accepted
evidence is therefore the full 62/63 result plus three independent passes for
the only subsequently changed case. Compared with the original $1.1993 /
74-call baseline, the accepted full-run cost is 20.4% lower.

### 5. Pacing

The 6.5-second ceiling remains, but is applied immediately before expected model calls. Five deterministic server cases no longer pay the artificial delay.

## Database impact

- Two append-only tables written only by local eval runs.
- No Realtime subscription.
- No user-facing request path.
- One run insert/update and one result row per selected case.
- Indexes cover run time/status, run-result joins, case history, and failed-result review.
- RLS uses wrapped `(SELECT auth.uid())` and service-role writes.

## Release gates

- No conversation surface changed: no model eval.
- Localized conversation change: affected category or categories plus smoke.
- Serial tool inventory/schema change without a global prompt/context change:
  `serial-tool-contract,smoke`.
- Shared/global prompt, context, provider/model, routing, authorization, or
  model-request construction change: full Tier 1.
- Realtime-only change: direct Realtime schema/route/RPC verification and DEV acceptance; serial analogues are not sufficient.
- Tier 2: affected speech/policy categories or broad prompt/model releases, always three runs per case.

## Deferred to ORB-365

The five model-free cases and other pure helpers should move into the conventional test framework introduced by ORB-365. They remain in the runner for now so ORB-364 does not create a competing test framework.
