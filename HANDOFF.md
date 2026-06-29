# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app
- **Version:** 0.6.76

---

### Last Session Completed

**Project CRUD Reliability Rework — propose/confirm/execute — 2026-06-28 (Claude Code, Opus 4.8) — v0.6.76**

Stan's directive: "CRUD must be rock solid in text mode first." We diagnosed the prior structural gate as fragile (six overlapping steering mechanisms; the AI driving a deterministic state machine across turns) and replaced it, for **project mutations**, with a clean server-held propose → confirm → execute flow. Tested by Stan in text mode ("felt comfortable"); **Tier 1 evals 27/27 green.**

**Organizing principle (drives all future Orb work):** *correctness vs. judgment.* Deterministic code owns anything with one right answer (which row, executing once, reporting truthfully); the non-deterministic Orb owns interpretation/judgment (understanding intent, phrasing, disambiguation, strategic insight). A sturdy deterministic spine *frees* the Orb to be expressive, because a wrong word can no longer cause a wrong act. The boundary is meant to be adjustable — move things from rails toward rope as trust grows.

**The new flow (projects only this pass):**
- **One rule:** mutation tools PROPOSE (never execute); a single `confirm_mutation` tool EXECUTES the exact stored intent. Calling a mutation tool twice just re-proposes — the only path to a write is `confirm_mutation`.
- **Identity ≠ label:** `resolveProjectReference` turns a free-text name into 0/1/N projects (normalize for match, preserve for display; exact name → exact code → unique substring). Ambiguous → the Orb asks which, using the code as the tiebreaker. The pending stores the resolved **id**, never a name.
- **Server-held pending** (`orb_pending_mutations`, one row per user, TTL, upsert-supersede). The client echoes nothing. **Consumed on load** → a pending is confirmable only on the turn directly after it's proposed (fail-safe: a stray later "yes" can't execute it).
- **Hybrid confirm:** voice → instant deterministic "Done — …" (no extra model turn); text → Orb narrates.

**New module:** `lib/orb-mutations.ts` (resolution + pending store + propose + execute). **Migration:** `scripts/migrations/20260628_orb_pending_mutations.sql` (applied; RLS `(SELECT auth.uid())`, service-role-only, UNIQUE(user_id)).

**Also:** project mutations now route via the new flow; the **legacy gate is reduced to todos only** and clearly marked transitional. Contract changes go through `docs/api-spec.yaml` → regenerated `lib/orb-contract.ts` (caught + fixed pre-existing drift: restored `set_voice`/`exit_voice` and three tool labels the spec lacked). Eval suite gained `backlogOverride` (frozen backlog) + `pendingSummary` + `__UNIQUE__` runtime name generation so project-routing cases are deterministic, not hostage to live DB.

### Changes in this commit (v0.6.76 + carried-forward v0.6.73–v0.6.75)

This commit bundles the uncommitted v0.6.73–v0.6.75 work (capability detection, voice structural fixes, error propagation) **plus** this session's v0.6.76 project-mutation rework. Key files:
- `app/actions/orb-converse.ts` — propose/confirm/execute interception, `confirm_mutation`, server-held pending (consume-on-load), hybrid confirm, dead project handlers removed, GATED_MUTATIONS reduced to todos, multi-turn speech spacing, premature-speech discard
- `lib/orb-mutations.ts` — NEW: resolution + pending store + propose + execute
- `scripts/migrations/20260628_orb_pending_mutations.sql` — NEW: pending table
- `app/api/orb-eval/route.ts` — mirrored pending injection, `backlogOverride`, name-first backlog
- `docs/api-spec.yaml` + `lib/orb-contract.ts` — name-param tools, `confirm_mutation`, drift fixes
- `lib/orb-prompt.ts` — mutation prompt rewritten (always call tool; server handles confirmation), name-first observations
- `scripts/eval-cases.ts` + `scripts/orb-eval.ts` — new fields (pendingSummary, backlogOverride, __UNIQUE__), project-flow cases, frozen backlogs
- `lib/hooks/useCapabilities.ts` — NEW: runtime capability detection
- `lib/hooks/useVoiceMode.ts`, `components/UnifiedDashboard.tsx`, `components/OrbConversation.tsx` — capability detection, TTS fallback, error recovery (v0.6.74)
- `app/actions/manage-project.ts` — name-conflict check in createProject
- `lib/changelog.ts`, `lib/version.ts`, `package.json` — v0.6.76 (+ 0.6.73–0.6.75 entries)

### Eval Status

- **Tier 1: 27/27 passed ✅** (deterministic; project-routing cases now use frozen `backlogOverride`)
- **Tier 2:** not run this session
- The eval endpoint executes nothing (captures tool calls only) — it creates no DB rows.

### Known Issues / Watch

1. **Voice not yet verified by Stan** for the new flow — hybrid confirm only exercises in voice mode. Next focus: examine voice exactly as we did text (it was also whack-a-mole'd — expect redundant code / path consolidation opportunities).
2. **Latency** — to be looked at as part of voice/CRUD verification.
3. **Todos still on the legacy gate** — migrate to the new flow, then delete the legacy gate + client `req.pendingMutation` echo + remaining "six mechanisms" traces.
4. **Backlog cache staleness** (separate from this flow): the ~5-min prompt cache can make the Orb *speak* stale counts after a mutation. Execution always reads live DB; only narration is affected. Candidate follow-up: invalidate cache on mutation.
5. **iPhone Chrome / Settings→Voice / Comet voice** — pre-existing, unchanged.

### Key Lessons

1. **Don't let a non-deterministic entity own correctness.** The fragility came from the AI driving a deterministic confirm state machine. Code owns when/which; the AI owns what/how it's said.
2. **A sturdy deterministic spine frees the AI.** Once a wrong word can't cause a wrong act, you can stop muzzling the Orb (templated confirmations, hallucination catchers shrink).
3. **Identity ≠ label.** Free-text names can collide and change → never a key. Resolve name→id; surface the stable code only to break ties.
4. **Eval cases test model behavior → their context must be controlled, not live.** Use `backlogOverride`/`pendingSummary`/`__UNIQUE__`; never hard-code live project names.
5. **The contract is generated from `docs/api-spec.yaml`.** Edit the spec + regenerate; never hand-edit `lib/orb-contract.ts` (drift gets silently reverted).

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

1. **Examine voice mode the way we did text.** This baseline (project CRUD via propose/confirm/execute) carries forward. Verify CRUD in voice, then audit voice for redundant code / path consolidation — it was whack-a-mole'd too, so expect the same kind of cleanup the text path needed. Stan: "examine voice as it is just as you did with text."
2. **Latency** — look at responsiveness (especially voice); the hybrid deterministic confirm is one lever, but general LLM+TTS latency is the bigger factor.
3. **Migrate todos to the propose/confirm/execute flow**, then delete the legacy gate + client `req.pendingMutation` echo. Todos use code identity (no fuzzy resolution needed); reuse the shared machinery.
4. **Prompt consolidation** — the structure now carries the weight; several prompt crutches around mutation/confirmation can shrink. Do this with the todo migration.
5. **Backlog cache staleness** — consider invalidating the prompt cache on mutation so the Orb stops *speaking* stale counts (execution is already live-correct).

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

`2026-06-28 — Claude Code (Opus 4.8)`

---

*Updated by AI at end of each session. Committed with session code changes.*
