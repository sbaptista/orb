-- 20260527_explicit_grants.sql
--
-- Future-proof against Supabase's upcoming breaking change:
-- After Oct 30 2026, new public tables won't auto-expose to the Data API.
-- Existing tables keep their grants, but new tables will need explicit ones.
--
-- This migration:
--   1. Tightens existing table grants (revoke excess, grant only what's needed)
--   2. Sets ALTER DEFAULT PRIVILEGES so future tables get correct grants automatically
--
-- Ref: https://github.com/orgs/supabase/discussions/45329

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- PART 1: Tighten grants on all 17 existing tables
-- ═══════════════════════════════════════════════════════════════════
--
-- Current state: anon/authenticated/service_role all have FULL privileges
-- (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER) on every table.
-- That's far too permissive. RLS is the safety net, but grants should be minimal.

-- Revoke everything from anon on all tables first, then grant back selectively.
-- anon should only read lookup/metadata tables — never write user data.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM service_role;

-- ── Lookup / metadata tables (read-only for everyone) ──
GRANT SELECT ON public.priorities TO anon, authenticated, service_role;
GRANT SELECT ON public.statuses TO anon, authenticated, service_role;
GRANT SELECT ON public.roles TO anon, authenticated, service_role;

-- ── System settings (anon reads for app config; authenticated can modify) ──
GRANT SELECT ON public.system_settings TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.system_settings TO authenticated, service_role;

-- ── Core user data tables (authenticated + service_role only) ──
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todos TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platforms TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todo_platforms TO authenticated, service_role;

-- ── Audit, feedback, notifications ──
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_log TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_repo TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orb_friction TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════
-- PART 2: Future-proof — ALTER DEFAULT PRIVILEGES
-- ═══════════════════════════════════════════════════════════════════
--
-- After Oct 30 2026, Supabase will remove the implicit default privileges
-- that currently auto-grant everything to anon/authenticated/service_role.
-- These statements ensure any new table created by `postgres` (the role
-- used by psql migrations and Supabase dashboard) automatically gets
-- the right grants.

-- First revoke the overly-permissive defaults set by Supabase
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM service_role;

-- Then set minimal defaults for new tables:
-- anon: read-only (lookup tables; user data tables are protected by RLS anyway)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;

-- authenticated: full CRUD (RLS policies enforce row-level access)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- service_role: full CRUD (bypasses RLS by design)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

-- Note: supabase_admin default privileges are managed by Supabase itself.
-- We cannot ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin from the
-- transaction pooler connection. Supabase will update these when they
-- roll out the breaking change (Oct 30, 2026). Our psql migrations run
-- as `postgres`, so the defaults above cover our migration path.

COMMIT;
