# HANDOFF.md

> Living session-to-session context for the Orb project.
> Every AI reads at session start. Every AI updates it at session end.
> Committed with each session's code changes.
>
> **History policy (agreed with Codex, 2026-07-12):** this file holds only *current, load-bearing* context. Durable technical lessons live in the **Knowledge Repo**; operating rules in **AGENTS.md**, the **object-capability matrix**, **UI catalog**, **eval cases**, and the **concurrency protocol**; implementation history in **git**. Prune aggressively — do not let dated session narratives accumulate here.

---

## App State

- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app
- **Version:** local/canonical **0.6.189**; production remains **v0.6.188**. v0.6.189 is committed locally but not pushed.

---

## Last Session Completed

**ORB-325 voice instrumentation, Firefox input, Safari hardening, and architecture review — 2026-07-12 (Codex, GPT-5) — v0.6.189 — OPEN**

Added stage-level telemetry: `voice-recognition / listen_to_submit`, `voice-turn / recognized_to_mic_return`, and `voice-output / greeting_playback|answer_playback`. Measurements cover recognition start/first result/submit, response readiness, API TTS request/response, audio decode, playback start/end, and microphone return; metadata includes provider/model/voice/rate, recognition path, and platform/browser but never transcript contents. Supported browsers are **Safari, Chrome, Edge, and Firefox**. Firefox now records a short utterance, posts it to an authenticated server endpoint for OpenAI transcription, and feeds the result into the same conversation state machine; audio is not stored. The evaluation/keep-remove gate lives in `docs/orb-325-voice-quality-plan.md`. Performance matrix and browser support policy updated. Device verification remains.

The full Tier 1 run exposed three unrelated eval issues. Corrected ordinal action-set recognition (`first five todos` now reaches the deterministic ledger branch), retained the meaningful completed-switch speech guards while allowing the accurate in-progress phrase “Switching to…”, and added a forbidden-tool assertion so ticket-deletion safety prohibits todo mutation tools without rejecting a safe `query_tickets` read. Targeted Tier 1 rerun passed **3/3**.

ORB-325 follow-up: restored the audible greeting on every voice-mode entry (the existing-conversation branch had skipped directly to listening), and keeps the submitted recognition transcript visible in the voice input field through processing/playback; it clears when the microphone resumes for the next turn. Stan verified the interaction on localhost: the greeting and input-field transcript returned, and the overall response felt materially better.

Release validation: `npx tsc --noEmit`, focused lint (0 errors; pre-existing warnings only), `git diff --check`, and the Next.js production build all pass. Firefox localhost acceptance is complete; Safari, Chrome, and Edge remain in the controlled browser matrix.

Safari acceptance exposed a permission-recovery UX gap: Orb correctly detected a denied microphone but only said to check browser settings. The voice panel now gives concrete recovery steps for Safari, Chrome, Edge, and Firefox (with a separate iPhone/iPad Safari path), and Help explains that guidance is available in place.

Safari's longer CRUD test exposed structural issues. Database evidence showed the initial shortened proposal contained all **3** todos, so the report that only 2 were initially visible is not classified as an STT defect. The next turn was genuinely wrong: stored response heading said 3 while listing 4; because it narrated rather than replacing the held transaction, “Confirmed” had no pending action to execute and triggered a second confirmation. A shared deterministic undercount guard now compares claims such as “only two, add one” with the exact held operations, corrects the count, itemizes the existing set, and preserves it for one confirmation. The matching Tier 1 case is `pending-create-undercount-corrects-without-expanding`. Todo confirmations now resolve project names instead of exposing internal codes. Voice entry still speaks a greeting but no longer appends repeated greeting cards to an existing transcript. Project-switch summaries reject stale todos from the previously selected project, preventing the false “1 active” message after four creates.

Stan clarified the apparent initial undercount: the first shortened item was flattened onto the confirmation heading (`Confirm…? - create …`) while the other two rendered as separate rows. Root cause was shared `sanitizeUserFacingSpeech` collapsing `\n\n` through a broad `\s{2,}` replacement. It now collapses horizontal whitespace only and preserves Markdown list breaks. This was a transcript-formatting defect, not evidence of faulty STT.

Stan retested the corrected Safari interaction and reported it was **much better**. The transcript/list and duplicate-confirmation fixes are accepted qualitatively; Safari's measured strategic-response latency remains open.

The first run of `pending-create-undercount-corrects-without-expanding` reached the model because the shared parser recognized “only two” but not Safari's actual transcript, “only **have** two.” The parser now accepts the optional “have” while remaining scoped to an exact pending create set plus an explicit request for one more. Focused Tier 1 rerun passed **1/1** on the deterministic path.

The later Safari strategic/survey transcript failed the broader quality gate and changed the direction of ORB-325. Correlated provider evidence showed the initial strategic request spent **75.437s** in Gemini plus **3.028s** for the first TTS chunk (minimum first audio about **78.5s**), and a mistaken strategic route continued for **50.562s** after the user stopped it. Simple survey turns carried roughly **55k–56.5k input tokens**, took 8–11s in the model before TTS, and replayed prior answers into four duplicate feedback tickets (TICKETS-49, 50, 52, and 53). This is a serial-pipeline, context, routing, workflow-state, idempotency, and cancellation problem—not a Safari-only defect.

`docs/orb-325-voice-quality-plan.md` now preserves the transcript evidence, prior Orb voice-history lessons from the Knowledge Repo, external voice interaction benchmarks, proposed latency gates, and the next architecture decision: compare an optimized serial operator with an isolated native Realtime/WebRTC operator. Do **not** restore the old sentence-splitting `speakStreaming()` design. Further phrase-specific patches are paused, and they must not be replaced with canned responses. Orb's language remains fluid; deterministic workflow state, routing, authorization, confirmation, idempotency, cancellation, and verified tool outcomes provide the rock-solid structure underneath it.

Verification completed for this slice: TypeScript, focused lint (0 errors; pre-existing warnings only), `git diff --check`, and production build passed. Stan ran the targeted Tier 1 regressions: the three initial cases passed **3/3**, and `pending-create-undercount-corrects-without-expanding` passed **1/1** after its parser correction. Firefox localhost acceptance passed, and Stan qualitatively accepted the corrected Safari confirmation interaction as “much better.” Broad Chrome/Edge/device acceptance is deferred until the architecture gate; do not spend another full paid eval run on the unresolved design.

---

**ORB-312 — Production Performance Baseline Sweep — 2026-07-12 (Codex, GPT-5) — CLOSED**

Closed after sweeping the instrumented high-use flows across Mac/iPad/iPhone into a ranked, evidence-based target list that separates actionable application latency from OS ceremony, telemetry artifacts, and infra/framework tails. Headline win: AI Metrics `ai_accounting_load` — merging two serialized server actions into `getAiMetricsBundle` removed a full action round-trip (production Mac p50 **4251 → 2631 ms, ~38%**). Closed `closed_at` 2026-07-12T20:50:52Z; KB entry `841e6aef-5255-4d97-adef-8dbe53cc753c`.

---

**ORB-323 — auth hardening + orphan-prevention cleanup (ORB-321 follow-ups) — 2026-07-12 (Claude Code, Opus 4.8) — v0.6.187–v0.6.188 — CLOSED**

Spun off from the ORB-321 login-loop root-cause fix and completed end-to-end (built, shipped, Vercel-promoted, production-verified, closed). All 6 items:
- **#1** Removed the temp `/api/auth-debug` diagnostic endpoint + its `proxy.ts` bypass line.
- **#2** `deleteUser` (`app/actions/delete-user.ts`): `auth.admin.deleteUser` failure is now a **hard error** (was a silent `console.warn` — the swallowed failure that produced ORB-321's orphaned auth users); the "already gone" case is tolerated as success.
- **#3** A valid auth session that can't resolve to a `public.users` row (phantom/orphaned) is now **signed out** via a new **`app/auth/signout/route.ts`** route handler before landing on login, instead of looping `/dashboard ↔ /auth/login`. Key lesson: a **React Server Component can't write cookies** (Supabase `setAll` is try/caught in RSC), so a real sign-out must live in a route handler; the dashboard gate routes `!resolveUser.ok` through it. Do **not** sign out in the proxy on a bare role query — it pre-empts `resolveUser`'s reconciliation/invitation paths.
- **#4** `app/auth/login/page.tsx` never leaks the raw provider error anymore — fixed friendly copy (real error stays in telemetry).
- **#5** Removed the v0.6.184 proxy self-heal band-aid (no longer load-bearing once the root cause was fixed) — shipped separately as v0.6.187.
- **#6** Migration **`scripts/migrations/20260712_orb_adaptations_cascade.sql`**: `orb_adaptations.user_id` FK `NO ACTION → ON DELETE CASCADE` — the **same latent orphan-cause** as the ORB-321 telemetry FKs, found by auditing the *whole* FK class during #2. Applied to the DB (verified). Convention: telemetry FKs → SET NULL (outlive user); personal per-user data → CASCADE.

**Verification:** `tsc` 0, `eslint` 0; representative Tier 1 eval smoke 13/13 (run twice); production-verified after v0.6.188 promotion (passkey sign-in + friendly error, no login loop on Safari/iPad, deleteUser end-to-end orphan check). Closed via Orb API (`closed_at` 2026-07-12T20:26:54Z); KB entry `0b1961cc-d149-4b94-be6b-e6540f7cce60`. **Test-user provisioning was scoped OUT** (separate workstream — see Next Priorities).

---

**ORB-322 — automatic cross-version client-state invalidation (Part B, split from ORB-321) — 2026-07-11/12 (Claude Code, Opus 4.8) — v0.6.186 — CLOSED**

Stale version-coupled client state survived deploys because volatile-state clearing only ran from the **Update button** — any other path to a new bundle (plain reload / back-navigation / browser picking up new assets) left stale Orb transcript/input/action-set/command-history behind, sometimes forcing a manual browser site-data clear.

**Fix (shared module + 3 files):**
- **New `lib/client-state.ts`** — single source of truth: `VERSION_VOLATILE_SESSION_KEYS` (the 3 existing Orb keys **+ added `todos_orb_cmd_hist`**), `LAST_APPLIED_VERSION_KEY`, shared `clearVersionVolatileState()`.
- **`app/layout.tsx`** — a **pre-hydration inline `<script>`** (first child of `<body>`, built from the shared constants) running synchronously during HTML parse, **before React hydrates and before `UnifiedDashboard` reads sessionStorage** (React fires child effects before parent effects, so a provider `useEffect` would lose that race). On boot: if compiled `VERSION !== localStorage[orb_last_applied_version]` → clear volatile keys + set the marker. Fires **once per version transition**, regardless of how the new bundle arrived.
- **`components/SystemStateProvider.tsx`** — removed the duplicated local key list + clear function; `applyUpdate` uses the shared helper/constant.

**Preserved across versions (deliberately NOT cleared):** voice prefs, dismissed broadcasts, welcome state, saved login email, dev flags, session identity, the marker itself. (Conservative scope — the value is the automatic trigger, not a heavier wipe.) HTTP cache headers audited → no change needed. Closed 2026-07-12T19:41:51Z; KB entry `8770a2e3-dc23-410a-990d-6e83ea5c7a85`.

**Current product behavior (intended):** loading a newly-deployed version clears any in-progress Orb conversation — a stale transcript from the old bundle can't be safely reused, same as the Update-button path.

---

**ORB-321 — WebKit login loop root-caused & closed — 2026-07-11 (Claude Code, Opus 4.8)**

The recurring Safari/iPad login loop was **not** cookie corruption (the discarded v0.6.181–185 theory). Real, DB-proven cause: `deleteUser` swallowed an `auth.admin.deleteUser` FK failure (telemetry `user_id` was NOT NULL + NO ACTION), leaving orphaned `auth.users` rows with live passkeys; selecting an orphan's passkey minted a phantom session with no `public.users` row → proxy `/dashboard ↔ /auth/login` loop. Fixed at the data/schema level: migration `20260711_telemetry_user_id_set_null.sql` (telemetry FKs → nullable + ON DELETE SET NULL) + deletion of the 4 orphaned auth users. Production-verified, closed; KB `c9292534`. The hardening half became **ORB-323**; the client-state half became **ORB-322** (both above).

---

## Current Uncommitted Changes

- `components/SystemStateProvider.tsx`, `ACTIVE_WORK/claude-code.md` — Claude Code's active ORB-326 SystemStateProvider poll-dedup slice; Codex did not stage or commit these files.
- `.claude/settings.local.json` — intentional local tool-settings change (never committed with feature work).

---

## Active Risks / Unresolved Work

- **ORB-325 remains open at an architecture gate.** Current voice mode is measurably too slow and brittle for broad conversational parity with text. Do not resume symptom-by-symptom tuning before choosing and validating the orchestration contract in `docs/orb-325-voice-quality-plan.md`.
- **Preserve TICKETS-48–54 as evidence.** Four are duplicate survey side effects, but cleanup requires separate authorization; do not dismiss or delete them silently.
- **Standing, low priority (verified 2026-07-12):** full-project `npm run lint` reports **6 errors + 63 warnings**, all in pre-existing files unrelated to recent work. Focused ORB-325 lint has 0 errors and retains one pre-existing `react-hooks/set-state-in-effect` warning at `useCapabilities.ts:142`.

---

## Next Priorities

1. **ORB-325** — next session, decide the bounded voice architecture and scope an isolated comparison of optimized serial vs native Realtime/WebRTC using the fixed transcript scenarios and latency/correctness gates. No implementation without Stan's explicit approval.
2. **ORB-326** — Claude Code's SystemStateProvider poll dedup is waiting for release bookkeeping after v0.6.189 is committed.
3. **ORB-292** — design user-facing Value/Balanced/Deep Thinking modes, per-user allowances, consent-based Orb tuning proposals.

_(Reprioritize with Stan. Recently cleared: **ORB-324** (test-user provisioning) closed as already-implemented — the dev-login bypass + non-admin/admin test users + non-admin telemetry already exist via ORB-295 (`app/actions/dev-login.ts` + `DEV_USERS`); KB `bb244e91`. Also closed: ORB-303/ORB-317/ORB-287/ORB-254 — file a fresh focused ticket if any has genuinely unfinished scope rather than reviving a closed one.)_

---

## Key Current Decisions

Load-bearing invariants for anyone touching Orb behavior. Full operating rules live in **AGENTS.md**; UI patterns in **docs/ui-catalog.md**; conversation behavior in **eval cases** + `lib/orb-contract.ts`.

- **Name-first identifiers.** Project **NAME** is the identifier everywhere users/model interact. Project **code** is internal-only, auto-generated, immutable, and exists solely to prefix todo codes (`ORB-73`) — never a second user-facing label, never user-editable. References resolve name → exact code → fuzzy/partial name (`resolveProjectByReference`). `switch_project`, `update_project`, `delete_project` all take **name**, server resolves. (The old `switch_project`-uses-code inconsistency is **reconciled** as of 2026-07-12.)
- **Structural mutation gate** (not prompt-only). CRUD tools are held server-side: the model calls the tool immediately, the server holds, the user confirms, the server executes. The mutation prompt aligns ("always call the tool immediately — the server handles confirmation").
- **Identifier provenance.** Task/project codes may only be used if they were actually seen this conversation (backlog, tool result, or the user's words) — never constructed by pattern or remembered across a cleared session. Enforced at the prompt layer + a server-side gate that rejects mutations targeting unseen codes.
- **Browser support.** Safari, Chrome, Edge, and Firefox are the required representative browser families; capability-specific features must provide an honest fallback. Canonical policy: `docs/browser-support-policy.md`.
- **Voice.** v0.6.189 still uses the predictable final-response serial path; Firefox uses authenticated server transcription when native recognition is unavailable. ORB-325 now evaluates an optimized serial operator against a bounded native Realtime/WebRTC operator. Do not restore pseudo-realtime sentence-level `speakStreaming()`. During the restructure, add neither phrase-specific patches nor canned responses: natural language stays fluid, while deterministic state, routing, authorization, confirmation, idempotency, cancellation, and verified outcomes enforce correctness.
- **Git push is never automatic** — explicit in-chat approval every time (also structurally enforced via settings.local.json).
- **Orb identity:** Brownie temperament, butler intelligence.

---

## AI Tool Used Last Session

`2026-07-12 — Codex (GPT-5)`

---

*Updated by AI at end of each session. Committed with session code changes.*
