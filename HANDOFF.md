# HANDOFF.md

> Living session-to-session context for the Orb project.
> Every AI reads at session start. Every AI updates it at session end.
> Committed with each session's code changes.
>
> **History policy (agreed with Codex, 2026-07-12):** this file holds only *current, load-bearing* context. Durable technical lessons live in the **Knowledge Repo**; operating rules in **AGENTS.md**, the **object-capability matrix**, **UI catalog**, **eval cases**, and the **concurrency protocol**; implementation history in **git** and `lib/changelog.ts`. Prune aggressively — do not let dated session narratives accumulate here.

---

## App State

- **Branch:** `codex/orb-325-production-hardening` (required short-lived migration branch; not pushed)
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app
- **Version:** local/canonical **0.6.217**; production remains **v0.6.188**. The whole `codex/orb-325-production-hardening` branch is unpushed.
- **Production maintenance:** **ACTIVE** while the ORB-337 database migration waits for the aligned v0.6.217 app release. Keep active until Tier 1 is green, Stan approves the push, deployment is confirmed, and production move/create checks pass.

---

## Last Session Completed

**ORB-337 never recycle todo numbers — 2026-07-18 (Codex, GPT-5) — v0.6.216 — DATABASE MIGRATED + VERIFIED / APP RELEASE PENDING**

Todo UUID remains permanent identity; project code plus `todo_number` remains the current address. A new RLS-protected per-project high-water table and database trigger now own all ordinary create/move allocation with atomic row locking. Seed data comes from every surviving row (including soft-deleted todos) plus parseable audit history, and the migration aborts if any surviving or audited number exceeds the seeded counter. `todo_number` becomes positive, non-null, immutable outside a move, and fully unique across surviving and soft-deleted rows. Delete never changes the counter, and a move consumes a new destination number without returning its source address.

Removed independent `MAX(todo_number) + 1` allocation from REST moves, both serial Orb move paths, Realtime confirmation, and ticket-to-todo creation. Backup & Recovery now sends todos through a service-role-only restore RPC that preserves exported UUID/project/number pairs while the allocation triggers remain enabled, advances the high-water, is idempotent for the same archive row, and rejects a different UUID claiming an occupied address. Archive cleanup now also preserves JSON-array columns such as todo URLs and Knowledge Repository tags. Added an emergency maintenance-only rollback plus a disposable-project verification script covering parallel allocation, failed-write rollback, delete/move non-reuse, immutability, and restore integrity.

Database design impact: one indexed counter-row upsert per todo create/move; no Realtime subscription, render/poll write, or new unindexed query. Existing Todo CRUD interaction spans include the allocator, so no trigger-side timing writes were added. The optimized production build, `npx tsc --noEmit`, focused ESLint (0 errors; seven pre-existing warnings in touched legacy files), and `git diff --check` pass. The guarded Realtime rewrite was matched exactly against the live stored function, and the restore column list was checked against the live 21-column `todos` table.

Production migration completed transactionally on 2026-07-18 HST under audited maintenance mode. Preflight found `todos` at 20.9% dead rows; every public application table above the mandated threshold was vacuumed/analyzed, leaving `todos` at 0% before migration. Seeded high-waters: ADELESADUL 4, CAN26 44, HELM 64, MIRACLESON 6, ORB 341, PRETO 7, STOKELYFRO 4, TICKETS 2. All eight projects have exactly one counter; the new constraints/triggers are present; restore execute privilege is false for anon/authenticated and true only for service role; the Realtime stored function contains no legacy maximum allocator.

The first disposable verification attempt encountered transient PostgREST schema-cache reload error `PGRST002` after DDL and left two empty test projects; both were removed directly, an explicit schema reload was requested, and REST readiness returned HTTP 200. The full rerun passed concurrency, failed-write rollback, hard-delete/move non-reuse, immutability, restore idempotency/collision/high-water behavior, and cleaned up successfully. Postflight found no test residue, no RLS initplan regressions, strong disk cache health, `todos` at 4.5% dead rows, and verification-churn tables vacuumed back to 0%. Maintenance was briefly cleared after verification, then immediately restored when the old production app/version boundary was rechecked; the public `/api/version` endpoint now confirms `maintenance: true`.

Stan’s first Tier 1 run was 68/70. The failures exposed two pre-existing contract/routing gaps rather than an ORB-337 allocator failure: `query_db` had disappeared from the generated serial tool contract despite its implementation/prompt/Realtime schema/eval remaining present, so the model supplied no required `table`; and an exact visible task close redundantly queried before mutating. v0.6.217 restores the canonical `query_db` schema from `docs/api-spec.yaml` and clarifies direct exact-code mutation routing. Contract generation, TypeScript, focused lint (0 errors; six pre-existing warnings), `git diff --check`, and the optimized production build pass. The two repaired cases passed 2/2; Stan explicitly chose to skip a second complete Tier 1 run and approved the v0.6.217 push based on the original 68 passing cases plus the repaired 2/2 focused result.

**ORB-326 SystemStateProvider poll dedup — 2026-07-18 (Codex, GPT-5) — v0.6.215 — CLOSED**

The app shell now makes one `/api/version` request per initial, visible-tab interval, focus/visibility, online-event, manual-refresh, or DEV-simulation trigger. That response drives both `isOnline` and the existing version/maintenance/lockout/broadcast state, eliminating the redundant `/api/health` client request. Network exceptions and non-OK responses set offline; a later successful response restores online and refreshes the full state packet. The lightweight `/api/health` route remains deployed for possible external probes; a repository/config audit found no in-app, Vercel, or GitHub consumer that requires deletion or further changes.

Added opt-in `background / system-state / version_poll` telemetry; ordinary runs enqueue no measurement traffic. Updated the ORB-309 initialization plan, consolidation reference, and performance matrix. No UI pattern, database query, schema, Realtime subscription, or Orb conversation contract changed. `npx tsc --noEmit`, focused ESLint, and `git diff --check` pass. Localhost access was restored and ORB-326 was closed with resolution notes plus a Knowledge Repository entry.

**ORB-325 Realtime voice — provider-owned turn-taking rewrite, cross-platform quality fixes, checkpoint — 2026-07-17 (Claude Code, Opus 4.8) — v0.6.213 — VOICE RUNTIME VALIDATED across the full supported matrix / still allowlist-gated**

The previous Realtime design was a **client-side manual turn/response state machine** that disabled the provider's own turn-taking and hand-rolled `response.create`/`response.cancel` from transcription events. It raced the provider's one-active-response rule and crashed sessions after a handful of turns (`response_cancel_not_active`, then `conversation_already_has_active_response`), plus produced empty/lost responses. **Stan's call:** revert the patches and rewrite to **provider-owned turn-taking with no greeting** (Perplexity-style: continuous listening, provider handles barge-in). Realtime is a **replacement** of the voice path (fallback chain: Realtime voice → text input in the Orb → list UI), staying allowlist-gated for staged rollout.

`lib/hooks/useRealtimeVoiceSpike.ts` was fully rewritten (~660 lines, was ~1315). Session (`app/api/orb-realtime/session/route.ts`): `server_vad`, **`create_response: false`**, **`interrupt_response: true`**. The client sends `response.create` in exactly **three** guarded places (on transcript-ready; the deferred version on a prior response's `response.done`; one tool-result continuation per response via `executeToolBatch`), all guarded against `responseInFlightRef`; there are **zero** `response.cancel` sends. Parallel tool calls in one response are batched into one continuation `response.create` (the `calls=2` crash). No greeting — opens into listening. Status is driven by `output_audio_buffer.started/stopped/cleared` (truthful audio), not `response.done`. Silero is now **advisory telemetry only** (gates nothing). An always-on DEV lifecycle trace + a "Copy Realtime trace" DEV button (`getTrace()`) were the diagnostic that made every root cause below findable.

**ORB-325's 4 named acceptance issues, resolved:**
1. **Response latency** — Stan confirmed not an issue after the rewrite.
2. **Near-inaudible voice on some platform/browser combos** — root-caused as **acoustic echo**, not a routing bug: Orb's own speakerphone output was leaking into the mic and the provider VAD misread it as the user interrupting, cutting Orb off mid-sentence (`threshold: 0.65` too permissive). Confirmed via headphone A/B (clean with AirPods; glitchy on speaker) before touching code. Fix: `threshold` → **0.8** in the session config — a stricter volume gate for what counts as speech, real speech still clears it easily.
3. **Mishearing "Orb" and other words** — Stan confirmed not an issue after the above.
4. **First part of the greeting missed** — resolved structurally: there is no greeting anymore.

**Two more defects found and fixed during multi-device testing:** (a) iPad Safari occasionally redelivered the same `response.done` event; since its turn mapping had already been deleted, the repeat fell back to `activeTurnIdRef.current` and got misattributed to whatever turn was active by then, causing a `listening→thinking` flicker (no functional break — tool dedup already prevented double execution). Fixed with a `handledResponseIdsRef` set that drops a repeat outright. (b) The DEV lifecycle trace didn't capture the actual thrown error on a failed connection attempt (only the separate on-screen error text did) — added a `START FAILED: <name>: <message>` trace line so a failed session is fully diagnosable from one copied trace. (A `429 insufficient_quota` from OpenAI surfaced during this testing — an account/billing issue, unrelated to any code change; resolved by Stan outside the codebase.)

**Validated clean, this session, on:** Mac Safari, Mac Chrome, Mac Edge, iPad Safari, iPhone Safari — held long conversations, tool calls, interruptions, no crashes, no audible/echo glitches, no status flicker. Firefox is out of ORB-325's scope entirely (tracked under **ORB-330**, which also owns the recorded-audio/server-transcription fallback for browsers without native STT).

`npx tsc --noEmit` + focused ESLint green throughout both this session's commits. The server-side typed-capability surface (todo/project/knowledge/ticket/audit/query_db/nav/prefs/memory/adaptation tools, migration-backed transactional confirmation RPCs, mutation-authorization grammar) is **unchanged** and remains valid. Flow doc (`docs/orb-325-realtime-voice-flow.md`) rewritten to the new architecture. Changelog: the 10 uncommitted, partly-superseded v0.6.202–0.6.211 entries were collapsed into one honest v0.6.212 entry; v0.6.213 adds this session's three fixes on top.

**Still gated — do NOT flip the main voice button yet; that flip is real code, not a config toggle** (today `handleOrbTap` still drives the serial path; nothing wires the main Orb control to `useRealtimeVoiceSpike`). Remaining before product-default: a full sweep of the typed capabilities themselves (project/knowledge mutations, reads, navigation, prefs, memory, adaptation — this session's testing exercised voice reliability/audio quality, not every tool) across Safari/Chrome/Edge; a green full Tier 1 (no Orb tool/param/policy contract changed this session, so no new eval case was required); then plan + build the actual button-flip code (in progress — see Next Priorities).

**Button-flip plan decided-so-far (not yet built, not yet approved as a whole plan):** Stan removed the allowlist gate entirely — Realtime becomes available to **every** authenticated user, no staged per-email rollout (small user base makes this the right call; `ORB_REALTIME_VOICE_ENABLED`/`ORB_REALTIME_VOICE_ALLOWLIST` and `getRealtimeVoiceAccess` are to be deleted, not just widened). An unsupported browser (Firefox, or anything unrecognized) is **not blocked** — it gets Realtime plus a warning banner (reusing the existing amber alert-banner catalog pattern, `#fef3c7`/`#d97706`) saying results may be unpredictable; the banner is **persistent** (shows every session on an unsupported browser) but **dismissible once per session**. The serial voice UI (`useVoiceMode`, its button states, TTS wiring) is to be **removed**, not kept dormant, once Realtime is confirmed live in production. Grounded the visual design in the real orb-state code (`components/UnifiedDashboard.tsx`, `app/globals.css`): idle/listening/speaking keep their existing production colors/animations unchanged; **Connecting and Thinking both reuse the existing neutral `.ud-voice-progress` sweep-bar motif** (rendered inside the orb sphere above the icon, today's "gathering data" indicator) rather than inventing a new color — Stan explicitly chose to keep these neutral, not adopt a new accent color; the new **error** state (which the orb has never needed before) reuses the existing danger/red treatment. The existing `oc-voice-box` (`components/OrbConversation.tsx:464-542`, transcript + Speak/Listen/Stop + exit/X button) needs zero changes — reused exactly as-is. A click-through prototype was shown via the visualize tool for review — ephemeral, not committed to the repo; a reworked version incorporating all of the above is in progress.

**Realtime voice incident reporting wired to the existing pipeline (v0.6.214).** Stan noticed an OpenAI `429 insufficient_quota` during device testing surfaced only in the server terminal log — unacceptable for production. Orb already has a complete provider-incident pipeline (`lib/orb-model/incidents.ts`: `classifyProviderFailure` + `notifyOrbIncident`, used today by the serial engine in `app/actions/orb-converse.ts`) that classifies billing/rate-limit/unavailable errors, files a deduplicated ticket, and emails every admin with the reason and a link to the provider's console — `openai` was already in its provider tables, just never wired to Realtime voice. Added `'voice'` to `OrbModelRole` (purely additive; the two existing consumers just filter a model catalog Realtime doesn't use) and a voice-specific user message; wired the session route's (`app/api/orb-realtime/session/route.ts`) sole OpenAI call failure through the same classifier + incident notifier. Verified the classifier correctly tags the exact `insufficient_quota` message Stan hit as billing (matches via the word "billing" later in that message) rather than generic. Not yet live-tested (ticket+email firing) — deferred until the button-flip testing pass, per Stan.

**Recent prior context (brief):**
- **Typed-capability parity (ORB-325, v0.6.197–0.6.202):** native Realtime tools for project/knowledge/ticket/audit/repository/query_db/nav/prefs/memory/adaptation, with migration-backed replay-safe confirmation + durable receipts. Knowledge survives project deletion (FK → SET NULL + note trigger). All applied and rollback-verified. Kept intact by the rewrite.
- **ORB-323 / ORB-322 / ORB-321 (closed, shipped ≤ v0.6.188):** WebKit login-loop root cause (orphaned auth users from a swallowed `deleteUser` FK failure) fixed at the schema level; auth hardening + orphan-prevention; automatic cross-version client-state invalidation. KB entries recorded.

---

## Current Uncommitted Changes

- ORB-337 v0.6.216: `scripts/migrations/20260718_never_recycle_todo_numbers.sql`, `scripts/rollbacks/20260718_never_recycle_todo_numbers.sql`, `scripts/verify-never-recycle-todo-numbers.ts`, `app/api/tasks/[id]/route.ts`, `app/actions/orb-converse.ts`, `app/actions/ticket-actions.ts`, `app/actions/import-data.ts`, `docs/api-spec.yaml`, `docs/object-capability-matrix.md`, `docs/orb-337-never-recycle-todo-numbers-plan.md`, `package.json`, `package-lock.json`, `lib/version.ts`, `lib/changelog.ts`, and `HANDOFF.md`.
- ORB-326 v0.6.215: `components/SystemStateProvider.tsx`, `docs/Consolidate_API_Health_and_Version_Polling.md`, and `docs/orb-309-initialization-performance-plan.md`; shared matrix/release/handoff files now also include ORB-337.
- ORB-325 main-button work owned by Claude: preserve its uncommitted Realtime/UI files; do not stage or rewrite them as ORB-337 work.
- `.claude/settings.local.json` — intentional local tool-settings; never committed with feature work. Its `"ask": ["Bash(git push *)"]` is the push gate working correctly — not an allowlist entry, do not "fix" it.
- `docs/orb-327-architecture-audit-plan.md` — unrelated untracked architecture-audit plan; preserve.

---

## Active Risks / Unresolved Work

- **ORB-337 database migration is active; production maintenance must stay on until the app catches up.** Stan reruns the two repaired Tier 1 cases, then the full Tier 1 suite if focused checks pass; after it is green, push only with Stan's explicit approval, confirm v0.6.217 deployment plus production REST/UI/serial/Realtime create and move behavior, then disable maintenance. Do not leave v0.6.188 paired with the migrated database outside maintenance because its old move narration can calculate the wrong destination address even though the trigger persists the correct one. The rollback reopens the original defect and is emergency-only.
- **ORB-325 Realtime voice quality is validated; the main-button flip itself is unbuilt.** Voice reliability, audio quality (echo/interruption), and glitches are resolved across the supported matrix. What's left is a full typed-capability sweep + full Tier 1 green, then finalizing and building the actual flip (see Next Priorities — one open sub-question on the warning banner's dismissibility). A deterministic serial fallback remains rejected; Realtime is the decided destination.
- **Ambient false turns from genuine background noise** (not echo — that's fixed) remain an open, lower-priority quality question; Silero is gathering device evidence but is advisory-only today. Never add an English/phrase-specific filter.
- **Standing, low priority (verified 2026-07-12):** full-project `npm run lint` reports 6 errors + 63 warnings, all pre-existing/unrelated. Focused ORB-325 lint is 0 errors.

---

## Next Priorities

1. **Stan reruns `npm run eval -- --id realtime-close-intent-analogue,realtime-query-db-intent-analogue`, then `npm run eval:t1` if focused green.** If the full tier is green, obtain explicit push approval, deploy the aligned v0.6.217 app, verify production create/move surfaces, then disable maintenance and close ORB-337 with resolution notes + Knowledge Repository entry.
2. **Finalize + build the main-button flip** (Claude-owned implementation now present in the working tree; preserve its ownership boundary and complete its acceptance/release work).
3. **DEV-operator acceptance on Safari/Chrome/Edge:** the typed capabilities themselves (project/knowledge mutations, reads, navigation, prefs, memory, adaptation, explicit named-project create, one confirmation, upfront permission, interruption).
4. Then a green full Tier 1 (Stan runs `npm run eval:t1`) before any push.
5. **ORB-292** — user-facing Value/Balanced/Deep-Thinking modes, per-user allowances, consent-based tuning proposals.

---

## Key Current Decisions

Load-bearing invariants. Full operating rules in **AGENTS.md**; conversation behavior in **eval cases** + `lib/orb-contract.ts`; Realtime runtime in `docs/orb-325-realtime-voice-flow.md`.

- **Voice — Realtime IS the destination, provider-owned (decided by Stan; implemented 2026-07-17; audio/quality validated same day).** The provider (OpenAI server VAD, `threshold: 0.8`) owns turn detection and barge-in interruption; the client never sends `response.cancel` and creates a response only after a turn transcribes (never for a user turn otherwise). No greeting. Validated clean on Mac Safari/Chrome/Edge, iPad Safari, iPhone Safari. Realtime replaces the serial voice path once the main-button flip is built and gates pass; until then production defaults to serial and Realtime stays dev/allowlist-gated. Do not restore a client-side manual turn state machine or an ASR-confidence/duration ambient filter. No phrase-specific patches or canned responses.
- **No allowlist once the flip ships (decided by Stan, 2026-07-17).** Realtime becomes available to every authenticated user, not staged per-email — the user base is small enough (Stan + a couple testers) that the staged-rollout mechanism is unneeded overhead. `getRealtimeVoiceAccess`/`ORB_REALTIME_VOICE_ENABLED`/`ORB_REALTIME_VOICE_ALLOWLIST` are to be deleted when the flip is built, not just widened. An unsupported browser (Firefox, or anything unrecognized) is **warned, never blocked** — Realtime still runs, with a banner (reuse the amber alert-banner catalog pattern) saying results may be unpredictable; **persistent every session, dismissible once per session**. The serial voice UI is removed (not kept dormant) once Realtime is confirmed live in production.
- **Voice panel visual states reuse existing orb code, no new colors (decided by Stan, 2026-07-17).** Idle/listening/speaking keep production's exact colors/animations. Connecting and Thinking both reuse the existing neutral `.ud-voice-progress` sweep-bar motif (rendered inside the orb sphere, today's "gathering data" indicator) — explicitly not the new accent color a first prototype proposed. The new `error` status (no prior orb precedent) reuses the existing danger/red treatment. `oc-voice-box` needs no changes.
- **Provider incidents (billing/rate-limit/outage) always go through `lib/orb-model/incidents.ts`** (`classifyProviderFailure` + `notifyOrbIncident` — ticket + admin email, deduplicated), never a one-off log line. Realtime voice was wired to this in v0.6.214 after an OpenAI quota failure was found surfacing only in the server terminal.
- **Name-first identifiers.** Project **NAME** is the identifier everywhere users/model interact. Project **code** is internal-only, auto-generated, immutable, prefixes todo codes only. References resolve name → exact code → fuzzy name.
- **Todo identity model** (ORB-337): `id` (uuid) permanent identity; `code` (project code + `todo_number`) the current address, changes on move, **never recycled**; `title` a non-unique human search key (resolver fails closed on ambiguity). Move renumbers.
- **Structural mutation gate** (not prompt-only). CRUD tools held server-side: the model calls the tool, the server persists a proposal, shared server predicates evaluate the actual current utterance. Upfront permission executes without a duplicate ask; otherwise a bare affirmation / explicit approval confirms. The DB is the commit boundary with transactional confirm RPCs + durable receipts.
- **Identifier provenance.** Task/project codes may only be used if actually seen this conversation (backlog, tool result, or the user's words) — never constructed or remembered across a cleared session. Enforced at prompt + server gate.
- **Browser support.** Safari/Chrome/Edge required; Firefox temporarily experimental (ORB-330). Canonical: `docs/browser-support-policy.md`.
- **Git push is never automatic** — explicit in-chat approval every time (also structurally enforced via settings.local.json).
- **Orb identity:** Brownie temperament, butler intelligence.

---

## AI Tool Used Last Session

`2026-07-18 — Codex (GPT-5)`

---

*Updated by AI at end of each session. Committed with session code changes.*
