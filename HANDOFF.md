# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app
- **Version:** 0.6.97

---

### Last Session Completed

**Voice + Todo Action Transaction Release — 2026-06-29 (Codex, GPT-5) — v0.6.97**

Stan's directive: keep the same deterministic spine Claude established for text, then make voice CRUD feel solid without whack-a-mole. We mapped the voice path first, documented the consolidation plan, then built the first canonical approximation for **todo action transactions shared by text and voice**.

**Organizing principle carried forward:** *correctness vs. judgment.* The app owns exact actions, confirmation state, action sets, and verified outcomes. The Orb owns intent interpretation and conversational phrasing. This session extended that principle from project CRUD into todo CRUD and voice references.

**What changed:**
- **Todo action transaction path:** multi-todo create/update/delete/move requests are collected into a single pending action transaction. Confirmation executes the exact stored operations deterministically; "is it set/done?" while pending returns a deterministic "not yet" answer instead of accidentally executing or guessing.
- **Session action-set ledger:** verified grouped results are recorded as session action sets, so follow-ups like "delete them" and "delete the first five" resolve to the exact prior batch rather than stale backlog order. The ledger is mirrored to `sessionStorage` for same-tab/session recovery and is cleared on transcript clear or project switch.
- **Grouped voice/user summaries:** grouped confirmations and success messages now summarize by count (`create 5 todos in TEST`, `deleted 5 todos`) while transcript thought/progress bullets can still show individual task codes for trust.
- **Bulk delete path:** "delete all todos in test2" calls the delete tool for each matching task and lets the server summarize and ask once.
- **Voice speech channel cleanup:** `speak`, `speakStatus`, and `speakStreaming` now route through one internal queue setup. Progress cues are visual-only. API TTS failures no longer silently fall back to browser TTS, avoiding mixed voices.
- **Voice settings refresh:** dashboard refreshes TTS config when settings change and before the greeting, so voice/provider changes apply without reload.
- **Voice auto-TTS and mic handoff:** deterministic non-streaming replies now speak in voice mode. A recovery guard hands the mic back if voice lands in the idle "Ready" pocket, and duplicate `SpeechRecognition.start()` races are treated as already-listening instead of console errors.
- **Concise voice summaries:** broad "state of my projects" voice questions use a deterministic short summary. The shortcut is limited to broad/global project-state questions so single-project health checks still exercise the normal operational model route.
- **Commitment integrity:** Orb now has a behavioral rule not to promise future behavior, persistence, or capability unless a real tool/rule can honor it. If a behavior is only possible for the current conversation, Orb must say that.
- **Eval runner timestamps:** Tier runs now print start/completion timestamps.

**New documents:**
- `docs/orb-voice-speech-channel-plan.md` — voice path map and consolidation plan.
- `docs/orb-action-transaction-thesis.md` — thesis, implementation approximation, testing strategy, and abandonment criteria for product-level action transactions.

**Tracking todo and knowledge:**
- Created **ORB-299 — Voice and todo action transaction reliability release** (`in progress`, priority High) to carry this major release work forward after production push.
- Added linked knowledge entry `Voice and todo action transaction reliability release state` with detailed implementation state, eval results, manual verification, and watch items.

### Changes in this commit (v0.6.77–v0.6.97)

Key files:
- `app/actions/orb-converse.ts` — todo action transaction type, deterministic pending/status handling, grouped execution, action-set ledger resolution, broad voice project summary shortcut, commitment-integrity prompt inclusion.
- `app/api/orb-eval/route.ts` — mirrors deterministic action-set and broad voice summary behavior for evals.
- `components/UnifiedDashboard.tsx` — TTS config refresh, voice auto-TTS for final replies, mic idle recovery, session action-set persistence, grouped toasts.
- `lib/hooks/useVoiceMode.ts` — unified speech queue entry, no silent API-TTS fallback, duplicate recognition-start guard, runtime TTS config update.
- `components/settings/SettingsVoice.tsx` — emits settings-change event for runtime voice refresh.
- `lib/orb-prompt.ts` — bulk delete rule, disambiguation follow-through, search_knowledge routing restoration, commitment integrity.
- `scripts/eval-cases.ts` + `scripts/orb-eval.ts` — tool-count assertions, action-set injection, focused cases for batch create, bulk delete, ledger delete, voice summaries, and unsupported commitments.
- `app/globals.css`, `docs/ui-catalog.md` — voice transcript readability/UI catalog updates from the voice UI pass.
- `lib/changelog.ts`, `lib/version.ts`, `package.json` — release entries and version bump through v0.6.97.

### Eval Status

- **Tier 1:** passed after fixing `voice-status-question-stays-operational` (the deterministic voice summary shortcut was too broad and bypassed the provider route).
- **Tier 2: 20/20 passed ✅** (2026-06-29 17:54:07–18:05:46 HST; 11m39s; ~1.67M tokens; ~$1.71)
- The eval endpoint executes nothing (captures tool calls only) — it creates no DB rows.

### Known Issues / Watch

1. **Double confirmation edge:** one prior transcript showed a ledger/bulk delete confirmation being asked twice. Later tests looked good, but keep watching for any prompt-first confirmation leaking before the app-owned pending transaction.
2. **Failure/warning paths:** success cases are now strong; still worth deliberately testing partial failures, missing tasks, stale action-set references, and network aborts so pending/action-set state cannot lie after an error.
3. **Action ledger scope:** current ledger is session/same-tab durable, not a DB transaction journal. This is intentional for the first approximation; revisit only if cross-device or crash recovery becomes necessary.
4. **Latency:** voice feels much improved, but record breakdown later (LLM, TTS synthesis, audio playback, recognition restart) before broad optimization.
5. **Backlog cache staleness:** execution reads live DB, but any model-narrated context can still be stale if cached. Deterministic action-set outcomes reduce the most dangerous cases, but broad narration may still lag.

### Key Lessons

1. **Don't let a non-deterministic entity own correctness.** The fragility came from the AI driving a deterministic confirm state machine. Code owns when/which; the AI owns what/how it's said.
2. **A sturdy deterministic spine frees the AI.** Once a wrong word can't cause a wrong act, you can stop muzzling the Orb (templated confirmations, hallucination catchers shrink).
3. **Session references need product-level records.** "Delete them" and "delete the first five" should resolve against verified action sets, not the model's memory or the current backlog sort order.
4. **Summaries can be grouped while details remain visible.** Voice/user-facing summaries should say "created/deleted 5 todos"; transcript thoughts can retain individual codes for trust.
5. **Do not promise what the app cannot keep.** "In this conversation" is acceptable; "I'll remember going forward" is only acceptable when a real persistence tool/rule honors it.
6. **Identity ≠ label.** Free-text names can collide and change → never a key. Resolve name→id/code; surface stable codes only when needed to break ties or verify.
7. **Eval cases test model behavior → their context must be controlled, not live.** Use `backlogOverride`/`pendingSummary`/`actionSets`/`__UNIQUE__`; never hard-code live project names unless the case intentionally depends on live state.

---

### Not started

- **ORB-292:** Design user-facing Value/Balanced/Deep Thinking modes, per-user allowances, and consent-based Orb tuning proposals.
- **ORB-287:** Investigate dashboard background polling overhead.
- **ORB-254 remaining:** Blank User columns when filtering by date.

---

### Prior Session Context

**CRUD Reliability — Name-First Context + structural gate — 2026-06-27 (Claude Code, Opus 4.6)**

v0.6.73–v0.6.75: removed regex approval gate, name-first AI context, capability detection, voice structural fixes, first structural mutation gate (now superseded by the propose/confirm/execute flow above).

**Voice mode production fixes — 2026-06-26**

v0.6.67–v0.6.71: silent TTS fix, build gate for TTS keys, iPhone AudioContext volume, selected voice DB load, delete-project loop, duplicate voice race, fader slider.

---

## Key Decisions

- **Name-first context.** The AI's backlog, scope text, observations, and all project references use project NAME as the primary identifier. Code is shown as metadata `[code: XXX]` for tool calls only. Users never interact with codes.
- **Structural mutation gate replaces prompt-only gating.** CRUD tools are held server-side until user confirms. The AI calls the tool immediately, the server holds, the user confirms, the server executes.
- **Prompt aligns with gate.** The mutation prompt says "always call the tool immediately — the server handles confirmation." No conflict between prompt-layer and gate-layer expectations.
- **Project name is the user's identifier.** Tool params for `delete_project` and `update_project` accept `name`, not `project_code`. Handlers look up by name. Code is immutable, auto-generated, internal.
- **Linear processes get structural enforcement.** If steps must happen in a fixed order, code enforces the order. Non-linear processes (queries, reads) stay prompt-guided.
- **Unified toolbar: same 6 buttons on all screens.** No desktop/mobile split.
- **Modal conformity:** All modals use `modal-footer` with `justify-content: flex-end`. Cancel = `btn-cancel`. Primary = `btn-primary`. Delete = `btn-danger` with `marginRight: auto`.
- **Git push is NEVER automatic.** Structural enforcement via settings.local.json.
- **Orb identity: Brownie temperament, butler intelligence.**
- **Voice personality: one personality at three volumes** (reserved/natural/open).
- **Voice preferences in localStorage, not DB.** Browser voices differ per device.
- **Voice testing: Chrome/Safari/Edge only.** Comet is unreliable for voice.

---

## Next Priorities

1. **Production push:** Stan approved release direction after final manual voice CRUD tests and evals. Commit locally first; push only after Stan explicitly says push.
2. **Continue ORB-299 after release:** failure/warning tests should deliberately exercise stale references, missing todos, partial delete/update failures, and interrupted/network-aborted sessions. Ensure all paths are try/catch wrapped and do not leave stale pending/action-set state.
3. **Double-confirm watch:** if a future transcript shows two confirmations for one grouped action, trace whether a model speech confirmation is escaping before the app-owned pending transaction.
4. **Latency breakdown:** measure voice turn timing by stage before optimizing.
5. **Consider persistence design later:** pronunciation/user behavior preferences need a separate product design if they should survive beyond the current conversation. Do not imply persistence without a real tool.

---

## Panel Transitions — Design Notes for Next AI

The orb panel and list panel currently use **conditional rendering** (mount/unmount) to show/hide. This means CSS transitions can't animate them — the element doesn't exist in the DOM before it appears.

**To add transitions, the next AI needs to:**
1. Keep both panels always mounted in the DOM
2. Use CSS classes to control visibility (`opacity`, `transform`, `pointer-events`)
3. Toggle a class like `panel--visible` / `panel--hidden` instead of conditional rendering
4. Add CSS transitions (~200ms) for the opacity/transform change
5. Use `pointer-events: none` on hidden panels to prevent interaction
6. Consider: hidden panels still run effects/subscriptions — may need to gate data fetching behind visibility state to avoid unnecessary API calls

**Complexity:** Medium-high. The panels have state (conversation history, scroll position) that benefits from staying mounted. But they also have polling/subscriptions that shouldn't run when hidden. Test on all three platforms — the resize handle between panels also needs to work correctly with always-mounted panels.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Never `git push` without Stan's explicit in-chat approval** — structural enforcement via settings.local.json
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

## AI Tool Used Last Session

`2026-06-29 — Codex (GPT-5)`

---

*Updated by AI at end of each session. Committed with session code changes.*
