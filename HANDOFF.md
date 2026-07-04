# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app
- **Version:** 0.6.139

---

### Last Session Completed

**AI Metrics Cost Accounting Labels + ORB-310 First Redesign Slice — 2026-07-03 (Codex, GPT-5) — v0.6.139**

Stan asked why OpenAI/ElevenLabs TTS usage was not visible in AI Metrics. Direct DB inspection showed TTS usage is present in `orb_model_requests` with `source = voice_tts`; the UI was unclear because the newer request-ledger cost accounting area was titled generically while the visible table below is the older `orb_metrics` daily metrics surface.

**What changed:**
- Renamed the top AI Metrics cost section to **App AI Cost Accounting** and clarified that it is the newer request ledger for model calls and API TTS usage, including OpenAI and ElevenLabs.
- Mapped `voice_tts` to the visible source label **Voice TTS**.
- Created **ORB-310 — AI Metrics Redesign** to redesign Settings -> AI Metrics piece by piece, remove or demote legacy `orb_metrics` data, make the request ledger primary, and address AI Metrics performance while redesigning.
- Started ORB-310 at the top of the page: tightened the App AI Cost Accounting caption, populated Model from request-ledger models plus configured rate cards, moved the eval/day-to-day note under the filter controls, replaced duplicate summary card/list renderings with one ledger-style summary card, added an **Accounting Details** card, aligned the shorter top cards to the same width, moved the Rate Cards header/caption outside the card list, shortened the rate-card caption, and restored a visually distinct **New Rate Card** form above the existing rate-card list.
- Removed the legacy `orb_metrics` daily summary from the visible AI Metrics page.
- Replaced the visible logging table with **AI Request Log**, a paginated/searchable/sortable request-level `orb_model_requests` ledger with provider, model, source, role, status, latency, token/character counts, cost estimate, and failure columns.
- Kept the shared `SettingsCrudList` pagination and column navigation controllers for the request log.
- Fixed `SettingsCrudList` so tables using external search modals still render the column navigation controller when the table overflows; AI Request Log uses that path.
- Added a show/hide toggle for **AI Request Log** and defaulted it collapsed on narrow/coarse-pointer screens to reduce iPhone scrolling when the log renders as cards.
- Fixed the narrow-width **Show Log** jump by keeping `SettingsCrudList` page headers and header extras mounted during initial table loading instead of replacing the whole page shell with skeleton rows.
- Restyled **Provider Bill Reconciliation** with the same section-header/card pattern, visible input outlines, editable recorded bill rows, and audited delete support.
- Started ORB-311 by checking AI Metrics performance telemetry before optimizing: production samples still show `ai_accounting_load` as the larger page-load signal, while `request_log_load` is the growing-table risk.
- Converted **AI Request Log** from exact-count offset paging to cursor pagination on indexed `created_at`, returning `nextCursor` to `SettingsCrudList` and dropping table counts from the hot request-log fetch.
- Limited request-log server sorting to created-time order for this first optimization pass so the query can stay on the append-heavy log-table access pattern instead of encouraging arbitrary large-table sorts.
- Continued ORB-311 after Stan tested the cursor path: new `request_log_load` samples showed the cursor path reduced the ugly tail on iPhone Chrome, while `ai_accounting_load` remained the larger initialization bottleneck.
- Added `get_ai_cost_summary_rollups`, a service-role-only database rollup RPC for App AI Cost Accounting totals, provider/model breakdowns, role breakdowns, source breakdowns, actual row range, and model options.
- Updated `getAiCostSummary` to consume compact rollup rows instead of fetching and reducing thousands of raw `orb_model_requests` rows in the server action.
- Fixed AI Metrics `page_full_load` telemetry so it measures the component load lifecycle directly instead of relying on a stale Settings navigation timestamp that produced misleading `0ms` samples.
- Tightened performance telemetry platform detection so iPhone/iPad analysis prefers browser device signals before falling back to viewport width and coarse-pointer heuristics.
- Updated the UI catalog to document cursor pagination as the preferred pattern for log-style or append-heavy settings tables such as AI Request Log, Audit Log, and future Knowledge Repo-style tables.
- Updated the UI catalog and object capability performance matrix to document the reusable large-table fetch pattern: database-side rollups for summary cards/breakdowns and cursor pagination for detail rows.
- Updated the UI catalog with the AI Metrics accounting, rate-card, and request-log patterns used by the redesign.
- Updated AGENTS so required Supabase, psql, Orb API, and Knowledge Repo reads go directly to approved/escalated network access when the current AI tool is known to be sandboxed, instead of first recreating the expected DNS failure.

**What we learned:**
- Rate cards contain ElevenLabs Turbo v2.5 at `50` input-per-million and OpenAI TTS rows at `15`/`30` input-per-million.
- TTS usage exists in `orb_model_requests`: OpenAI `tts-1` and ElevenLabs `eleven_turbo_v2_5` rows are present under `source = voice_tts`.
- Provider bill reconciliation should record actual plan/bill amounts for the period; rate cards remain the per-unit estimate.

**Tracking:**
- ORB-309 remains **open**. The AI Metrics performance optimization work has not been done yet.
- ORB-310 is **closed** as of 2026-07-04 01:07 UTC. Knowledge Repo entry: `ORB-310 AI Metrics redesign completed` (`9b765610-a483-4d7c-aee6-2a5b07b76a66`).
- ORB-311 is **open**. Request Log has received the first scalable-fetch change, but before/after production samples still need to confirm improvement and decide whether App AI Cost Accounting summary queries are the next optimization target.

**Verification:**
- `npx tsc --noEmit` passed.
- `git diff --check` passed.

### Uncommitted Changes

- `AGENTS.md`
- `app/actions/get-ai-request-log.ts`
- `app/actions/get-ai-cost-summary.ts`
- `app/actions/orb-ai-settings.ts`
- `app/globals.css`
- `components/settings/SettingsCrudList.tsx`
- `components/settings/SettingsCostReconciliation.tsx`
- `components/settings/SettingsMetrics.tsx`
- `docs/object-capability-matrix.md`
- `docs/ui-catalog.md`
- `HANDOFF.md`
- `lib/changelog.ts`
- `lib/performance/telemetry.ts`
- `lib/version.ts`
- `package.json`
- `scripts/migrations/20260703_ai_cost_summary_rollups.sql`

---

### Prior Session: ORB-309 Performance Analysis UI + Production Telemetry Checkpoint — 2026-07-02 (Codex, GPT-5) — v0.6.138

Stan resumed ORB-309 after the instrumentation foundation shipped and asked to work through the remaining tasks without closing ORB-309. This checkpoint adds the first analysis layer to Settings -> Performance and records the first production telemetry lesson: production collection needs both deployed code/server env enablement and per-browser local measurement.

**What changed:**
- Added a **Performance Analysis** section above Latency Summary in Settings -> Performance.
- Changed summary calculations so P50/P75/P95 are based on successful completed events only; failed, stale, aborted, and interrupted events stay visible as reliability signals instead of contaminating latency percentiles.
- Added analysis cards for data coverage, completed events, failed/interrupted events, and top bottleneck.
- Added **Needs Attention** rows for high P95, high Max, and high failure-rate groups.
- Added platform-difference and environment/platform/browser coverage summaries.
- Added a **Production Collection Checklist** under Measurement Controls and to the ORB-309 plan: deploy latest app version, set `ORB_PERF_TELEMETRY_ENABLED=true` in Vercel Production, redeploy if needed, turn on Local Browser Measurement per browser/device, select focus areas, and confirm `environment = production` rows.
- Updated the UI catalog and changelog for the new Performance Settings analysis/checklist classes.

**What we learned:**
- Production telemetry ingestion is working once server-side ingestion is enabled and the testing browser has Local Browser Measurement turned on.
- A code deploy alone does not enable production telemetry. Vercel Production must have `ORB_PERF_TELEMETRY_ENABLED=true`.
- First production sample observed: **36 production events on v0.6.137** from Mac/Chrome between `2026-07-03 06:55:11` and `06:58:19 UTC`.
- Early production signals: `auth / login / passkey_click` had one slow sample around 8.5s; AI Metrics showed first samples around 4.3s `page_full_load` and 3.4s `ai_accounting_load`; Settings Performance filter loads had 11 samples with p50 about 1.2s, p95 about 3.1s, and max about 4.2s; dashboard init looked much faster in production than dev so far.
- Production is still on v0.6.137 until this commit is pushed/deployed; v0.6.138 analysis UI/checklist has been verified in dev only.

**Tracking:**
- Added Knowledge Repo entry `ORB-309 production telemetry and analysis UI checkpoint` (`c34e99e4-470f-42f6-9b2d-657b34160d48`).
- ORB-309 remains **open**. Do not close it until production samples exist across Mac/iPad/iPhone, a measured bottleneck is improved, and before/after data confirms the result.

**Verification:**
- Stan manually verified the dev UI: Performance Analysis appears above Latency Summary, coverage/counts look plausible, Needs Attention shows expected rows, and narrow-width cards stack without disappearing controls/text.
- `npx tsc --noEmit` passed.
- `node scripts/verify-ui-catalog.js` passed.
- `git diff --check` passed.

---

### Prior Session: ORB-309 Performance Instrumentation Foundation — 2026-07-02 (Codex, GPT-5) — v0.6.120-v0.6.137

Stan stopped new feature work to address the basic performance problem systemically: login was one visible symptom, but the task became instrumentation for every user-clickable flow, with dev and production measurements, focus-area controls, platform/browser context, and a Settings surface for analysis.

**What changed:**
- Created **ORB-309 — Improve Initialization Speed** and kept it open. This commit ships the measurement foundation, not the final optimization work.
- Added `performance_events` storage, ingestion, querying, deletion, and summary actions with RLS, indexes, platform/browser/viewport metadata, focus areas, sampling, batching, correlation IDs, and immediate flush for measured interactions.
- Added **Settings -> Performance** with measurement controls, focus-area toggles, sample rate, probe/flush actions, event CRUD/search/filter/table/cards, event detail modal, latency summary, P50/P75/P95/Max, platform/browser grouping, and narrow-width card layouts.
- Instrumented auth/login, OTP verification, Settings navigation, AI Metrics, Orb Metrics reconciliation, generic `SettingsCrudList` lifecycle/actions, dashboard initialization, project switching, todo CRUD, bulk delete, dashboard list controls, Orb submit, and voice start.
- Updated the ORB-309 plan, Object Capability Matrix, UI catalog, and AGENTS process rules so new functionality must explicitly decide whether performance instrumentation is required.
- Improved Performance Settings UX based on Stan's testing: styled measurement controls and filters, fixed detail modal overlap, used the existing Settings column controller, added table/card titles, preserved summary cards on narrow widths, made latency-summary rows readable, and added browser collection/filtering.

**First dev findings:**
- AI Metrics is the current standout slow surface. Local dev data showed `settings-ai-metrics / ai_accounting_load` and `metrics_table_load` with multi-second medians and very high P95/Max outliers.
- Some Performance Settings views can become analysis targets themselves as the events table grows.
- Failed/stale/interrupted events are now captured, but successful latency analysis should separate them from completed events.
- Production data is still required before choosing remedies because dev and production timings may differ materially.

**Tracking:**
- Added Knowledge Repo entry `ORB-309 performance instrumentation foundation and first dev findings` (`b197fe48-46fd-4428-b283-a02e612bc0ce`).
- ORB-309 remains **open**. Do not close it until production data has been collected and the remaining analysis/optimization work below is complete.

**Verification:**
- `npx tsc --noEmit` passed during the session.
- `node scripts/verify-ui-catalog.js` passed.
- `git diff --check` passed during the session.
- `npm run build` passed at v0.6.137.
- Browser/device testing happened iteratively on dev with Stan. Production collection is the reason for this commit/push.

### Prior Session: Voice Speak-Once, Confirm-Loop Fixes, Identifier Provenance, Project-Code UI Audit — 2026-07-01 (Claude Code, Fable 5) — v0.6.113-v0.6.119

Four connected pieces of work, each surfaced by Stan testing the prior session's voice operator runtime live and reporting exactly what broke, then asked to be fixed as a general class rather than a one-off patch.

**1. Voice speak-once (v0.6.113).** The streaming speech queue (per-response spoken-character tracking + "shrink recovery") was the source of voice repeating itself: when the server replaced streamed narration with deterministic text (a confirm message, a phantom-code correction), the queue detected the shrink and re-spoke the replacement from scratch, overlapping with narration still playing on slower mobile TTS. Replaced with speak-once-per-turn: voice waits for the response to finish streaming, derives `spokenText` once, speaks it, done. Removed `speakStatus`/stream modes, `spokenChars`, `completeSpeechPrefix`, `utteranceId`, and the unread `prevStreamingRef` (~80 lines net). Trade-off: first audio now waits for stream end; the existing "Gathering data..." visual state covers the wait.
- Files: `lib/hooks/useVoiceMode.ts`, `components/UnifiedDashboard.tsx`, `docs/orb-voice-operator-runtime-plan.md`, `docs/ui-catalog.md`.

**2. Confirm-loop fixes (v0.6.114).** Stan hit two live bugs testing voice: (a) "Confirm confirm" (a stacked voice-transcript affirmation) didn't match the exact-phrase affirmation regex, so it fell through to the model as a new request and asked to confirm a second time; (b) granting permission up front in the same message ("you have my permission to create them") wasn't recognized, so Orb asked to confirm anyway. Fixed both: `isBareAffirmation`/`isBareDecline` now accept any input made of stacked affirmation/decline phrases; a new `grantsUpfrontPermission` check executes held todo operations directly when permission was granted in the requesting message, with Orb acknowledging the pre-given go-ahead in its response. Stop remains the escape hatch.
- Files: `app/actions/orb-converse.ts`, `app/api/orb-eval/route.ts` (mirrored), `scripts/eval-cases.ts`.

**3. Identifier provenance (v0.6.115).** After the transcript was cleared by an update/Reconnect, Stan asked Orb (in a fresh voice session) to delete "the two test todos you created" — Orb had no record, so it fabricated codes by incrementing from the last known todo number (guessed TODO-4/-5 instead of the real TODO-2/-3). Root cause: nothing enforced that a task code Orb uses actually came from something it had seen — this was the third fabricated-identifier bug in the codebase (after phantom codes in speech, fabricated UUIDs), so it was fixed as a general provenance principle at three layers instead of a fourth one-off patch: (1) a new `IDENTIFIER PROVENANCE` resolution law in the shared prompt — codes must come from context, never from memory of a cleared session or pattern-completion; (2) a deterministic `[SYSTEM]` note injected whenever a conversation starts with empty history, telling the model its session record is empty; (3) a structural server-side gate that tracks every code the model has actually been shown (prompt, tool results, conversation) and rejects any mutation targeting an unseen code, redirecting the model to `query_todos` first.
- Files: `lib/orb-prompt.ts`, `app/actions/orb-converse.ts`, `app/api/orb-eval/route.ts` (mirrored), `scripts/eval-cases.ts`.

**4. Itemized bulk confirmations (v0.6.116).** Deleting the (now correctly found) todos worked, but the confirm message said "see the transcript for the exact items" without ever listing them. Confirm messages now itemize the exact targets (code + title) under the summary line, capped at 10 with an "…and N more (total)" tail for large sets — so a 1,000-todo bulk delete still gets a real confirmation gate without a wall of text.
- Files: `app/actions/orb-converse.ts`, `app/api/orb-eval/route.ts` (mirrored).

**5. Project-code UI audit and cleanup (v0.6.117).** Separate design conversation: Stan asked whether the project `code` column serves any purpose beyond composing todo codes (e.g. `ORB-73`) given tables already have `id`. Conclusion: code stays, but narrowed to exactly that one internal purpose — never a second user-facing label. Full audit presented and approved before any change:
- **Deleted (orphaned, unreachable from any in-app link since the Unified Dashboard shipped):** `app/dashboard/classic/page.tsx`, `app/dashboard/[productId]/page.tsx`, `components/DashboardProducts.tsx`, `components/TodoView.tsx`. Shared types (`Todo`/`Product`/`Priority`/`StatusDef`) extracted to new `lib/todo-types.ts` first so `TodoForm.tsx`/`QueryResultsModal.tsx`/`TodoPanel.tsx` (still live) kept working. Any future split-view rebuild starts from `UnifiedDashboard`, not from the deleted files.
- **Stripped project code from every remaining user-facing surface:** switch-project list, ticket/knowledge project pickers, Settings → Projects table, printed reports, the Orb project-switch voice/transcript message.
- **Removed the editable Code field entirely** from all three project create/edit forms (`AddProductModal.tsx`, `SettingsProjects.tsx`, `SettingsUserDetail.tsx`). No server change needed — `createProject`/`updateProject` already auto-generate a unique code from the name (`generateUniqueCode` in `app/actions/manage-project.ts`) when none is supplied.
- **Added fuzzy project-name resolution** (`resolveProjectByReference` in `UnifiedDashboard.tsx`: exact name → exact code → fuzzy/partial name via the existing `fuzzyMatch` util) so "Switch to Mr. Stokely" and "Switch to Mr. Stokely from Boston" both resolve — replacing four duplicated exact-match-only call sites (`/switch`, `/drop`, `/edit`, the Orb `switch_project` client action).
- Files: `components/UnifiedDashboard.tsx`, `components/AddProductModal.tsx`, `components/settings/SettingsProjects.tsx`, `components/settings/SettingsUserDetail.tsx`, `components/settings/SettingsTickets.tsx`, `components/settings/SettingsKnowledge.tsx`, `app/dashboard/print/page.tsx`, `app/settings/projects/page.tsx`, `lib/todo-types.ts` (new), `docs/ui-catalog.md`.

**6. Shared false-completion guard and name-first switch_project (v0.6.118).** Live voice testing caught Orb saying it had switched projects without calling the backing `client_action`, leaving the active project unchanged. Root cause: the false-completion-claim guard existed in the eval harness but had drifted from production. The guard now lives in one shared module (`lib/orb-model/false-claim-guard.ts`) and is tool-agnostic: unbacked completion claims for navigation/actions are blocked the same way unbacked mutation claims are. The server-side switch-project resolver now shares the fuzzy project resolver from `lib/projects.ts`, and `client_action.switch_project.target` is name-first, not code-first, matching `update_project`/`delete_project`.
- Files: `app/actions/orb-converse.ts`, `app/api/orb-eval/route.ts`, `components/UnifiedDashboard.tsx`, `docs/api-spec.yaml`, `docs/orb-voice-operator-runtime-plan.md`, `lib/orb-contract.ts`, `lib/orb-model/false-claim-guard.ts` (new), `lib/orb-prompt.ts`, `lib/projects.ts`, `scripts/eval-cases.ts`.

**7. Eval harness parity for voice rules and adaptation capability (v0.6.119).** Follow-up audit found the eval harness was missing real production voice speech-policy rules and the self-proposed behavioral adaptation capability. Those are now shared with production instead of duplicated by hand, so no re-greeting, brevity rules, filler avoidance, and adaptation proposal behavior are visible to the automated suite.
- Files: `app/actions/orb-converse.ts`, `app/api/orb-eval/route.ts`, `docs/orb-voice-operator-runtime-plan.md`, `lib/orb-prompt.ts`, `scripts/eval-cases.ts`.

**Eval suite:** 6 new/strengthened Tier 1 cases this session (`confirm-mutation-doubled-affirmation`, `upfront-permission-still-emits-creates`, `no-session-record-looks-up-before-delete`, itemization assertion added to `delete-first-action-set-resolves-by-ledger`, `switch-project-partial-name-resolves`). Full suite: **Tier 1 34/34 passed**, confirmed by Stan from the terminal.

**Process note (own mistake, corrected):** mid-session, running `rm -rf .next` three times during `tsc --noEmit` verification (to clear stale generated route-type errors after deleting the classic routes) hung Stan's live dev server and, downstream, the eval suite's first HTTP request. Diagnosed once Stan reported the hang; fixed by Stan restarting the dev server (its own script already does `rm -rf .next && next dev ...`). Saved as `feedback_next_cache_live_server` — never delete `.next` directly again; only tell Stan to, paired with a restart.

**Verification:**
- `npx tsc --noEmit` passed (clean, 0 errors) at every stage.
- Focused ESLint on touched files: 0 errors throughout; only pre-existing warnings.
- Full-repo `eslint .`: 8 errors, all pre-existing in `app/prototype/voice/page.tsx` and `components/settings/SettingsCrudList.tsx` — neither touched this session.
- `node scripts/verify-ui-catalog.js` passed.
- `git diff --check` clean except one pre-existing Markdown line-break convention (double trailing space, used 21× elsewhere in `docs/ui-catalog.md`) that was matched, not introduced.
- **`npm run eval:t1` — Tier 1 34/34 passed** (run by Stan from the terminal). One case (`bulk-delete-project-todos-calls-tools`) failed on the full run — diagnosed as a one-off model past-tense phrasing slip against the eval harness's single-shot completion-claim guard (not a code regression; production has a multi-turn retry the eval harness lacks) — confirmed by isolated re-run passing 1/1.
- No device/browser testing performed this session (server-side/prompt work + non-interactive UI removal); Stan should spot-check voice on iPhone/iPad for the speak-once behavior and confirm the project-code-free UI reads correctly on all three platforms.

**Loose end resolved in v0.6.118:** `client_action`'s `switch_project.target` is now documented and prompted as a project name, not a project code, consistent with `update_project`/`delete_project`.

---

### Prior Session: Voice Operator Runtime + ORB-299 Closure — 2026-06-30 (Codex, GPT-5) — v0.6.106–v0.6.112

Stan's directive evolved from fixing iPhone/iPad voice bugs into a product-level voice pivot: Orb voice should be an **operator for the dashboard**, not a screen reader for a complex task interface. Voice carries intent, compact confirmations, concise outcomes, and short summaries; the transcript/UI carries exact target sets, long analysis, and inspection detail.

**What changed:**
- Removed automatic initial backlog summaries. Text and voice now start with a greeting and wait for the user to ask for project state.
- Prevented voice mode from reading old transcript cards before the intro. Existing Orb messages are marked as display-only history before voice mode activates.
- Added `spokenText` alongside transcript `text` so voice can speak shorter operator-style responses while the screen keeps fuller answers.
- Updated the speech queue to track spoken character progress per Orb response, queue only new completed segments, avoid final-response replay, recover from shortened derived spoken text, and hand the mic back after the final spoken turn.
- Removed the dashboard-level "Ready" recovery timer from the voice path; mic handoff is owned by the voice runtime/queue.
- Hardened iPhone/iPad recognition handling with duplicate-start guards and rapid empty start/end loop protection.
- Kept API TTS failures visible instead of silently falling back to a browser voice.
- Added concise bulk confirmation speech that points to the transcript for exact todos/items.
- Repositioned the voice Orb as a featured top-right presence, reduced it slightly, added visual `Gathering data...`, and added an indeterminate progress bar.
- Created `docs/orb-voice-operator-runtime-plan.md` and updated `docs/ui-catalog.md` for the new voice placement/state pattern.
- Added eval case `greeting-no-automatic-summary`.
- Fixed the eval endpoint so frozen backlog fixture cases can use fixture-only project codes without depending on the live database containing that project.

**Tracking:**
- Closed **ORB-299 — Voice and todo action transaction reliability release** with server-verified `closed_at`.
- Added linked knowledge entry `Voice operator runtime and ORB-299 closure` (`0586b02c-5268-4d4a-afee-0485e468aca3`).
- Related prior knowledge `Voice and todo action transaction reliability release state` (`467d7b95-e319-4419-9c5e-6e2666c8c4aa`) remains true as the pre-operator action transaction/speech channel state; the new entry extends it rather than superseding it.

**Verification:**
- `npx tsc --noEmit` passed.
- Focused ESLint passed with existing warnings only.
- `node scripts/verify-ui-catalog.js` passed.
- `git diff --check` passed.
- `npm run build` passed.
- Manual iPad/iPhone localhost testing improved markedly after the operator pivot. Production real-device testing remains the next meaningful check because voice behavior can differ after deploy.

### Prior Session: Object Capability Matrix — Systematic CRUD/Surface Audit — 2026-06-30 (Claude Code, Sonnet 5)

**Object Capability Matrix — Systematic CRUD/Surface Audit — 2026-06-30 (Claude Code, Sonnet 5)**

Stan's directive: stop discovering capability gaps (e.g. Tickets having create-only Orb access) piecemeal — build a systematic, living audit across every domain object and every surface, plus a separate cross-cutting performance/flow matrix, since speed problems (e.g. login latency) need the same systematic treatment, not one-off fixes.

**What changed:**
- Created `docs/object-capability-matrix.md` — two-part matrix:
  - **Part 1:** all 11 domain objects (`todos`, `projects`, `knowledge_repo`, `tickets`, `audit_log`, `categories`, `groups`, `statuses`, `priorities`, `invitations`, `users`) audited across DB table, Orb tool CRUD, `query_db` fallback, REST API, Settings UI CRUD (verified against actual `onEdit`/`onDelete`/`onCreate` handlers in each Settings component, not assumed), Print, Help, and Test coverage.
  - **Part 2:** Flow/Performance matrix for cross-cutting critical paths (login/auth, dashboard load, project switch, settings loads, voice start, todo CRUD round-trip) — none currently instrumented.
- Added **"Object Capability Matrix — Maintenance Rule"** section to AGENTS.md (modeled on the existing UI Catalog / Eval Suite rules): any new table/tool/endpoint/page/flow must update the matrix in the same change; blank cells must be confirmed with Stan, not assumed.
- Filed four ORB todos for confirmed gaps:
  - **ORB-301** — Add a read tool for projects (`query_projects`)
  - **ORB-302** — Add update/delete tools for `knowledge_repo` entries
  - **ORB-303** — Add read/update/delete tools for tickets (sharpest gap — create-only today)
  - **ORB-304** — Systematic time-to-interactive instrumentation across critical flows (login flagged as the first known case; reframed from an initial one-off "fix login speed" todo after Stan caught the piecemeal framing mid-session)
- **Confirmed with Stan:** `statuses`/`priorities` are deliberately fixed/unmanaged (no Orb tool, no Settings page) — not a gap. Matrix records this as confirmed, not open.
- **Key findings surfaced:**
  - REST API (`docs/api-spec.yaml`) covers only `/api/tasks` — no project/knowledge/ticket/audit endpoints exist for external agents at all.
  - The only test coverage anywhere in the repo is the Orb eval suite (Tier 1/2), scoped to conversational tool-calling only — Settings UI, REST, and every non-conversational surface has zero automated test coverage.
  - Knowledge Repo's Settings UI (full CRUD) exceeds its Orb tool surface (create+read only) — an inverse gap worth noting alongside ORB-302.

No version bump — documentation/process work only, no user-facing app change this session.

**Tracking:** No knowledge_repo entry written yet for this session (the matrix doc itself is the artifact). Consider adding a short knowledge entry on close if this work is later closed against a todo.

### Key Lesson (this session)

When a reported problem (a missing tool, a slow flow) looks like a one-off, treat it as a signal to audit the whole category, not a ticket to patch the single instance. Caught live this session: an initial "fix login speed" todo was rewritten into ORB-304 (systematic instrumentation) after Stan pointed out it repeated the exact piecemeal pattern the matrix work exists to prevent. Saved to memory as `project_systematic_quality_audits` and `project_app_generator_vision` (Orb as a deliberate learning ground toward a future app-generator tool — context for why this kind of systemic work matters beyond Orb itself).

---

### Prior Session: Release Coherency + Manual Update Recovery — 2026-06-30 (Codex, GPT-5) — v0.6.104

Stan's directive: fix the broader release/update problem that affects both development and production. Users should never have to clear browser data, switch tabs, or guess whether the app silently changed under them after a deploy or local dev-server restart.

**Core contract:** Orb may detect that a newer server version or restarted local dev process exists, but it must not present itself as running that new state until the user explicitly applies the update/reconnect.

**What changed:**
- **Next 16 build warning cleanup:** follow-up v0.6.105 migrated `middleware.ts` to `proxy.ts`/`proxy()` and aligned `outputFileTracingRoot` with `turbopack.root` using `process.cwd()`, removing the production build warnings Stan saw after v0.6.104.
- **Central release coordinator:** `SystemStateProvider` owns server/client version state, polls `/api/version` while visible, and exposes one `applyUpdate` path for visible and conversational update actions.
- **Pinned running client version:** the mounted app shell pins `clientVersion` once. Version labels, Settings update checks, and What's New use that pinned value so Fast Refresh/HMR cannot make the app look upgraded before approval.
- **Production update detection:** production can only show the update banner for a real server/client version mismatch. `/api/version` returns `serverBootId: null` outside development.
- **Development restart detection:** local Next/Turbopack restarts are detected with a development-only `serverBootId`. The banner says `Dev only: reconnect to the restarted local server` and the button says `Reconnect`, avoiding production-style update language.
- **Manual-only apply:** automatic reload was removed after mobile testing showed it undermines trust. The app detects automatically, but reloads only when the user taps Update/Reconnect or explicitly applies an update.
- **Scoped state clearing:** `applyUpdate` clears only version-sensitive session state (`todos_orb_input`, `todos_orb_conversation`, `todos_orb_action_sets`) and preserves auth, durable settings, voice preferences, and layout preferences.
- **Push-only service worker lifecycle:** `public/sw.js` now uses `skipWaiting`/`clients.claim` while still avoiding any fetch handler or app asset cache.
- **What's New coherency:** Settings filters the changelog to the pinned running version, labels it `Installed`, and does not present newer release entries as installed before approval.
- **Dev-channel hardening:** the admin developer-channel poll pauses during update/restart recovery and on stale server-action response errors so it does not fire server actions into a rebooting dev server.

**Tracking todo and knowledge:**
- Closed **ORB-300 — Release coherency and automatic update recovery** with server-verified `closed_at`.
- Added linked knowledge entry `Release coherency and manual update recovery contract` (`6d3e884c-0b15-4934-86cf-aa88e5910ce4`).
- Checked related knowledge. `Helm version update system — update banner, changelog, What's New sheet, and SW dev guard` is adjacent prior art, not superseded.

### Changes in this commit (v0.6.99–v0.6.105)

Key files:
- `components/SystemStateProvider.tsx` — release coordinator, pinned client version, update reason, manual apply path, scoped session clearing.
- `app/api/version/route.ts` — no-store version endpoint now includes development-only `serverBootId`.
- `components/UpdateBanner.tsx` — reason-specific copy for real version updates vs dev-only reconnects.
- `components/ui/OrbVersionLabel.tsx` — displays pinned running client version.
- `components/settings/SettingsWhatsNew.tsx` — filters changelog to the installed/running version and uses the shared manual update path.
- `components/UnifiedDashboard.tsx` — conversational check/apply update actions use the release coordinator; dev-channel polling backs off during restart recovery.
- `public/sw.js` — push-only service worker lifecycle update.
- `middleware.ts` → `proxy.ts`, `next.config.ts` — Next 16 proxy convention and aligned build roots.
- `lib/changelog.ts`, `lib/version.ts`, `package.json` — release entries and version bump through v0.6.105.

### Verification Status

- `npx tsc --noEmit` passed.
- Focused ESLint on touched files passed with only existing `UnifiedDashboard` warnings.
- `git diff --check` passed.
- `npm run build` passed after v0.6.105 cleanup; the prior `outputFileTracingRoot`/`turbopack.root` and `middleware` deprecation warnings no longer appeared.
- Manual local testing on iPad/iPhone confirmed: update/reconnect waits for user action, version stamp stays pinned before approval, and dev-only reconnect copy is clear.
- Production verification is next after push. Production should exercise only the version-mismatch path, never the dev-only server-restart path.

### Known Issues / Watch

1. **Production verification pending:** after deploy, test old open tabs on Mac/iPad/iPhone. Expected: banner appears for server/client version mismatch, version stamp remains old until Update is tapped, then reload shows v0.6.105.
2. **Voice production still needs retest:** earlier iPhone voice symptoms may have been affected by stale release state. Retest voice after production release coherency is live.
3. **Full project lint still has unrelated historical errors:** focused lint on touched files is clean, but full `npm run lint` still fails in unrelated prototype/settings files.

### Key Lessons

1. **Detecting an update is not applying an update.** The UI must distinguish “new state exists” from “this app is running new state.”
2. **Running version is a client-shell fact.** Pin it at mount; do not let server version or HMR module replacement rewrite the user's visible installed version before consent.
3. **Development recovery needs development language.** A local dev-server restart is not a production release. Label it as dev-only reconnect so the mechanism builds trust instead of confusion.
4. **Manual consent beats clever auto-reload.** Especially on mobile, silent recovery can feel like the app changed behind the user's back.

---

### Not started

- **ORB-292:** Design user-facing Value/Balanced/Deep Thinking modes, per-user allowances, and consent-based Orb tuning proposals.
- **ORB-287:** Investigate dashboard background polling overhead.
- **ORB-254 remaining:** Blank User columns when filtering by date.

---

### Prior Session Context

**Voice + Todo Action Transaction Release — 2026-06-29 (Codex, GPT-5) — v0.6.97**

v0.6.77–v0.6.97: unified voice speech channel, no silent TTS fallback, deterministic todo action transactions shared by text/voice, session action-set ledger, grouped summaries, concise voice project state, commitment integrity, and eval coverage. Created ORB-299 to continue failure/warning-path work.

**CRUD Reliability — Name-First Context + structural gate — 2026-06-27 (Claude Code, Opus 4.6)**

v0.6.73–v0.6.75: removed regex approval gate, name-first AI context, capability detection, voice structural fixes, first structural mutation gate (now superseded by the propose/confirm/execute flow above).

**Voice mode production fixes — 2026-06-26**

v0.6.67–v0.6.71: silent TTS fix, build gate for TTS keys, iPhone AudioContext volume, selected voice DB load, delete-project loop, duplicate voice race, fader slider.

---

## Key Decisions

- **Name-first context.** The AI's backlog, scope text, observations, and all project references use project NAME as the primary identifier. Code is shown as metadata `[code: XXX]` for tool calls only. Users never interact with codes.
- **Project code is internal-only, purely for composing todo codes (v0.6.117).** Code has exactly one job: prefixing todo codes like `ORB-73`. It is never a second user-facing label (removed from every list/table/picker/print surface that showed it) and never user-editable (removed from every create/edit form; `createProject`/`updateProject` auto-generate it from the name). Project references — typed, spoken, or model-driven — resolve by exact name → exact code → fuzzy/partial name (`resolveProjectByReference` in `UnifiedDashboard.tsx`), so a short or partial name always works.
- **Structural mutation gate replaces prompt-only gating.** CRUD tools are held server-side until user confirms. The AI calls the tool immediately, the server holds, the user confirms, the server executes.
- **Prompt aligns with gate.** The mutation prompt says "always call the tool immediately — the server handles confirmation." No conflict between prompt-layer and gate-layer expectations.
- **Project name is the user's identifier.** Tool params for `delete_project` and `update_project` accept `name`, not `project_code`. Handlers look up by name. Code is immutable, auto-generated, internal. (Known inconsistency: `client_action`'s `switch_project.target` is still documented as "Project code" — not yet reconciled to the name-first convention; see loose end in the v0.6.117 session notes above.)
- **Identifier provenance is a general rule, not a per-tool patch (v0.6.115).** Task/project codes may only be used if they came from something actually seen this conversation — backlog, tool result, or the user's words. Never constructed by pattern, never remembered across a cleared session. Enforced at three layers: a prompt law, a record-state-transparency note on empty history, and a structural server-side gate that rejects mutations targeting unseen codes.
- **Voice speaks once per turn, after the response completes (v0.6.113).** Voice does not chase the stream — the screen shows streaming progress, voice waits for the final response and speaks a single derived summary. This is what fixed voice repeating/overlapping itself.
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

1. **Deploy and verify v0.6.138:** production is currently collecting telemetry on v0.6.137. After this push, confirm `/api/version` reports v0.6.138 and Settings -> Performance shows the new Performance Analysis panel and Production Collection Checklist.
2. **Collect broader production data for ORB-309:** gather Mac, iPad, and iPhone samples for login, dashboard, Settings navigation, AI Metrics, Performance Settings, todo CRUD, project switching, Orb submit, and voice start. Compare production against dev before optimizing.
3. **Choose the first optimization target from production evidence:** early production Mac/Chrome points to login passkey click, AI Metrics, and Performance Events filtering, but sample counts are too low for a final call.
4. **Optimize the selected bottleneck and measure before/after:** likely AI Metrics unless broader production samples point elsewhere. Keep ORB-309 open until the measured improvement is confirmed.
5. **Add deeper instrumentation primitives if needed:** reusable server-action timing helper, deeper voice listen/speak handoff timings, and any additional stage attribution required by the first optimization target.

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

`2026-07-02 — Codex (GPT-5)`

---

*Updated by AI at end of each session. Committed with session code changes.*
