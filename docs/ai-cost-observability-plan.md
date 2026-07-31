# AI Cost Observability — plan for Settings → AI Metrics + AI Settings

**Status:** Draft for review (Stan, Codex). No code written. Supersedes nothing yet.
**Origin:** Stan, 2026-07-30, after reconciling his own tracking spreadsheet against the card statement.
**Related:** ORB-353 (usage monitoring), ORB-363 (provider/ledger reconciliation), ORB-364 (eval cost).

---

## 1. The question the page should answer

Today the page answers *"what did each call cost?"* — a ledger. The questions Stan actually
asks are:

1. **Am I about to run out?** (the only one with a deadline)
2. **What is this costing me, per week/month, per provider?**
3. **Where is it going — product use, or evals?**
4. **Do the numbers I have match the money that actually left my account?**

None is answered at a glance today. #1 is not answered at all.

**Design consequence:** the headline is not a dollar total. It is **runway** — days of credit
left at the current burn rate, per provider. That follows directly from Stan turning
auto-recharge off (2026-06-09): the credit balance is now the spend cap, and it fails closed.
Three outages have already come from it — the eval suite dying mid-run 2026-07-26, voice
failing 2026-07-30 with `insufficient_quota`, and the exhaustion that opened ORB-363.
Running out, not overspending, is the live risk.

---

## 2. Pushback: keep the rate cards

Stan proposed dropping them now that provider APIs give exact figures. **I disagree**, and the
reason is that the three sources answer different questions and none substitutes for another:

| Source | Question it answers | What it cannot do |
|---|---|---|
| **Rate card × tokens** (`orb_model_requests`) | *Which call, case, user, route, or eval spent this?* | Be exactly right |
| **Provider API** (`orb_cost_reconciliations`) | *What does the vendor say I owe?* | Attribute to anything |
| **Card statement** | *What money actually left the account?* | Say when it was consumed |

Provider APIs return **totals**, not attribution. Every question worth asking this session
needed attribution: "evals were 57% of spend" (ORB-364), "a full Tier 1 run costs $1.26",
"voice is the largest real line". None is answerable from a provider total. Drop the rate
cards and those questions become unanswerable — and ORB-364's entire cost-reduction case
could not have been made.

The estimate is also **live**; provider APIs lag by hours and the card by days. Real-time
budget gating has nothing else to run on.

**What should change instead:** stop presenting the estimate as if it were truth. Show
estimate and provider figure side by side with the **divergence** as a first-class number.
That divergence is a health metric: it sat at 1.9% after the cents bug was fixed, and a
sudden move in it means either a new model with no rate card or a parsing bug. The 100× bug
went unnoticed for days precisely because nothing displayed the gap.

---

## 3. Pushback: "spend caps" are solving yesterday's problem

Agreed that Monthly Limits are weak, but the reason matters. With auto-recharge off, the
prepaid balance **already is** a hard cap that cannot be exceeded. A configured cap below it
is a second ceiling under one that already works.

What is missing is the opposite: **advance warning before a balance runs dry**, which is a
different feature and currently does not exist in any form.

Note the two failure modes are a genuine trade, not a right answer:

- auto-recharge **on** → unbounded spend, fails silently
- auto-recharge **off** → unplanned outage, fails loudly

Stan chose the one that fails loudly and cheaply. Nothing here should quietly restore
auto-refill in the name of convenience.

---

## 4. Answer: yes, merge — but not into one long page

Merge, because the split forces you across two pages to answer one question. "Am I about to
run out?" needs the balance (metrics) and the threshold (settings) together.

Proposed structure — one **AI** section, four surfaces:

**NOW** — the glance. Per provider: runway in days, balance if the API exposes it, burn rate
(7-day trailing), and a status dot. One row per provider, nothing else. This is the screen
that should answer #1 in under two seconds.

**HISTORY** — the charts. Bar for comparison across providers, line for usage over time, with
range selection (7d / 30d / 90d / YTD / custom). Split by **eval vs product** as a first-class
toggle, not a filter buried in a table — that split was 57/43 and is the actionable lever.

**PROVIDERS** — reconciliation. Estimate vs provider vs card, per provider per month, with
divergence shown. Import lives here (§5).

**CONTROLS** — warning thresholds, notification routing, and the role reserves. Spend caps
demoted or removed pending §3.

Detail rows do not disappear; they move behind the charts, reachable by clicking a bar or a
point. The current page's failure is that the rows *are* the page.

---

## 5. Import: yes, and the schema is already designed

Automatic pulling exists for API spend (ORB-353: Anthropic Cost API, OpenAI Costs API, Gemini
via BigQuery, ElevenLabs). It **cannot** reach two things:

- **Non-API spend** — Claude.ai $209.42, ChatGPT $41.88, Perplexity $261.78, GitHub $50.26.
  That is **$573.81**, larger than the $346.56 of runtime API spend, and completely invisible
  to every provider usage API.
- **Prepaid top-ups vs consumption.** Every Anthropic and OpenAI API charge on the card is a
  credit purchase, not metered billing. Card totals record when credit was *bought*.

So import is not a fallback, it is the only route to the majority of the money.

**Stan's spreadsheet is already the right schema** — `date, item, company, model, type, notes`
with `type ∈ {credit, monthly, yearly, auto-charge}`. Adopt it directly rather than inventing
one; it has survived real use for 148 days.

Import should be CSV upload with a preview-and-confirm step, matching against existing rows so
re-importing an overlapping export does not double-count. Reconciliation on import is the
point: it caught two real omissions in the spreadsheet (ElevenLabs 07/24 $6.28, OpenAI 06/25
$10.47) and one coincidental match that hid them.

---

## 6. What I would add that is not on Stan's list

**Cost per unit of value.** Dollars alone cannot tell you whether spend is worth it. Cost per
conversation, per todo created, per eval run. ORB-364's decision was only makeable because
per-run cost existed.

**Eval spend as its own line everywhere.** It was 57% of total. It is also the most
compressible, and the only category where a single command can spend $1.26.

**A "what changed" note.** When burn rate moves sharply, say why — a new model, a longer
prompt, an eval run. Otherwise the chart shows a spike and the user reconstructs the cause
from memory.

---

## 7. Constraints and risks

**Performance.** ORB-312 already found this page's load was ~100% server-auth, and fixed it
by merging two actions into `getAiMetricsBundle`. Charts over 90d/YTD must not scan
`orb_model_requests` per render. Expect a daily rollup table (`orb_model_daily`) written by
the existing cron; the raw ledger stays for drill-down. **This is a new query pattern and
needs its own DB impact analysis before build** (AGENTS.md design-time checklist).

**Charts are new UI.** No chart pattern exists in `docs/ui-catalog.md` today. This needs a
catalog addition proposed to Stan before creation, and the `dataviz` skill loaded before the
first line of chart code.

**Do not trust a matching total.** The OpenAI column reconciled to the cent while containing
one omission and one not-yet-posted charge that happened to cancel. Reconciliation UI must
compare **transactions**, not totals.

**Provider units are provider-specific.** Anthropic returns cents; OpenAI returns dollars.
That cost two days and a false support ticket. Any new provider integration states its unit
explicitly in code with a comment, and the divergence display is what catches the next one.

---

## 8. Phasing

- **Phase 1 — NOW surface.** Runway, burn, balance per provider. Highest value, smallest
  surface, answers the only question with a deadline.
- **Phase 2 — rollup + HISTORY charts.** Needs the rollup table and a catalog pattern.
- **Phase 3 — PROVIDERS + import.** CSV import, transaction-level reconciliation, divergence.
- **Phase 4 — CONTROLS.** Merge settings in, resolve the spend-cap question, retire what
  ORB-363 concludes is dead.

Each phase is independently shippable. Phase 1 alone would have prevented all three outages.

---

## 9. Decisions (Stan, 2026-07-30)

**Balance is DERIVED, not fetched.** Runway needs burn rate (Orb already computes this from
`orb_model_requests`) plus remaining balance. No provider is known to expose remaining prepaid
credit via API. But with card import (below), balance falls out arithmetically:

    balance = Σ top-ups (card) − Σ consumption (ledger)

which needs no provider cooperation at all. It inherits the ledger's estimation error, so show
it as approximate and let the reconciliation surface correct it. This also makes card import a
**dependency of the runway feature**, not an optional extra — reordering the phases below.

**Import the CARD STATEMENT, not a curated sheet.** Stan will not maintain the spreadsheet.
Consequences, all load-bearing:

- **Orb becomes the system of record.** There is no longer a hand-checked sheet to reconcile
  against, so import correctness is the whole safety net. The reconciliation UI is not a
  nicety; it is the only thing that will catch a missed charge.
- **Classification must be automatic, with review.** The card gives
  `ANTHROPIC ANTHROPIC.COMCA`, `CLAUDE.AI SUBSCRIPTION`, `OPENAI *CHATGPT SUBSCR`,
  `GOOGLE *CLOUD` vs `GOOGLE *Google One`. Map descriptor → (provider, type), show the
  proposed classification, let Stan correct it, and **remember the correction** so the same
  descriptor is never asked about twice.
- **The card contains everything else in his life.** Groceries, dental, air travel. Import
  must filter to AI vendors and **discard the rest without storing it** — not import-then-hide.
  Data minimisation is the rule: a row that is not AI spend should never reach the database.
  This also means an unrecognised descriptor is dropped, not stored "just in case", so the
  classifier must be reviewable rather than silent.
- **Amounts include Hawaii GET at 4.712%.** Provider invoices are pre-tax; the card is
  post-tax. Store both, reconcile on pre-tax, and display post-tax as the cash figure. Getting
  this wrong makes every comparison look 4.7% off and invites a second cents-style hunt.
- **`Google One` is not Orb.** It runs identically through 2025, predating the project. The
  classifier must exclude it by default while keeping `GOOGLE *CLOUD`.

**Who decides what counts as "AI spend": Stan, at export time.** He curates the CSV; Orb does
not attempt to judge whether a vendor is AI-related. Orb's job is narrower and more tractable:
given a row Stan considers AI spend, determine `(provider, type, is_orb_runtime)`. This is a
good split — Stan holds the judgment that needs context, Orb holds the mapping that needs
consistency — and it is why unrecognised rows must be surfaced rather than dropped.

**Per-user attribution.** The rollup keys on `user_id`. `orb_model_requests` already carries
it. Note the asymmetry this creates and design for it explicitly: **the ledger is per-user,
the card is org-level** — a card charge is Stan's card, not any particular user's usage. So
per-user views can only ever be estimate-based, and provider/card figures are org totals. The
reconciliation surface therefore compares at org level; the per-user view is attribution only,
and must say so rather than implying the split is verified.

**Spend caps: hide from the UI, keep the code and data.** Same pattern as `DICTATE_ENABLED`
in `OrbConversation.tsx` — remove the surface, retain the mechanism, so a future multi-user
world does not have to rebuild it. Record in the object-capability matrix that the capability
exists but is deliberately unreachable, so a later audit does not read the blank cell as a gap.

---

## 10. Revised phasing

Card import moves first, because runway depends on it.

- **Phase 1 — Import + classification.** CSV upload, descriptor→provider mapping with
  remembered corrections, AI-only filtering, pre/post-tax storage. Unlocks everything else.
- **Phase 2 — NOW surface.** Derived balance, burn rate, runway per provider. The screen that
  answers the only question with a deadline.
- **Phase 3 — PROVIDERS.** Transaction-level reconciliation across ledger / provider API /
  card, with divergence as a first-class number.
- **Phase 4 — rollup + HISTORY charts.** Daily rollup table keyed on user and provider;
  bar and line with range selection and the eval/product split.
- **Phase 5 — CONTROLS.** Merge settings in; hide spend caps; keep warning thresholds.

---

## 11. Classification, derived from real data (30-row curated sample, 2026-07-30)

Stan's curated export reconciled to the statement **exactly** — 30 rows, $920.37, zero missing,
zero extra. Classification falls out of the descriptor alone, so the mapping below is evidence,
not guesswork:

| Descriptor contains | Provider | Type | Orb runtime? |
|---|---|---|---|
| `CLAUDE.AI SUBSCRIPTION` | Anthropic | subscription | no |
| `ANTHROPIC` (otherwise) | Anthropic | credit | **yes** |
| `OPENAI *CHATGPT SUBSCR` | OpenAI | subscription | no |
| `OPENAI* CHATGPT CREDIT` | OpenAI | credit | **no** — ChatGPT account, not the API |
| `OPENAI` (otherwise) | OpenAI | credit | **yes** |
| `GOOGLE *CLOUD` | Google | credit | **yes** |
| `GOOGLE *Google One` | Google One | consumer | no — predates Orb, present all through 2025 |
| `ELEVENLABS` | ElevenLabs | subscription | **yes** |
| `MISTRAL` | Mistral | credit | **yes** |
| `WWW.PERPLEXITY.AI` | Perplexity | subscription | no |
| `GITHUB` | GitHub | subscription | no |

**Order matters.** `CLAUDE.AI SUBSCRIPTION` must be tested before the generic `ANTHROPIC`
match, and both ChatGPT variants before the generic `OPENAI`. Written casually, a regex
conflates the OpenAI API account with the ChatGPT account — they are different accounts and
only one is Orb.

### The category dimension is the substantive schema change

Split the same 30 rows by **type** instead of vendor and they read completely differently:

- **credits $344.47** — money that flowed through Orb's own API calls
- **subscriptions $575.90** — tools Stan would pay for whether Orb existed or not

Nearly two thirds of "AI spend" is not Orb's running cost. Only the credit half belongs in
runway and burn-rate arithmetic: **a subscription does not deplete**, so including it makes
runway meaningless. Store `(provider, type, is_orb_runtime)` per row and let every surface
choose which question it is answering.

### Parser requirements, from three real exports

- Find the header row rather than assuming row 1 — one export had a blank leading line and the
  header on row 2, plus trailing empty columns.
- Quoted fields containing commas are real (`"GITHUB, INC. GITHUB.COM CA"`).
- **Do not assume date ordering.** The curated file is sorted by provider then date. Key each
  row on the tuple `(date, description, amount)`, which is also what makes re-importing an
  overlapping export idempotent.
- **A `Credit` column may be missing entirely.** Two exports carried only `Debit`, so refunds
  and grants — including a −$0.16 Anthropic free credit — were invisible. Request the credit
  column; if absent, say so at import rather than silently treating the file as complete.
- **The file is curated by Stan (updated 2026-07-30).** He now exports AI rows only and has
  removed `GOOGLE *Google One`. That changes what an unrecognised descriptor MEANS, and it is
  the most important consequence in this section:

  - Previously an unknown row was probably groceries → drop it silently.
  - Now an unknown row is spend **Stan deliberately included** → it is either a provider Orb
    has never seen (a new model, a new tool) or a descriptor variant of a known one. Dropping
    it silently would lose real spend and understate cost with no trace.

  So: **unrecognised rows are surfaced for classification, never discarded.** Import reports
  "3 rows I could not classify" and asks; the answer is remembered so the same descriptor is
  never asked about twice. This is the opposite of the earlier design and is strictly better —
  it turns the classifier's ignorance into a prompt rather than a silent omission.

- **Surfacing is the error-correction loop for a manual step, not a fallback for exotic
  vendors (Stan, 2026-07-30).** Curation is done by hand, so it will sometimes be wrong, and
  the mistakes run both ways:

  - a **non-AI row slips in** → unrecognised → surfaced → Stan says "not AI" → dropped, and
    the descriptor is remembered so it never appears again;
  - an **AI row with an unfamiliar descriptor** → surfaced → classified → counted.

  One mechanism catches both, which is what makes it worth building rather than a special
  case. The consequence: Stan does not have to curate *correctly*, only *approximately*, and
  Orb asks about the remainder. That is what makes a hand-maintained export trustworthy at
  all.

  Same shape as ORB-339's todo resolver, and the pattern recurs often enough in this project
  to be worth naming: **when input is ambiguous, ask rather than guess.** A tie does not
  resolve to the first candidate; an unknown descriptor does not resolve to "probably
  nothing".

- **Review must read as routine, not as failure — this is a design decision, not a mechanical
  one.** If unclassified rows are presented as errors (red, "import problems", a warning
  icon), Stan will start avoiding the import, and a runway figure nobody refreshes is worse
  than none. Present it as ordinary work: "3 rows need a home", inline, with the classification
  one click away and previously-answered descriptors already filled in. The count of
  unclassified rows should trend to zero on its own as the mapping learns, so a non-zero count
  means something genuinely new happened — which is information, not a fault.

- **Keep filtering server-side anyway.** One export described as stripped still contained 128
  non-AI rows and $7,313 of unrelated personal spending. That was a human step failing once,
  and it will fail again. Curation is now the primary mechanism and server-side filtering is
  defence in depth — but with unknowns surfaced rather than dropped (above), the two are no
  longer in tension: obvious non-AI descriptors (grocery, fuel, restaurant patterns) are
  discarded without storing, and everything else is either classified or queued for review.

- **`GOOGLE *Google One` is no longer expected in input** but the exclusion rule stays as a
  guard. It ran identically through all of 2025, predating Orb, so if it reappears it should
  not be counted.

## 12. Import cadence: event-driven, not scheduled

**Answer: monthly as a backstop, and prompted whenever the derived balance says a top-up is
missing.** The reasoning matters more than the interval.

Balance is derived as `Σ top-ups − Σ consumption`. Consumption is known continuously from the
ledger, so the derived balance decays accurately on its own. **It only becomes wrong when a
top-up happens that Orb has not imported** — and that error is one-directional:

- **A missing top-up understates the balance** → runway too short → Orb warns *early*. Safe.
- A *consumption* underestimate (a missing rate card, a parsing bug) overstates the balance →
  warns *late*. Dangerous — and no import frequency fixes it. That is what the estimate-versus-
  provider divergence in §2 is for.

So import cadence is not safety-critical; it governs how pessimistic the runway looks. That
argues strongly against nagging.

**Orb can detect when it needs an import rather than asking on a timer.** A derived balance
at or below zero while calls are still succeeding is proof of an unrecorded top-up — the
provider clearly has credit Orb cannot see. That is a precise, self-detecting trigger:

1. **Derived balance ≤ 0 but requests succeeding** → "You have topped up since the last
   import. Import to restore an accurate runway."
2. **Runway below the warning threshold** → prompt, since that is exactly when the figure
   needs to be trustworthy.
3. **Monthly** → backstop for the subscription and reconciliation side, which has no
   self-detecting signal because subscriptions do not deplete.

**Always show the age of the balance data.** A runway of "9 days" computed from a three-week-old
import is a confident lie, and this session has enough of those. Display the last import date
beside the figure and go amber once staleness exceeds what the burn rate makes safe.

## 11. Remaining open questions

1. RESOLVED: CSV (`Date,Description,Debit`) — see §11.
2. RESOLVED: event-driven — see §12.
3. Retroactive scope: import 2026 to date only, or 2025 as well for a full baseline? 2025 has
   no AI spend at all beyond consumer Google One, so probably not.
