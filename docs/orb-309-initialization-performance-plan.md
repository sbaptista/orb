# ORB-309 — Initialization and Interaction Performance Instrumentation Plan

**Status:** Instrumentation foundation plus first Settings analysis layer in progress; initial auth, dashboard-init, dashboard clicks, Settings navigation, AI Metrics page-load, Performance Settings, shared Settings CRUD timings, and voice-start markers are implemented for dev/prod collection.
**Created:** 2026-07-02  
**Scope:** Measure, analyze, and improve initialization and click/tap response times across the full Orb user surface in both development and production.

---

## Problem

Stan notices slow initialization during login, but login is only one example. The real problem is systemic: Orb does not currently measure user-facing latency across all major interactions, so slow paths are discovered by feel instead of evidence.

The fix should not start by optimizing one flow. First, Orb needs a low-overhead measurement system that can be turned on and off by focus area, runs in development and production, logs stage-level timings, and gives enough context to identify what is slow.

---

## Implementation Status

Completed foundation:

- `performance_events` table, indexes, RLS policies, ingestion API, and admin Settings CRUD/search/filter/detail page.
- Browser telemetry helper with focus areas, sample rate, platform/viewport context, batching, navigation start tracking, and immediate flush support for short interactions.
- Auth timings for login mount, passkey checks/clicks, OTP request, and OTP verification.
- Dashboard initialization timings for client mount and key Supabase loads.
- Settings navigation timings from sidebar/picker click to destination route.
- AI Metrics timings for table load, AI accounting load, provider reconciliation load, and full perceived page load.
- Shared `SettingsCrudList` timings for initial/search/filter/sort/pagination loads and CRUD/modal actions across Settings pages.
- First Performance Settings analysis layer: completed-event percentiles are separated from failed/stale/interrupted events, with data coverage, top bottleneck, attention rows, platform differences, and environment/platform/browser coverage surfaced above the raw latency table.

Still pending before optimization work is complete:

- Production measurement pass with focus areas enabled narrowly.
- Deeper analysis views for bottlenecks, outliers, failures/interrupted events, session/time-window filtering, and platform/browser comparison once production samples exist.
- Server-side timing helper for server actions/routes that need deeper DB/action stage attribution.
- Deeper voice listen/speak handoff timings beyond the current voice-start markers.
- Optimization of AI Metrics and Performance Settings based on measured production evidence.

## Production Collection Checklist

Production measurement requires both server-side ingestion and per-browser local recording:

1. Deploy the latest app version to production.
2. Set `ORB_PERF_TELEMETRY_ENABLED=true` in Vercel Production.
3. Redeploy if Vercel requires it for the environment variable to take effect.
4. On each Mac, iPad, or iPhone browser being tested, set **Local Browser Measurement** to **On** in Settings -> Performance.
5. Select the focus areas being measured, then run the target flows.
6. Confirm rows appear in `performance_events` with `environment = 'production'`.

---

## Existing Context

`docs/object-capability-matrix.md` already tracks this as the flow-performance class:

- **ORB-304** — Systematic time-to-interactive instrumentation across critical flows.
- **ORB-309** — Improve Initialization Speed, created to make the scope explicit: measure everything the user can click, then optimize based on results.

Relevant Knowledge Repo lessons:

- `Eliminate Client-Side Data Fetching Waterfalls with Server-Side Prefetch`: move initial data to server props where possible, avoid client mount waterfalls.
- `Server-rendered pages with many queries need Suspense streaming and lazy tab mounting`: show the default view early; lazy-load hidden tabs/sections.
- `Vercel Function Bundling: Module-Scope SDK Initialization Can Crash Unrelated Server Actions`: avoid heavy or fragile module-scope initialization in server-action import graphs.
- Voice latency entries: measure stage-by-stage, not just end-to-end.
- Disk I/O/index lessons: any measurement storage must avoid high write volume and new sequential-scan patterns.

---

## Current Surface Map

### Global / Shell

- `components/Providers.tsx`
  - Mounts `SystemStateProvider`, `ToastProvider`, `TooltipProvider`, `TableTuner`, and `GlobalDevPanel`.
- `components/SystemStateProvider.tsx`
  - One initial `/api/version` check supplies both reachability and system state; `/api/health` remains available for external probes but is no longer polled by the app shell.
  - Periodic version checks: 5 seconds in dev, 30 seconds in production while visible.
  - Focus/visibility/network-triggered checks.
- `proxy.ts`
  - Runs maintenance lookup with 15-second module cache.
  - Runs Supabase auth lookup and user role lookup for protected pages.

### Login / Auth

- `app/auth/login/page.tsx`
  - Initial passkey availability detection.
  - Production conditional passkey mediation background flow.
  - Email OTP submit path:
    - `checkLoginAllowed(email)` server action.
    - `supabase.auth.signInWithOtp`.
    - Router transition to `/auth/verify-otp`.
  - Passkey click path:
    - `authenticateWithPasskey`.
    - Router transition to `/dashboard`.
- `app/auth/verify-otp/page.tsx`
  - `supabase.auth.verifyOtp`.
  - Router transition to `/dashboard`.
- `app/auth/callback/route.ts`
  - Invite/token hash verification.
  - `resolveUser`.
  - Redirect to dashboard/create-account.

### Dashboard Initialization

- `app/dashboard/page.tsx`
  - Server auth check.
  - `resolveUser`.
  - `visibleProjectsQuery`.
  - Renders `UnifiedDashboard` with `initialProducts`.
- `components/UnifiedDashboard.tsx`
  - Client profile/user load.
  - Selected project restoration.
  - Priorities load.
  - Statuses load.
  - Selected-project lightweight todos for Orb state.
  - All-project todos for overall urgency.
  - Main todo list load.
  - TTS config load.
  - Admin project search list load.
  - Dev-channel poll for admins.
  - Reminder checks after todo load.
  - System health/version polling via provider.

### Dashboard Click/Tap Interactions

- Orb / voice start.
- Orb text submit.
- Stop voice / exit voice.
- Project search open and project switch.
- Add project, edit project, delete project.
- Pane toggles on desktop/mobile.
- Sort, filters, list view selector.
- Add todo, edit todo, toggle done, status change.
- Bulk mark done, bulk delete, select all, clear selection.
- Pagination / load more.
- Print.
- Global menu, settings link, help link, account link.
- Update/Reconnect banner actions.

### Settings

- `app/settings/layout.tsx`
  - Server auth check and user role/profile load.
  - Sidebar render.
- `components/settings/SettingsCrudList.tsx`
  - Centralized loader for most Settings tables.
  - Search, server search, pagination, sort, table scroll checks.
  - Add/save/delete/move/bulk delete.
  - Modal open/edit/close.
- Individual Settings pages with custom loaders/actions:
  - Tickets, Knowledge, Audit, AI, Metrics, Maintenance, Users, Invitations, Passkeys, Notifications, Account, etc.

---

## Measurement Goals

### Instrumentation Decision Gate

Every new feature or meaningful behavior change must decide whether performance instrumentation is required before implementation. The decision should be recorded in the plan or work summary.

Instrumentation is required when the change:

- adds or changes a user-clickable/tappable workflow, route transition, form submit, modal open/save/delete flow, bulk action, search/filter/sort/pagination path, voice interaction, login/auth step, or Settings page
- adds or changes initialization work on route load, dashboard mount, Settings mount, app shell/provider mount, or background startup
- adds a new server action, API route, Supabase query/RPC, model/TTS call, file/network request, or any sequential async chain that affects perceived user response
- adds platform-dependent behavior where Mac, iPad, and iPhone may differ in latency, rendering cost, touch handling, or network behavior
- touches an existing flow already listed in `docs/object-capability-matrix.md` Part 2 or this ORB-309 plan
- is reported by Stan as slow, sluggish, delayed, stuck, or slow to initialize

Instrumentation is usually not required for copy-only changes, static documentation, purely visual CSS tweaks with no new interaction or loading path, type-only refactors, or dead-code deletion. If uncertain, instrument or ask Stan before building.

### End-to-End User Timings

Each click/tap path should produce a user-facing duration:

- `input_to_visible_feedback_ms`: click/key submit to spinner/disabled state/optimistic UI.
- `input_to_first_content_ms`: click to first meaningful UI change.
- `input_to_settled_ms`: click to final settled UI state.
- `input_to_navigation_complete_ms`: click to destination visible, when navigation occurs.

### Stage Timings

Each flow should also log named stages:

- client preparation
- server action or Supabase request
- database query/RPC
- model call or TTS call, if applicable
- route transition
- render/state commit proxy point
- background follow-up work

### Context

Each event should include:

- environment: `development` or `production`
- app version
- route
- focus group
- flow name
- interaction name
- platform class: Mac / iPad / iPhone approximation
- browser and viewport
- online status
- user role
- selected project id/code when relevant
- success/failure
- failure code/message class
- correlation id for connecting client and server records

Do not log task titles, transcript text, emails, OTP codes, or free-form user input.

### Platform Dimensions

Platform differences are a primary measurement axis, not metadata trivia. Remedies may differ for Mac, iPad, and iPhone, so every timing record must preserve enough detail to split results accurately:

- platform class: `mac`, `ipad`, `iphone`, or `unknown`
- viewport width/height
- pointer class: coarse/fine
- hover capability
- browser family/version when available
- standalone/PWA mode if detectable
- network status and coarse connection hints when available

Analysis must report p50/p75/p95 by platform. A fix is not complete if it improves Mac while leaving iPhone or iPad worse, unless Stan explicitly accepts that trade-off.

---

## Proposed Architecture

### 1. Feature Toggle And Focus Areas

Add a performance telemetry gate with both server and client controls:

- Server env var: `ORB_PERF_TELEMETRY_ENABLED=true|false`.
- Optional sampling env var: `ORB_PERF_TELEMETRY_SAMPLE_RATE=0..1`.
- Optional focus env var: `ORB_PERF_TELEMETRY_FOCUS=auth,dashboard-init,dashboard-clicks,settings,voice,background`.
- Admin/dev override in localStorage through DEV panel:
  - `orb_perf_enabled=true|false`
  - `orb_perf_sample_rate`
  - `orb_perf_focus=["auth","dashboard-init","dashboard-clicks","settings","voice","background"]`
- Production default: off unless env enables it.
- Development default: off, but easy to turn on from DEV panel.

Do not make this all-or-nothing. Operators must be able to measure a narrow area without flooding the table with unrelated events. Initial focus groups:

- `auth`: login, passkey, OTP request/verify, callback, auth redirects.
- `dashboard-init`: dashboard server route and client initialization.
- `dashboard-clicks`: project/todo/list/menu/update interactions.
- `settings`: Settings page loads, CRUD, search, pagination, filters.
- `voice`: voice start, recognition, TTS config, TTS synthesis/playback, mic handoff.
- `background`: health/version polling, reminders, dev-channel polling, maintenance checks.

Every event must include its focus group so analysis can filter by the intended measurement session.

The client helper should expose:

- `isPerfTelemetryEnabled()`
- `startInteraction(name, metadata)`
- `mark(stage)`
- `end(status, metadata)`
- `measureAsync(name, fn, metadata)`

When off, helper calls must be no-ops with near-zero overhead.

### 2. Data Store

Add a new append-only table instead of overloading `audit_log` or `orb_model_requests`.

Proposed table: `public.performance_events`

Core columns:

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `environment text not null`
- `app_version text not null`
- `user_id uuid null references auth.users(id)`
- `session_id uuid null`
- `correlation_id uuid not null`
- `route text not null`
- `focus text not null`
- `flow text not null`
- `interaction text not null`
- `surface text not null`
- `platform text null`
- `browser text null`
- `viewport jsonb null`
- `duration_ms integer not null`
- `stages jsonb not null default '[]'::jsonb`
- `success boolean not null`
- `failure_code text null`
- `metadata jsonb not null default '{}'::jsonb`

Indexes:

- `(created_at desc)`
- `(environment, created_at desc)`
- `(focus, created_at desc)`
- `(flow, interaction, created_at desc)`
- `(platform, created_at desc)`
- `(user_id, created_at desc)` where `user_id is not null`
- `(correlation_id)`

Retention:

- Initial manual retention is acceptable for alpha.
- Add a follow-up cleanup policy/script once the table has real volume.

RLS:

- Service role full access.
- Admin read access.
- Authenticated insert via an API route or server action preferred; avoid direct broad client insert if the API route can sanitize fields.

### 3. Logging Path

Use a dedicated endpoint or server action:

- `POST /api/performance-events`
- Accepts batched events.
- Checks feature toggle.
- Sanitizes metadata allowlist.
- Adds trusted fields server-side where possible: user id, environment, version.
- Uses `navigator.sendBeacon` when available for unload/navigation-safe logging.
- Falls back to `fetch(..., { keepalive: true })`.

Batching:

- Client queues events in memory.
- Flush when queue reaches 10 events.
- Flush every 10 seconds while enabled.
- Flush on `visibilitychange` hidden and `pagehide`.

Do not write on every animation frame, hover, scroll, resize, or keystroke.

### 4. Server-Side Stage Measurement

Add a tiny server helper for actions/routes:

- `withServerTiming(flow, interaction, correlationId, asyncFn)`
- `markServerStage(name)`
- return stage records to the client when the interaction already has a response payload, or log server-only event when there is no client continuation.

Use this first in:

- `checkLoginAllowed`
- `devLogin`
- `app/dashboard/page.tsx` stages
- `resolveUser`
- `visibleProjectsQuery`
- `SettingsCrudList` custom loaders where server actions exist
- Orb conversation and TTS already have model/TTS latency; include their existing ids/latency in the broader interaction record instead of duplicating model records.

### 5. Settings Management Surface

Add a new admin-only Settings page for performance telemetry. This is required, not optional, because the system must be operable without editing environment variables or running ad-hoc SQL.

Use existing Settings UI patterns:

- Build the page in the Settings shell with the standard `s-page`, `s-header`, `s-card`, and `s-form` assembly where needed.
- Use `SettingsCrudList` for the `performance_events` collection.
- Use `layout: 'table'` so Mac/wide iPad get the standard Settings table and iPhone/narrow iPad get `SettingsCrudList` mobile cards.
- Use existing `TextSearchModal` and `DateSearchModal` for text and created-date filtering.
- Use server-side pagination, search, sort, and filters; performance logs must not be client-filtered after loading a huge result set.
- Use existing `PaginationController`, `SearchController`, `FilterKebab`, `EditorModal`, and action-cell patterns.
- Use platform-specific `tableColumns[].platformWidths`, `selectionColumnWidths`, and `stickyColumnsByPlatform` if the table needs tuned geometry.
- Do not create new CSS classes, modal shells, search widgets, table wrappers, or CRUD controls unless the catalog proves there is no fit. If a new UI pattern is truly necessary, ask Stan first and update `docs/ui-catalog.md` in the same change.

Required Settings capabilities:

- Full CRUD for the table:
  - create/import a manual event only if useful for testing the pipeline
  - read/list event rows
  - edit allowed metadata fields or classification fields if needed
  - delete selected rows for cleanup
  - bulk delete filtered rows, guarded by confirmation
- Search and filters:
  - text search across route, focus, flow, interaction, failure code, browser, and selected metadata fields
  - created date filter
  - environment filter
  - app version filter
  - focus group filter
  - platform filter
  - success/failure filter
- Sort:
  - created date
  - duration
  - focus
  - flow
  - interaction
  - platform
- Row details:
  - open a read-only `EditorModal` showing full stage timings and sanitized metadata.

The same page should include an operations panel using existing Settings form/card styles:

- enable/disable telemetry where runtime-configurable
- choose active focus areas
- set sample rate
- show current effective configuration for development and production

If production focus toggles cannot be changed at runtime without a deployment, the page must say so clearly and still show the effective env-driven setting.

### 6. Analysis Surface

The Settings page should also provide summary analysis, either in the first build or immediately after raw event CRUD lands:

- filter by environment
- filter by version
- filter by focus/route/flow/interaction
- filter by platform
- p50, p75, p95, max
- count and failure count
- dev vs production comparison
- Mac vs iPad vs iPhone comparison
- top slow stages
- recent slow traces

Do not overbuild charts before the first data set. A compact summary table is enough if it uses existing Settings patterns and answers the core questions.

---

## Initial Instrumentation Set

### Phase 1 — Foundations

1. Add toggle + no-op client helper.
2. Add `performance_events` table and indexes.
3. Add sanitized batch logging endpoint.
4. Add focus-area controls so a measurement session can target auth, dashboard, settings, voice, or background work.
5. Add DEV panel shortcut for local measurement sessions.
6. Add the admin-only Settings page using `SettingsCrudList`, existing search modals, server-side pagination/search/sort, mobile cards, and read-only detail modal.
7. Add minimal summary analysis on that Settings page.

### Phase 2 — Critical Initialization

Instrument:

1. Login page mount:
   - first client render
   - passkey support detection
   - conditional mediation start/end
2. Email OTP request:
   - submit click
   - `checkLoginAllowed`
   - Supabase OTP request
   - route push to verify page
3. OTP verify:
   - verify click
   - Supabase verify
   - dashboard navigation
4. Dashboard route:
   - auth user
   - `resolveUser`
   - projects query
   - server render handoff
5. Dashboard client:
   - profile load
   - selected project restore
   - priorities/statuses
   - orb todos
   - all todos
   - main list todos
   - TTS config
   - time to list visible
   - time to Orb active/calm/urgent state visible

### Phase 3 — Dashboard Click Surface

Instrument:

1. Project switch.
2. Search project modal open/select.
3. Add/edit/delete project.
4. Add/edit/toggle/status-change todo.
5. Bulk mark done/delete.
6. Sort/filter/view changes.
7. Load more/pagination.
8. Orb text submit.
9. Voice start:
   - click
   - TTS config
   - AudioContext unlock/start
   - greeting message visible
   - first audio
   - mic listening
10. Print modal open/render.
11. Update/Reconnect apply.

### Phase 4 — Settings Surface

Instrument centrally in `SettingsCrudList`:

1. initial table load
2. search submit/debounce load
3. pagination
4. sort
5. add/save/delete/move/bulk delete
6. modal open/close perceived response

Add custom instrumentation for non-CRUD settings pages:

- AI settings
- Metrics
- Maintenance
- Account/email/passkey actions
- Notifications
- Audit log

### Phase 5 — Optimize Based On Data

Only after collecting dev and production data:

1. Sort by p95 `input_to_settled_ms`.
2. Split by environment and platform.
3. Identify whether each slow path is:
   - auth/proxy
   - Supabase/network
   - server action
   - client waterfall
   - render cost
   - hidden/background work
   - model/TTS latency
4. Fix the top bottleneck class, not just the single slowest button.
5. Keep before/after comparison by version.
6. Decide remedies per platform. For example, a Mac fix may be server prefetching, while an iPhone fix may be lazy mounting, reduced initial animation/render work, or deferring background checks.

---

## Likely Early Hypotheses To Validate

These are not conclusions yet; measurement should prove or reject them.

1. Login may be slowed by sequential `checkLoginAllowed` then `signInWithOtp`.
2. Protected route navigation may pay both proxy auth/role lookup and page-level auth/profile work.
3. Dashboard client mount may issue multiple independent Supabase reads that could be batched, prefetched, or deferred.
4. `checkReminders()` runs after todo fetch and may make list loading feel longer if coupled to the same interaction.
5. Admin-only project search loading has retry delays and auto-ticket side effects that should never block first paint.
6. Settings pages likely repeat auth/profile work in layout plus table-specific loads.
7. Voice start likely needs separate timings for TTS config, audio unlock, TTS synthesis, playback start, and mic start.
8. Global health/version polling may add background noise during measurements and should be tagged separately from foreground interactions.

---

## Database Impact Analysis

This feature touches the database.

| Question | Answer |
|---|---|
| New query pattern? | Yes. Admin analysis queries by date, environment, focus, flow, interaction, platform, user, and correlation id. Add indexes up front. |
| Realtime? | No. Do not use `postgres_changes`; analysis can be pull-based. |
| Frequent writes? | Yes, if left unbounded. Mitigate with off-by-default toggle, focus areas, sampling, batching, no hover/scroll/keystroke logging, and allowlisted interactions only. |
| New table? | Yes, `performance_events`. RLS must use `(SELECT auth.uid())` wrappers. |
| New WHERE/JOIN columns? | Yes: `created_at`, `environment`, `focus`, `flow`, `interaction`, `platform`, `user_id`, `correlation_id`. Add indexes listed above. |

Before any migration, run the AGENTS database health queries. After migration, run them again and confirm no unexpected scan/bloat pattern.

---

## Acceptance Criteria

Instrumentation is complete when:

1. Performance logging can be enabled/disabled without a deploy in dev and with env/config in production.
2. Performance logging can be limited to specific focus areas.
3. With logging disabled, helper calls are no-op and do not write.
4. With logging enabled, login, dashboard initialization, dashboard clicks, voice start, and Settings CRUD produce correlated timing records.
5. Records distinguish dev from production.
6. Records preserve platform dimensions for Mac, iPad, and iPhone analysis.
7. Records include stage timing, not only total duration.
8. Sensitive user input is not stored.
9. A Settings page provides full CRUD, search, filters, server-side pagination/sort, read-only detail inspection, and summary analysis using existing Settings patterns.
10. Analysis can answer:
   - What are the slowest interactions by p95?
   - Is dev or production slower?
   - Is Mac, iPad, or iPhone slower?
   - Which stage dominates each slow flow?
   - Did a version improve or regress the flow?
11. At least one before/after optimization is made using collected data rather than guesswork.

---

## Proposed First Build Batch

If Stan approves implementation, keep the first batch deliberately small:

1. Add `performance_events` migration + indexes + RLS.
2. Add telemetry toggle/helper + batch endpoint.
3. Add focus-area controls plus DEV panel shortcut.
4. Add the new admin Settings page for event CRUD/search/filter/pagination/details using `SettingsCrudList` and existing search/detail patterns.
5. Instrument login, OTP verify, dashboard server route, and dashboard client initialization only.
6. Add first-pass summary analysis on the Settings page.
7. Collect dev and production baselines by platform before optimizing.

After the baseline is real, expand to the full click surface.
