# ORB-381 — Model Cost Comparison Plan

**Status:** Planning complete; implementation blocked pending Stan's approval
**Todo:** ORB-381 — Compare AI model costs
**Created:** 2026-08-15 — Codex (GPT-5.6 Sol)

## 1. Objective

Give Stan a repeatable, provider-neutral way to answer:

> For the same useful Orb work, which model costs less after quality failures,
> retries, caching, and provider billing are taken into account?

The primary campaign metric is **rate-card estimated cost per successful or
accepted outcome**, calculated from the exact usage returned for each model
call. Provider-console billing is an independent aggregate calibration signal;
it is not falsely allocated to individual eval runs when the provider does not
offer that scope.

The first comparison set is:

- Anthropic Claude Haiku 4.5
- Google Gemini 3.1 Pro Preview
- Moonshot Kimi K3

The implementation must discover eligible models from Orb's model catalog and
strategic-eval manifest so future eval models do not require a one-off reporting
exception.

## 2. Current Evidence and Gaps

### What already exists

- `orb_model_requests` records provider, model, role, source, tokens, cache
  tokens, latency, model/tool call count, estimated cost, and the rate snapshot
  used for every request.
- `orb_eval_runs` and `orb_eval_results` record commit, selection, case results,
  pass/fail evidence, estimated cost, provider/model, model-call count, and
  duration.
- Serial eval requests carry the eval run id into
  `orb_model_requests.correlation_id`, so their request-ledger costs can be
  joined back to a run.
- The strategic runner preserves a blinded review packet with estimated cost,
  latency, provider/model, scenario, and tool calls.
- AI Metrics already owns rate cards, provider/model filtering, request history,
  funding data, and provider bill reconciliation UI.

### What is missing

1. Separate eval runs are not grouped into one intentional, comparable campaign.
2. The comparison workload and repetition count are not frozen as a versioned
   benchmark.
3. Provider-billed cost cannot be attached precisely to an eval campaign. The
   available provider consoles do not scope billing to those runs. The current
   reconciliation record is provider-wide and date-based, so the comparison
   must not present aggregate billing as campaign actual cost.
4. Strategic results are written to files but are not persisted in the same
   comparison data model as serial results.
5. There is no durable accepted-response count or review status for strategic
   answers.
6. AI Metrics can total estimated cost, but it cannot show cost per pass,
   estimate-to-bill variance, cache effectiveness, or normalized model cost.
7. A configured rate card affects future request records only. It cannot explain
   or correct an already-recorded discrepancy by itself.

The Knowledge Repository was not queried for this plan because agent database
credentials are intentionally unavailable under manual-transfer mode.

## 3. Measurement Principles

### 3.1 Compare like with like

A comparison is valid only when its model runs share:

- the same benchmark version;
- the same Git commit;
- the same case/scenario ids;
- the same requested repetitions;
- the same prompt/context packet versions;
- the same mutation/dry-run behavior; and
- completed status without missing provider-limited runs.

The UI must label a campaign **Not comparable** when any of those invariants
diverge. It must not silently put mismatched runs in one table.

### 3.2 Separate campaign estimates from aggregate provider billing

For every model result, preserve:

1. **Estimated campaign cost** — sum of the immutable per-request estimates and
   rate snapshots captured by Orb.
2. **Estimate basis** — token counts, cached-token treatment, and effective
   rates used by those request records.
3. **Provider calibration status** — whether a broader provider-level
   reconciliation exists, its scope, and its aggregate variance when the Orb
   and provider coverage can genuinely be aligned.

Provider billing never rewrites request-ledger estimates and is never assigned
to a campaign unless a future provider source actually identifies that
campaign's usage. A provider-wide discrepancy may guide a new effective-dated
rate card or an accounting fix, but no blanket correction factor is silently
applied to campaign results.

### 3.3 Cost follows useful outcomes

Report at least:

```text
estimated cost per completed outcome = estimated cost / completed outcomes
estimated cost per successful outcome = estimated cost / passed or accepted outcomes
```

When there are zero successful outcomes, cost per success is **Unavailable**,
not zero or infinity.

### 3.4 Caching is part of the product economics

Do not normalize caching away. Orb repeatedly sends stable system and tool
context in real use, so provider cache behavior is a legitimate cost
difference. Report cached-input tokens and cache-read percentage beside cost.

To expose warm-up effects, show the first repetition separately from subsequent
repetitions when the underlying data permits it. Do not claim a run was cold
unless the provider cache was actually isolated or expired.

### 3.5 Report sample size and uncertainty

Every comparison shows completed outcomes and requested repetitions. One pass is
reported as `1/1`, never as deterministic proof. Cost and quality rankings must
remain visibly provisional when samples are incomplete.

## 4. Benchmark Workloads

### 4.1 Operational benchmark

Add a provider-neutral `cost-operational` suite to `scripts/eval-cases.ts`.
It should contain a stable, representative subset of Tier 1 cases covering:

- ordinary conversation with no tool;
- todo read and create;
- project read or mutation proposal;
- Knowledge search and mutation confirmation;
- mutation approval and decline;
- repository inspection;
- one multi-turn tool flow; and
- one cross-category safety sentinel.

Rules:

- Include only cases whose provider/model is not pinned internally.
- Include only cases expected to invoke the selected model; deterministic
  model-free cases do not measure model cost.
- Do not weaken assertions or create provider-specific expectations.
- Run each case three times for a cost campaign even if its ordinary Tier 1 gate
  remains 1/1. Campaign repetition is a measurement setting, not a change to
  Tier 1 release semantics.
- Operational eligibility requires a tool-capable model exposed for Evaluation.
  Initially this compares Haiku and Kimi; Gemini is not forced through a tool
  workload it cannot perform.

### 4.2 Strategic benchmark

Reuse the frozen ten-scenario strategic corpus with three runs per scenario.
Strategic eligibility comes from models capable of the Strategic role, so the
initial comparison can include Haiku, Gemini, and Kimi.

For each response persist:

- scenario and repetition;
- blinded review id;
- provider/model;
- estimated cost and rate snapshot;
- latency and tool-call count;
- rubric scores when supplied;
- accepted/rejected/unreviewed status; and
- concise reviewer notes when supplied.

Tool calls on a Strategic response remain an automatic failure. Human review is
still required for judgment quality; cost must not become a proxy for quality.

### 4.3 Live-use follow-up

The controlled benchmark is the first gate, not the whole product decision.
Afterward, compare a fixed number of ordinary live interactions per model using
the existing request ledger. Keep live-use results in a distinct workload type
so they are never mixed into eval pass rates.

The first implementation should display live provider/model cost and success
proxies already recorded by Orb, but must label them observational. A future
phase may add an explicit user-rated successful-interaction signal; ORB-381 does
not infer quality from a lack of errors.

## 5. Data Model

Add a migration with two low-volume control/evidence tables.

### 5.1 `orb_model_cost_comparisons`

One row per campaign:

- `id uuid`
- `name text`
- `workload_type text` — `operational_eval`, `strategic_eval`, or `live_observation`
- `benchmark_version text`
- `git_sha text`
- `selection text`
- `case_ids jsonb`
- `prompt_version text`
- `context_packet_version text`
- `requested_repetitions integer`
- `status text` — `draft`, `running`, `complete`, or `invalid`
- `started_at`, `completed_at`
- `notes text`
- `created_at`, `created_by`

### 5.2 `orb_model_cost_comparison_results`

One row per campaign/provider/model:

- `id uuid`
- `comparison_id uuid`
- `provider text`
- `model text`
- `eval_run_ids uuid[]` or a normalized join table if implementation evidence
  shows array membership would make validation/querying awkward
- `completed_outcomes integer`
- `successful_outcomes integer`
- `model_call_count integer`
- `input_tokens`, `output_tokens`, `cached_input_tokens`,
  `cache_write_tokens`
- `estimated_cost_usd numeric`
- `rate_basis jsonb` — the distinct immutable rate snapshots represented by the
  underlying requests
- `average_latency_ms numeric`
- `review_status text` — `not_required`, `unreviewed`, `reviewed`
- `accepted_outcomes integer null`
- `comparable boolean`
- `comparability_issues jsonb`
- `created_at`, `updated_at`

Use database checks for non-negative counts/costs, accepted outcomes not
exceeding completed outcomes, valid periods, and one result per
comparison/provider/model. Apply service-role write and admin read/write RLS
consistent with the existing AI control-plane tables.

Do not add campaign-billing columns that imply unavailable precision.
`orb_cost_reconciliations` remains the separate provider-level calibration
surface and may be extended only to describe its real aggregate/cumulative
scope more honestly.

## 6. Runner Design

Add a provider-neutral comparison orchestrator, invoked through the encrypted
launcher so Stan enters the unlock password once.

Proposed commands:

```bash
orb-dev --compare-model-costs --workload operational --repetitions 3
orb-dev --compare-model-costs --workload strategic --repetitions 3
```

Behavior:

1. Resolve eligible models from the catalog/strategic manifest.
2. Print the exact models, workload version, case count, repetitions, and
   estimated upper-bound call count before the first provider call.
3. Create one comparison campaign.
4. Run models serially through the existing eval paths; do not duplicate tool
   execution or assertion code.
5. Tag each underlying eval run with the comparison id.
6. Preserve provider-neutral 429 parsing and pacing.
7. Checkpoint after every case/model so interruption is resumable.
8. Mark incomplete/provider-limited results non-comparable rather than silently
   lowering their denominator.
9. Print estimated cost and pass/acceptance state together with the exact rate
   basis; campaign completion does not wait for provider billing.

Add `--models provider/model,...` only as an explicit narrowing option. The
default remains every eligible model, so a newly adopted eval model is not
accidentally omitted from future comparisons.

Do not let the comparison command mutate Operational, Strategic, or Evaluation
Settings. Model choice is scoped to the run.

## 7. Aggregate Provider Calibration

The available provider consoles do not identify billing for one eval campaign.
Therefore ORB-381 does **not** ask Stan to enter a fictional campaign-specific
actual cost and does not block a campaign on billing reconciliation.

Provider-console figures remain useful at their honest scope:

1. Record the provider, reported amount, observation date/time, and the scope
   the console actually supplies (for example current billing period or
   cumulative account usage).
2. Record whether the key/account is dedicated to Orb or may include unrelated
   traffic.
3. Compare the provider total with Orb's best genuinely matching aggregate only
   when the boundaries can be aligned.
4. If boundaries cannot be aligned, show the two totals without calculating a
   misleading variance percentage.
5. Never distribute an aggregate discrepancy across individual campaigns or
   models as if the provider supplied that allocation.

The current Moonshot observation—Orb $6.42 versus the provider console
$6.09905—is an aggregate calibration clue, approximately 5.3% high, not proof
that any particular eval campaign was overestimated by 5.3%.

The calibration surface must distinguish usage charges from recharge/top-up,
grants, tax, and remaining balance. It may reuse or carefully extend the
existing provider reconciliation record, but remains separate from comparison
campaign evidence.

An automated import is a later enhancement only if an official source exposes
verifiable provider/model/time scope. It must write the same aggregate
calibration truth rather than create a parallel cost system.

## 8. AI Metrics UI

Place **Model Cost Comparisons** in the existing AI Metrics **Orb** section,
after the current accounting summary and before rate cards. This is application
AI effectiveness, not provider funding administration.

Reuse the existing cataloged families:

- `s-page-wide`, `s-card`, and `s-form` for the settings shell and inputs;
- `metrics-summary-grid` / `metrics-summary-card` for campaign totals;
- `metrics-details-card` / `metrics-details-row` for comparison metadata;
- the existing responsive settings table/card treatment for model results;
- existing `pill` / `pill-active` controls for workload/status filters if a
  filter is needed.

No new visual family is planned. If implementation reveals that the comparison
matrix cannot be expressed accessibly with these cataloged patterns, stop and
ask Stan before adding a new CSS family.

Each campaign displays:

- comparability status and any mismatch reason;
- workload, benchmark version, Git SHA, case/scenario count, and repetitions;
- model/provider;
- pass or acceptance rate with numerator/denominator;
- estimated cost;
- immutable rate basis;
- estimated cost per completed and successful/accepted outcome;
- average latency;
- model/tool call count;
- token/cache breakdown and cache-read percentage; and
- relative cost index against a user-selected baseline model.

A separate provider-calibration note may show the latest compatible aggregate
reconciliation and its scope. It must explicitly say that the value is not
campaign-specific.

Do not present a single unexplained “winner.” Cost, quality, and latency remain
separate columns; the cheapest passing model can be visually identified without
collapsing the decision into an opaque score.

Mac uses the full comparison table. iPad may horizontally navigate documented
table columns. iPhone uses one readable model card per result with the primary
cost-per-success and pass/acceptance figures first. All controls retain 44pt
touch targets.

## 9. Server Actions and Queries

Add admin-only actions/RPCs for:

- paginated comparison-campaign summaries;
- one campaign with model results;
- recording strategic review status and accepted count; and
- validating campaign comparability from underlying immutable eval facts.

Existing provider reconciliation actions remain the aggregate calibration
path. Extend them only if needed to record honest scope/observation metadata;
do not attach their amounts to comparison results.

Aggregation belongs in SQL/RPC, not in a client download of request-level rows.
Join serial request costs using correlation/eval run ids. Extend strategic
evaluation persistence so it supplies equivalent immutable facts rather than
parsing `/tmp` review packets in the UI.

The comparison page must load independently of the large request log. One failed
comparison query must not blank the rest of AI Metrics.

## 10. Performance Instrumentation

Instrumentation is required because ORB-381 adds an AI Metrics load path,
server queries, and strategic-review save interactions.

Reuse focus `settings`, flow `settings-ai-metrics`, with interactions such as:

- `model_comparisons_load`
- `model_comparison_open`
- `model_comparison_review_save`

Capture success/failure, comparison/result row counts, workload type, and query
duration. Do not include aggregate billing amounts or review text in telemetry.

Update Part 2 of `docs/object-capability-matrix.md` for the new AI Metrics flow.

## 11. Verification

### Deterministic tests

- Cost-per-success math, including zero successes.
- Aggregate estimate variance and direction only when reconciliation coverage is
  explicitly compatible; incompatible coverage yields no percentage.
- Cache percentage with null/zero input.
- Eligibility discovery for Operational versus Strategic workloads.
- Comparability validation for Git SHA, selection, benchmark version, prompts,
  repetitions, incomplete runs, and missing results.
- Aggregate provider-scope compatibility, including cumulative totals and
  accounts that may contain unrelated traffic.
- Database constraints and RLS behavior.
- Resume/checkpoint behavior without duplicate model results.

### UI acceptance

- Empty, running, complete, invalid, and partially reviewed campaigns.
- Desktop table, iPad column navigation, and iPhone cards.
- Strategic-review validation, dirty-close behavior, saving/error recovery,
  keyboard access, and 44pt touch targets.
- AI Metrics remains usable when the comparison query fails.
- Existing Orb, Providers, and Controls sections remain unchanged.

### Model eval gate

ORB-381 changes eval orchestration and model-request construction used for
comparison, so Stan runs full Tier 1 after implementation:

```bash
/Users/stanleybaptista/.local/bin/orb-dev --eval-t1
```

The comparison workload itself is then run once end to end for Operational and
Strategic models. AI tools do not run these model evals.

### Release verification

- `npx tsc --noEmit`
- changed-file ESLint
- UI catalog verification
- deterministic comparison tests
- migration applied and constraints/RLS verified
- Mac, iPad, and iPhone acceptance
- required model eval results recorded in `HANDOFF.md`
- version/changelog/handoff release bookkeeping complete before push

## 12. Delivery Phases

### Phase A — Comparable evidence foundation

- Freeze/version the Operational cost suite.
- Add campaign/result schema and RLS.
- Tag serial eval runs with comparison ids.
- Persist Strategic results in the comparison evidence model.
- Add deterministic math and comparability tests.

### Phase B — Orchestration

- Add the encrypted-launcher comparison command.
- Discover eligible models by workload.
- Add repetition, checkpoint/resume, pacing, and non-comparable failure states.
- Verify it reuses existing eval assertions and model adapters.

### Phase C — AI Metrics report

- Add comparison list/detail queries and server actions.
- Build the existing-pattern responsive report.
- Show the estimate rate basis, aggregate provider-calibration context, and
  strategic acceptance entry without implying campaign-level billing.
- Add required Settings performance instrumentation.

### Phase D — Acceptance and calibration

- Stan runs Operational and Strategic campaigns.
- Compare estimated cost per successful outcome across identical workloads.
- Record or reuse provider-console totals only at their real aggregate scope and
  investigate any aligned aggregate variance separately.
- Decide whether any built-in/configured rate assumptions need a new
  effective-dated rate card; never rewrite historical request snapshots.
- Use the results to decide whether Kimi's cost advantage is real enough to
  justify broader use.

## 13. Explicit Non-Goals

- Automatically scraping provider websites.
- Treating account recharge, grants, tax, or remaining balance as model usage
  cost.
- Weakening eval assertions to improve a model's cost-per-pass figure.
- Forcing tool-incapable models through Operational tests.
- Combining mismatched commits, prompts, selections, or sample sizes.
- Repricing historical request rows after a rate-card change.
- Selecting or promoting production models automatically.
- Replacing human Strategic review with a cost score.

## 14. Approval Gate

No application, runner, database, or UI implementation is authorized by this
document alone.

Stan's approval should confirm or modify these recommended decisions:

1. Build both controlled workloads: Operational and Strategic.
2. Default to every eligible model; allow explicit narrowing only.
3. Run three repetitions per outcome for comparison campaigns.
4. Use immutable rate-card estimated cost per success as the campaign metric.
5. Use provider-console billing only as aggregate calibration; never allocate it
   to eval campaigns without provider-supplied scope.
6. Keep comparison evidence separate from aggregate provider reconciliation.
7. Place Model Cost Comparisons in AI Metrics → Orb using existing UI patterns.
8. Keep Kimi experimental until comparison and live-use evidence support a
   separate promotion decision.

Implementation begins only after Stan explicitly approves this plan.
