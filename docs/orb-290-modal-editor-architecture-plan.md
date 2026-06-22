# ORB-290: Modal Editor Architecture Plan

**Status:** Approved for implementation by Stan on 2026-06-22.

## Decision

ORB-290 should not be completed by adding more keyboard handlers to `SettingsCrudList` and `TodoPanel`. The feature exposes a shared editor lifecycle that is currently implemented separately in multiple modal families.

The bounded rewrite will create a shared behavioral foundation for editor-style modals while preserving the existing `modal-center`, `modal-header`, `modal-body`, and `modal-footer` visual system. This is not an app-wide modal rewrite and does not change the visual model without separate design approval.

## Why A Rewrite Is Warranted

Current implementation review found:

1. `SettingsCrudList` simultaneously owns collection rendering, pagination, server loading, cards, selection, modal state, dirty tracking, close confirmation, and keyboard behavior.
2. `TodoPanel` duplicates the same editor lifecycle independently.
3. Ticket editing bypasses CrudList persistence and close state through a custom footer, making successful save/close behavior unsafe.
4. The current worktree does not type-check because `handleModalKeyDown` is referenced after its function was removed.
5. A scope-prefilled add form can be marked dirty before the user changes anything.
6. A TodoPanel save does not reliably replace the dirty baseline, so ORB-290's required post-save disabled state is not guaranteed.

These are signs that the editor lifecycle needs one owner. They are not isolated keyboard bugs.

## Architecture Target

### 1. `EditorModal` behavioral shell

Create one shared client component or tightly scoped component/hook pair for editor-style modal behavior.

It owns:

- canonical `modal-center` composition, dialog semantics, focus placement/restoration, backdrop and X dismissal requests, and the existing settings scroll lock;
- Escape handling for the active, topmost editor only;
- Shift+Return as the editor default action, only when a valid save action exists;
- a single confirmation dialog for dirty dismissal;
- footer placement and the Save/Cancel/Discard lifecycle.

It does **not** own domain fields, validation rules, persistence details, ticket email previews, or collection rendering.

### 2. `useDirtyEditor` state contract

Use one controller for every editable form. Its public contract must include:

- `form`, `setForm`, `isDirty`, `isSaving`, and `error`;
- `openAdd(initialForm)` and `openEdit(initialForm)` that set an immutable normalized baseline;
- `save()` that validates, persists, and replaces the baseline with normalized saved data before resolving;
- `requestClose()` that either closes or presents the dirty confirmation;
- `discard()` that closes without persisting.

Dirty comparison must be semantic and normalized, not incidental object serialization. For example, URL text must use the same trimmed-line representation before comparison and persistence.

### 3. Per-entity editor adapters

Each entity supplies a narrow adapter:

- `toForm(record)` and `toRecord(form)`;
- `normalize(form)`;
- `validate(form)`;
- `save(form, mode)`;
- optional body layout and post-save behavior.

Tickets remain a rich `modal-compose` editor with preview, but its adapter returns the persistence result to the shared controller. It must not replace the footer or close lifecycle.

Todo editing uses the same foundation, with its existing close/distillation behavior expressed as a post-save result: a normal save refreshes the baseline; closing a todo may open the follow-up distillation step rather than dismissing prematurely.

### 4. `SettingsCrudList` narrowed back to collections

It retains:

- server/client loading, search, filtering, sorting, pagination, desktop table and mobile-card rendering, selection, and row action dispatch.

It loses:

- modal markup;
- dirty snapshot state;
- keyboard listener ownership;
- dirty dismissal prompt rendering;
- arbitrary `renderFooter` persistence escape hatches.

Its API becomes simple: `onAdd`, `onEdit(item)`, and optional `onRowClick(item)` dispatch to the page's editor controller.

## Modal Taxonomy

The keyboard rule must not be applied indiscriminately to every dialog.

| Family | Examples | Dirty state | Shift+Return |
|---|---|---:|---:|
| Editor | Todo, Project, Category, Knowledge, Memory, User, Ticket | Yes | Save and close when valid/dirty |
| Create editor | New todo, new project, add setting record | Yes after user input | Create and close when valid |
| Search/filter | Text search, date search, project picker | No | Existing explicit search/select contract only |
| Confirmation | Delete, discard, destructive actions | No | No universal save command |
| Read-only/command | Help, print, detail views, commands | No | No universal save command |

Escape means "request dismissal" for all dialogs, but only editor dialogs may need a dirty confirmation.

## Migration Sequence

### Phase 0 — Stabilize the branch before behavior changes

1. Restore a green TypeScript baseline by removing the stale `handleModalKeyDown` reference or restoring a defined handler only as a temporary correction.
2. Correct the metrics migration history so a clean database can run every migration exactly once. Do not edit an already-applied historical migration to represent a later schema change; make the follow-up migration idempotent or restore the original migration and put changes exclusively in the later migration.
3. Write interaction tests against the current behavior before extraction.

### Phase 1 — Build and verify the shared editor core

1. Add `EditorModal` and `useDirtyEditor` using the existing catalog's `modal-center` structure and z-index stack.
2. Define normalized dirty comparison per form type.
3. Implement focus, topmost-modal keyboard ownership, IME/composition safety, and no duplicate submission while saving.
4. Add a small test harness or component-level test fixture for the editor contract.

### Phase 2 — Migrate generic settings editors

Migrate Categories, Projects, Knowledge, Memory, and Users first. They are simple forms and establish the adapter pattern without Ticket or Todo complexity.

### Phase 3 — Migrate Tickets

Move Tickets to an adapter with a custom body only. The shared editor owns saving, disabled state, success baseline, close, and dirty prompt. Validate reporter email behavior, linked-todo warning, and refresh behavior.

### Phase 4 — Migrate TodoPanel

Move TodoPanel to the same controller while preserving its domain-specific fields, audit write, urgency check, and distillation follow-up. Verify an ordinary save stays open and becomes clean; Shift+Return saves and closes unless a close-to-distill transition is required.

### Phase 5 — Remove legacy modal behavior from CrudList

Delete the redundant modal/dirty/keyboard code and `renderFooter` escape hatch after all settings consumers are migrated. Update the UI catalog with the behavioral contract and consumer list.

## Metrics Follow-up (Separate, But Required Before Release)

The metrics feature is not part of the editor rewrite, but its current work must be corrected before this batch is released:

1. Summary cards currently aggregate only the loaded page (maximum 50 rows), not the filtered result set. Add a separate aggregate RPC/result with the same search/date filters.
2. Decide explicitly whether evaluation calls belong in operational usage totals. If yes, label them or add a source dimension; if no, exclude them.
3. Document whether metric recording is best-effort. If it must be complete, await it or use a durable queue rather than fire-and-forget promises.
4. Keep pricing/rate provenance outside the browser-only hardcoded map, or label estimates with a rate version/effective date.

## Database Impact

The modal/editor rewrite itself does not require a schema change.

Metrics requires a new read pattern for filtered aggregates. Add an RPC that returns totals with the same predicates as `get_orb_metrics_page`; verify its query plan against `orb_metrics(user_id, date, model)` and add an index only if the actual filter/sort plan needs one. No Realtime subscription is justified.

Before any metrics migration, run the AGENTS database health inspection queries before and after, and verify a clean database can replay the complete migration sequence.

## Required Verification

For each migrated editor, verify on Mac, iPad, and iPhone:

1. Opening an existing record: Save disabled.
2. Change a value: Save enabled.
3. Revert exactly: Save disabled.
4. Save: baseline refreshes and Save disables without closing.
5. Shift+Return: saves once and closes when the editor is valid and dirty.
6. Return as the first character in a textarea: inserts a newline and remains usable.
7. Escape, backdrop, and X: clean form closes; dirty form presents Save / Discard / Keep Editing.
8. Nested confirmation: only the topmost dialog receives Escape or default actions.
9. Ticket: successful save closes without a false dirty prompt and cannot double-submit.
10. Todo close: existing distillation and audit behavior remain correct.

Run `npx tsc --noEmit`, the relevant UI tests, `node scripts/verify-ui-catalog.js`, and `git diff --check`. Orb eval changes are not expected unless conversational behavior changes; if it does, extend `scripts/eval-cases.ts` and pass Tier 1 before push.

## Approval Gate

Stan has approved planning and asked for this design. Implementation requires explicit approval after reviewing this plan.
