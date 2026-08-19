# AI Metrics Orb CSV Export Plan

**Status:** Implemented locally; migration applied; live acceptance pending
**Created:** 2026-08-18 — Codex (GPT-5.6 Sol)

## 1. Objective

Add an **Export CSV** action to AI Metrics → Orb so Stan can download the
request-level data behind the AI Request Log for analysis in Excel, Numbers,
Google Sheets, or another data tool.

The export must include the platform on which each model request originated.
Orb does not currently persist that field in `orb_model_requests`, so platform
capture is a prerequisite rather than something the exporter can infer later.

The export is a read-only portability feature. It must never change AI
Settings, rate cards, request records, or provider accounting.

## 2. Recommended Scope

Export the append-only `orb_model_requests` ledger, not a mixture of unrelated
CSV sections. This ledger is the source data for the Orb tab's cost summaries,
provider/model analysis, token accounting, latency, and success/failure views.

The first version should:

- live in the **AI Request Log** heading beside Show/Hide Log;
- export every row matching the Request Log's active text and date filters,
  not only the currently visible 50-row page;
- retain the current stable `created_at DESC, id ASC` ordering;
- work even when the request log is collapsed on iPad or iPhone;
- produce a header-only CSV when no rows match, with a calm explanatory toast;
  and
- exclude rate cards, funding transactions, provider snapshots, and AI policy
  settings. Those are different schemas and should not be forced into one
  malformed CSV.

If those control-plane datasets need export later, add separately named files
or a ZIP bundle rather than multiple incompatible tables in one CSV.

## 3. Platform Capture Prerequisite

### Verified current gap

- `orb_model_requests` has no platform column.
- `OrbModelRequestRecord` and `recordOrbModelRequest` accept no platform.
- `performance_events` records platform, browser, and viewport, but those rows
  have no durable one-to-one key connecting them to a model request.
- Serial conversation requests carry `systemInfo` and an `isMobile` UI flag,
  but those are not persisted in the model ledger and cannot reliably
  distinguish every Mac/iPad/iPhone case after the fact.

Do not backfill existing rows by viewport, user agent, source, or nearby
performance-event timestamps. Those would be guesses. Historical rows should
remain explicitly `unknown`.

### Data model

Add an idempotent migration:

```sql
ALTER TABLE public.orb_model_requests
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'unknown';
```

Add a check constraint allowing exactly:

```text
mac
ipad
iphone
server
unknown
```

`server` is reserved for known non-device work such as eval runs. `unknown`
covers historical records and any request whose origin was not supplied or
recognized. Do not add an index initially: the first export selects this field
but does not introduce a platform `WHERE` pattern.

### One client-environment owner

Platform capture must not be implemented as a model-ledger detector beside the
performance detector. Extract the existing performance telemetry logic into a
single client-safe module, for example `lib/client-environment.ts`, owning:

```text
ClientEnvironmentSnapshot
  platform: mac | ipad | iphone | unknown
  browser
  viewport: width, height, dpr, pointer, hover, standalone
```

Expose one `collectClientEnvironment()` function. Performance telemetry and
model-request callers must both consume that same snapshot/type; neither may
retain a private platform classifier or reinterpret viewport/user-agent data.
The model ledger initially persists only `snapshot.platform`, while
performance telemetry continues to persist the complete snapshot.

This extraction, the model-ledger migration, and both consumer updates are one
atomic implementation change. Do not land or release platform capture for the
model ledger unless performance telemetry has moved to the shared collector in
the same change and its existing Mac/iPad/iPhone behavior remains verified.

### Model-request propagation

Propagate the validated platform through every request-ledger entry point:

- serial Operational and Strategic conversation;
- Realtime usage reports;
- speech-to-text uploads;
- OpenAI TTS synthesis; and
- eval/strategic-eval recording, explicitly stamped `server`.

The shared ledger writer must validate the enum again before insertion. Client
input is never written to the database unchecked. Server-originated eval work
uses a deliberate `server` value at the ledger boundary; it does not pass
through or fork the client detector.

Add Platform to the visible AI Request Log and its text-search fields so the
CSV does not expose an important dimension that the UI cannot inspect.

## 4. CSV Contract

Recommended columns, in stable order:

```text
request_id
created_at_utc
provider
model
source
route_role
platform
success
failure_code
attempt_count
latency_ms
input_tokens
output_tokens
cached_input_tokens
cache_write_tokens
reasoning_tokens
total_tokens
client_tool_calls
estimated_cost_usd
rate_version
rate_effective_date
rate_input_per_million
rate_output_per_million
rate_cached_input_per_million
rate_cache_write_per_million
correlation_id
evaluation_case_id
prompt_version
context_packet_version
```

Rules:

- timestamps remain ISO-8601 UTC so the file is unambiguous across Mac, iPad,
  iPhone, Excel, and Google Sheets;
- token counts remain integers and cost/rate values remain unformatted decimal
  numbers, never localized currency strings;
- null values become empty cells, while `success` remains explicit `true` or
  `false`;
- flatten the immutable `rate_snapshot` into columns instead of putting JSON
  in a cell;
- use RFC 4180-style quoting, CRLF rows, and a UTF-8 BOM for Excel/Numbers
  compatibility; and
- neutralize text cells beginning with `=`, `+`, `-`, or `@` so CSV content
  cannot become a spreadsheet formula.

Deliberately exclude `user_id`, `response_text`, and raw `provider_usage`.
Those fields are not needed for cost analysis and could expose user content or
provider payload details. Request and correlation IDs remain included because
they are required to trace an exported row back to eval/run evidence.

## 5. Server Design

Add an admin-only dynamic Route Handler, for example:

```text
GET /api/settings/ai-metrics/export
```

Accepted query parameters mirror the existing Request Log controls:

- `search`
- `createdFrom`
- `createdTo`
- `createdBefore`

Implementation rules:

1. Authenticate and authorize with the same admin boundary used by
   `getAiRequestLog`; do not rely on the page being hidden from non-admins.
2. Extract shared filter parsing/sanitization from `get-ai-request-log.ts` so
   the table and export cannot drift semantically.
3. Select only the explicit export columns; never use `select('*')`.
4. Read in bounded keyset pages ordered by `(created_at DESC, id ASC)` rather
   than one unbounded response or offset pagination.
5. Stream CSV rows through a `ReadableStream` with `Content-Type:
   text/csv; charset=utf-8`, `Content-Disposition: attachment`, and
   `Cache-Control: private, no-store`.
6. Use a deterministic filename such as
   `orb-ai-metrics-2026-08-18.csv`; when a date filter is active, include the
   range in the filename when it remains reasonably short.
7. Apply a documented high safety ceiling (recommended: 100,000 rows). If the
   matching set exceeds it, stop with a clear message asking for a narrower
   date filter rather than silently truncating the file.

The export itself is read-only. The only migration is the additive platform
column and constraint described above; no existing request record is rewritten.

## 6. Client Interaction

In `SettingsMetrics.tsx`:

- add **Export CSV** beside Show/Hide Log using the existing button/action-row
  grammar;
- pass the current Request Log search/date filters to the route;
- show `Exporting…` and disable repeat taps while the request starts;
- on browsers with the File System Access API, open the native save picker
  from the user's tap and stream the response into the chosen file;
- on Safari/iPad/iPhone, use the bounded response as a Blob and fall back to
  the standard download link used elsewhere in Orb;
- on success, use the filename supplied by the server and report the exported
  row count;
- on failure, show the existing calm error toast; and
- keep a minimum 44pt touch target on iPad and iPhone.

The export should not open a new modal. Its scope is already visible through
the Request Log filters, and a modal would add ceremony without adding a
decision.

**UI family:** reuse `metrics-request-log-heading`, `flex-row`, `gap-md`, and
the existing `btn-outline` / `btn-primary` button family. No new CSS prefix or
parallel component family is planned. Update `docs/ui-catalog.md` only to
document the new behavior on the existing family.

## 7. Performance and Database Impact

Performance instrumentation is required because this adds a user-triggered
network/download workflow.

- Add a `settings` focus-area interaction named `request_log_export_csv`.
- Record whether text/date filters were active, returned row count, generated
  byte count, duration, success/failure, and whether the safety ceiling was
  reached. Do not record the search text itself.
- Keep CSV formatting server-side so large datasets do not block the browser's
  main thread.
- The query reuses the Request Log's existing filter pattern and the indexed
  `created_at` cursor path. It adds no Realtime subscription, new table,
  frequent write, or background work beyond one small enum value on each
  existing request-ledger insert.
- The new `platform` column is returned and searched with the existing request
  ledger. Do not add a platform index until a dedicated platform filter or a
  measured query plan justifies it.
- Before implementation, verify the query plan for an all-time export and a
  date-bounded export. Text search uses multi-column `ILIKE` and may scan; do
  not add a speculative index unless measured export evidence shows it is
  needed.
- Update Part 2 of `docs/object-capability-matrix.md` to record export timing
  coverage on the existing Settings page flow.

## 8. Verification

### Deterministic checks

- commas, quotes, CR/LF, Unicode, and empty values round-trip correctly;
- formula-leading cells are neutralized;
- numeric precision is preserved without locale formatting;
- flattened rate snapshots produce the documented columns;
- Mac, iPad, and iPhone requests persist their exact platform classification;
- eval requests persist `server`, while pre-migration rows remain `unknown`;
- invalid client platform values are stored as `unknown`, never verbatim;
- a model request and performance event emitted from the same device snapshot
  report the same platform, browser, and viewport source data;
- no second platform-classification function remains in the model-request or
  performance paths;
- CSV headers stay stable even for zero rows;
- text/date filters return the same IDs as the Request Log;
- export includes more than one page when more than 50 rows match;
- cursor boundaries neither duplicate nor skip rows with identical timestamps;
- the safety ceiling fails loudly without returning a partial file; and
- non-admin and unauthenticated requests are rejected.

### Live acceptance

- Mac: download all rows, a date range, a search result, and an empty result;
- iPad and iPhone: the action remains reachable with a 44pt target and the
  downloaded CSV can be opened or shared;
- open the result in Numbers or Excel and confirm column alignment, timestamps,
  formulas, Unicode, and decimal cost values;
- compare exported row count and several request IDs against the visible log;
- make one real request from Mac, iPad, and iPhone and compare each visible
  Platform value with its exported row;
  and
- inspect Settings performance telemetry for a small and a large export.

## 9. Release Gate

- `npx tsc --noEmit`
- focused ESLint for changed files
- UI catalog verification
- authenticated Mac/iPad/iPhone acceptance
- no Orb model eval: this changes no conversational tool, routing rule, prompt,
  or defined speech behavior

Record: `Eval: not applicable — no conversation surface changed`.

## 10. Build Sequence

1. In one atomic change, extract the single client-environment collector,
   migrate performance telemetry to it, add the platform column, and propagate
   the same snapshot value through every model-request ledger path. Verify
   database health before/after the migration and verify performance telemetry
   has not drifted.
2. Add Platform to the Request Log read/search/table surface.
3. Extract shared Request Log filter parsing and query construction.
4. Add the pure CSV escaping/row formatter and deterministic checks.
5. Add the authenticated, non-cached streaming export Route Handler.
6. Add the catalogued Export CSV action and download/error states.
7. Add focused Settings performance instrumentation.
8. Update `docs/ui-catalog.md` and `docs/object-capability-matrix.md`.
9. Run deterministic and static verification, then complete live
   Mac/iPad/iPhone acceptance before release bookkeeping.

## 11. Local Implementation Record

Implemented 2026-08-18 after Stan's approval:

- `lib/client-environment.ts` now owns the only Mac/iPad/iPhone classifier and
  the complete browser/viewport snapshot used by performance telemetry.
- Every browser-originated request-ledger path supplies platform from that
  collector; eval rows deliberately use `server`; the ledger writer maps any
  malformed value to `unknown`.
- `20260818_model_request_platform.sql` adds the constrained, defaulted ledger
  column without guessing historical device values.
- AI Request Log reads, searches, displays, and exports Platform.
- The admin-only export route shares the log's filter parser, preflights the
  100,000-row ceiling, uses bounded keyset pages, and streams a 29-column CSV
  without `user_id`, `response_text`, or `provider_usage`.
- The existing Request Log heading now assembles `btn-outline` Export CSV and
  `btn-primary` Show/Hide Log controls; no new UI class or modal was added.
- `request_log_export_csv` measures filters-present flags, rows, bytes,
  duration, cancellation, ceiling rejection, and ordinary failure without
  recording filter text.
- Deterministic CSV/platform verification, TypeScript, and focused ESLint pass
  locally. Stan applied the platform migration successfully on 2026-08-18;
  Mac/iPad/iPhone acceptance remains pending his localhost test.

Stan will create the one encompassing Knowledge Repository entry after the
whole job is complete; no agent-side Knowledge write was attempted.
