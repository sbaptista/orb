# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads this at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.4.79 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**Production Bug Fix, Settings Tables Overhaul, Cascade Delete — 2026-05-17**

### Production Bug: Settings > Users Stuck on "Loading..."

Root cause: `RESEND_API_KEY` missing from Vercel env vars. `lib/email.ts` initialized `new Resend()` at module scope — Vercel bundled it with `list-users.ts` into one serverless chunk, crashing the entire chunk on load. Fixed with lazy initialization via `getResend()`. Also hardened `listUsers` and `SettingsUsers.load` with try/catch/finally.

### Settings > Users Rewrite

Full rewrite from list layout to sortable table matching Tickets pattern:
- Sortable columns (Name, Email, Role) with click-to-sort headers
- Checkbox selection per row with select-all, bulk delete action bar
- Super admins and protected users excluded from selection
- Removed "View Projects" link

### User Cascade Delete

- Migration `20260517_cascade_user_delete.sql`: Changed `projects.created_by` FK to ON DELETE CASCADE
- `deleteUser()` reassigns shared projects to super admin before delete
- Added `deleteUsers()` bulk action for multi-select delete

### Settings > Projects Enhancements

- Sortable columns: Code, Name, Owner (via SettingsCrudList generic sorting)
- Search/filter input across name, code, description, and owner
- Bulk delete with checkboxes (shared projects excluded from selection)
- Added `deleteProjects()` bulk server action

### SettingsCrudList Generic Upgrades

Extended the generic CRUD component with three capabilities:
- **Sorting**: `TableColumn.sortKey` + `sortValue` with click-to-sort column headers
- **Search**: `searchFilter` predicate + `searchPlaceholder` renders text input above table
- **Bulk delete**: `bulkDelete.canSelect` predicate, checkbox column, bulk action bar

---

## Uncommitted Changes

- `lib/email.ts` — lazy Resend client initialization
- `app/actions/list-users.ts` — try/catch hardening, null check for user
- `app/actions/delete-user.ts` — shared project reassignment + `deleteUsers()` bulk action
- `app/actions/manage-project.ts` — `deleteProjects()` bulk action
- `components/settings/SettingsUsers.tsx` — full rewrite to sortable table with bulk delete
- `components/settings/SettingsCrudList.tsx` — sorting, search, bulk delete generic support
- `components/settings/SettingsProjects.tsx` — sortable columns, search, bulk delete config
- `scripts/migrations/20260517_cascade_user_delete.sql` — CASCADE FK migration (already run)
- `lib/version.ts` — v0.4.79
- `package.json` — v0.4.79
- `HANDOFF.md` — this update

---

## Key Decisions

*   **Email is the stable identity, not auth UUID.** Supabase can replace auth UUIDs on invite/re-invite. All user lookups now go through `resolveUser()` which queries by email first.
*   **Atomic ID reconciliation via Postgres function.** Supabase JS client can't do multi-statement transactions, so FK migration uses a server-side `reconcile_user_id()` function called via `rpc()`.
*   **Shared project access is read+create for users, full access for admins.** Prevents invited users from modifying/deleting feedback they didn't create, while still allowing them to contribute.
*   **Lazy SDK initialization in server actions.** Module-scope SDK constructors crash Vercel function chunks when env vars are missing. Always use lazy getClient() pattern.
*   **Shared projects survive user deletion.** Reassigned to super admin in application code before CASCADE fires. Business rule kept in server action, not DB trigger.
*   **SettingsCrudList for complex tables only.** Statuses and Priorities (short fixed lists) don't need sorting/search/bulk — keep them simple.

---

## Next Priorities

1.  **ORB-105 remaining items** — bulk edits for Priorities and Statuses were deemed overkill; review if any other sub-items remain.
2.  **Monitor production** — verify Settings > Users and Projects pages work correctly after deploy.
3.  **Test cascade delete** — delete a test user and confirm shared projects survive, non-shared projects cascade.

---

## AI Tool Used Last Session

`2026-05-17 — Claude Code (claude-opus-4-6)`

---

*Updated by AI at end of each session. Committed with session code changes.*
