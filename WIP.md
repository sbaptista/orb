# ORB-325 Production Hardening WIP

---

## 2026-07-14 — Claude Code (Opus 4.8) — typed parity, Phase 1: safe todo closing

**Ownership:** Codex is out of usage for several days (Stan), so Claude Code owns the full ORB-325 Realtime surface. Direction **decided by Stan 2026-07-14: typed capability parity** — build native Realtime tools for every remaining capability, **not** a serial fallback. Closing uses a **dedicated `propose_close_todo`**, not an overloaded update path.

**Phase sequence (Stan-approved):** 1) safe closing ← *this* · 2) project mutations · 3) knowledge repo · 4) read-only parity (tickets/audit/bounded query_db) · 5) navigation/client actions + adaptations · 6) ambient VAD classifier (Silero, shadow-mode only, separate, needs dependency approval — do NOT bundle). Stan-only gates: browser acceptance, `npm run eval:t1` green, decision to flip the main voice button.

**Phase 1 status: code complete, migration NOT applied, NOT committed.** Version 0.6.196 → **0.6.197**.
- NEW `scripts/migrations/20260714_realtime_todo_closing.sql` — `close_todo` added to proposal `kind` CHECK; `confirm_realtime_todo_mutation` gains a `close_todo` branch (stale-check + project lock + authorize → set status=closed + resolution_notes + closed_at, insert ONE knowledge_repo entry with origin_todo_id/product_id, insert ONE `todo_close` audit, durable receipt). **NOT YET APPLIED.**
- `lib/orb-realtime/types.ts`, `app/api/orb-realtime/turn/route.ts` (new `propose_close_todo` op, app-layer AI attribution + length caps), `app/api/orb-realtime/session/route.ts` (instructions + `propose_close_todo` tool), `lib/hooks/useRealtimeVoiceSpike.ts` (dispatch), `scripts/eval-cases.ts` (`realtime-close-intent-analogue`), `docs/object-capability-matrix.md`, `lib/changelog.ts`.
- Static: `npx tsc --noEmit` clean.

**Eval default reverted to Haiku (v0.6.198, internal — no changelog entry).** ORB-334's Gemini default was Stan's deliberate *token-cost experiment*, not a permanent choice. The routine suite is the production gate, so it must exercise production's model (`orb-converse.ts` → `claude-haiku-4-5`); gating Haiku on Gemini's tool choices proves nothing either way. Full T1 on Gemini (2026-07-14) was 48/52 — the 3 non-Realtime failures (`update-knowledge-correction-tool`, `memory-save-offered`, `approval-follow-through`) were all "Gemini prefers verify-first" (search/recall/query instead of update/save/update), i.e. cross-model drift, not regressions. That run also cost ~1.9M tokens / ~$1.35 / 12m 5s.
- NEW `lib/orb-model/eval-defaults.ts` — provider-neutral `ORB_EVAL_DEFAULT_PROVIDER='anthropic'` / `ORB_EVAL_DEFAULT_MODEL=ANTHROPIC_HAIKU_REFERENCE_MODEL`. Removed those constants from `gemini.ts` (a provider module is the wrong home for a neutral default).
- Each provider branch in `app/api/orb-eval/route.ts` now falls back to **its own** model (gemini→`GEMINI_STRATEGIC_EVAL_MODEL`), never another provider's — the previous shared fallback would have handed Haiku to Gemini once the default flipped.
- Gemini/Mistral remain fully available via `EVAL_PROVIDER`/`EVAL_MODEL` or per-case overrides; the strategic manifest and `one-model-strategic-route-stays-tool-free` now pin `GEMINI_STRATEGIC_EVAL_MODEL` directly.
- Runner verified: `Default evaluator: anthropic/claude-haiku-4-5`.

**Confirmation grammar fixed (v0.6.199, user-facing).** Stan's DEV acceptance found closing was *impossible to authorize*: `isBareMutationAffirmation` was anchored `^…$` over bare tokens only, and lacked "approved"/"approve" entirely. So "approved", "I confirm the change", and "Yes, apply the change to close ORB-338" were all refused — the user could never close ORB-338. Orb compounded it by inventing grammar guidance (claimed "confirmed" was rejected — it wasn't — and suggested "I approve closing ORB-338", which the server refused).
- `lib/orb-model/mutation-authorization.ts`: added `isExplicitMutationApproval` + a single `authorizesPendingMutation` = bare affirmation OR explicit approval act (approve/confirm/authorize, apply|execute|make|do the change|it|that, go ahead/proceed) **guarded by** not-a-question, not-negated, and not-retrospective (already / should have / told you / again / why). The retrospective guard is what keeps `permission-complaint-does-not-confirm` refusing. Bare vocabulary gained approved/approve/affirmative/absolutely/definitely/correct.
- All confirm gates now use `authorizesPendingMutation`: `orb-converse.ts` (4 sites), `orb-eval/route.ts` tool-availability filter, `orb-realtime/turn/route.ts` handler recheck. Upfront-permission path unchanged.
- Session instructions + `buildPendingMutationConfirmationInstruction`: never describe/quote/guess the accepted wording; on rejection restate the pending change and ask for approval in the user's own words.
- Eval: added Tier 1 `explicit-sentence-approval-confirms`; `permission-complaint-does-not-confirm` must stay green.
- Verified by direct predicate exercise (scratchpad script): 36/36 — every transcript phrase authorizes, every complaint/question/decline/noise/empty refuses.
- **Needs Stan's re-test in the DEV operator, plus a focused eval run on the two authorization cases.**

---

### PHASE 2 IN PROGRESS — project mutations (create/update/delete)

**Phase 1 is COMMITTED at `0fb3f4f`** (v0.6.197–v0.6.199), migration applied, live-accepted (ORB-338 closed on "approved"). Not pushed.

**Design decided (do not re-litigate):** project **code generation must not be ported to SQL**. `createProject` (app/actions/manage-project.ts) generated codes in TS via a private `generateUniqueCode`; duplicating that in the RPC would create a second generator that silently diverges from the web UI's. Instead:
- **DONE:** extracted `checkCodeConflict` / `generateUniqueCode` / `normalizeProjectCode` into **`lib/project-codes.ts`** (a plain module — NOT app/actions/manage-project.ts, which is `'use server'`, where every export becomes a publicly callable server action). `manage-project.ts` now imports them; behaviour unchanged; tsc + eslint clean.
- **PLAN:** generate the candidate code at **propose** time in TS (analogous to how todo proposals snapshot `expected_*`), store it in the proposal params, and have the RPC re-validate name/code conflict under lock and commit atomically, failing closed on a race. One generator, still exactly-once.

**Schema facts already verified (don't re-query):**
- `orb_realtime_proposals`: `project_id` nullable (SET NULL), `todo_id` nullable, `title` NOT NULL 1–240 (store the project name there). Phase 1's `execution_shape` CHECK already permits `status='executed'` with `todo_id IS NULL`, so project mutations fit with no constraint change.
- `projects`: `code` varchar NULLABLE with **no DB trigger** generating it (app-layer only); `created_by` NOT NULL; `is_dormant` NOT NULL default false; trigger `products_updated_at` maintains `updated_at`.
- `todos_product_id_fkey` is **ON DELETE CASCADE** — serial `delete_project` is a genuine HARD delete of the project and all its todos (unlike `delete_todo`, which is soft). Realtime must match that semantic and say so plainly in the confirmation.

**Remaining Phase 2 steps:**
1. Migration `20260714_realtime_project_mutations.sql`: add `create_project|update_project|delete_project` to the kind CHECK; add RPC branches **before** the todo-targeted ELSE block (they have no `target_todo_id`). create → insert with the pre-generated code + `created_by=p_user_id` + audit `project_create`; update → lock/authorize, snapshot-check `expected_updated_at`/`expected_name`, set name/description only (code immutable), audit `project_update`; delete → lock/authorize, hard delete, audit `project_delete`. Receipt + replay for each. The final `UPDATE … SET todo_id = v_todo.id` yields NULL for project kinds — fine.
2. `lib/orb-realtime/types.ts`: add the three kinds.
3. `turn/route.ts`: `propose_create_project` / `propose_update_project` / `propose_delete_project` (name-first resolution via `resolveProjectByReference`, ambiguity fails closed; create generates the code via `lib/project-codes`).
4. `session/route.ts`: three tools + instructions (name-first; delete is irreversible incl. all todos).
5. `useRealtimeVoiceSpike.ts`: dispatch.
6. `scripts/eval-cases.ts`: Tier 1 `realtime-create/update/delete-project-intent-analogue`.
7. `docs/object-capability-matrix.md` projects row + version bump + changelog.
8. Rollback-only DB test, then Stan: focused eval + DEV acceptance, then commit.

**RESOLVED (v0.6.200) — knowledge now survives project deletion.** `knowledge_repo_product_id_fkey` was ON DELETE CASCADE, so hard-deleting a project destroyed every entry originating from it, including the ones Phase 1's closing workflow writes. Stan chose: SET NULL **plus a note that the project no longer exists**.
- Migration `20260714_knowledge_survives_project_delete.sql` (APPLIED): FK → ON DELETE SET NULL, plus a BEFORE DELETE trigger on `projects` (`note_project_deleted_on_knowledge`) that prepends `**ORIGINATING PROJECT DELETED (YYYY-MM-DD):** the project “X” no longer exists…` while the name is still readable, preserving the original body below (same banner convention as SUPERSEDED entries).
- `origin_todo_id` was already correctly SET NULL — verified, so cascaded todos don't drag their entries down. Only `product_id` was wrong.
- Rollback-verified: both a plain entry and a close-workflow entry survived, `product_id` nulled, note present and naming the project, original body intact, 0 test rows persisted. 253 entries exist today (244 project-attached) — this was live exposure, not theoretical.

---

**Immediate next steps for Phase 1:**
1. Stan approves applying the migration (`psql … -f scripts/migrations/20260714_realtime_todo_closing.sql`).
2. Rollback-test the close RPC: one closed todo (resolution_notes+closed_at), one KB row, one `todo_close` audit, receipt replays identically, already-closed + missing-notes fail closed.
3. Stan runs `npm run eval:t1` (incl. new close analogue).
4. Stan DEV-operator acceptance: "Close ORB-XXX, I did …" → one proposal → one confirm → receipt; verify DB.
5. Commit Phase 1 (ask first; never push without approval). Then Phase 2.

---

## ORB-334 eval provider checkpoint

- Routine Tier 1, Tier 2, and strategic suites now default to `google/gemini-3.1-pro-preview` through shared constants in `lib/orb-model/gemini.ts`.
- The CLI and eval endpoint use the same default; routing fixtures still verify role classification, not production provider selection. Explicit provider/model overrides remain possible for deliberate comparisons.
- Production Orb routing is unchanged. No database or user-facing workflow changed, so no new performance instrumentation is required.
- Static checks and no-network CLI help passed. Stan's representative model-backed run passed Tier 1 2/2 and Tier 2 1/1 with usage reported as `google/gemini-3.1-pro-preview` (~209,229 tokens, ~$0.2330, 11.281s average model latency, 1m36s elapsed). Keep future runs focused; do not run the paid suite automatically.
- ORB-334 is closed with resolution notes; Knowledge Repository entry `a2d3d716-b389-485e-8cd6-7a18f7a2f44d` preserves the model-as-subject coverage caveat and measured tradeoffs.

## Current status

- The Realtime/WebRTC spike is accepted for Safari, Chrome, and Edge; Firefox is deferred to ORB-330.
- Production hardening is implemented on `codex/orb-325-production-hardening`; the database migration is applied.
- Static spike verification is green; Stan manually accepted exact named-project count scope and the focused Tier 2 case passed 1/1.
- Durable end-to-end create acceptance passed: one executed proposal, one `STOKELYFRO-3` todo, one audit event, matching stored receipt.
- Typed scoped-list acceptance passed: Orb's 9-code open list matched the database exactly.
- Durable update/delete/move is implemented and the follow-up migration is applied. Rollback-only verification passed for one write + one audit per operation, identical replay receipts, soft deletion, move renumbering, and stale-version rejection; no verification data persisted.
- Fixed the receipt-ledger constraint discovered by list deletion of `STOKELYFRO-3`: an executed proposal keeps its receipt after a later hard delete, while `todo_id` is allowed to clear through its existing `ON DELETE SET NULL` foreign key.
- Realtime mutations now accept a natural todo title or code plus an optional project name. The server resolves one fresh accessible row and rejects ambiguity; a separate exact-code read is no longer required.
- Text and Realtime now share `lib/orb-model/mutation-authorization.ts`. Realtime waits for the actual current-turn transcript, accepts upfront permission without another confirmation, and rejects mixed-content complaints/reminders as confirmation even if the model calls the tool. The serial/eval tool set also omits `confirm_mutation` unless a pending proposal exists and the current input passes that same bare-affirmation predicate; the handler rechecks defensively.
- The response watchdog is one absolute 12-second post-transcription deadline across model and tool phases. Tool failures now mark the whole telemetry turn unsuccessful.
- A representative Edge timeout exposed a media-lifecycle bug: the watchdog cancelled the provider response and also paused the session-owned remote `<audio>` element, so the retry received RTP and completed its transcript while remaining inaudible. Recovery now leaves the media element continuously playing; `response.cancel` stops the failed output, and telemetry records the element's paused state at first inbound audio. The same exchange exposed missing Realtime priority semantics, so known labels now map directly (`urgent=1`, `high=2`, `normal=3`, `low=4`) instead of asking for an internal number.
- The accepted retest confirmed the final receipt was audible and `ORB-336` changed exactly once to priority 2. Its first natural-title attempt exposed broad boolean fuzzy matching: the shared existing relevance scorer now selects a unique stronger near-exact title after exact matching, while ties remain ambiguous. Realtime startup also removes the one passive dashboard greeting it replaces and suppresses urgency-transition narration while connecting/active, leaving one synchronized greeting.
- The next retest resolved `ORB-336` correctly and mapped normal to 3, but VAD split the request and the shared grammar did not yet include “you have my approval,” causing another confirmation. It also emitted unsolicited closing speech from a new VAD event with no transcript. OpenAI documents transcription as asynchronous with response creation, and committed audio/transcription events share an `item_id`. Realtime now disables VAD-driven automatic responses, correlates committed items to application turns, and calls `response.create` only after the current item’s non-empty transcript completes. Late prior transcripts stay visible but cannot answer or authorize the new turn. The shared grammar now recognizes “my approval” only when the same utterance creates a concrete proposal. Trailing passive status messages are removed when Realtime supersedes the passive greeting.
- The following approval retest exposed a post-receipt loop, not an authorization failure. Database evidence proved two requested priority-2 updates executed once each; after each canonical receipt, the model unnecessarily called `confirm_todo_mutation` again, the bare-affirmation gate correctly rejected that redundant call, and Orb falsely narrated the rejection instead of the successful receipt. OpenAI’s Realtime response contract permits per-response `tool_choice:none` and tool overrides. Every server-authored exact proposal/error/receipt speech response now disables tools, so it can only narrate the canonical text; the next genuine user turn restores session tools. Telemetry records `preAuthorized` and `canonicalReceipt` booleans.
- The v0.6.195 retest passed cleanly: one pre-authorized canonical receipt updated `ORB-336` to priority 3 with no redundant confirmation. Separate Korean/other short transcripts appeared without deliberate speech; the hook has no pointer input, so these are classified as microphone/VAD false triggers with plausible ASR output. The session now requests ASR logprobs and records privacy-safe aggregate confidence plus VAD duration. The evidence does **not** support a safe threshold: false and legitimate short turns overlap in confidence and duration. Automatic language detection remains enabled; an English lock and language/word heuristics were explicitly rejected because Orb must understand multilingual input and be able to answer in another language. Work is paused pending a language-independent speech/non-speech design.
- Focused Tier 1 permission/mutation coverage is 5/5. The complaint case first failed by calling `confirm_mutation`, then passed 1/1 after the tool availability and handler were structurally gated by the shared predicate.

## Design decisions

- Production promotion retains the current serial voice path as a fallback; Realtime is introduced through an explicit rollout gate, not a flag-day replacement.
- The database is the mutation commit boundary. A proposal is persisted before it is returned to the voice model.
- Confirmation calls one transactional RPC that locks the proposal, re-authorizes the project, locks the project during todo-number allocation, creates the todo and audit event, stores the canonical receipt, and returns that same receipt on replay.
- No `postgres_changes`, polling, high-frequency writes, or audio/transcript storage is added.
- New query patterns are primary-key proposal confirmation, pending-expiry maintenance, and natural todo resolution across accessible non-deleted rows (project-scoped whenever a current/explicit project is available). The migrations include proposal FK/pending-expiry indexes; existing partial todo indexes cover project/non-deleted lookup. Unique fuzzy matching currently filters the bounded accessible result in application code; gateway timing will determine whether a database search/index change is ever justified.
- Update/delete/move targets cannot be supplied as raw model-generated IDs. The proposal endpoint resolves a natural title/code and optional project name to one fresh accessible row, snapshots its version, and rejects ambiguity; confirmation re-authorizes and locks the proposal, todo, and affected projects. Opposite-direction moves lock projects in stable UUID order.
- Realtime updates intentionally exclude `closed`: closing stays on the full workflow until resolution notes and Knowledge Repository obligations are transactional too.

## Immediate next steps

1. ORB-325 is **OPEN**. It was briefly closed and immediately reopened after Stan clarified that the main Realtime path is not product-default and remaining scope was unclear. Durable checkpoint: Knowledge Repository `8d4c4ac3-a3c7-4a09-8d4c-f0beb877c24a`.
2. **DECIDED 2026-07-14 (Stan): typed capability parity, not fallback** — see the Claude Code section at the top. Realtime still lacks project mutation, Knowledge Repository, tickets, audit/repository inspection, navigation/client actions, adaptations/preferences/memory; safe closing is now built in Phase 1 (pending apply/accept). Build each remaining capability as native typed Realtime tools per the phase sequence above.
3. Do not spend more model calls or add an ASR-confidence/duration threshold from the current sample. For ambient false turns, evaluate a language-independent acoustic classifier in shadow mode only. Silero VAD is a candidate, not an approved dependency. Reuse the exact existing MediaStream, do not alter the WebRTC sender, measure total model/worklet/WASM and device cost, and validate quiet confirmations plus multilingual speech across Mac/iPad/iPhone Safari/Chrome/Edge.
4. If suppression is later justified, rejected turns must clear watchdog/state, skip the visible transcript and `response.create`, end telemetry as expected suppression, quarantine late events, and delete/exclude the provider input item so nonsense cannot pollute later context. A response gate alone does not prevent false provider interruptions.
5. Manually accept supported-browser factual reads, natural-title mutations, upfront permission, one confirmation, interruptions, watchdog recovery, and unsupported-intent fallback. Then Stan runs `npm run eval:t1`; no push or product-default switch until Tier 1 is green.
6. Run the production build only when it will not disturb Stan's user-owned dev server.
