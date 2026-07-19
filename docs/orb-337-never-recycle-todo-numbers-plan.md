# ORB-337 — Never-Recycle Todo Number Plan

**Status:** Implemented as v0.6.216; production database migrated and verified; aligned application release pending.
**Prepared:** 2026-07-18 — Codex (GPT-5)
**Scope:** Make every project’s `todo_number` allocation monotonic and concurrency-safe across create, move, hard-delete, REST, UI, serial Orb, Realtime Orb, and ticket-to-todo paths.

**Execution status (2026-07-18 HST):** The production migration was applied transactionally under maintenance and the full disposable verification suite passed. Production maintenance remains active until Stan’s Tier 1 eval is green and the aligned v0.6.217 application is explicitly approved, pushed, deployed, and smoke-tested.

---

## Decision Already Made

Stan’s standing decision in ORB-337 is authoritative:

- A number issued within a project is never issued again, even after the todo moves away or is hard-deleted.
- `todos.id` is the permanent identity.
- `<project code>-<todo_number>` is the todo’s current address. A move keeps the UUID but assigns the destination project’s next never-before-issued number.
- Titles remain non-unique human search keys.
- Historical codes may become honestly dangling after a move, but must never silently retarget to another todo.

This plan does not reopen those product decisions.

---

## Research Findings

### Current database state

- `public.todos.todo_number` is nullable in the schema, but all 421 current rows have a number.
- No current `(product_id, todo_number)` duplicates exist.
- There is no unique constraint on `(product_id, todo_number)`.
- The `set_todo_number` insert trigger calls `assign_todo_number()`, which always assigns `MAX(todo_number) + 1`.
- `confirm_realtime_todo_mutation()` independently uses `MAX(todo_number) + 1` for moves.
- Current indexes include a non-unique, active-row-only index on `(product_id, todo_number)`. It cannot enforce the invariant and excludes soft-deleted rows.

### Allocation paths found

1. Ordinary UI, serial Orb, and other todo creates insert into `todos`; the insert trigger assigns the number.
2. `TodoPanel` moves by changing `product_id`; today it preserves the old number because no move trigger exists.
3. REST PATCH (`app/api/tasks/[id]/route.ts`) queries the destination maximum in application code and writes the next number.
4. Serial Orb has two move execution branches in `app/actions/orb-converse.ts`; both query the destination maximum and write the next number.
5. Realtime Orb’s `confirm_realtime_todo_mutation()` queries the destination maximum inside its transaction.
6. Ticket-to-todo creation calculates a maximum in `app/actions/ticket-actions.ts`, although the insert trigger currently overwrites the supplied value.
7. Data import uses todo upserts. The existing insert trigger already replaces supplied numbers for inserted rows; ORB-337 must not silently worsen restore semantics, and the import path needs an explicit regression check.

### Why current-row `MAX()` is not a safe seed

Production data already contains retired numbers above the surviving-row maximum:

| Project | Current todo maximum | Highest audited number | Required initial high-water |
|---|---:|---:|---:|
| Adele’s adulations | 3 | 4 | 4 |
| CAN26 | 43 | 44 | 44 |
| Helm | 63 | 64 | 64 |
| Miracles on Parade | 6 | 6 | 6 |
| Orb | 341 | 341 | 341 |
| Pre-todos | 7 | 0 | 7 |
| mrstokely-from-boston | 0 | 4 | 4 |
| Tickets | 2 | 1 | 2 |

Seeding from current todos alone would immediately make retired addresses reusable in four projects. The migration must seed each project from the greater of:

- every surviving todo number, including soft-deleted rows; and
- every parseable todo code in `audit_log.before.code` and `audit_log.after.code`.

The audit log is the best available historical record, not a proof that every pre-audit hard deletion can be reconstructed. The guarantee becomes absolute for all allocations after this migration; already-reused historical codes cannot be made unique retroactively.

Do **not** add an arbitrary seed buffer such as `+1000`. No finite buffer can prove that an unobserved historical number is avoided, while a buffer would immediately jump visible addresses (for example, ORB-342 would become ORB-1342). Seed from all recoverable evidence, document the historical boundary honestly, and make the forward guarantee structural.

### Database health baseline

- `todos`: 73,601 sequential scans / 14,829,074 tuples read; the existing hot-path indexes remain relevant.
- `todos`: 421 live / 87 dead rows, reported dead-row ratio 20.7%.
- No RLS init-plan violations were found.
- Disk-reading statements were overwhelmingly cache hits; no ORB-337-specific disk-read concern was observed.

Before applying the migration, recheck the dead-row count and run `VACUUM ANALYZE public.todos` with Stan’s approval if the ratio remains above 20%.

---

## Recommended Architecture

### 1. Internal per-project counter table

Add `public.project_todo_number_counters`:

- `project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE`
- `last_issued_number integer NOT NULL CHECK (last_issued_number >= 0)`

This table is preferable to a counter column on `projects` because every allocation would otherwise fire the project’s general `updated_at` trigger and make an internal todo allocation appear to be a user-visible project edit.

Enable RLS. Authenticated reads, if retained for diagnostics, must use an owner/admin policy with `(SELECT auth.uid())`; client inserts/updates/deletes remain forbidden. Counter mutation is owned by the hardened trigger function, not by application code.

Concrete access model:

- revoke `INSERT`, `UPDATE`, and `DELETE` from `anon` and `authenticated`;
- grant no client write policy—the absence of a permissive write policy denies writes under RLS;
- if diagnostic reads are exposed, grant only `SELECT` and add one owner/admin policy that resolves the counter row through `projects.created_by = (SELECT auth.uid())` or `(SELECT is_admin())`;
- do not add a misleading `"deny all"` policy alongside the read policy: PostgreSQL’s default policies are permissive and combine with `OR`, so `USING (false)` adds no protection beyond the absence of another policy.

### 2. One database-owned allocator

Replace `assign_todo_number()` with a fixed-search-path, `SECURITY DEFINER` trigger function that atomically increments the destination counter through:

```sql
INSERT ... ON CONFLICT (project_id)
DO UPDATE SET last_issued_number = project_todo_number_counters.last_issued_number + 1
RETURNING last_issued_number
```

The row-level conflict update is the serialization point. Concurrent creates or moves into the same project cannot receive the same number. A failed later transaction rolls the increment back with the transaction; committed deletions and moves never decrement it.

Use the function from two triggers:

- `BEFORE INSERT ON public.todos` — always assigns the next number.
- `BEFORE UPDATE OF product_id, todo_number ON public.todos`:
  - if `product_id` changed, assigns the destination’s next number;
  - increments only the destination counter; the source counter is never decremented or otherwise touched;
  - if `product_id` was included in the update but did not actually change, leaves the number untouched;
  - if only `todo_number` changed, rejects the update as an illegal address rewrite.

This makes the database boundary authoritative for UI, REST, serial Orb, Realtime Orb, service-role calls, and future paths.

`ON CONFLICT ... DO UPDATE` takes the required row lock; PostgreSQL’s default `READ COMMITTED` isolation is sufficient. `SERIALIZABLE` is unnecessary and would add retry behavior without strengthening this single-row allocation invariant.

The only other current `BEFORE UPDATE` trigger is `todos_updated_at`; it does not consume `todo_number`. Name the allocation trigger deterministically and verify trigger order from `pg_get_triggerdef` after migration rather than relying on creation order.

### 3. Structural constraints

After validating current rows:

- set `todos.todo_number` to `NOT NULL`;
- add `CHECK (todo_number > 0)`;
- add a full unique constraint/index on `(product_id, todo_number)`, including soft-deleted rows.

The unique constraint is defense in depth. The counter prevents reuse after rows disappear or move; the constraint prevents two surviving rows from sharing an address if a future path bypasses allocation.

### 4. Remove application-owned allocation

Once the trigger is installed:

- REST moves set only `product_id` and use the returned row’s actual `todo_number`.
- Both serial Orb move branches set only `product_id`, select the returned number, and build speech/audit output from the returned row.
- Realtime confirmation removes `v_next_number` and its `MAX()` query; its row-locked update sets only `product_id` and reads the trigger-assigned number through `RETURNING`.
- Ticket-to-todo creation removes its redundant maximum query and explicit `todo_number`.
- `TodoPanel` needs no new allocation code; its existing returned-row update becomes correct once the move trigger exists.
- Backup restoration preserves exported UUIDs **and** exported todo addresses through a dedicated service-role-only restore path. The normal insert/move trigger must never trust a client-supplied number.

Repository search after implementation must find no live todo allocation based on `MAX(todo_number)` or a descending maximum query. Historical migration files remain unchanged.

### 5. Preserve the Backup & Recovery contract

`SettingsBackup` describes the archive as a portability layer that “restores or merges” exported data, and the confirmation says matching IDs are upserted. A recovery import must therefore preserve a todo’s UUID, project, and `todo_number`; treating restored todos as newly created items would silently break historical references.

Add a narrowly scoped restore mechanism:

- a batch restore RPC/function executable only by `service_role`, with execute revoked from `PUBLIC`, `anon`, and `authenticated`;
- `importData()` remains admin-gated and calls that trusted restore path for todos;
- the restore transaction sets a transaction-local restore mode while keeping every trigger enabled, upserts the exported rows with their explicit numbers, rejects any address collision belonging to a different UUID, and advances each project counter to `GREATEST(existing high-water, imported todo_number)`;
- ordinary inserts and moves continue to ignore caller-supplied numbers and allocate through the counter;
- restoring the same UUID/address is idempotent; restoring a different UUID into an already occupied address fails closed with a clear archive-integrity error.

This corrects an existing recovery defect: the current insert trigger overwrites exported numbers when restoring rows that no longer exist.

Do not implement restore by running `ALTER TABLE ... DISABLE TRIGGER`. Trigger state is table-global, not scoped to one archive transaction, so concurrent ordinary writes could bypass allocation. The transaction-local restore mode is entered only inside the service-role-only restore function and is consumed by the still-enabled trigger.

### 6. Delete semantics

Actual hard deletes exist in serial Orb deletion and archive purge paths, even though the external REST DELETE is soft. Todo deletes never touch the counter table, so neither soft nor hard deletion returns a number to the pool.

The counter row is tied to the project UUID and survives project soft deletion. A hard-deleted project ends that project’s lifetime and cascades its counter row; preventing a newly created project with the same human code from reusing the prior project’s address namespace is a separate project-code lifecycle decision, not a todo-number allocation rule. Record that boundary rather than silently broadening ORB-337.

---

## Implementation Files

Expected files, subject to final diff review:

- New `scripts/migrations/20260718_never_recycle_todo_numbers.sql`
- New `scripts/rollbacks/20260718_never_recycle_todo_numbers.sql`
- New `scripts/verify-never-recycle-todo-numbers.ts`
- `app/api/tasks/[id]/route.ts`
- `app/actions/orb-converse.ts`
- `app/actions/ticket-actions.ts`
- `app/actions/import-data.ts`
- A new migration redefining or the main migration redefining `confirm_realtime_todo_mutation()` from the current production body
- `docs/api-spec.yaml` — make REST move support and destination allocation accurate
- `docs/object-capability-matrix.md` — record the internal counter surface and create/move integrity coverage
- This plan
- Release bookkeeping only after feature work is complete: `package.json`, `package-lock.json`, `lib/version.ts`, `lib/changelog.ts`, `HANDOFF.md`

No UI component or CSS pattern is added. `docs/ui-catalog.md` does not change.

---

## Database Impact Analysis

| Required question | ORB-337 answer |
|---|---|
| New query pattern? | Yes. Each create/move performs one primary-key counter-row upsert/update inside the existing todo write transaction. The counter table’s primary key is the required index. |
| Realtime / `postgres_changes`? | No. No subscription or WAL reader is added. |
| Frequent writes? | No. One counter write occurs only when a todo is created or moved—not on render, polling, typing, or background startup. |
| New table? | Yes. It receives RLS, explicit grants/revokes, a primary key, FK cascade, and an owner/admin read policy using `(SELECT auth.uid())`. |
| New WHERE/JOIN column? | `project_id` is the primary key of the counter table; no extra index is needed. |

The change replaces a project-wide maximum scan with an indexed single-row update. It should reduce allocation read work while adding a very small serialized write per destination project.

---

## Performance Instrumentation Decision

Instrumentation is required because this changes todo create/move writes and introduces a database row-locking path.

No new browser telemetry hook is proposed:

- dashboard todo creation already records `dashboard-clicks / dashboard-todos / todo_create`;
- TodoPanel saves/moves already record `dashboard-clicks / dashboard-todos / todo_panel_save`;
- Realtime create/move is already covered by voice turn and gateway telemetry;
- the REST response and database verification cover the external-agent path.

Update the performance matrix to identify the counter allocation as part of those existing measurements. Compare warm create and move timings before/after on Mac, iPad, and iPhone; investigate only if the existing interaction metrics regress.

Do not add `clock_timestamp()` logging inside the trigger. Persistent per-allocation timing writes would add overhead to the invariant being measured; the existing end-to-end measurements already include the counter upsert and row-lock time.

---

## Verification

### Migration preconditions

1. Confirm no null or duplicate `(product_id, todo_number)` rows.
2. Recompute current and audited high-water values.
3. After seeding, fail the migration unless every project satisfies both `MAX(all surviving todo_number) <= counter.last_issued_number` and `MAX(all parseable audited todo number) <= counter.last_issued_number`.
4. Confirm all project codes used for audit parsing are immutable and unambiguous.
5. Re-run the canonical database-health queries.
6. If `todos` dead rows remain above 20%, request approval and run `VACUUM ANALYZE public.todos` before migration.

### Transactional behavior

Using disposable projects/todos and guaranteed cleanup:

1. Create numbers 1 and 2; hard-delete 2; the next create must be 3.
2. Move a todo out; the source project’s next create must not reuse its retired number.
3. Move a todo into a destination; it receives destination high-water + 1.
4. Move it back; it receives a new source address while keeping the same UUID.
5. Attempt a direct `todo_number` rewrite without a project move; it must fail.
6. Insert multiple todos concurrently into one project; all numbers must be unique and the counter must advance exactly once per committed insert.
7. Attempt a failed create/move transaction; confirm rollback does not leave an inconsistent todo/counter pair.
8. Verify ordinary TodoForm create, TodoPanel project move, REST move, serial Orb move, Realtime move, and ticket-to-todo creation all report the number returned by the database.
9. Export and restore a disposable data set. Confirm restored todos preserve UUID, project, and `todo_number`; the counter advances to at least the largest imported number; repeating the same archive is idempotent; and a different UUID claiming an occupied address fails closed.

### Static and contract checks

- `npx tsc --noEmit`
- focused ESLint for changed TypeScript files
- `git diff --check`
- repository search shows no live `MAX(todo_number)` allocation
- object-capability matrix and REST spec match the implementation

This is not a new Orb conversational tool, parameter, routing rule, or speech policy, so no new eval case is required. The existing move/create Tier 1 coverage remains applicable, and Stan still runs `npm run eval:t1` before any production push.

---

## Rollout

This is a high-risk schema change and remains on the existing required short-lived branch.

The migration and application cleanup are mutually dependent. The table, seed, functions, triggers, and constraints are one transactional migration—not separately exposed production steps. Use a maintenance window:

1. Finish and locally verify code plus migration.
2. Stan reviews and approves the production sequence.
3. Enable maintenance mode and stop todo mutations.
4. Re-run preconditions and health checks.
5. Apply the migration.
6. Run database invariants and focused create/move checks.
7. Push the aligned application release only after Stan’s explicit in-chat approval.
8. Confirm the deployment, REST response, UI create/move, serial Orb, and Realtime behavior.
9. Disable maintenance mode.

The counter trigger protects old application writes, but pre-migration application code can calculate and narrate a stale maximum when historical audit high-water exceeds current rows. Do not leave the migrated database paired with the old application outside maintenance mode.

---

## Rollback

Prepare a rollback migration before production application:

- restore the prior insert-only trigger and prior Realtime function body;
- drop the move/immutability trigger and new structural constraints;
- preserve a snapshot of counter values for diagnosis.

Rollback is safe only while maintenance remains enabled. Reverting to `MAX(todo_number) + 1` reopens the original defect, so it is an emergency compatibility action, not an acceptable steady state. If application deployment fails after the database migration, keep maintenance enabled until either the aligned application deploys or the database rollback completes.

---

## Workspace Prerequisite

Stan confirmed that Claude owns the existing ORB-325 files and approved ORB-337 implementation. Codex claimed only the ORB-337 application, migration, verification, documentation, and release-bookkeeping files. The Realtime database function is changed through the ORB-337 migration; Codex does not edit Claude's active Realtime route files.

---

## Approval

Stan approved the plan and explicitly authorized the build. Application and migration files may be implemented and locally verified. Applying the migration to production remains a maintenance-window step, and git push still requires separate explicit in-chat approval.
