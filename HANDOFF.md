# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app
- **Version:** 0.5.232

---

### Last Session — PAUSED / COMMITTED

**ORB-254: Audit the Audit Log — 2026-06-15 (Codex, GPT-5)**

### Status: Stages 1–3 COMPLETE, Stage 4 PARTIAL / PICK UP LATER

Stan's intent: make the audit log and ticket system useful for diagnosing user issues. A user couldn't get past a basic error and the audit log was useless for triage.

---

### Stage 1 — System info collection ✅ COMPLETE

Capture browser, OS, OS version, and viewport on all tickets and audit log entries.

**Created files:**
- `lib/system-info.ts` — client-side UA parser, exports `SystemInfo` type + `collectSystemInfo()`
- `scripts/migrations/20260614_audit_log_system_info.sql` — adds `system_info jsonb` column to `audit_log` (ALREADY APPLIED to database)

**Modified files:**
- `lib/audit.ts` — `logAuditEvent` accepts optional `system_info` param
- `app/actions/log-audit.ts` — server action wrapper passes through `system_info`
- `app/actions/ticket-actions.ts` — `createTicket` accepts `systemInfo`, merges into `detail.system`
- `app/actions/orb-converse.ts` — `OrbRequest` type has `systemInfo` field; all `logAuditEvent` and `createTicket` calls pass it through
- `components/UnifiedDashboard.tsx` — lazy `collectSystemInfo()` via useRef, passes to `orbConverse` and all `logAudit` calls
- `components/OrbPanel.tsx` — same pattern as UnifiedDashboard
- `components/TodoView.tsx` — `systemInfoRef`, all `logAudit` calls include `system_info`
- `components/TodoPanel.tsx` — `collectSystemInfo()` on both `logAudit` calls

---

### Stage 2 — Audit log completeness + UI display ✅ COMPLETE

Added audit logging to ALL mutation paths. Added system_info display to audit log and tickets.

**Audit logging added to every mutation path:**
- `app/actions/manage-project.ts` — project_create, project_update, project_dormancy, project_delete, project_bulk_delete
- `app/actions/manage-todo.ts` — todo_create, todo_update, todo_delete
- `app/actions/manage-user.ts` — user_stage_change
- `app/actions/friction-actions.ts` — friction_log, friction_delete
- `app/api/tasks/route.ts` (REST API POST) — todo_create
- `app/api/tasks/[id]/route.ts` (REST API PATCH/DELETE) — todo_update, todo_delete
- `components/TodoForm.tsx` — todo_create (client-side)
- `components/DashboardProducts.tsx` — project_update, project_create, project_delete
- `components/QueryResultsModal.tsx` — todo_update, todo_delete
- `components/settings/SettingsAccount.tsx` — user_name_change
- `components/settings/SettingsGroups.tsx` — group_create, group_update, group_delete
- `components/settings/SettingsKnowledge.tsx` — knowledge_create, knowledge_update, knowledge_delete
- `components/settings/SettingsUrgency.tsx` — urgency_threshold_change
- `components/settings/SettingsFriction.tsx` — todo_create (from friction conversion)

**UI display:**
- `components/settings/SettingsAudit.tsx` — system info bar in detail modal (browser, OS, viewport); User column added (resolves `user_id` FK → name/email); Actor column kept separate
- `app/actions/get-audit-logs.ts` — joins `users!user_id(first_name, last_name, email)` for user resolution
- `components/settings/SettingsTickets.tsx` — system info bar in ticket edit modal
- `app/actions/get-audit-logs.ts` — Audit text search calls `get_audit_log_page`, which filters one indexed `audit_log.search_text` field for Table, Action, historical User identity, Actor, Record, Before, and After with literal punctuation handling and exact total counts; Created uses explicit UTC range boundaries
- `components/settings/SettingsAudit.tsx` — Created timestamps display in the browser's IANA timezone; a dedicated modal provides On, At or before, At or after, and Between filtering and clearly names the active timezone
- `components/settings/SettingsAudit.tsx` — Audit details show historical user identity, current identity when it differs, browser-local Created time, and canonical UTC
- `scripts/migrations/20260615_add_audit_search_text.sql` — adds historical user name/email snapshots, backfills existing rows from the best available current identity, maintains snapshots/search text on new audit rows, adds `idx_audit_log_search_text_trgm`, and creates `get_audit_log_page` for paginated trusted search (ALREADY APPLIED to database)

**Search DB impact:** `audit_log.search_text` and two identity snapshot columns add modest row/index storage and trigger maintenance on audit writes. Text searches use one GIN trigram index with no intermediate result lists or hidden caps. Created filtering uses the existing `created_at` index with UTC boundaries. No Realtime.

**Intentional exclusions:** `complete-onboarding.ts` (one-time), `delete-audit-logs.ts` (meta), `dev-channel` (infra), `push_subscriptions` (browser tokens), `UpdateBanner`/`SettingsWhatsNew` (no user data)

---

### Stage 3 — Orb auto-tickets on failure ✅ COMPLETE

- `app/actions/orb-converse.ts` — inner tool catch block now auto-files a ticket when any tool handler throws (fire-and-forget `createTicket` with tool name, error, input snippet, conversation_snippet, systemInfo)
- Outer catch block now auto-files tickets for non-billing service errors (overloaded, rate limit, network, unknown) — previously only billing errors filed tickets

---

### Stage 4 — Table UX: sticky columns + horizontal scroll ⚠️ PARTIAL

**What was built:**
- `SettingsCrudList` now has a `stickyColumns: number` config option. First N columns (including checkbox) get `position: sticky` with computed `left` offsets.
- Column resize machinery REMOVED entirely (state, refs, effects, localStorage, Reset button, resize handles, `.col-resize-handle-sheets` CSS).
- `<colgroup>` added to enforce column widths.
- `table-layout: fixed` reintroduced WITH explicit `min-width` on the table (sum of all column widths) so the table overflows rather than compressing.
- Mobile scroll arrows styled as encircled (border-radius + border) in `globals.css`.
- Checkbox `<td>` no longer uses `audit-td` class (was causing dots).
- Search placeholder changed from "Filter" to "Search".
- Search input widened to `max-width: 420px` desktop, `100%` mobile.
- `app/actions/diagnose-audit.ts` DELETED — dev-only diagnostic tool that littered the audit log with probe entries. Associated Diagnose + Copy buttons removed from `SettingsAudit.tsx`.
- Audit Log **User** is now the first data column and is the single frozen data column on every platform (`stickyColumns: 2` = checkbox + User).
- Audit Log now uses a compact green **Search by...** dropdown. Text fields mode shows only the text search field. Created date mode hides/clears text search, shows the Created filter button, and opens the date modal. Opening/closing the dropdown no longer reloads the table.
- Table column navigation is a borderless **prev/next columns** group at the far right with compact 40px circular buttons.

**Known incomplete / next pickup:**
- Stan said this todo is not quite complete and will be picked up another time.
- Continue visual testing on localhost across Mac, iPad, and iPhone.
- Re-check Audit Log toolbar spacing after the final green **Search by...** dropdown change.
- Re-check User frozen column behavior on iPhone/iPad Safari.
- If horizontal scroll still "springs back," use Table Tuner measurements and inspect whether the table width, scroll container, or sticky offsets are being compressed by mobile Safari.

**Current column widths (SettingsAudit.tsx):**
- Revised Mac preset approved by Stan, then reordered so User is first: checkbox 38px, User 140px, Table 128px, Action 140px, Actor 79px, Record 140px, Before 140px, After 140px, Created 140px
- Mac total: 1085px; `frozenColumns: 0`
- iPad is now an explicit separate source preset, preserving its prior widths and User-first order: checkbox 38px, User 140px, Table 128px, Action 170px, Actor 120px, Record 140px, Before 140px, After 140px, Created 170px
- iPad total: 1186px
- Revised iPhone preset approved by Stan, then reordered so User is first: checkbox 38px, User 140px, Table 128px, Action 140px, Actor 140px, Record 140px, Before 140px, After 140px, Created 140px
- iPhone total: 1146px
- Rejected iPad TABLES drafts were invalidated by advancing tuner storage to v3; SettingsCrudList now sets an explicit total table width so Safari cannot redistribute approved fixed column widths
- `stickyColumns: 2` on all platforms, freezing checkbox + User.

**Key files for debugging:**
- `components/settings/SettingsCrudList.tsx` — sticky logic in `renderItemRow` (clones tr, injects sticky styles on first N td children), table/colgroup rendering around line 675
- `app/globals.css` — `.audit-table` styles (around line 1144), `.crud-table-scroll` mobile styles, `.cs-scroll-arrow` styles
- `components/settings/SettingsAudit.tsx` — column definitions, renderRow

**Root cause hypothesis if scroll still fails:** Mobile Safari may not respect `min-width` on `<table>` elements the same way desktop does, or the `overflow: hidden` on the `.s-card` parent may be clipping the scroll container. The next AI should:
1. Test whether adding `width: 1216px` (explicit, not min) to the table forces overflow
2. Check if removing `overflow: hidden` from the s-card wrapper fixes it
3. Consider whether the colgroup approach is sufficient or if each `<td>` also needs `min-width`
4. Verify sticky works by inspecting computed styles in Safari DevTools

---

### Table Tuning mode ✅ BUILT — INTERACTIVE DEVICE VERIFICATION PENDING

Stan approved taking time out from Stage 4 to build a reusable visual table-authoring tool so column widths and frozen columns can be approved by sight instead of discussed as abstract pixel values.

**What was built:**
- `components/dev/TableTuner.tsx` — global development-only tuner available for every rendered HTML table
- **Tables** action inside the existing `DEV` menu; choose any table on the current route
- The `DEV` launcher is mounted globally through `Providers`, so it appears on every route; dashboard-only Orb simulation controls portal into the same panel when available
- Fixed a server/client hydration mismatch in the dashboard DEV-control portal by deferring portal lookup until React confirms client hydration
- Closing Table Tuning now exits tuning mode by removing drag boundaries and cancelling table-pick mode while preserving the auto-saved visual draft
- Touch-friendly draggable column boundaries that update the real rendered table
- Editable numeric pixel-width fields for direct entry alongside drag resizing, with a 24px minimum
- Spreadsheet-style **Freeze through** and **Unfreeze** controls; frozen columns are always contiguous from the left
- Strong visual divider after the final frozen column
- Draft widths/frozen count persist in local storage during iteration
- Platform detection uses Orb's rules: iPhone at `767px` or narrower, iPad for wider coarse-pointer devices, Mac for wider fine-pointer devices
- Mac, iPad, and iPhone drafts are stored independently; tuning one platform does not overwrite another
- **Copy configuration** exports the route/table signature, active platform, viewport, scroll container `clientWidth`/`scrollWidth`, and all saved platform presets with measured widths and `frozenColumns`
- `components/Providers.tsx` mounts the tuner globally in development only
- `app/globals.css` and `docs/ui-catalog.md` document the new pattern

**Verification completed:**
- `npx tsc --noEmit --pretty false` — passes
- Focused ESLint for `TableTuner.tsx` and `Providers.tsx` — passes with no warnings
- UI catalog verification — passes
- Full `npm run lint` — exits 0; remaining warnings are pre-existing
- Production build reached Turbopack compilation but could not complete in the sandbox because `next/font` could not fetch DM Sans and Cormorant Garamond from Google Fonts

**Verification still required:**
- Codex browser automation was blocked from opening `https://localhost:3001` by the browser security policy.
- Stan must perform the first interaction pass in the existing localhost browser: choose Audit Log, drag Before/After/Created widths, freeze through Action, copy the configuration, refresh to confirm persistence, and reset.
- After Stan declares the layout correct, apply the copied values to `SettingsAudit.tsx` and use the exported `clientWidth`/`scrollWidth` evidence to finish Stage 4 without another CSS guess.

**Database impact:** none. No queries, writes, tables, columns, indexes, or Realtime subscriptions.

---

### Circular navigation conformity

- Added shared `.nav-circle-btn`: strict 44×44 width/min/max dimensions, `appearance: none`, circular border, hover background, and pressed background/scale feedback. This follows the Knowledge Repo iOS Safari rule that `border-radius: 50%` alone does not prevent oval buttons.
- Audit Log search controls now have captions: **Search by text fields** above the text search field and **Search by create date** above the Created date filter button.
- The Audit Log Created filter sits beside the search field instead of in the page header, and the old `Times: Pacific/Honolulu` helper text was removed.
- Audit Log now uses a compact standard green **Search by...** button/dropdown to reduce toolbar real estate. Text fields mode shows only text search; Created date mode hides and clears text search, shows the Created date filter button, and opens the date filter modal when selected.
- Audit Log moved **User** to the first data column and freezes only the checkbox plus User column on every platform.
- Table column navigation now anchors to the far right of the table toolbar as a borderless **prev/next columns** group with compact 40px circular arrow buttons and tooltips; it wraps under when the viewport is constrained.
- Table pagination First/Previous/Next/Last controls use the same circular class and tooltips.
- HScrollNav arrows and icon-only filter/view close controls also use the shared circular pattern.

### Create modal polish

- `components/TodoForm.tsx` now uses the canonical `modal-center modal-lg` structure instead of the standalone `.tf-*` modal shell.
- The New Task modal has a named header, explanatory subcopy, proper `pf-field` labels, larger title input, responsive metadata grid, monospace URL field, and canonical footer actions.
- `components/settings/SettingsAudit.tsx` now applies the same canonical padding and top-right close alignment to the Audit Log Created date-time filter modal, with copy changed to "All times local ({local time})."
- Removed the old `.tf-*` modal CSS from `app/globals.css`; `docs/ui-catalog.md` now marks it as deprecated/removed.
- `AGENTS.md` and `docs/ui-catalog.md` now include the UI Assembly Protocol: identify the UI family, inspect canonical examples, reuse existing structure/classes, ask Stan when multiple viable patterns fit, and when no viable catalog pattern exists, ask whether a new catalog pattern should be added before creating one.

---

### Not started

- **ORB-265:** Full Audit of Orb Instructions — Orb fabricates todo numbers and silently fails operations. Deferred until audit work is complete.

---

### Other changes in this session

- `app/account/page.tsx` — minor edit
- `components/settings/ChangeEmailModal.tsx` — minor edit
- `docs/ui-catalog.md` — updated with new patterns

---

## Commit / Push State

Stan explicitly approved handoff, commit, and push on 2026-06-15 even though this todo is not quite complete.

Expected final state after this handoff: committed to `main` and pushed to `origin/main`.

Run `git status --short` to confirm clean.

**New files:**
- `components/dev/TableTuner.tsx`
- `lib/system-info.ts`
- `scripts/migrations/20260614_audit_log_system_info.sql`
- `scripts/migrations/20260615_add_audit_search_text.sql`

**Deleted files:**
- `app/actions/diagnose-audit.ts`

**Verification before commit/push:**
- `npx tsc --noEmit --pretty false` — passed
- Focused ESLint for recently touched Audit/CRUD files — passed
- `node scripts/verify-ui-catalog.js` — passed
- `git diff --check` — passed
- Orb eval Tier 1 — 8/8 PASSED (Claude Code, 2026-06-15)

---

## Finish-Up Instructions For Claude Code

Stan is handing this off to Claude Code to finish the release gate, commit, and push.

Codex completed the handoff update and file-based checks, but did **not** commit or push. Codex also did **not** complete Orb Tier 1 eval because the eval runner requires the user-started localhost dev server on `https://localhost:3001`, which Codex could not reliably access in this session.

Claude Code should:

1. Re-read this `HANDOFF.md`, `AGENTS.md`, `docs/ui-catalog.md`, and the changed Audit/table files before editing or committing.
2. Confirm localhost is running and available.
3. Run the mandatory Orb Tier 1 eval:
   ```bash
   NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/orb-eval.ts --tier 1
   ```
4. If Tier 1 is green, update this handoff's verification note with the exact Tier 1 result.
5. Review `git status --short` and `git diff --stat`.
6. Commit all intended changes locally from `/Users/stanleybaptista/Projects/orb`.
7. Push only because Stan explicitly requested this handoff/commit/push path in chat.

Suggested commit message:
```bash
git add -A && git commit -m "feat: improve audit log diagnostics and table controls" && git push origin main
```

Important: this todo is intentionally not quite complete. Do not mark ORB-254 closed unless Stan explicitly says to close it. Next session should pick up remaining Audit Log/table UX testing from the "Known incomplete / next pickup" section above.

---

## Panel Transitions — Design Notes for Next AI

The orb panel and list panel currently use **conditional rendering** (mount/unmount) to show/hide. This means CSS transitions can't animate them — the element doesn't exist in the DOM before it appears.

**Current pattern** (UnifiedDashboard.tsx):
```
{showOrb && <OrbConversation ... />}
{showList && <div className="ud-list-content">...</div>}
```

**To add transitions, the next AI needs to:**
1. Keep both panels always mounted in the DOM
2. Use CSS classes to control visibility (`opacity`, `transform`, `pointer-events`)
3. Toggle a class like `panel--visible` / `panel--hidden` instead of conditional rendering
4. Add CSS transitions (~200ms) for the opacity/transform change
5. Use `pointer-events: none` on hidden panels to prevent interaction
6. Consider: hidden panels still run effects/subscriptions — may need to gate data fetching behind visibility state to avoid unnecessary API calls

**Complexity:** Medium-high. The panels have state (conversation history, scroll position) that benefits from staying mounted. But they also have polling/subscriptions that shouldn't run when hidden. Test on all three platforms — the resize handle between panels also needs to work correctly with always-mounted panels.

---

## Earlier Sessions

**ORB-260, ORB-261, ORB-262 — Auth & Settings overhaul — 2026-06-13 (Claude Code, Opus 4.6)**
- Restored explicit passkey button on login. Stale passkey flows. Split compound Data page. Removed breadcrumbs. Passkey migration to Account page. Email change flow. v0.5.224.

**ORB-255 global filtering + ORB-252 repository inspection — 2026-06-12 (Codex)**
- Full-dataset filtering/sorting on Knowledge Repository and Audit Log. Repository access for Admin/Super Admin/Developer roles.

**ORB-196: Unified Toolbar + Modal Conformity — 2026-06-10 (Session 76, Claude Code)**
- Merged AppNav + CommandBar. SearchModal. Modal footer standardization. Empty states.

---

## Key Decisions

- **Unified toolbar: same 6 buttons on all screens.** No desktop/mobile split. Search is a modal trigger button (Linear Cmd+K pattern), not an inline input. Orb and List are paired edge buttons with accent color.
- **Modal conformity:** All modals use `modal-footer` with `justify-content: flex-end`. Cancel = `btn-cancel` (looks like text). Primary = `btn-primary` (green fill). Delete = `btn-danger` (red fill) with `marginRight: auto` (far left). X close button top-right.
- **Filter presentation:** Kebab menus, not native selects or pills. Consistent with commands rule: styled dropdown triggered by a button. Accessibility contract: menu/menuitemradio pattern with keyboard support.
- **Accessibility hardening boundary:** No redesign unless a real contrast/motion failure is found. Prefer visible titles and labels as accessible names; attach destructive confirmation text to the final destructive action.
- **Resize divider behavior:** Do not snap the divider back to preset ratios after drag. Persist the exact user-selected position; use a 40px coarse-pointer gutter on iPad/touch.
- **Project switcher language:** The dashboard project selector is "Change Project", not "Search"; `SearchModal` remains reusable with a default title of "Search".
- **Empty states:** OrbMini SVG illustration + message. 5 variants. "Ask Orb" not "Ask the Orb".
- **Loading states:** Skeleton shimmer rows, never bare "Loading…" text.
- **Git push is NEVER automatic.** Structural enforcement via settings.local.json.
- **Disabled opacity normalized to 0.7** across the entire app.
- **Three-tier font scaling:** Desktop → Tablet (touch) → Phone.
- **Staging environment removed.** Two-tier workflow: localhost → production.
- **Orb identity: Brownie temperament, butler intelligence.**
- **Email change: instant via admin API.** No confirmation email, no sign-out. Session refreshes in place, PasskeyGate handles re-registration.
- **Column resize removed.** Sticky columns + horizontal scroll replaces resize. `stickyColumns` is a per-table config on SettingsCrudList.

---

## Next Priorities

1. **Verify Table Tuning mode on localhost** — tune Audit Log widths visually, freeze through Action, and copy the exported configuration.
2. **Fix Stage 4 using measured evidence** — apply Stan-approved widths and use exported scroll dimensions to resolve iPhone horizontal scrolling.
3. **Commit** — once all stages are verified. No push without Stan's explicit approval.
4. **ORB-265** — Full Audit of Orb Instructions (after audit work is done).

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Never `git push` without Stan's explicit in-chat approval** — structural enforcement via settings.local.json
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

## AI Tool Used Last Session

`2026-06-14 — Claude Code (Opus 4.6)`

---

*Updated by AI at end of each session. Committed with session code changes.*
