# Per-todo due time, timezone, and reminders

**Status:** Plan drafted 2026-07-24; all open questions settled with Stan same day. **NOT yet approved for build.** No code written.
**Todo:** **ORB-361** (`2edec224-6988-4f48-814c-243ec09886f0`), filed 2026-07-26, P3 — one todo for the whole plan, per Stan. ORB-360 remains separate as the Phase 0 prerequisite.
**Origin:** grew out of ORB-360 ("Unclear which time zone Orb uses for urgency threshold reports") during design discussion with Stan on 2026-07-24. Larger than ORB-360 and partly supersedes it — see §11.

---

## The idea in one line

A due date is an event in the world, so it carries its own timezone; a reminder is an act of planning, so it must never itself create urgency; and urgency is how much runway is left, which is neither of those.

---

## Decisions taken (Stan, 2026-07-24)

| # | Decision |
|---|---|
| 1 | **Timezone moves to the todo.** Each dated todo stores the zone its due time is expressed in. |
| 2 | **Captured at creation from wherever the user is.** Create a todo in Vancouver, it's a Vancouver todo. Always changeable afterwards. |
| 3 | **Displayed in the origin zone.** An October Vancouver todo still reads as Vancouver time when viewed from Honolulu in November. |
| 4 | **Reminder replaces the global urgency threshold.** Per todo, opt-in, blank means no reminder. `Settings → Urgency Threshold` is deleted, not rebuilt. |
| 5 | **A reminder never changes the orb's mood.** It fires, it informs, the mood is untouched — at any distance. |
| 6 | **Urgency is derived from runway**, not from the reminder. |
| 7 | **City-name picker**, Apple Reminders style — not an IANA dropdown. |

### The reasoning behind #5, because it inverted an earlier proposal

An earlier draft had "inside its own reminder window → orb goes urgent." Stan rejected it with the decisive case: *"The point of the early milestones was so that I didn't feel a sense of urgency."* Under that rule, a three-week lead time means three weeks of red — **the better you plan, the longer the orb screams**, which trains you to set reminders later to keep it quiet. Exactly backwards.

So a reminder is an **anti-urgency device**: placed early precisely so the thing is handled while it is still calm. It is a notification, not a state.

### Supporting evidence: the orb's due-date urgency path has never fired

Measured live, 2026-07-24 (wording corrected per Stan — urgent is *reachable* any time by setting a todo's priority to Urgent; it just happens that none are set):
- **Zero** active todos carry the Urgent priority right now.
- **All 9** todos with a due date are **closed** — every one, out of 433 total.

So in practice the only live branch of `computeUrgency` has been `active.length > 5`, and the orb has sat at `busy`. The due-date branch — the one this plan redesigns — has never fired in real use, which is why the "when does a deadline become urgency" question was still open.

---

## 1. Three independent concepts

Today all three are entangled in one global integer, `users.urgency_threshold_hours`.

| Concept | Question it answers | Lives on | Affects mood? |
|---|---|---|---|
| **Due time + zone** | *When is this due, in the world?* | the todo | — |
| **Reminder** | *When do you want to be told?* | the todo, optional | **No** |
| **Urgency** | *How much runway is left?* | derived | Yes |

Because urgency is *derived*, the user never sets two time values per todo. They set a due date and optionally a reminder. That's it.

---

## 2. Data model

### 2.1 Changes

| Change | Rationale |
|---|---|
| `todos.due_at` → **`timestamptz`** | Store an absolute instant. This is what makes ORB-360's bug class *impossible* rather than merely fixed: with an instant there is nothing left to interpret, so no consumer can disagree. Also makes `ORDER BY due_at` correct across zones, which it is not today. |
| **new** `todos.due_timezone text NULL` | The IANA zone the due time was expressed in. Set only when `due_at` is set. Drives display and editing. |
| **new** `todos.reminder_lead_value smallint NULL` + `todos.reminder_lead_unit text NULL` | The reminder lead as a **value + unit pair** (`CHECK` value between 0 and 99, unit in `('minutes','hours','days','weeks','months')`, both null or both set). **`NULL` = no reminder**; **value `0` = at due time** — distinguishing those two is deliberate; the old setting conflated them. A pair rather than a flat minute count because Stan's Custom option includes **months**, which have no fixed minute length: "3 months before" must be computed by calendar arithmetic against the due date in `due_timezone`, and must *stay* "3 months before" if the due date moves. The preset dropdown options are just sugar over these same two fields. |
| `todos.reminded_at` | **Already exists** (`timestamptz`), already cleared on due-date change at [`TodoEditor.tsx:192`](../components/TodoEditor.tsx). Reused as-is — the dedup mechanism is already built. |
| `users.urgency_threshold_hours` | **Dropped** — but in a *follow-up* migration after the release is verified in production, so a rollback never needs a column restored. |
| `users.timezone` | **Kept and repurposed** — see §4.2. Not a user-facing setting. |

### 2.2 Migration

Trivially small: **9 rows carry a due date and all 9 are closed.** Their exact instants are inconsequential, so they are interpreted as `Pacific/Honolulu` (Stan created all of them) and stamped with that `due_timezone`. Migration aborts if it finds a dated row it cannot attribute.

### 2.3 Database impact analysis (per AGENTS.md)

| Question | Answer |
|---|---|
| New query pattern? | **No.** [`reminders.ts`](../lib/reminders.ts) already filters `due_at IS NOT NULL AND reminded_at IS NULL AND status IN (...)`. The predicate shape is unchanged; only the column type is. |
| New index needed? | **Not yet.** 433 rows total, 9 dated — a sequential scan is correct here and an index would be cargo cult. **Trigger point:** add `CREATE INDEX idx_todos_due_at_pending ON todos (due_at) WHERE deleted_at IS NULL AND reminded_at IS NULL` once dated todos pass ~1,000, or if the sequential-scan audit shows `todos.seq_tup_read` climbing. |
| Realtime / `postgres_changes`? | **No.** None added. |
| High-frequency writes? | **No.** One write per todo save; one `reminded_at` stamp per reminder sent. |
| New table? | **No.** |
| RLS? | No new table, so no new policy. Existing `todos` policies cover the new columns. |
| Type change risk | `timestamp` → `timestamptz` rewrites the table. At 433 rows this is instant. Run inside the transaction with the backfill. |

Per the periodic-health rule, the canonical inspection queries (sequential scan, dead rows, RLS initplan) run **before and after** this migration.

---

## 3. Urgency derivation

Replaces the global threshold entirely. Layers onto the existing mood logic rather than replacing it.

> **`urgent`** — any active todo has an `is_urgent` priority, **or is past due**, **or is within its imminent window**.
> **`busy`** — any active todo is within its runway window, **or** more than 5 active todos (existing behaviour, unchanged).
> **`calm`** — otherwise.

"Past due" is unconditional and load-bearing: it means a todo with **no** reminder can never blind the orb. Blank reminders are safe.

The windows are **derived from priority**, so no new field is needed — the user already tells Orb how much a thing matters:

| Priority | Runway → `busy` | Imminent → `urgent` |
|---|---|---|
| 1 Urgent | *(already urgent by flag)* | — |
| 2 High | 3 days | 24 hours |
| 3 Medium | 24 hours | 4 hours |
| 4 Low / none | 8 hours | at due time |

**Accepted as defaults by Stan (2026-07-24)** — chosen so `urgent` stays late and rare — with one addition: **the windows are admin-settable per project.**

### Per-project window overrides

- **Storage:** `projects.urgency_windows jsonb NULL` — `NULL` means "use the defaults above." Shape: `{ "2": { "runway_hours": 72, "imminent_hours": 24 }, "3": {...}, "4": {...} }`, keyed by priority value, validated server-side on write (no client-trusted JSON). A jsonb column rather than a child table because it is read only alongside the project row the app already fetches, is never queried by its contents, and needs no index — per the design-time DB checklist this adds no new query pattern.
- **UI (placement chosen by Stan, 2026-07-24):** a new button in the unified dashboard's list toolbar, beside **Sort / Filters / View / +New** — deliberately close to the orb whose color these windows govern, so cause and control share a screen. It edits the **currently selected project's** windows (the dashboard already carries that context), opening a modal from the cataloged modal family with `pf-select`/`pf-field` inside. On iPhone, if toolbar space is tight, it folds into the Commands modal the same way + Project already does. No new CSS family — existing toolbar-button and modal patterns only.
- **Permissions (corrected by Stan, 2026-07-24 — not admin-only):** the **project owner** sets the windows for their own projects; admins can set them for any project. This mirrors the app's existing ownership model (non-admins see only their own projects anyway). It is also obligatory, not optional: the deleted Settings → Urgency page was available to every user, so an admin-only replacement would mean non-admins *lost* control in the redesign. The write goes through a server action that validates both the JSON shape and ownership — never a client-trusted update.
- **Defaults-first presentation:** most users will never touch this and should never need to — `NULL` = defaults costs nothing and configures nothing. The modal opens showing the effective values with a visible "Using defaults" state and a one-tap **Reset to defaults** (which writes `NULL`, not a copy of the default numbers — so future default changes flow through to projects that never customized).
- **Resolution order:** todo's project override → global defaults. No per-user layer.

### Help section overhaul

The Help entry for the orb's moods changes from fixed definitions to an **overview with samples** of how the windows might be set per project:
- A **small icon of the orb in each state** (calm / busy / urgent) next to each description — reusing the existing orb visual treatment (production colors/animations per the ORB-325 decision, static or minimal versions for Help). If this needs a new small-orb class, that is a catalog addition and gets proposed to Stan before creation, per protocol.
- An explicit note that the user can **ask Orb why the ambient mood shifted** — see the capability below.

### New conversational capability: "why is the orb busy/urgent?"

The Orb must be able to explain the current mood **per project**: which project, which todo(s), and which rule (urgent priority / past due / imminent window / runway window / >5 active) is driving it. The per-project urgency computation already produces this internally — the work is surfacing the *reasons* (not just the resulting mood) into the Orb's context or a read tool so the explanation is grounded rather than guessed. Guessing here would be exactly the confabulation the ORB-325 honesty rule prohibits. Eval: Tier 2 case asserting the Orb names the actual driving todo/rule; see §7.

---

## 4. Timezone

### 4.1 Capture and display

- **On create:** the client stamps `Intl.DateTimeFormat().resolvedOptions().timeZone` — the zone the user is *actually in* at that moment. A todo created on a Vancouver business trip is a Vancouver todo.
- **Always editable** in the todo editor.
- **Display in the origin zone**, with the zone abbreviation shown **only when it differs from the viewer's current zone**. Always printing "HST" on every todo while sitting in Honolulu is noise; "Oct 14, 9:00 AM PDT" while sitting in Honolulu is the whole point.
- Todos with no due date have no zone. The field is hidden, not disabled-and-empty.

### 4.2 Server-created todos — the gap this closes

Orb voice/text and the REST API create todos with **no browser context**, so there is no zone to stamp. `users.timezone` becomes that fallback — and stops being a dead column. **To Stan's question: this is not a new field.** `users.timezone` already exists (`text`, default `'America/Los_Angeles'`); what is new is that the app starts writing it:

- **Auto-maintained, never a setting, and not exposed in the UI — deliberately.** On dashboard load, the client compares `Intl.DateTimeFormat().resolvedOptions().timeZone` against the stored value and updates the row only when they differ — a write that fires roughly as often as the user changes timezones, i.e. almost never. Exposing it as an editable setting would create two writers that fight: a manual choice either gets clobbered by the next auto-write or pins the app to a stale zone, which is the exact failure mode this plan removes. A value the system derives gets no knob.
- **Zone-source precedence for server-side todo creation** (tightened 2026-07-24 after Stan probed the UI question):
  1. **Orb conversation (text and voice) is not actually headless** — the client makes the request, so the browser's live zone is sent along with every conversation request and used directly. This closes the stale-fallback window (land in Vancouver, tell Orb "due 9am tomorrow" *before* the dashboard has loaded in the new zone — the stored fallback would still say Honolulu).
  2. **`users.timezone` covers only the genuinely headless paths:** the REST API (external agents — Claude Code, Codex) and any cron/system-originated create.
- **The user always sees and can correct the outcome where it matters:** the stamped zone is visible and editable on the todo itself (§6). A wrong fallback is never silent or locked in.
- **Transparency line — included (Stan, 2026-07-24):** a read-only line on the Account page — *"Detected timezone: Honolulu (updates automatically as you travel)"* — makes the mechanism legible without making it a setting. Read-only is the point: it shows what the system derived; the per-todo field is where corrections happen.

This finally answers the question that opened this thread. Verified 2026-07-24: **nothing in the app has ever written `users.timezone`** — no insert, no update, no migration, no trigger, no audit entry. Stan's `Pacific/Honolulu` was set by hand outside the repo; the other two rows are an untouched column default. This plan makes the app the writer.

### 4.3 The city picker

`Intl.supportedValuesOf('timeZone')` already contains the city names — `America/Vancouver`, `Pacific/Honolulu`, `America/Argentina/Buenos_Aires`. Take the last segment, swap underscores for spaces, filter out `Etc/*` and legacy aliases. `Intl.DateTimeFormat(zone, { timeZoneName: 'longGeneric' })` yields **"Pacific Time"** and `'short'` yields **"PDT"**, reproducing Apple's `Pacific Time (PDT)` confirmation line. **No dependency, no curated list, stays current as IANA updates.**

**Known limitation, accepted for v1:** only cities that *are* IANA zones exist. Vancouver works; **Seattle does not** (it is `America/Los_Angeles`). Apple ships a real city database to bridge this. The field must not be labelled as accepting "any city." Revisit with an alias map only if it causes real friction.

**UI pattern:** `ComboSelect` and all `pf-combo*` CSS were **deliberately deleted in ORB-355** in favour of native `pf-select`; this plan does not resurrect them. It reuses the cataloged **`admin-search-*`** family (`admin-search-wrap` / `-input` / `-dropdown` / `-result` / `-empty`) already used by `SearchModal` for Change Project — same interaction, already built, already carrying the accessibility contract (focus on open, arrow keys, Enter, Escape). Rendered **inline inside the todo editor**, not as a nested modal, since the editor is itself a modal.

---

## 5. Reminder

A `pf-select` on the todo editor. Options deliberately richer than the four the old global setting offered — reproducing those four here would recreate the same limitation at smaller scale:

> **None** *(default)* · At time due · 1 hour before · 2 hours before · 12 hours before · 1 day before · 2 days before · 1 week before · **Custom…**

**Custom** (added by Stan, 2026-07-24 — the Helm-financials case: reminders set *months* ahead of the due date) reveals two fields when selected:
- **Number:** 1–99 (numeric input, `pf-field`)
- **Unit:** hours / days / weeks / months (`pf-select`)

Every preset maps onto the same `reminder_lead_value` / `reminder_lead_unit` pair Custom writes — one storage model, no special cases. On edit, a stored pair that matches a preset shows as that preset; anything else shows as Custom with the fields populated.

**Month arithmetic rule (explicit, so it isn't improvised at build time):** the trigger instant is computed by calendar subtraction in `due_timezone`, clamping the day when the target month is shorter — due July 31, "1 month before" → June 30. Weeks/days/hours are exact arithmetic on the `timestamptz` instant.

Delivery reuses [`lib/reminders.ts`](../lib/reminders.ts) unchanged in shape: the trigger instant becomes `due_at − lead`, computed by the rule above — the hand-rolled `getUTCFromLocalTime` offset dance is deleted outright. The email renders the due time in the todo's `due_timezone`, fixing the existing mismatch where the trigger used one zone and the displayed date used another.

### The no-reminder nudge (decided in scope by Stan, 2026-07-24)

A dated todo with **no** reminder is the exposed case — it slides from quiet to overdue with no warning. But it is only *sometimes* a gap: a cake due out of the oven needs no reminder; a financial milestone virtually requires one. So the chief-of-staff behaviour is: **point it out once, and stand down when told.**

- Surfaced through the **existing observations mechanism** ([`context.ts:335`](../lib/orb-model/context.ts) `computeObservations`, already gated by the `guidance_level` preference — `quiet` already suppresses all observations, no new plumbing).
- **Per-todo opt-out:** new column `todos.reminder_nudge_dismissed_at timestamptz NULL` (added in the Phase 3 migration, not Phase 1's). When the user tells Orb "no reminder needed for this one" — or dismisses in the editor — it is stamped and that todo is never mentioned again. Dismissal survives due-date edits; it is about the *todo's nature*, not its current date.
- **Once means once:** the observation fires for a todo at most one time even if never dismissed — the mechanism must not be capable of nagging.
- Eval: Tier 1 for the dismissal write; Tier 2 asserting the Orb mentions a dated, reminder-less, undismissed todo — and stays silent about a dismissed one.

---

## 6. UI changes

| File | Change |
|---|---|
| [`components/TodoEditor.tsx`](../components/TodoEditor.tsx) | Due Date field (exists, `:429-449`) gains an adjacent **Timezone** city picker and a **Reminder** select (with Custom revealing the number/unit pair, §5). All hidden when no due date is set. Existing `reminded_at` clearing at `:192` extends to reminder-lead changes. |
| [`components/views/TaskListView.tsx`](../components/views/TaskListView.tsx), [`TaskKanbanView.tsx`](../components/views/TaskKanbanView.tsx) | Badges and date text render in origin zone; zone abbreviation shown only when it differs from the viewer's. Delete the duplicate `parseLocalDatetime` import. |
| [`components/settings/SettingsUrgency.tsx`](../components/settings/SettingsUrgency.tsx) | **Deleted**, along with its route. This dissolves the earlier open question about converting its inline-styled select to `pf-select` — the file is going away. |
| [`app/settings/page.tsx:8`](../app/settings/page.tsx) | **Redirect target must change.** It currently sends the Settings index to `/settings/urgency`; deleting that page without repointing this breaks the entire Settings entry point. |
| [`app/dashboard/print/page.tsx`](../app/dashboard/print/page.tsx) | Due dates render in origin zone. |
| [`components/UnifiedDashboard.tsx`](../components/UnifiedDashboard.tsx) | New toolbar button (beside Sort / Filters / View / +New) opening the selected project's urgency-windows modal (§3) — visible to the project's owner and admins. Folds into the Commands modal on iPhone if space demands, mirroring + Project. |
| Account page | Read-only *"Detected timezone"* line (§4.2). |

---

## 7. Orb conversational contract

This is a genuine capability change, not a refactor.

- `create_todo` / `update_todo` gain **`due_timezone`**, **`reminder_lead_value`**, and **`reminder_lead_unit`**.
- [`lib/orb-contract.ts:33`](../lib/orb-contract.ts) currently describes `due_at` as *"Optional **timezone-agnostic** due date/time string"* — that becomes false and must be rewritten.
- **[`docs/api-spec.yaml`](api-spec.yaml) is canonical** and regenerates `lib/orb-contract.ts`. Edit the spec, regenerate — never hand-edit the contract.
- Realtime tool schemas in [`app/api/orb-realtime/session/route.ts`](../app/api/orb-realtime/session/route.ts) mirror the same params.
- [`lib/db-schema.ts`](../lib/db-schema.ts) — the allowlisted schema `query_db` reads — gains both columns.
- [`lib/orb-prompt.ts`](../lib/orb-prompt.ts) — due-date guidance updated for zones.
- REST API ([`app/api/tasks/route.ts`](../app/api/tasks/route.ts), `[id]/route.ts`) accepts both fields for external agents.

**New conversational capabilities:**
1. The Orb must resolve zones from speech — *"due 9am Tokyo Tuesday"* has to land in the right column — and leads: *"remind me a week before"* → `reminder_lead_value: 1, reminder_lead_unit: 'weeks'`; *"remind me three months out"* → `3 / 'months'`.
2. The Orb must **explain the ambient mood on request** (§3): asked "why is the orb busy?", it answers from the actual per-project urgency drivers in its context — never by guessing.

### Eval cases (mandatory, same change)

- **Tier 1** — `create_todo` with a spoken city/zone sets `due_timezone`; "remind me a week before" sets `reminder_lead_value: 1` / `'weeks'`; a todo created with no reminder leaves both fields `null` rather than defaulting.
- **Tier 2** — the Orb states the due time **in the todo's zone** when reporting it; does not describe a distant reminder as urgent; and when asked why the orb is busy/urgent, names the actual driving project, todo, and rule.

Per project rule, **Stan runs `npm run eval:t1`**; I do not run evals.

---

## 8. Other mandatory analyses

**Performance instrumentation — not required.** No new server action, network call, or async chain; the todo save path already carries a measured span. The city picker filters ~400 in-memory strings on keystroke with no I/O. Two notes rather than instrumentation: the `Intl.DateTimeFormat` instances are built once and memoized per zone, not per todo or per keystroke; and the city list is computed once per mount, not per render.

**Object capability matrix** — `todos` row updates (two new columns, two new Orb tool params, REST fields); `users` row updates (`urgency_threshold_hours` removed, `timezone` becomes app-written). No new Part 2 flow.

**UI catalog** — no new pattern. Reuses `admin-search-*`, `pf-select`, `pf-field`, `EditorModal`. Catalog updated to record the todo editor's new fields and to note the Settings → Urgency page's removal.

**Release** — version bump in `package.json` + `lib/version.ts`, and a real user-facing `lib/changelog.ts` entry. This is a visible behaviour change and a removed settings page, so it earns proper prose.

---

## 9. Phased build (phasing approved by Stan, 2026-07-24)

Each phase is independently shippable, releasable, and verifiable — no phase leaves the app in a half-state.

### Phase 0 — ORB-360 as already scoped *(prerequisite, separate plan doc)*
One `lib/due-time.ts` helper, four duplicate parsers deleted, the `project-health.ts` hardcoded-`0` fix. Ships the live 10-hour inconsistency fix immediately. §11.

### Phase 1 — Data model + per-todo zone & reminder
1. Migration: `due_at` → `timestamptz`, add `due_timezone` + `reminder_lead_value`/`reminder_lead_unit`, backfill the 9 rows, verify. DB health queries before and after.
2. Rewire `lib/due-time.ts` to source the zone from the todo.
3. `users.timezone` auto-maintenance; live-zone-with-request for Orb conversation; headless fallback for REST/cron; read-only "Detected timezone" line on Account (§4.2).
4. TodoEditor: city picker + reminder select with Custom (§5, §6).
5. Task views, print view: origin-zone rendering.
6. `lib/reminders.ts`: lead-based trigger (calendar-month rule), origin-zone email rendering, delete `getUTCFromLocalTime`.
7. Contract chain: `api-spec.yaml` → regenerate `lib/orb-contract.ts` → Realtime schemas → `db-schema.ts` → `orb-prompt.ts` → REST routes. Tier 1 eval cases for the new params.

### Phase 2 — Urgency derivation + settings removal
1. Derivation in `lib/orb-state.ts` per §3 with the **global defaults** (per-project overrides not yet); delete every `urgency_threshold_hours` read.
2. Delete `SettingsUrgency` + route; **repoint `app/settings/page.tsx`**.
3. Tier 2 eval case: distant reminder not described as urgent.

### Phase 3 — Per-project windows + Help + "ask Orb why" + nudge
1. `projects.urgency_windows jsonb` + validation; owner-and-admin dashboard toolbar button + modal for the selected project, defaults-first with Reset (§3).
2. Help overhaul: overview + samples, orb-state icons, "ask Orb why" note (§3).
3. Mood-explanation capability: per-project urgency drivers surfaced into Orb context; Tier 2 eval case.
4. No-reminder nudge: `todos.reminder_nudge_dismissed_at` migration, observation wiring, per-todo dismissal, eval cases (§5).

### Phase 4 — Cleanup *(after production verification of Phases 1–3)*
1. Drop `users.urgency_threshold_hours`.
2. Capability matrix, UI catalog, changelog entries verified complete across all phases.

Each phase carries its own version bump(s) and changelog entry; the eval additions land in the same phase as the capability they guard, never deferred.

---

## 10. Verification

`npx tsc --noEmit` and focused ESLint. No production build as verification.

For Stan on localhost:

1. **The original ORB-360 bug.** A todo due inside the old browser/server disagreement window now reads identically on the orb, the task card, and the Orb's spoken report.
2. **Travel case.** Create a todo with a Vancouver zone; confirm it displays as Vancouver time with `PDT` shown, while a Honolulu todo shows no abbreviation.
3. **Reminder ≠ urgency.** A todo due in 3 weeks with a 1-week reminder leaves the orb **calm**. This is the decisive check for §5 — if the orb reacts, the design is wrong.
4. **Runway.** Walk a todo's due date inward and confirm `calm → busy → urgent` at the §3 boundaries.
5. **Blank reminder still protected.** A todo with no reminder that goes past due still turns the orb urgent.
6. **Custom reminder with months.** A todo due July 31 with a "1 month before" reminder triggers June 30 (clamped), rendered in the todo's zone; moving the due date recomputes the trigger.
7. **Per-project override wins.** Set a project's High-priority runway to something distinctive (e.g. 7 days) and confirm the orb reacts at the override boundary, not the default, and that other projects keep the defaults.
8. **"Why is the orb busy?"** Ask the Orb; confirm it names the actual driving project, todo, and rule — and says plainly when it cannot see a reason, rather than inventing one.
9. **DST.** `Pacific/Honolulu` has none, but `America/Los_Angeles` and `America/Vancouver` do — check a spring-forward date.
10. **Platforms.** Mac / iPad / iPhone agree with each other and with server-side output.
11. **Settings index still loads** after the Urgency page is deleted.

---

## 11. Relationship to ORB-360

**This supersedes ORB-360's *diagnosis* but not its *work*.**

ORB-360's core deliverable — one `lib/due-time.ts`, four duplicate parsers deleted, the [`project-health.ts:115`](../lib/orb-model/project-health.ts) hardcoded-`0` bug fixed — is a **prerequisite** for this plan, not an alternative to it. Only the zone's *source* changes (user row → todo row). Doing it first is not throwaway work.

**Recommended sequencing:** ship ORB-360 as scoped, then this. It fixes the live 10-hour inconsistency and the project-health bug against 9 rows of risk, and leaves this plan standing on one helper instead of four.

Superseded within ORB-360's plan once this ships: the `users.timezone` Settings picker (§4 there) — there is no timezone setting in this design.

---

## 12. Open questions — all settled 2026-07-24

1. **Runway/imminent numbers:** accepted as defaults, admin-settable per project (§3).
2. **No-reminder observation:** in scope, with per-todo opt-out — Stan's framing: a cake due out of the oven needs no reminder, a large project virtually requires one, so the Orb may point out the gap provided the user can tell it to ignore that todo (§5).
3. **Filing:** one todo for this whole plan (ORB-360 remains its own todo as the Phase 0 prerequisite).
4. **"Detected timezone" Account line:** include (§4.2).
5. **Per-project windows UI:** Stan's placement — a button in the unified dashboard list toolbar beside Sort / Filters / View / +New, near the orb whose color it governs, acting on the selected project (§3).
