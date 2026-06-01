# Add Explicit Database Grants for Supabase REST/Data API Compatibility

This plan addresses the upcoming Supabase breaking change where new tables created in the `public` schema will no longer be exposed to the Data API (`supabase-js`, PostgREST, and GraphQL) automatically. Explicit `GRANT` statements must be run to expose tables.

## User Review Required

> [!IMPORTANT]
> To ensure the application does not break when Supabase rolls out this restriction (effective May 30, 2026 for new projects and October 30, 2026 for existing ones), we will add explicit database grants for all 17 tables in our `public` schema.

## Proposed Changes

We will introduce a new migration script that grants the required table privileges to the standard Supabase client roles (`anon`, `authenticated`, and `service_role`).

### Database Migrations

#### [NEW] [20260527_add_explicit_grants.sql](file:///Users/stanleybaptista/Projects/orb/scripts/migrations/20260527_add_explicit_grants.sql)
- Explicitly grants `SELECT` privileges to `anon`, `authenticated`, and `service_role` roles for public metadata/settings tables.
- Explicitly grants `SELECT`, `INSERT`, `UPDATE`, and `DELETE` privileges to `authenticated` and `service_role` roles for all user data tables.
- Exposes tables to `service_role` fully.

The migration will contain:
```sql
-- 1. Metadata and lookup tables (accessible by anon, authenticated, and service_role)
GRANT SELECT ON public.system_settings TO anon, authenticated, service_role;
GRANT SELECT ON public.priorities TO anon, authenticated, service_role;
GRANT SELECT ON public.statuses TO anon, authenticated, service_role;

-- 2. System settings updates (restricted to authenticated and service_role)
GRANT INSERT, UPDATE, DELETE ON public.system_settings TO authenticated, service_role;

-- 3. Core user data tables (accessible by authenticated and service_role)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todos TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platforms TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todo_platforms TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_log TO authenticated, service_role;

-- 4. Feedback, notifications, and onboarding tables (accessible by authenticated and service_role)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_repo TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orb_friction TO authenticated, service_role;
```

### Versioning & Handoff

#### [MODIFY] [package.json](file:///Users/stanleybaptista/Projects/orb/package.json)
- Bump version to `0.5.66`.

#### [MODIFY] [version.ts](file:///Users/stanleybaptista/Projects/orb/lib/version.ts)
- Update display version to `v0.5.66`.

#### [MODIFY] [changelog.ts](file:///Users/stanleybaptista/Projects/orb/lib/changelog.ts)
- Document the additions of the database grants migration in `v0.5.66`.

#### [MODIFY] [HANDOFF.md](file:///Users/stanleybaptista/Projects/orb/HANDOFF.md)
- Silently update state to `v0.5.66`.

---

## Verification Plan

### Automated Tests
- Run `npm run build` to verify the codebase compiles.

### Manual Verification
- We can apply the migration SQL locally against our database.
- Verify that the app's tables load correctly when running the server.
