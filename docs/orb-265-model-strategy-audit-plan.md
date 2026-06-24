# ORB-265: Model Strategy and Strategic Capability Audit

**Status:** In progress — Phase 0 and the non-routing Anthropic reference instrumentation slice are approved. The append-only `orb_model_requests` ledger is deployed and the dev evaluation endpoint is its first writer. No provider routing or UI changes are approved.

## Objective

Establish whether Orb can deliver reliable strategic analysis, calibrated proactive coaching, adaptive behavior, app navigation, and safe task management **within a realistic operating budget**. The goal is not to choose a fashionable model; it is to identify the model or model mix that fits Orb's product value, safety, latency, and cost constraints at the same time.

The current Anthropic bill answers an important historical question: June 1–19 used `claude-sonnet-4-5`, while Haiku began on June 20. The current `orb_metrics` data begins only on June 20, so it cannot attribute the earlier Sonnet period. A provider-neutral evaluation and telemetry system is required before drawing model conclusions.

## Current State

### What exists

- `app/actions/orb-converse.ts` calls Anthropic directly with `claude-haiku-4-5` for conversation, greetings, and insight distillation.
- `lib/orb-prompt.ts` supplies strategic reasoning, coaching, memory, preference, adaptation, mutation-integrity, and app-navigation instructions.
- The system prompt is assembled from stable rules plus dynamic backlog, audit, knowledge, memory, preference, adaptation, and UI context.
- `orb_metrics` aggregates daily usage by user, date, and model: calls, speech/voice/input/ambient characters, client tool calls, input/output tokens, cache creation tokens, and cache read tokens.
- `scripts/eval-cases.ts` protects tool routing and a small number of behavioral rules. It has one strategic scope case, but no strategic-quality evaluation.

### Gaps

- Orb is prompt- and context-conditioned, not fine-tuned. Its current adaptation loop depends on the model proposing changes; it is not measured learning.
- Proactive observations are computed at session start, but the prompt says to surface them at greeting and then become reactive. This intentionally limits the behavior Stan wants to evaluate.
- The former computed-insights path is suspended in `app/actions/orb-converse.ts`; current strategic behavior is primarily prompt-driven.
- The eval API and runner expose only input/output tokens, not the full live metric shape.
- The code is Anthropic-specific. A provider swap cannot safely be made by changing a model string.

## Product Decision

Orb should become **model-flexible**, using the model appropriate to the task while preserving one Orb identity, one tool contract, and one measurement system. Deployment is governed by a feasibility envelope, not a single ranked metric:

- Strategic value: useful, grounded judgment that improves on a traditional list.
- Integrity: tool correctness, mutation approval, truthful completion claims, and factual reliability.
- Experience: acceptable latency and response stability.
- Budget: an affordable cost per interaction and projected monthly spend at realistic usage.

A model missing any threshold is not deployable, even if it excels on another dimension. A cheap generic assistant is not Orb's differentiator; an excellent strategic model that exceeds the sustainable budget is equally not a production choice.

Candidate roles:

| Role | Work | Candidate models |
| --- | --- | --- |
| Operational | CRUD, lookups, navigation, approvals, simple summaries | a fast, low-cost tool-capable candidate |
| Everyday strategy | prioritization, workload read, coaching, pattern synthesis | a balanced reasoning/tool-capable candidate |
| Deep strategic review | weekly planning, cross-project analysis, difficult ambiguity | a high-judgment candidate only when its budget envelope permits |
| Future private/local experiment | constrained offline or privacy-sensitive work | selected open-weight model; Phase 5+ only, not a production assumption |

No model earns a role from reputation, benchmark claims, or price alone. The evaluation manifest resolves each capability tier to an exact provider/model ID, pricing snapshot, and evaluation date. It must pass Orb's own workload, safety, and budget gates.

## Canonical Provider Metrics Contract

Before any multi-provider evaluation, add an internal normalized result that every provider adapter returns. Native field names remain available in a provider metadata blob, but the dashboard and evaluator compare this common shape.

```ts
type OrbModelUsage = {
  provider: 'anthropic' | 'openai' | 'google' | 'mistral' | 'local'
  model: string
  source: 'conversation' | 'greeting' | 'distillation' | 'eval' | 'strategic_review' | 'proactive_observation' | 'adaptation_proposal'
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number | null
  cacheWriteTokens: number | null
  reasoningTokens: number | null
  totalTokens: number | null
  providerToolCalls: Record<string, number> | null
  clientToolCalls: number
  latencyMs: number
  attemptCount: number
  success: boolean
  failureCode: string | null
  estimatedCostUsd: number
  providerUsage: Record<string, unknown> // typed per provider inside its adapter
}
```

### Provider mappings

| Provider | Input | Output | Cache read | Cache write | Reasoning |
| --- | --- | --- | --- | --- | --- |
| Anthropic | `input_tokens` | `output_tokens` | `cache_read_input_tokens` | `cache_creation_input_tokens` | not separately exposed |
| OpenAI | `input_tokens` | `output_tokens` | `input_tokens_details.cached_tokens` | not separately exposed | `output_tokens_details.reasoning_tokens` |
| Google Gemini | `prompt_token_count` | `candidates_token_count` | `cached_content_token_count` | not equivalently exposed | `thoughts_token_count`, when supplied |
| Mistral | `prompt_tokens` | `completion_tokens` | `prompt_tokens_details.cached_tokens` | not separately exposed | provider/model dependent; `null` unless supplied |
| Local/open-weight | tokenizer-derived input/output counts | tokenizer-derived input/output counts | provider/runtime dependent | provider/runtime dependent | runtime dependent |

`null` means the provider did not expose an equivalent value. It must never be replaced with zero, estimated, or copied from another provider. Cost calculation uses an immutable `(provider, model, rate_version, effective_date)` snapshot stored with each record, never a live hard-coded rate lookup.

## Evaluation Design

### Fixed context packets

Create versioned, sanitized context packets from real Orb conditions. Each packet contains the same selected project, backlog, relevant audit history, memories/adaptations, UI state, and user request. Candidate models receive equivalent information and the same normalized tools.

Required scenarios:

1. A clear, urgent next-step choice.
2. Conflict between urgency and momentum.
3. Many open tasks with a likely quick-win sequence.
4. A stale task that may be better closed than revived.
5. Cross-project imbalance without unjustified nagging.
6. A user showing overwhelm or avoidance.
7. A request requiring both app explanation and a later approved CRUD action.
8. A misleading/incomplete context packet that requires uncertainty rather than invention.
9. A known user preference or approved adaptation that should change the answer.
10. A case where the correct strategic behavior is silence or a direct operational response.

### Two independent scorecards

**Quality — blind human review**

Score 1–5 for each dimension, without exposing provider or model:

- Grounding: cites real tasks, dates, and observed behavior accurately.
- Judgment: balances urgency, momentum, staleness, blocking, and project balance.
- Specificity: makes a concrete recommendation instead of restating the list.
- Restraint: does not invent a pattern, nag, over-coach, or force a recommendation.
- Attunement: respects preference, memory, tone, and the user’s current mode.
- Follow-through: preserves scope and mutation-approval rules when action is requested.

**Operational metrics — automated**

- Correct tool and parameters.
- Completion-claim integrity.
- Hallucinated task/data count.
- Latency and retry rate.
- Normalized token/cost data completeness.
- Cost per accepted strategic answer.

For this evaluation, an **accepted strategic answer** has no factual or mutation-integrity failure, no blinded quality dimension below `3/5`, and an aggregate score at or above the agreed threshold. In live use, corrections, retries, immediate edits, and undo actions are observational signals rather than proof that an answer was accepted or rejected.

### Feasibility envelope

Set these values before running candidates:

- Minimum blinded strategic quality score and no-critical-failure rule.
- Maximum acceptable latency for conversational and strategic routes.
- **Initial strategic cost guardrail:** `$0.08` per accepted strategic answer.
- **Total monthly cost ceiling:** `$40` across every Orb AI source.
- **Initial normal-use estimate:** `300` strategic interactions per month. At the strategic guardrail this reserves up to `$24`, leaving `$16` for operational turns, greetings, distillation, and variance. This is an evaluation gate, not a promise that every strategic call will spend the full allowance.

The report must project monthly cost from the measured per-source usage, including cache behavior, rather than extrapolating from a headline token rate. A model can qualify qualitatively and still fail the budget gate; a low-cost model can qualify economically and still fail the strategic-quality gate.

### Gate rules

- A candidate is ineligible if it cannot return the canonical usage fields that its provider exposes, report latency/error state, and preserve Orb tool integrity.
- A candidate cannot become the CRUD/operational default unless all Tier 1 tool and mutation cases pass.
- A candidate cannot become a strategic route unless it equals or exceeds the incumbent on the blinded quality rubric, with no critical factual or mutation-integrity failure.
- No model is selected from a single answer. Use at least three runs for nondeterministic strategic cases and retain raw responses for review.

## Architecture Direction

### Provider adapter boundary

Keep `lib/orb-contract.ts` as the tool/data contract. Add a narrow internal provider boundary below it, not a second Orb implementation per vendor.

```ts
interface OrbModelProvider {
  startTurn(request: OrbModelRequest): AsyncIterable<OrbModelEvent>
  continueTurn(request: OrbContinuationRequest): AsyncIterable<OrbModelEvent>
}
```

`orb-converse.ts` owns the turn loop: safety rules, approval gate, tool execution, mutations, persistence, and UI response shape. Each adapter only translates the provider's request/stream/tool-result-continuation protocol into `OrbModelEvent` and typed provider usage. This is essential because Anthropic, OpenAI, Gemini, and Mistral use different continuation mechanics after Orb returns client-tool results.

### Routing policy

Do not add an invisible, unconstrained automatic router. Start with explicit, logged routes:

- `operational`: default low-cost model.
- `strategic`: selected high-judgment model, only for recognized strategic requests or a clearly labeled review action.
- `evaluation`: model named explicitly, isolated from normal user history, marked `source='eval'`.

Any later automatic escalation must have a documented trigger, user-visible explanation when it materially changes latency/cost, a per-session ceiling, and an audit trail.

## Phased Plan

### Phase 0 — Audit and success criteria

1. Inventory all current prompts, dynamic context sources, tools, behavior rules, memories, adaptations, and precomputed insights.
2. Define the strategic scenarios and blind-review rubric with Stan.
3. Freeze a canonical policy specification: same Orb intent, tool contract, context packet, adaptation state, and safety requirements for every candidate.
4. Run a prompt-compatibility checkpoint. Start with the same rendered prompt; permit a documented provider-specific renderer only for unavoidable API/tool syntax differences. Do not tune model behavior during comparison without treating it as a separate, measured variable.
5. Capture a reproducible cost baseline: Haiku, the historical Sonnet configuration where reproducible, full token/cache calculations, and the underlying provider-console reconciliation. Do not record unverified daily-cost claims as a baseline.
6. Set the feasibility envelope: quality, integrity, latency, per-interaction, per-user/day, and monthly budget thresholds.

**Out of scope:** production routing, user-visible model choice, prompt rewrites for individual providers, and changes to the adaptation loop. These variables stay fixed during the evaluation so the result measures model/provider behavior rather than a moving system.

**Deliverable:** reviewed evaluation corpus and acceptance criteria. No production routing changes.

### Phase 1 — Normalize instrumentation

1. Extend `orb_metrics` (or introduce a request-level companion table) to record source, provider, latency, success, retries, normalized usage fields, immutable rate metadata, and a correlation ID that links an Orb recommendation or mutation to later audit activity.
2. Preserve the existing daily aggregate for fast dashboard summaries, but retain request-level data for evaluation and attribution.
3. Update the eval API/runner to return the entire normalized usage record, not just input/output token totals.
4. Add metrics UI only after the data contract is approved; it should show provider/source filters, regret/undo signals when causally linked, and unavailable provider fields honestly.

**Database impact:** This adds a new query pattern and likely a request-level table. Before implementation, run the AGENTS database-health inspection, inspect `information_schema`, design partial/composite indexes for date/provider/source/user queries, use RLS `(SELECT auth.uid())` patterns, and avoid Realtime subscriptions. Writes occur once per model call, never per streamed token.

### Phase 2 — Provider-neutral evaluation harness

1. Add model selection only to the dev/eval surface, never to production conversation routing.
2. Implement the Anthropic adapter first as the reference implementation, preserving current behavior where possible.
3. Add **one Gemini strategic candidate** as the first challenger. Pin its exact model ID and rates in the dated evaluation manifest; do not embed a rotating model name in this plan.
4. Run a cache-portability probe with the stable Orb prompt prefix for both providers. Record cache hit semantics, effective billed input cost, and latency; do not compare headline rates alone.
5. Add strategic quality cases separately from the existing Tier 1/Tier 2 conversational regression suite. Tool integrity remains a hard gate; quality evaluation produces comparable evidence rather than a false deterministic pass.
6. Run an exploratory set of 5 context packets × 3 runs × 2 candidates (30 responses), then a decision set of 10 packets × 3 runs × 2 candidates (60 responses) only if the exploration is promising.
7. Produce a blinded review packet that excludes provider/model names and hides cost/latency until quality scoring is complete. Apply the feasibility envelope after qualitative scoring.

**Deliverable:** comparison report across the Anthropic reference and one Gemini strategic candidate. Add Mistral next only if its potential cost/value advantage justifies the next adapter.

### Phase 3 — Decide Orb's role map

1. Choose operational and strategic default candidates from measured results and the feasibility envelope.
2. Set budget and escalation policy; a model that exceeds the monthly ceiling does not deploy regardless of quality.
3. Decide whether adaptation proposals should run only on the strategic route.
4. Decide whether proactivity is a scheduled strategic review, a session greeting, an in-conversation behavior, or a deliberate combination. This must be product behavior, not a side effect of model whim.

**Deliverable:** approved model-routing policy and updated Orb capability contract.

### Phase 4 — Controlled implementation

1. Implement only the approved adapters and routes.
2. Add matching conversation eval cases whenever routing/policy behavior changes.
3. Run Tier 1 green before any production push, then run the model-comparison suite on the approved candidates.
4. Start with a local/dev feature flag and a strict budget cap; review live attribution before production expansion.

## Decisions Needed From Stan

1. Strategic trigger: explicit user request only at first, or also scheduled weekly review/session greeting.
2. Initial candidate: confirm a Gemini strategic candidate as the sole first challenger; choose the exact model ID only in the dated evaluation manifest. Mistral is the next cost/value challenger if Gemini does not clearly meet the feasibility envelope.
3. Privacy posture: whether hosted providers are acceptable for backlog, audit, memories, and adaptation context; this determines whether local/open-weight trials are strategic or merely exploratory.
4. Reviewer: Stan alone, or a small blinded panel, for qualitative strategic scoring.
5. License posture for future open-weight candidates: document whether a candidate is hosted-only, open-weight under a permissive license, or subject to a custom commercial license before any self-hosting work.

## Verification

- Existing Orb Tier 1 tool correctness remains green after any adapter work.
- Every evaluation response has a complete canonical telemetry record or an explicit `null` for unavailable native fields.
- Every model comparison stores the exact prompt/context-packet version and raw response.
- Cost totals reconcile within an agreed tolerance to each provider's console for a sample period.
- Cache-portability probes use the same stable Orb prefix and report provider-specific cache semantics alongside effective cost.
- A candidate must meet the full feasibility envelope; no model can be selected from quality or price alone.
- No candidate is exposed to regular users until its mutation-integrity and attribution behavior has been validated on the full model-specific suite.
