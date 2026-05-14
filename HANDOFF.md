# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads this at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.4.45
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**Settings stabilization, security hardening, Account page separation — v0.4.45**

### Security — RLS owner-only policies
- Stripped all admin bypass from RLS policies (`scripts/migrations/20260513_rls_owner_only_select.sql` — already executed). Dashboard now only shows own data for all roles.
- Admin cross-user access is exclusively via server actions using `createAdminClient()`.
- Role visibility: superadmin sees all, admins see everyone except superadmin, owners see only themselves.

### Server actions created
- `app/actions/get-user-detail.ts` — `getUserDetail`, `getUserProjects`, `getProjectTodos` with role-based visibility checks.
- `app/actions/manage-todo.ts` — CRUD for todos via admin client. Default status fixed from `'pending'` to `'open'`.
- `app/actions/manage-project.ts` — CRUD for projects. Code is now required, validated (uppercase alphanumeric, max 6 chars), uniqueness-checked.
- `app/actions/list-users.ts` — Filters superadmin from admin view.

### Settings UI
- **SettingsUserDetail** — Fully migrated from client-side Supabase to server actions. Column headings added to project list.
- **SettingsProjectTodos** — Made read-only (view-only table). Todo CRUD belongs on the Todos page, not Settings.
- **SettingsTopbar** — Dynamic breadcrumbs, all segments clickable. Breadcrumb override context for correct back-links from project detail pages.
- **NavLink** — Navigation guard wrapper using Next.js `onNavigate` API for unsaved changes protection.
- **UnsavedChangesProvider** — Context provider with beforeunload handler and dismissable toast. Wired into sidebar and topbar.
- **BreadcrumbOverridesProvider** — Context for child components to fix breadcrumb paths (e.g., `/settings/projects` → `/settings/users/{ownerId}`).

### Account page separated
- Moved Account from `/settings/account` to `/account` as a standalone page with its own topbar (`tv-topbar` + `sl-title`).
- Removed Account from Settings sidebar. Settings index now redirects to `/settings/priorities`.
- Dashboard user button links to `/account`.

### Bug fixes
- **useVisibilityRefetch** — Removed aggressive `focus` listener that caused constant page reloads. Added 5-second minimum gap between refetches. Background refetches no longer flash "Loading..." state.
- **Priority dropdown** — Fixed column name (`label` not `name`) in priorities query.
- **Product codes** — Made required with validation and uniqueness check.
- **Statuses** — Fixed all hardcoded `pending`/`in_progress`/`done` to real DB values (`open`, `in progress`, `on hold`, `closed`).

### Consistency
- TodoView and Account page both use `sl-title` for page titles, `tv-version-footer` for version display.

---

## Key Decisions

- **Two-layer security model:** RLS for dashboard (owner-only at DB level), server actions for Settings (role-based admin access via `createAdminClient()`).
- **Settings is for administration, not task management.** Todo CRUD removed from Settings; project todos are view-only. Use the Todos page for mutations.
- **Account is not a Settings page.** It's a standalone page accessible from the dashboard user button.
- **Product codes are required.** The conversational AI resolves todos by splitting task codes (e.g., `ORB-73`). Null codes break this.

---

## Next Priorities

1. Create reusable page/component templates (topbar+back, CRUD list, detail view) so new pages are assembled from existing parts.
2. Fetch live backlog at session start.
3. Review open Orb tickets from the Friction Queue.

---

## AI Tool Used Last Session

`2026-05-13 — Claude Code (Anthropic Claude Opus 4.6)`

---

*Updated by AI at end of each session. Committed with session code changes.*
