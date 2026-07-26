# ORB-360 — One canonical timezone for urgency thresholds

**Status:** Plan drafted 2026-07-24. **NOT approved for build.** No code written.
**Todo:** ORB-360 (`bdcade62-29ca-4917-90cd-a88761469a49`) — "Unclear which time zone Orb uses for urgency threshold reports", open, P3, no description.
**Decision from Stan (2026-07-24):** the **user's timezone is canonical everywhere**. The `project-health` hardcoded-threshold bug is folded into this ticket rather than filed separately.

---

## Root cause

`todos.due_at` is **`timestamp without time zone`** (verified against `information_schema`). The stored value is a bare wall-clock reading with no zone attached, so it cannot answer "is this due soon?" on its own — every consumer must supply a zone. Four different zones are supplied today, via two duplicate implementations of the same predicate.

| Surface | Zone actually used | Call site |
|---|---|---|
| Dashboard orb (mood + urgent list) | **Browser** | [`UnifiedDashboard.tsx:401`](../components/UnifiedDashboard.tsx), `:1136`, `:1163` → [`orb-state.ts:28`](../lib/orb-state.ts) `parseLocalDatetime` |
| `GET /api/orb-state` | **Server** (Vercel = UTC) | [`app/api/orb-state/route.ts:73`](../app/api/orb-state/route.ts) |
| Push notifications | **Server** | [`lib/push.ts:107`](../lib/push.ts) |
| Orb conversation urgency | **Server** | [`app/actions/orb-converse.ts:15`](../app/actions/orb-converse.ts) |
| Project-health packet (what the Orb *reports*) | **Server**, **and threshold hardcoded to `0`** | [`lib/orb-model/project-health.ts:57`](../lib/orb-model/project-health.ts), `:115` |
| **Task-card `overdue` / `due today` badges** | **Browser** | [`TaskListView.tsx:83`](../components/views/TaskListView.tsx), [`TaskKanbanView.tsx:77`](../components/views/TaskKanbanView.tsx) → [`views/types.ts:50`](../components/views/types.ts) |
| Reminder email — *trigger* | **User's `users.timezone`** ✅ correct today | [`lib/reminders.ts:145`](../lib/reminders.ts) `getUTCFromLocalTime` |
| Reminder email — *displayed date* | **Server** | [`lib/reminders.ts:57`](../lib/reminders.ts) `formatLocalDateString` |

**Four duplicate parsers, not two** (corrected 2026-07-24 after tracing how the timezone is set):

| # | Location | Feeds |
|---|---|---|
| 1 | [`lib/orb-state.ts:28`](../lib/orb-state.ts) | orb mood, urgent counts |
| 2 | [`lib/orb-model/project-health.ts:57`](../lib/orb-model/project-health.ts) | the Orb's spoken reports (different implementation — bare `new Date()`) |
| 3 | [`components/views/types.ts:50`](../components/views/types.ts) | task-card overdue / due-today badges |
| 4 | [`components/UnifiedDashboard.tsx:160`](../components/UnifiedDashboard.tsx) | a fourth private copy inside the dashboard |

Copy #3 is the most user-visible of all of them: it decides whether a card shows a red **overdue** or amber **due today** badge, a per-task claim rendered directly beside the task. It is browser-local, so it disagrees with every server-side surface by the user's UTC offset.

**Observed impact.** Live data: Stan is `Pacific/Honolulu` with `urgency_threshold_hours = 24`; the server is UTC. That is a **10-hour disagreement** — a window every day in which the dashboard orb shows URGENT while the Orb conversation reports nothing due, or the reverse. Separately, `project-health.ts:115` passes `warningHours: 0`, so the packet that feeds the Orb's spoken reports counts only *already-overdue* todos and silently ignores the configured 24-hour early warning. That second bug is the most likely thing that prompted the ticket.

**Supporting gaps found during research:**
- **Nothing in the app ever *writes* `users.timezone`.** Verified three ways: a full `.ts`/`.tsx`/`.sql` grep finds only two reads ([`reminders.ts:129`](../lib/reminders.ts), [`context.ts:183`](../lib/orb-model/context.ts)) and no write; no migration in `scripts/migrations/` mentions the column; no database function or trigger references it; `audit_log` has no timezone change on record. Stan's `Pacific/Honolulu` was set manually via SQL or the Supabase dashboard, outside the app and outside the repo. The other two rows are the untouched column default. **The Settings picker proposed in §4 would be the first and only writer of this column in the app's history.**
- **`users.timezone` has no UI anywhere.** The only timezone string in the entire UI is `DateSearchModal`'s "All times local (your browser timezone)".
- **[`context.ts:183`](../lib/orb-model/context.ts) already fetches `timezone`** into the Orb model context and then never uses it — the plumbing is half-built already.
- **The three users are all Stan's own accounts** (`stan.baptista@gmail.com` plus the `+admin` / `+otto-owner` test aliases). There are no real third-party users stranded on a wrong default, which retires the backfill option in open question 2.

---

## Design

### 1. One helper, explicit zone, no default

New module **`lib/due-time.ts`** — the single source of truth for due-date math:

```ts
export function dueAtToInstant(dueAtStr: string, timeZone: string): Date
export function isDueWithinWarning(dueAtStr: string, warningHours: number, timeZone: string): boolean
```

`dueAtToInstant` is the existing, already-production-proven `Intl.DateTimeFormat` algorithm currently living privately in `reminders.ts` as `getUTCFromLocalTime`, promoted and shared. It interprets the naive wall-clock string *as a reading in `timeZone`* and returns a true UTC instant, which is then compared against `Date.now()`. Because the result is an absolute instant, **client and server produce identical answers** — that property is the entire fix.

`timeZone` is a **required parameter with no default**. This is deliberate: it makes `npx tsc --noEmit` enumerate every call site rather than letting any path silently retain today's ambient-zone behavior.

Deletions — **all four** duplicate parsers plus the two predicates collapse into this one module: `parseLocalDatetime` + `isDueWithinWarning` from [`lib/orb-state.ts`](../lib/orb-state.ts), the duplicate `isDueWithinWarning` from [`lib/orb-model/project-health.ts`](../lib/orb-model/project-health.ts), `parseLocalDatetime` from [`components/views/types.ts`](../components/views/types.ts), the private `parseLocalDatetime` in [`components/UnifiedDashboard.tsx:160`](../components/UnifiedDashboard.tsx), and `getUTCFromLocalTime` from [`lib/reminders.ts`](../lib/reminders.ts). Four implementations become one.

*Alternative considered:* extend `lib/orb-state.ts` instead of adding a module. Rejected — `reminders.ts` and `project-health.ts` would then import orb-*state* for pure time math they have nothing to do with. A small dedicated module is the honest boundary.

### 2. Threading the zone through

`computeUrgency`, `computeOrbState`, and `buildProjectHealthPacket` each gain a required `timeZone` argument. Every consumer **already fetches the `users` row** it needs, so this is an added column on an existing `select`, never a new query:

| File | Change |
|---|---|
| [`app/api/orb-state/route.ts:52`](../app/api/orb-state/route.ts) | add `timezone` to the existing select |
| [`lib/push.ts:89`](../lib/push.ts) | add `timezone` to the existing select |
| [`lib/orb-model/context.ts:183`](../lib/orb-model/context.ts) | already selects `timezone` — just use it; pass into `buildProjectHealthPacket` |
| [`components/UnifiedDashboard.tsx:830`](../components/UnifiedDashboard.tsx) | add `timezone` to the profile select, hold in state beside `urgencyThreshold`; delete the private parser at `:160` |
| [`components/views/TaskListView.tsx`](../components/views/TaskListView.tsx), [`TaskKanbanView.tsx`](../components/views/TaskKanbanView.tsx) | accept `timeZone` as a prop from the dashboard for the overdue / due-today badges; also pin their `toLocaleDateString`/`toLocaleTimeString` display calls to that zone instead of `undefined` (browser default), so the badge and the date it sits next to agree |
| [`lib/reminders.ts`](../lib/reminders.ts) | already has `user.timezone`; also pass it to `formatLocalDateString` so the email's displayed date matches the zone its trigger was computed in |

### 3. The project-health fix (folded in)

[`project-health.ts:115`](../lib/orb-model/project-health.ts) stops hardcoding `0` and takes the user's `urgency_threshold_hours`, sourced the same way `context.ts:329` already sources it. `buildProjectHealthPacket` gains `urgencyThresholdHours` and `timeZone` inputs. **This changes what the Orb says** — see the eval section.

### 4. Surfacing `users.timezone`

Add a timezone picker to [`SettingsUrgency.tsx`](../components/settings/SettingsUrgency.tsx), which is already the "when do I get warned" page and already saves to `public.users`. It reuses that page's existing load/save/`hasChanges`/audit flow — one extra field on one existing form, no new page and no new save path.

- Options from `Intl.supportedValuesOf('timeZone')`, narrowed to a sensible list; the user's current value always present even if outside it.
- On first load, if the stored value still equals the untouched column default, **prefill** the picker with `Intl.DateTimeFormat().resolvedOptions().timeZone` so accepting the right answer is one click. Prefill only — never a silent write.
- The existing threshold copy gains the zone: *"24 hours before due date, in your timezone (Pacific/Honolulu)."* The current copy states an interval with no zone, which is the literal complaint in the ticket title.
- Extend the existing `urgency_threshold_change` audit action to carry `timezone` before/after.

**UI catalog:** the new select uses the cataloged **`pf-select`** class. Note that the *existing* threshold select at [`SettingsUrgency.tsx:89-113`](../components/settings/SettingsUrgency.tsx) is a pre-existing deviation — a ~20-line inline `style` block reimplementing `pf-select`. Converting it is a 2-line in-family cleanup that makes the two adjacent selects match; **left out of scope pending Stan's yes/no** (open question 3). No new pattern is introduced either way, so no catalog change is required.

---

## Mandatory pre-build analyses

### Database impact (per AGENTS.md design-time checklist)

| Question | Answer |
|---|---|
| New query pattern? | **No.** Every change adds `timezone` to a `select` on a `users` row already being fetched by primary key. |
| New index needed? | **No.** No new WHERE/JOIN column; `users` is read by `id`. |
| Realtime / `postgres_changes`? | **No.** None added. |
| High-frequency writes? | **No.** One write per manual Settings save. |
| New table? | **No.** `users.timezone` and `users.urgency_threshold_hours` both already exist. |
| Schema migration? | **None required.** |

Per the periodic-health rule: no migration or schema change here, so no health-review run is required. If that changes during build, the canonical queries get run before and after.

### Performance instrumentation (per AGENTS.md build rule)

**Decision: not required, with one exception to confirm.** The urgency computation is pure in-memory arithmetic over already-fetched rows; no new server action, network call, or async chain is introduced, and no existing measured flow gains work. The Settings page gains one form field on an existing, already-instrumented save path.

The exception: `Intl.DateTimeFormat` construction inside `dueAtToInstant` is called once per todo with a `due_at`. At current backlog sizes this is negligible, but the formatter will be **hoisted and memoized per timezone** rather than constructed per todo, so the cost is O(zones) not O(todos). Flagging rather than hiding it.

### Orb eval suite (mandatory — this is a conversation-behavior change)

Changing `project-health.ts` from "overdue only" to "within the user's threshold" **changes what the Orb reports**, so it is squarely in scope for the suite. There is currently **no** urgency/due-date case in [`scripts/eval-cases.ts`](../scripts/eval-cases.ts) — verified; the only `urgent` hit is unrelated fixture prose.

Planned: a **Tier 2** behavioral case asserting that a todo due inside the user's configured window is reported as urgent, and one due outside it is not. Tier 2 because this is speech content, not tool selection — no tool or parameter changes shape here. Per project rule, **Stan runs `npm run eval:t1`**; I do not run evals.

### Object capability matrix

Part 1: the `users` row's **Settings UI** cell updates — `timezone` becomes user-editable rather than an invisible column. Part 2 needs no new flow row; urgency computation isn't a new critical path and gains no new latency surface.

---

## Steps

1. Create `lib/due-time.ts` with `dueAtToInstant` + `isDueWithinWarning` (memoized formatter per zone).
2. Delete all four duplicate parsers and both predicates; make `timeZone` required on `computeUrgency` / `computeOrbState` / `buildProjectHealthPacket`. Let `tsc` enumerate the breakage.
3. Fix each call site per the table in §2 — seven files; the server-side ones add a column to an existing select, the two task views take a new prop.
4. Fold in the project-health fix: real `urgencyThresholdHours` instead of `0`.
5. Fix `formatLocalDateString` in `reminders.ts` to render in the user's zone.
6. Add the timezone picker + zone-aware copy to `SettingsUrgency.tsx`; extend the audit payload.
7. Add the Tier 2 eval case.
8. Update `docs/object-capability-matrix.md` (users row, Settings UI cell).
9. Version bump (`package.json` + `lib/version.ts`) and a user-facing `lib/changelog.ts` entry — this is a visible behavior change, so it earns real changelog prose, not an internal-only bump.

---

## Verification

`npx tsc --noEmit` and focused ESLint, per project rule — no production build as verification.

Behavioral checks for Stan on localhost (I cannot reach the dev server):

1. **The 10-hour bug, directly.** Set a todo's `due_at` to a wall-clock time that falls inside the 24h window in HST but outside it in UTC. Before: dashboard and Orb disagree. After: both say urgent.
2. **Project-health threshold.** Ask the Orb for project health with a todo due in ~12 hours and a 24h threshold. Before: not counted urgent. After: counted.
3. **Task-card badges.** With a todo due inside the browser/server disagreement window, confirm the red **overdue** / amber **due today** badge on the card in both List and Kanban views agrees with the orb mood and with the Orb's spoken report. This is the surface most likely to be noticed and the one added late to this plan, so it deserves an explicit check rather than being assumed to follow.
4. **Reminder email.** Confirm the displayed "Due Date" matches the zone that triggered it.
5. **DST correctness.** `Pacific/Honolulu` has no DST, but `America/Los_Angeles` does and is the column default for the other two users — worth one check against a spring-forward date, since the offset algorithm is the piece most likely to be subtly wrong.
6. **Platforms.** Mac / iPad / iPhone should now agree with each other *and* with server-side output — today they agree with each other but not with the server.

---

## Open questions for Stan

1. **Timezone list scope** — full IANA list (~400 entries, correct but unwieldy on iPhone), or a curated shortlist with the user's current value always included? I lean curated.
2. ~~**Existing users on the untouched `America/Los_Angeles` default** — leave, or backfill?~~ **Retired 2026-07-24.** All three accounts are Stan's own (his plus the `+admin` / `+otto-owner` test aliases), so no real user is stranded on a wrong default and a backfill would solve a problem that does not exist. Settled as leave-and-prefill; the next real invitee gets a correct zone the first time they open the page. *(Useful side effect: the two test accounts sit at `urgency_threshold_hours = 0` while Stan's is `24`, so they make a ready-made A/B pair for verification step 2.)*
3. **Convert the existing threshold select to `pf-select`** in the same change (~2 lines, makes the two adjacent selects match), or leave the pre-existing inline-style deviation alone to keep this diff strictly on-topic?
