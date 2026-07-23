# ORB-353 — AI Usage Approaching-Limit Warning

**Status:** All research/verification complete. Every in-scope provider (Anthropic, OpenAI, ElevenLabs, Gemini) empirically confirmed live. See **Final Build Plan** below — waiting on Stan's go-ahead to start writing code. Earlier sections below the Final Build Plan are the decision trail, kept for rationale, not all still current (superseded points are marked).
**Created:** 2026-07-21
**Todo:** ORB-353 (priority 2, due 2026-07-22, status "in progress" — set by Stan, no prior discussion)

---

## Final Build Plan (supersedes "Proposed design" / "BLOCKED" sections below)

### Data model
1. **`orb_model_rate_cards`** — Stan adds the `openai / gpt-realtime-2.1` pricing row himself (already agreed).
2. **`lib/orb-model/policy.ts` (`OrbAiPolicy`)** — new fields:
   - `voiceBudgetUsd` (genuinely separate from `strategicBudgetUsd`, fixes the stale "Strategic + Voice" conflation)
   - `warningThresholdPct` — one shared percentage applied across every scope below (Orb ledger + all provider caps). Simpler than per-scope thresholds; easy to split later if you want finer control.
   - `anthropicSpendCapUsd`, `openaiSpendCapUsd`, `geminiSpendCapUsd` — admin-entered numbers, since none of those three APIs expose a real configured cap. ElevenLabs needs no cap field — its API already returns the real `character_limit`.
3. **New table `orb_usage_warnings`** (scope text, period text `YYYY-MM`, warned_at timestamp) — dedup state so each scope warns once per crossing per billing period, not every check cycle. Small, matches the existing ticket-dedup pattern in spirit but scoped per usage-scope rather than per-incident-summary.

### New module: `lib/orb-model/usage-monitor.ts`
- `getOrbLedgerUsage()` — extends today's `checkOrbBudget` logic to report operational/strategic/voice as three independent scopes (fixes the bug where voice silently folds into operational).
- `getAnthropicOrgSpend()` — `GET /v1/organizations/cost_report`, current month, org-wide total.
- `getOpenAiOrgSpend()` — `GET /v1/organization/costs`, current month, org-wide total.
- `getElevenLabsUsage()` — `GET /v1/user/subscription` → `{character_count, character_limit}` directly, no cap field needed.
- `getGeminiOrgSpend()` — BigQuery query against `gen-lang-client-0911706834.Shoebill_Software.gcp_billing_export_resource_v1_019FB0_14597B_968D29`, current month sum. (Table has 0 rows right now — export just enabled, expect data within ~24h. Code works the same whether the sum is 0 because nothing's landed yet or because spend is genuinely $0.)
- `checkAllUsageThresholds()` — computes all 7 scopes (operational, strategic, voice, Anthropic-org, OpenAI-org, ElevenLabs, Gemini-org) against `warningThresholdPct`, checks `orb_usage_warnings` for an existing warning this period, and on a **fresh** crossing: push + email + broadcast (see below), then records the dedup row. Called from the new cron route, not from any user-facing request path.

### Trigger / cadence — superseded 2026-07-21, now a dedicated Vercel Cron

**Original plan (riding `/api/version`'s 60s cache) rejected after Stan's question about performance impact.** Two real problems: (1) it would add several external network calls' worth of latency to a hot, already-optimized, frequently-polled endpoint (ORB-326 specifically shipped to make `/api/version` cheaper — this would work against that), risking a slow/degraded provider stalling every client's poll; (2) it would only run as a side effect of someone having the app open, defeating the point of a *proactive* warning.

**Considered and rejected: triggering off Orb's own model calls.** Ties the check to "actual usage," but the org-wide totals (Anthropic, OpenAI) are dominated by work outside Orb itself (this very Claude Code session, other projects under the same org) — a check gated on Orb's own traffic would be blind to exactly the spend that matters most today.

**Also researched: do the providers offer genuine push (webhooks) instead of polling?** Only **Google** does — Cloud Billing Budgets + Pub/Sub notifications. Confirmed **no** push exists for Anthropic (their own rate-limits doc, the natural place for it, only describes console-configured email alerts and pull APIs). OpenAI and ElevenLabs couldn't be confirmed either way (docs 403'd/404'd repeatedly) but show no evidence of one. Practically: none of these providers run live alerting internally either — their own "usage alert" email features are almost certainly just periodic checks on their side too. There's no way to be pushed something that isn't itself computed by polling somewhere upstream, except where a provider has built dedicated alerting infrastructure for it (Google has; the others apparently haven't).

**Decision (Stan, 2026-07-21): a dedicated cron job, every 15 minutes**, running independently of user traffic, catching org-wide spend growth from any source, adding zero latency to any user-facing request. **Gemini folds into this same cron** rather than getting a separate Pub/Sub push mechanism — it's already pull-based via the BigQuery export Stan set up, and keeping one uniform code path checking all 7 scopes (operational, strategic, voice, Anthropic-org, OpenAI-org, ElevenLabs, Gemini-org) is simpler than standing up GCP Budgets + Pub/Sub + a new webhook endpoint for marginal benefit over a 15-minute cron.

**Trigger mechanism corrected (2026-07-22):** the original build used a Vercel Cron entry in `vercel.json`, but Stan confirmed his Vercel plan only permits daily cron intervals — 15 minutes isn't available there. Rather than degrade to daily (a real regression — a spike could go unnoticed up to 24h) or require a paid plan upgrade, the check is triggered by a **GitHub Actions scheduled workflow** (`.github/workflows/usage-check.yml`, `*/15 * * * *`) calling the same `/api/cron/usage-check` production endpoint with `CRON_SECRET` as a GitHub Actions secret. The Vercel Cron entry was removed from `vercel.json`. **Done (2026-07-22):** `CRON_SECRET` set as both a Vercel production env var and a GitHub repository secret — this closes a real pre-existing gap, since it had never been set at all and both cron endpoints (`reminders` and `usage-check`) were unauthenticated in production until now. Takes effect on next deploy.

### On a fresh crossing (the "push operation")
1. **Push** every admin's subscribed devices via the existing `sendPushToUser` (`lib/push.ts`), admins = `role_id in (1,3)`.
2. **Email** every admin, reusing `notifyOrbIncident`'s admin-lookup/email/Resend code path (`lib/orb-model/incidents.ts`) — extending it with a new incident kind rather than duplicating the pipeline.
3. **Broadcast banner** — write `system_settings.broadcast_message` so `BroadcastBanner.tsx` shows it immediately. **Design nuance to flag:** the broadcast slot is single-message; if Stan has a manually-typed announcement active, auto-usage-warnings should never clobber it. Proposed rule: the auto-system only ever writes/clears a broadcast entry it marked itself (a new `source: 'auto-usage-warning'` field alongside the existing `{message, id, type}` shape); an admin-typed entry (no `source` field) is left untouched, and the usage warning falls back to push+email only for that cycle. Recomputes and overwrites its own entry every cache cycle while any scope is still over threshold; clears it once all scopes drop back under.

### UI changes (`components/settings/SettingsAI.tsx`)
- Fix the stale "Strategic + Voice" labels (line 69 description, line 85 model dropdown, line 126 budget field) → plain "Strategic" + new separate "Voice" budget field, per Stan's earlier confirmation.
- New card: **Usage Monitoring** — `warningThresholdPct`, `anthropicSpendCapUsd`, `openaiSpendCapUsd`, `geminiSpendCapUsd`, plus a read-only display row for ElevenLabs' real `character_count`/`character_limit` (no input needed there).

### Non-negotiables (carried through)
- No `scripts/eval-cases.ts` case anticipated — not an Orb-conversation tool/param/policy change. Will confirm once implementation is final.
- DB impact: one new small dedup table (`orb_usage_warnings`), a handful of new `OrbAiPolicy` columns, one new voice-usage ledger write path at existing request volume, one new rate-card row. No Realtime subscription, no new polling loop — rides the existing `/api/version` cadence.
- `docs/object-capability-matrix.md` — add a row for usage/budget/broadcast (currently has none) in the same change.

---

---

## Ticket text

> Display broadcast message when AI Usage is approaching its limit and send email message to admins.
>
> This requires the ability to access usage for every AI tool used in Orb. A message must be displayed and an email message needs to be sent to admins.
>
> Note: there should already be a broadcast message when any tool has reached its limit. This is a warning message that precedes it.

**Correction found during research:** no existing broadcast fires automatically at-limit today. `system_settings.broadcast_message` is 100% admin-typed (`SettingsMaintenance.tsx`). The real existing precedent is a **billing-error card + auto-ticket + admin email** pipeline (`lib/orb-model/incidents.ts`, live since ORB-228) that fires reactively when a provider call actually fails on billing/quota — not a proactive usage-threshold check. This plan builds the proactive piece net-new.

## Decisions confirmed by Stan (2026-07-21)

- **Scope:** cover every AI provider Orb has the ability to track usage for — both Anthropic (Orb conversation) **and** OpenAI (Realtime voice), not Anthropic alone.
- **Delivery:** must be a genuine **push operation** — not a passively-computed value the client happens to notice on its next poll. Orb already has a working web-push pipeline (`lib/push.ts` → `sendPushToUser`, used today for todo-urgency escalation) — reuse it, don't invent a second one.
- **Warning threshold:** UI-configurable (no fixed default mandated) — add as an editable field in `SettingsAI.tsx`, same pattern as the existing budget fields.
- **OpenAI Realtime rate card:** Stan will supply/insert the `gpt-realtime-2.1` pricing row into `orb_model_rate_cards` himself — do not fabricate cost figures.
- **Voice budget limit + monthly total:** both UI-configurable, no fixed figure mandated.
- **Push audience:** admins only (`role_id 1/3`), same as the existing billing-incident pipeline.
- **Stale "Strategic + Voice" labels in `SettingsAI.tsx`** (line 69 description, line 85 model dropdown label, line 126 budget field label): fix in this same change. Rename to plain "Strategic", add a genuinely separate "Voice" budget field, since voice (`gpt-realtime-2.1`, native reasoning) no longer routes through the strategic text model the way the old, now-unreachable serial voice engine (`useVoiceMode`) did.
- **Two distinct limits, both must be covered, whichever is reached first wins (2026-07-21):** Stan flagged that there are two separate ceilings — (1) Orb's own internal ledger-based budget policy, and (2) the AI provider's real account-level limit. Investigated whether provider-side "approaching" (not just "reached") is currently possible: **it is not** — `.env.local` only has the standard `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`, not the admin-scoped credentials each provider's usage/cost API requires (confirmed via Anthropic's own docs: the Admin API "is unavailable for individual accounts," needs an Organization + an `sk-ant-admin-...` key provisioned by an org admin; OpenAI's Usage/Costs API is understood to require a separate Admin API key from an org owner, though OpenAI's docs/help pages 403'd every fetch attempt and this specific claim is from general knowledge, not confirmed against current OpenAI docs — verify in the OpenAI dashboard). **Stan's decision: set up both admin keys before building**, so both limits can be checked proactively rather than shipping with an asymmetric design (Orb's limit proactive, provider's limit reactive-only). **This blocks the start of implementation.**

## What exists today (research findings)

| Piece | State |
|---|---|
| Broadcast banner (`system_settings.broadcast_message` → `/api/version` → `SystemStateProvider` → `BroadcastBanner.tsx`) | Admin-typed only. Reusable as the **display surface**, not currently usage-aware. |
| Anthropic (Orb conversation) usage ledger | Exists: `orb_model_requests` table, `checkOrbBudget()` in `lib/orb-model/budget.ts` returns real `spentUsd`/`limitUsd` per role (`operational`/`strategic`) and total, current UTC month. Checked only reactively, at request time, to hard-block — never proactively, no warning threshold. |
| OpenAI Realtime voice usage ledger | **Does not exist.** `recordOrbModelRequest` (`lib/orb-model/record.ts`) is never called from `app/api/orb-realtime/`. Voice sessions log nothing to `orb_model_requests`. `OrbModelRole` already includes `'voice'` (added v0.6.214) but `checkOrbBudget`'s role bucketing folds anything non-`'strategic'` into `'operational'` — a latent bug once voice starts logging, would silently misattribute voice spend against the operational cap. |
| Rate cards (`orb_model_rate_cards`) | Has `anthropic/claude-haiku-4-5`, `google/gemini-3.1-pro-preview`, `openai/tts-1`, `openai/tts-1-hd`, `elevenlabs/eleven_turbo_v2_5`. **No entry for the Realtime model** (`gpt-realtime-2.1`, `OPENAI_REALTIME_MODEL` env, `app/api/orb-realtime/session/route.ts:8`). |
| Push notifications | Exists and working: `sendPushToUser(userId, payload)` (`lib/push.ts`), `push_subscriptions` table, VAPID configured. Used today for the todo-urgency escalation feature, with a **before/after threshold-crossing pattern** (`checkAndNotifyEscalation`) that fires exactly once per crossing rather than every time — this is the right template to reuse here. |
| Admin lookup + email + dedup | Exists: `notifyOrbIncident` (`lib/orb-model/incidents.ts`) looks up `users` where `role_id in (1,3)`, dedupes via an open ticket with matching `summary`+`source:'orb-auto'`, emails via Resend. Reusable pattern, not currently wired to a usage-threshold event. |

## Proposed design

1. **Instrument OpenAI Realtime voice into the same ledger.** After each Realtime response completes (`response.done` carries a `usage` object from OpenAI), call `recordOrbModelRequest` with `provider: 'openai'`, `model: REALTIME_MODEL`, `routeRole: 'voice'` — mirroring how the serial engine already logs Anthropic calls. Requires a rate card row for `gpt-realtime-2.1` (audio input/output pricing differs from text pricing on this model family) — **I need you to confirm current rates**; a WebFetch to OpenAI's pricing page was blocked (403), and I won't fabricate a cost figure.
2. **Fix the role-bucketing gap in `checkOrbBudget`.** Give `'voice'` its own ledger bucket instead of folding into `'operational'`, and add a `voiceBudgetUsd` field to `OrbAiPolicy` (`lib/orb-model/policy.ts`), editable alongside `strategicBudgetUsd`/`operationalBudgetUsd` in `SettingsAI.tsx`.
3. **Add a configurable warning threshold** (e.g. `warningThresholdPct`, default 80) to `OrbAiPolicy` — the "approaching" line, distinct from the existing 100% hard block.
4. **Detect threshold crossing, not just threshold state.** Reuse the exact before/after pattern from `checkAndNotifyEscalation` (`lib/push.ts`): compute spend-vs-limit before and after each recorded request (Anthropic operational/strategic *and* new voice path); fire only on the transition from below-threshold to at-or-above-threshold, once per role per billing month (dedup key: role + `YYYY-MM`).
5. **On crossing, do three things together (the "push operation"):**
   - Push-notify every admin's subscribed devices via `sendPushToUser` (loop admins the same way `notifyOrbIncident` already does — `role_id in (1,3)`).
   - Email every admin, reusing the Resend + admin-lookup code path already in `incidents.ts` (either extend `notifyOrbIncident` with a new incident kind, or add a sibling function that shares its admin-lookup/email helpers — leaning toward extending, to keep one pipeline instead of two).
   - Auto-write `system_settings.broadcast_message` (type `warning`) so the existing `BroadcastBanner` shows it in-app immediately, without waiting for an admin to type one — reuses the display surface as-is, no new UI component.
6. **Dedup/reset:** a warning should not re-fire every request once above threshold. Store last-warned role+month (a small `system_settings` key, or a dedicated row) so it fires once per crossing, same as the ticket-dedup pattern elsewhere in this codebase.

## BLOCKED — waiting on Stan to provision two admin API keys

Nothing further gets built until these exist (either in `.env.local` locally, or you tell me you've decided to proceed without one and accept the reactive-only fallback for that provider — see the "union of both signals" fallback design that was the alternative option, still available if a key turns out to be impractical to obtain).

**Anthropic** (confirmed via `platform.claude.com/docs/en/api/administration-api`):
1. Requires an **Organization** account, not an individual one (Console → Settings → Organization to set one up if not already present).
2. An org member with the **admin** role provisions an **Admin API key** (prefix `sk-ant-admin-...`) via Console → **Create an Admin API key** (`docs/en/manage-claude/admin-api-keys`).
3. That key authenticates the **Usage and Cost API** (`docs/en/manage-claude/usage-cost-api`) and the **Rate Limits API** (`docs/en/manage-claude/rate-limits-api`) — the two endpoints this feature needs to read Orb's actual current spend and rate-limit standing against the real account ceiling.
4. Add to `.env.local` (and Vercel) as a new var, e.g. `ANTHROPIC_ADMIN_API_KEY` — separate from the existing `ANTHROPIC_API_KEY`, which cannot be reused for this.

**OpenAI** — I could not confirm current specifics; every OpenAI docs/help URL returned 403 to WebFetch, so **please verify directly in your dashboard** rather than trust this from memory: look for an **Admin API key** (as opposed to a regular/project API key) under your organization's API key settings — typically only an org **owner** can create one — and confirm it's what the **Usage and Costs API** actually requires. Add it as a new var, e.g. `OPENAI_ADMIN_API_KEY`, separate from the existing `OPENAI_API_KEY`.

## Admin key findings (2026-07-21, keys now live in `.env.local`)

- **Anthropic Cost API** (`/v1/organizations/cost_report`) confirmed working live against the real org ("Shoebill Software"). Returns real USD spend, daily granularity. **Org-wide total, not scoped to one API key** — this org has several keys (`helm`, `todos` [Orb's actual key — confirmed by matching `ANTHROPIC_API_KEY`'s prefix/suffix against `partial_key_hint`], `dev-open-code`, others), so this total includes all Claude Code work across projects, not just Orb's app-level calls.
- **Stan's explicit call (2026-07-21): use the org-wide total, not a per-key-filtered figure.** Today almost all Claude Code spend is effectively Orb-related work anyway, and a live pull from Anthropic's own billing source is more trustworthy than depending on manually remembered "provider bill" entries. **Correction to the design:** do not filter `cost_report` by `api_key_ids[]`. Label this in the UI/notifications honestly as **total Anthropic organization spend**, not "Orb's Anthropic spend" — those happen to be nearly the same today but are not definitionally the same thing, and the copy must not imply a narrower scope than what's actually measured.
- **No API exposes a configured dollar "spend cap"** for a Console/Platform-type org (only Enterprise orgs get a spend-limits endpoint, not applicable here). The cap itself must be an Orb-admin-entered number (fits the already-decided "UI configurable" approach) — checked against the *real* Cost API total, not Orb's own internal `orb_model_requests` ledger estimate. This is a genuine upgrade over today's `checkOrbBudget`, which only estimates spend from Orb's own request log.
- **Anthropic Rate Limits API** (`/v1/organizations/rate_limits`) also confirmed working — returns requests/tokens-per-minute ceilings per model group. This is a *throughput* limit, a different kind of ceiling than a dollar cap, and not per-dollar "approaching" in the same sense. Tentatively out of scope for the warning feature (which is about spend, per Stan's framing) unless Stan wants throughput ceilings covered too — will confirm rather than assume.
- **Scope correction (Stan, 2026-07-21): all four AI providers Orb uses, not just Anthropic + OpenAI.** Codebase inventory: `anthropic`, `google` (Gemini, strategic role), `openai` (Realtime voice + TTS), `elevenlabs` (TTS). Checked each for a queryable usage/spend source:

| Provider | Queryable? | How | Auth |
|---|---|---|---|
| **Anthropic** | Yes — confirmed live | `GET /v1/organizations/cost_report`, org-wide USD, daily buckets | `ANTHROPIC_ADMIN_API_KEY` (now in `.env.local`) |
| **OpenAI** | Yes — confirmed live | `GET /v1/organization/costs`, org-wide USD, daily buckets (same shape as Anthropic's) | `OPENAI_ADMIN_API_KEY` (now in `.env.local`) |
| **ElevenLabs** | Yes — confirmed via docs, not yet tested live | `GET /v1/user/subscription` → returns `character_count` **and** `character_limit` directly. Better than Anthropic/OpenAI: the actual configured limit is queryable, not just spend, so no admin-entered cap needed for this one. | Regular `ELEVENLABS_API_KEY`, already in `.env.local` — **no new admin key needed** |
| **Google (Gemini)** | **No** | Confirmed via Gemini API docs: no REST endpoint for usage/spend/quota via a simple AI Studio API key (which is what `GEMINI_API_KEY` is). Real usage/billing visibility requires a full Google Cloud Billing setup — GCP project, Cloud Billing API, service-account credentials — an entirely different, heavier auth model than the other three, not just a config addition. | N/A with current key type |

None of the three working APIs (Anthropic, OpenAI, ElevenLabs) expose a configured dollar spend cap except ElevenLabs (which exposes an actual character limit, not dollars). For Anthropic and OpenAI, the cap stays an Orb-admin-entered number compared against the real queried spend.

**Open question for Stan:** Google/Gemini has no path without a real GCP Cloud Billing setup (separate from just adding an API key — involves creating a service account, granting Billing Viewer IAM role, enabling the Cloud Billing API on a project). Options: (a) skip Gemini in this feature — Orb's internal ledger already estimates Gemini cost per-request the same way it does for Anthropic operational calls, so a same-caveat internal-ledger-based figure could stand in for Gemini only, clearly labeled as an estimate rather than real billing data; (b) do the full GCP setup so all four providers are equally real; (c) something else. Will ask directly before building the Gemini piece — everything else can proceed in parallel.

### Fifth provider: Mistral (2026-07-21, Stan: "Don't forget Mistral")

Not in Orb's app-level model catalog at all — this is the AI coding-assistant tool ("Mistral Vibe," per `HANDOFF.md`'s ORB-349 session and `ACTIVE_WORK/mistral-vibe.md`), a separate account/billing relationship from anything Orb's app calls at runtime. `.env.local` already has a `MISTRAL_API_KEY` (unclear original purpose — not referenced anywhere in `lib/orb-model/`).

**Note on scope, by analogy with the Anthropic decision above:** Claude Code and Codex don't need separate tracking — their spend already lands inside the Anthropic and OpenAI **org-wide** totals respectively, since they authenticate against the same organizations. Mistral Vibe is different: Mistral is not one of Orb's four app-level providers at all, so its spend isn't captured by anything else in this plan. It only needs covering because it's a distinct billing relationship, same reasoning as why Gemini CLI's spend would already be inside "Google," if Google were queryable.

- Mistral has an Admin API: `GET /v1/admin/spend-limit` (returns the **actual configured spend limit** — better than Anthropic/OpenAI, similar to ElevenLabs) and `GET /v1/admin/usage` (usage with pricing, broken down by category).
- **Tested live: the existing `MISTRAL_API_KEY` is not admin-scoped — 401 Unauthorized on both endpoints.** Needs a separate Mistral Admin API key, same pattern as Anthropic/OpenAI.

**Provider status, consolidated — all four in-scope providers empirically verified live (2026-07-21):**

| Provider | Status | Real spend source | Real cap source |
|---|---|---|---|
| Anthropic | ✅ verified live (`cost_report`, org-wide, $ by day) | Real | Not exposed by any API for a Console/Platform org — admin-entered number in Orb |
| OpenAI | ✅ verified live (`organization/costs`, org-wide, $ by day) | Real | Not exposed — admin-entered number in Orb |
| ElevenLabs | ✅ verified live (`user/subscription`) — simplest case, returns `character_count` **and** `character_limit` together | Real | Real — no admin-entered number needed, ElevenLabs tells us the actual limit |
| Google (Gemini) | ✅ verified live — BigQuery billing export (`gen-lang-client-0911706834.Shoebill_Software.gcp_billing_export_resource_v1_019FB0_14597B_968D29`), service-account auth confirmed working end-to-end (query executes cleanly, 0 permission errors). **Table currently has 0 rows** — export was just enabled; GCP billing export typically takes up to ~24h to backfill first data. Not a blocker, just a wait. | Real (once data lands) | Not exposed by this table — admin-entered number in Orb |
| Mistral | Deferred — Stan will add the admin key himself later | — | — |

**Mistral — deferred (Stan, 2026-07-21):** skipped from this build. Stan will provision the admin key himself when he gets to it; not blocking anything else here.

## Remaining open questions once keys are in place

1. **Provider-side threshold:** same UI-configurable-percentage approach as Orb's own budget, or should the provider-side warning instead key off whatever rate-limit/remaining-balance signal that provider's Usage API actually exposes (the two providers' APIs may not expose "% to limit" in the same shape)? Will confirm once I've read both APIs' actual response schemas.
2. **Poll cadence for the two Usage APIs:** these are external network calls with their own rate limits — proposing to check on the same cadence as `/api/version`'s existing 60s server cache rather than per-request, to avoid hammering either provider's Usage API. Will confirm as part of implementation, not blocking the start of work.

## Non-negotiables carried over

- Eval suite: this is not an Orb-conversation tool/param/policy change, so no `scripts/eval-cases.ts` case is anticipated — will confirm once implementation is final.
- DB impact: one new table-write path (voice usage logging) at existing request volume, one new rate-card row, one new/extended `system_settings` key or small dedup table — no Realtime `postgres_changes` subscription, no new polling loop (rides the existing `/api/version` cadence and the existing per-request ledger write).
- Object capability matrix (`docs/object-capability-matrix.md`) has no row for usage/budget/broadcast today — will add one in the same change per the matrix's own maintenance rule.
