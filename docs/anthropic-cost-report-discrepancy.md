# Anthropic Cost API report — draft for Anthropic Support

**Status:** Draft, ready to paste into an Anthropic support request. Not yet sent.
**Prepared:** 2026-07-26 by Claude Code (Opus 5) at Stan's request.
**Related:** ORB-363 (Orb's defensive fix), ORB-353 (the work that introduced provider-spend fetching).

---

## Draft message to Anthropic Support

**Subject:** `/v1/organizations/cost_report` returns amounts ~80× my actual billed spend

Hello,

The Admin API cost report endpoint appears to be returning costs far higher than what I am actually billed, and I would like to understand what the `amount` field represents for my account.

**My account**

Individual developer account. API usage is paid via **credit grants (auto-recharge)**, not an invoiced monthly plan. I also hold a separate Claude Pro annual subscription ($200/yr), which I understand is unrelated to API billing.

**What I am billed for July 2026** (from Console → Invoice history, all "Credit grant"):

| Date | Amount |
|---|---|
| Jul 1, 2026 | $5.24 |
| Jul 4, 2026 | $20.94 |
| Jul 9, 2026 | $20.94 |
| Jul 27, 2026 | $10.47 |
| **Total** | **$57.59** (= $55.00 + 4.71% tax) |

**What the cost report returns for the same period:** approximately **$4,463**, roughly 80× the above.

**Request**

```
GET https://api.anthropic.com/v1/organizations/cost_report
  ?starting_at=2026-07-01T00:00:00Z
  &ending_at=2026-07-27T00:00:00Z
Headers: anthropic-version: 2023-06-01, x-api-key: <admin key>
```

**Sample response (July 1, single bucket):**

```json
{
  "starting_at": "2026-07-01T00:00:00Z",
  "ending_at": "2026-07-02T00:00:00Z",
  "results": [
    { "currency": "USD", "amount": "155.83271", "workspace_id": null,
      "description": null, "cost_type": null, "model": null }
  ]
}
```

**The clearest single example — July 4, 2026, grouped by `description`:**

| Amount | Description |
|---|---|
| $978.34 | Claude Haiku 4.5 Usage — Input Tokens |
| $25.75 | Claude Haiku 4.5 Usage — Input Tokens, Cache Write |
| $17.17 | Claude Haiku 4.5 Usage — Output Tokens |
| $9.14 | Claude Haiku 4.5 Usage — Input Tokens, Cache Hit |
| **$1,030.40** | **day total** |

My actual invoice that day was **$20.94**.

**Why I believe the reported figure cannot be correct**

At the published Haiku 4.5 input price of $1.00 per million tokens, $978.34 implies roughly **978 million input tokens consumed on a single day**. My application's own request ledger — which records every API call it makes, with token counts returned in each API response — shows **41.05 million input tokens for the entire month of July**, across 1,740 calls, with 29.40M cached-read and 0.20M output tokens. Costing that volume against the published rate card gives **$48.59**, which matches my ~$55 of credit grants closely.

So three figures should agree and two of them do:

| Source | July 2026 |
|---|---|
| My credit-grant invoices | ~$55 |
| My application's own token-based estimate | $48.59 |
| `cost_report` | ~$4,463 |

The reported usage is also **entirely Claude Haiku 4.5**. I use Haiku for this application, so the attribution is plausible — but the volume is not. No Opus or Sonnet line items appear at all.

**Things I have already ruled out on my side**

- **Unit misreading.** The response states `"currency": "USD"` and the values parse as plain dollars; there is no cents-vs-dollars error in my code.
- **Pagination double-counting.** Page 1 returns Jul 1–7 and page 2 returns Jul 8–14 with no overlap, so my loop is not summing the same buckets twice.
- **Other consumers on the organization.** This is a single-developer organization; `workspace_id` is `null` on every row.
- **Claude Code / subscription usage bleeding in.** Claude Code runs Opus and Sonnet, neither of which appears anywhere in the report.

**My questions**

1. What does `amount` represent on a credit-grant / auto-recharge account? It does not appear to be billed dollars.
2. Is the cost report expected to reconcile with Console → Invoice history? If not, what is the correct endpoint for actual billed spend?
3. Is there a known issue affecting Haiku 4.5 cost attribution, or accounts of this type?

I am using this endpoint to drive automated spend monitoring, so I need to know whether the figure is usable and, if so, what it measures.

Thank you.

---

## Notes for Orb (not part of the message)

- Reproduce with: `docs/api-spec.yaml` is unrelated; the fetch lives at [`lib/orb-model/usage-monitor.ts`](../lib/orb-model/usage-monitor.ts) lines 48–72.
- Evidence gathered by direct `curl` against the live endpoint on 2026-07-26, not from Orb's own code path, so the findings are independent of Orb's implementation.
- **The same doubt applies to every other provider ORB-353 pulls** — OpenAI Costs API, Gemini via BigQuery export, ElevenLabs. Only Anthropic was verified. None should be trusted until checked against an invoice.
- Orb's defensive response is tracked in **ORB-363**: stop enforcing caps and displaying totals from provider figures, fall back to the internal ledger, and stop auto-writing provider numbers into `orb_cost_reconciliations`.
