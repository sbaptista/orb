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
- **Version:** local/canonical **0.6.213** (committed on this branch this session); production remains **v0.6.188**. The whole `codex/orb-325-production-hardening` branch is unpushed.

---

## Last Session Completed

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

**Recent prior context (brief):**
- **Typed-capability parity (ORB-325, v0.6.197–0.6.202):** native Realtime tools for project/knowledge/ticket/audit/repository/query_db/nav/prefs/memory/adaptation, with migration-backed replay-safe confirmation + durable receipts. Knowledge survives project deletion (FK → SET NULL + note trigger). All applied and rollback-verified. Kept intact by the rewrite.
- **ORB-323 / ORB-322 / ORB-321 (closed, shipped ≤ v0.6.188):** WebKit login-loop root cause (orphaned auth users from a swallowed `deleteUser` FK failure) fixed at the schema level; auth hardening + orphan-prevention; automatic cross-version client-state invalidation. KB entries recorded.

---

## Current Uncommitted Changes (after this session's v0.6.213 commit)

- `components/SystemStateProvider.tsx` — Claude Code's separate **ORB-326** poll-dedup slice (derive `isOnline` from the `/api/version` poll; drop the separate `/api/health` fetch). Deliberately kept OUT of the ORB-325 commit; still unstaged/unreleased.
- `.claude/settings.local.json` — intentional local tool-settings; never committed with feature work. Its `"ask": ["Bash(git push *)"]` is the push gate working correctly — not an allowlist entry, do not "fix" it.
- `docs/orb-327-architecture-audit-plan.md` — unrelated untracked architecture-audit plan; preserve.

---

## Active Risks / Unresolved Work

- **ORB-325 Realtime voice quality is validated; the main-button flip itself is unbuilt.** Voice reliability, audio quality (echo/interruption), and glitches are resolved across the supported matrix. What's left is a full typed-capability sweep + full Tier 1 green, then building the actual flip (see Next Priorities). A deterministic serial fallback remains rejected; Realtime is the decided destination.
- **Ambient false turns from genuine background noise** (not echo — that's fixed) remain an open, lower-priority quality question; Silero is gathering device evidence but is advisory-only today. Never add an English/phrase-specific filter.
- **Standing, low priority (verified 2026-07-12):** full-project `npm run lint` reports 6 errors + 63 warnings, all pre-existing/unrelated. Focused ORB-325 lint is 0 errors.

---

## Next Priorities

1. **Plan + build the main-button flip** (in progress). This is real code: wire the main Orb control to `useRealtimeVoiceSpike` instead of `useVoiceMode`/`handleOrbTap`'s serial path, decide the fallback for non-allowlisted users / unsupported browsers (text input in the Orb, per Stan's decided fallback chain), and plan the serial voice UI's eventual retirement. Needs Stan's explicit go-ahead on the plan before building (standing rule).
2. **DEV-operator acceptance on Safari/Chrome/Edge:** the typed capabilities themselves (project/knowledge mutations, reads, navigation, prefs, memory, adaptation, explicit named-project create, one confirmation, upfront permission, interruption) — this session validated voice reliability/audio quality, not every tool.
3. Then a green full Tier 1 (Stan runs `npm run eval:t1`) before any push.
4. **ORB-337** — never recycle `todo_number` (monotonic per-project high-water counter). Design pass before building; notes on the todo.
5. **ORB-326** — Claude Code's `SystemStateProvider` poll-dedup has an unstaged diff; coordinate before its own release bookkeeping.
6. **ORB-292** — user-facing Value/Balanced/Deep-Thinking modes, per-user allowances, consent-based tuning proposals.

---

## Key Current Decisions

Load-bearing invariants. Full operating rules in **AGENTS.md**; conversation behavior in **eval cases** + `lib/orb-contract.ts`; Realtime runtime in `docs/orb-325-realtime-voice-flow.md`.

- **Voice — Realtime IS the destination, provider-owned (decided by Stan; implemented 2026-07-17; audio/quality validated same day).** The provider (OpenAI server VAD, `threshold: 0.8`) owns turn detection and barge-in interruption; the client never sends `response.cancel` and creates a response only after a turn transcribes (never for a user turn otherwise). No greeting. Validated clean on Mac Safari/Chrome/Edge, iPad Safari, iPhone Safari. Realtime replaces the serial voice path once the main-button flip is built and gates pass; until then production defaults to serial and Realtime stays dev/allowlist-gated. Do not restore a client-side manual turn state machine or an ASR-confidence/duration ambient filter. No phrase-specific patches or canned responses.
- **Name-first identifiers.** Project **NAME** is the identifier everywhere users/model interact. Project **code** is internal-only, auto-generated, immutable, prefixes todo codes only. References resolve name → exact code → fuzzy name.
- **Todo identity model** (ORB-337): `id` (uuid) permanent identity; `code` (project code + `todo_number`) the current address, changes on move, **never recycled**; `title` a non-unique human search key (resolver fails closed on ambiguity). Move renumbers.
- **Structural mutation gate** (not prompt-only). CRUD tools held server-side: the model calls the tool, the server persists a proposal, shared server predicates evaluate the actual current utterance. Upfront permission executes without a duplicate ask; otherwise a bare affirmation / explicit approval confirms. The DB is the commit boundary with transactional confirm RPCs + durable receipts.
- **Identifier provenance.** Task/project codes may only be used if actually seen this conversation (backlog, tool result, or the user's words) — never constructed or remembered across a cleared session. Enforced at prompt + server gate.
- **Browser support.** Safari/Chrome/Edge required; Firefox temporarily experimental (ORB-330). Canonical: `docs/browser-support-policy.md`.
- **Git push is never automatic** — explicit in-chat approval every time (also structurally enforced via settings.local.json).
- **Orb identity:** Brownie temperament, butler intelligence.

---

## AI Tool Used Last Session

`2026-07-17 — Claude Code (Opus 4.8)`

---

*Updated by AI at end of each session. Committed with session code changes.*
