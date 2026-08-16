# Kimi K3 Integration and Evaluation Plan

**Status:** Implemented and accepted for experimental local use as of 2026-08-15
**Scope:** Direct Moonshot API integration for local Operational, Strategic, and Evaluation roles in Orb
**Production status:** Not promoted; no production credential or model default changes were made

## 1. Objective

Test `kimi-k3` as both of Orb's text-model roles while preserving Orb's existing tool safety, role routing, cost ledger, and evaluation discipline.

- **Operational:** task/project/knowledge queries and mutations through Orb's established tool loop.
- **Strategic:** no-tools prioritization and guidance using Orb's strategic context packets.
- **Accounting:** provider/model/role/source attribution, cached-token accounting, configured rate cards, and funding-cap visibility.
- **Evaluation:** existing Tier 1/Tier 2 suites plus the frozen strategic comparison corpus.

## 2. Decisions

1. Integrate Moonshot directly at `https://api.moonshot.ai/v1/chat/completions`; do not route through an intermediary.
2. Use provider id `moonshot`, model id `kimi-k3`, and secret name `MOONSHOT_API_KEY`.
3. Keep the key server-only in Orb's encrypted runtime environment. Do not restore a plaintext `.env.local`.
4. Use explicit `max_completion_tokens: 4096`; K3's much larger provider default must not determine Orb's rate-limit reservation or output size.
5. Use `reasoning_effort: low` for Operational and `reasoning_effort: high` for Strategic during the first evaluation. A `max` comparison is optional after the baseline.
6. Preserve `reasoning_content` on assistant messages across K3 tool turns, as required by K3's preserved-thinking protocol.
7. Expose Kimi in AI Settings as **Experimental** in local development. Production promotion remains a separate decision after evaluation.
8. Reuse the existing Settings shell, selects, rate-card form, funding controls, and AI Metrics request ledger. No new UI pattern or CSS family is required.
9. Add performance data through the existing model-request ledger (`latency_ms`, role, provider, model, source); no parallel telemetry path is required.

## 3. Provider Adapter

Add `lib/orb-model/moonshot.ts` with:

- OpenAI-compatible tool-schema conversion from Orb's Anthropic-shaped tool definitions.
- Conversion of Orb's existing message history, including Anthropic-style `tool_use` and `tool_result` blocks, into Moonshot assistant/tool messages.
- Non-streaming Chat Completions request handling for the first integration.
- Tool-call argument parsing with malformed-JSON protection.
- K3 `reasoning_content` preservation between tool turns.
- Stable, non-personal `prompt_cache_key` values separated by live/eval and Operational/Strategic route so repeated Orb prompt prefixes can use Kimi's automatic context cache.
- Usage normalization for `prompt_tokens`, `completion_tokens`, `total_tokens`, and top-level `cached_tokens`.
- Moonshot error status/body reporting and the existing provider-incident classification path.
- Official K3 reference rates for eval estimates, superseded at ledger-write time by an effective configured rate card.

## 4. Runtime Routing

### Strategic

When Orb routes a request to Strategic and the selected provider is `moonshot`:

1. Build the same stable and dynamic prompt used by the current routes.
2. Supply no tools.
3. Call K3 with `reasoning_effort: high`.
4. Reject any returned tool call.
5. Parse the existing strategic insight marker.
6. Record the request as `moonshot/kimi-k3`, source `strategic_review`, role `strategic`.

### Operational

When the selected provider is `moonshot`:

1. Supply the same role-filtered Orb tool inventory as Anthropic.
2. Call K3 with `reasoning_effort: low`.
3. Convert K3 tool calls into the existing internal tool-call shape.
4. Run the unchanged Orb proposal, confirmation, provenance, and mutation-verification machinery.
5. Convert tool results back into K3 messages and continue for at most the existing five turns.
6. Preserve K3 reasoning content in every assistant history item.
7. Record aggregate tokens, cache hits, tool calls, latency, and outcome once per Orb request.

The provider adapter changes model transport only. It does not weaken or duplicate Orb's mutation controls.

## 5. Settings and Cost Controls

### AI Settings

- Add `Kimi K3 — Experimental` to Operational, Strategic, and Evaluation model selectors in local development.
- Routine eval commands use the independently persisted Evaluation selection. A paired `EVAL_PROVIDER`/`EVAL_MODEL` environment override still pins a one-off comparison without changing Settings.
- The existing role-routing and strategic-read switches remain authoritative.
- No reasoning-effort control is added initially; fixed role defaults make the first comparison reproducible.

### AI Metrics

- Allow `moonshot` rate cards and provider-bill reconciliation entries.
- Add a `Moonshot API` funding-cap field using the existing funding-controls assembly.
- Suggested initial K3 rate card, effective on the test date:
  - input cache miss: `$3.00 / 1M`
  - cached input: `$0.30 / 1M`
  - output: `$15.00 / 1M`
  - cache write: blank
- Cost formula:

  ```text
  (uncached input × 3.00 / 1M)
  + (cached input × 0.30 / 1M)
  + (output × 15.00 / 1M)
  ```

- Compare cost per successful Operational task and cost per accepted Strategic answer, not only cost per request.

## 6. Evaluation Plan

Stan installed the API key in the encrypted environment and ran every model eval. The completed evidence is summarized in the v0.6.296 changelog and handoff; the gates below remain the requirements for any future production promotion, except where Stan explicitly accepted the recorded 63/65 Operational evidence for experimental local use.

### Gate A — Provider smoke

- One no-tools Strategic request.
- One Operational tool-selection request.
- Confirm non-null provider/model/token/latency/cost fields in AI Metrics.

### Gate B — Operational tool and safety coverage

```bash
EVAL_PROVIDER=moonshot EVAL_MODEL=kimi-k3 orb-dev --eval --suite serial-tool-contract,smoke
```

Required: Tier 1 hard gate passes; mutation confirmation and no-tool sentinels remain intact.

### Gate C — Full Operational regression

```bash
EVAL_PROVIDER=moonshot EVAL_MODEL=kimi-k3 orb-dev --eval-t1
```

Required before any production model promotion because provider/model request construction is a shared conversation surface. Stan accepted Kimi's observed 63/65 full-suite behavior as experimental evidence rather than requiring a perfect Operational promotion gate; failures moved between cases across full runs while focused reruns passed, so the valid assertions remain unchanged and no Kimi-specific prompt exceptions are added.

### Gate D — Behavioral suite

```bash
EVAL_PROVIDER=moonshot EVAL_MODEL=kimi-k3 orb-dev --eval-t2
```

Required: each Tier 2 case uses three runs and passes at least two.

### Gate E — Strategic corpus

```bash
orb-dev --strategic-eval --provider moonshot --output kimi-k3
```

Compare its 10 scenarios × 3 runs against the existing Gemini reference using grounding, judgment, specificity, restraint, attunement, and follow-through. Retain the current feasibility ceiling of `$0.08` per accepted Strategic answer.

## 7. Acceptance and Rollback

### Accept for production Strategic when

- blinded quality is competitive with or better than the Gemini reference;
- no tool calls occur on Strategic routes;
- the cost ceiling is met;
- latency is acceptable to Stan in live use;
- cost and token attribution are complete.

### Accept for production Operational when

- serial-tool-contract plus smoke passes;
- full Tier 1 passes;
- Tier 2 meets its 2/3 rule;
- mutation approval, tool-result narration, and false-claim guards remain effective;
- latency is acceptable for ordinary conversation;
- cost per successful task is acceptable relative to Haiku.

### Rollback

Select Haiku for Operational and Evaluation and Gemini for Strategic in AI Settings. If testing ends, remove `MOONSHOT_API_KEY` from the encrypted environment and revoke the dedicated Kimi API key.

## 8. User Checkpoints

Stan must provide or perform the following only when requested:

1. Create and minimally fund the Kimi Platform account.
2. Create the dedicated API key.
3. Add `MOONSHOT_API_KEY` to the encrypted local Orb runtime.
4. Run the requested eval commands and paste failures/results.
5. Decide whether either role is accepted for production.
6. If accepted, add the key to Vercel only immediately before the approved production release.
