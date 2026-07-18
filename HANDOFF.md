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
- **Version:** local/canonical **0.6.212** (committed on this branch this session); production remains **v0.6.188**. The whole `codex/orb-325-production-hardening` branch is unpushed.

---

## Last Session Completed

**ORB-325 Realtime voice — provider-owned turn-taking rewrite + checkpoint — 2026-07-17 (Claude Code, Opus 4.8) — v0.6.212 — VOICE RUNTIME VALIDATED / still allowlist-gated**

The previous Realtime design was a **client-side manual turn/response state machine** that disabled the provider's own turn-taking and hand-rolled `response.create`/`response.cancel` from transcription events. It raced the provider's one-active-response rule and crashed sessions after a handful of turns (`response_cancel_not_active`, then `conversation_already_has_active_response`), plus produced empty/lost responses. **Stan's call:** revert the patches and rewrite to **provider-owned turn-taking with no greeting** (Perplexity-style: continuous listening, provider handles barge-in). Realtime is a **replacement** of the voice path (fallback chain: Realtime voice → text input in the Orb → list UI), staying allowlist-gated for staged rollout.

`lib/hooks/useRealtimeVoiceSpike.ts` was fully rewritten (~660 lines, was ~1315). Session (`app/api/orb-realtime/session/route.ts`): `server_vad`, **`create_response: false`**, **`interrupt_response: true`**. The client sends `response.create` in exactly **three** guarded places (on transcript-ready; the deferred version on a prior response's `response.done`; one tool-result continuation per response via `executeToolBatch`), all guarded against `responseInFlightRef`; there are **zero** `response.cancel` sends. Parallel tool calls in one response are batched into one continuation `response.create` (the `calls=2` crash). No greeting — opens into listening. Status is driven by `output_audio_buffer.started/stopped/cleared` (truthful audio), not `response.done`. Silero is now **advisory telemetry only** (gates nothing). An always-on DEV lifecycle trace + a "Copy Realtime trace" DEV button (`getTrace()`) were the diagnostic that made the root causes findable.

**Validation:** Stan tested to a ~227s session on localhost — no crash, every turn answered, tool calls + continuations + interruptions clean, clean stop. `npx tsc --noEmit` + focused ESLint green throughout. The server-side typed-capability surface (todo/project/knowledge/ticket/audit/query_db/nav/prefs/memory/adaptation tools, migration-backed transactional confirmation RPCs, mutation-authorization grammar) is **unchanged** by the rewrite and remains valid. Flow doc (`docs/orb-325-realtime-voice-flow.md`) rewritten to the new architecture. Changelog collapsed: the 10 uncommitted, partly-superseded v0.6.202–0.6.211 entries → one honest v0.6.212 entry (committed v0.6.189–0.6.201 entries untouched).

**Still gated — do NOT flip the main voice button yet.** Remaining before product-default: supported-browser (Safari/Chrome/Edge) DEV acceptance of the typed capabilities; ambient false-turn / `silence_duration_ms` tuning; a green full Tier 1 (no Orb tool/param/policy contract changed this session, so no new eval case was required). Firefox deferred (ORB-330).

**Recent prior context (brief):**
- **Typed-capability parity (ORB-325, v0.6.197–0.6.202):** native Realtime tools for project/knowledge/ticket/audit/repository/query_db/nav/prefs/memory/adaptation, with migration-backed replay-safe confirmation + durable receipts. Knowledge survives project deletion (FK → SET NULL + note trigger). All applied and rollback-verified. Kept intact by the rewrite.
- **ORB-323 / ORB-322 / ORB-321 (closed, shipped ≤ v0.6.188):** WebKit login-loop root cause (orphaned auth users from a swallowed `deleteUser` FK failure) fixed at the schema level; auth hardening + orphan-prevention; automatic cross-version client-state invalidation. KB entries recorded.

---

## Current Uncommitted Changes (after this session's v0.6.212 commit)

- `components/SystemStateProvider.tsx` — Claude Code's separate **ORB-326** poll-dedup slice (derive `isOnline` from the `/api/version` poll; drop the separate `/api/health` fetch). Deliberately kept OUT of the ORB-325 commit; still unstaged/unreleased.
- `.claude/settings.local.json` — intentional local tool-settings; never committed with feature work. Its `"ask": ["Bash(git push *)"]` is the push gate working correctly — not an allowlist entry, do not "fix" it.
- `docs/orb-327-architecture-audit-plan.md` — unrelated untracked architecture-audit plan; preserve.

---

## Active Risks / Unresolved Work

- **ORB-325 Realtime voice reliability is solid but not yet product-default.** Remaining gates: supported-browser DEV acceptance, ambient/threshold tuning, full Tier 1 green. A deterministic serial fallback remains rejected; Realtime is the decided destination.
- **Ambient false turns** are now a VAD-threshold tuning question (Silero gathering device evidence), decoupled from reliability — worst case is a stray transcribed word, not a dead session. Never add an English/phrase-specific filter.
- **`silence_duration_ms` = 450ms** can chop a natural mid-thought pause into batched turns; raising it (~750ms) gives crisper 1:1 turn-taking. Untuned pending Stan's call.
- **Standing, low priority (verified 2026-07-12):** full-project `npm run lint` reports 6 errors + 63 warnings, all pre-existing/unrelated. Focused ORB-325 lint is 0 errors.

---

## Next Priorities

1. **Tuning (Stan's call):** raise `silence_duration_ms` 450→~750 and feel the difference.
2. **DEV-operator acceptance on Safari/Chrome/Edge:** the typed capabilities (project/knowledge mutations, reads, navigation, prefs, memory, adaptation, explicit named-project create, one confirmation, upfront permission, interruption).
3. **Flip the main voice button to Realtime** (replacement) after 1–2 pass and a green full Tier 1. Realtime is the decided destination; this is a gate, not an architecture question.
4. **ORB-337** — never recycle `todo_number` (monotonic per-project high-water counter). Design pass before building; notes on the todo.
5. **ORB-326** — Claude Code's `SystemStateProvider` poll-dedup has an unstaged diff; coordinate before its own release bookkeeping.
6. **ORB-292** — user-facing Value/Balanced/Deep-Thinking modes, per-user allowances, consent-based tuning proposals.

---

## Key Current Decisions

Load-bearing invariants. Full operating rules in **AGENTS.md**; conversation behavior in **eval cases** + `lib/orb-contract.ts`; Realtime runtime in `docs/orb-325-realtime-voice-flow.md`.

- **Voice — Realtime IS the destination, provider-owned (decided by Stan; implemented 2026-07-17).** The provider (OpenAI server VAD) owns turn detection and barge-in interruption; the client never sends `response.cancel` and creates a response only after a turn transcribes (never for a user turn otherwise). No greeting. Realtime replaces the serial voice path once gates pass; until then production defaults to serial and Realtime stays dev/allowlist-gated. Do not restore a client-side manual turn state machine. No phrase-specific patches or canned responses.
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
