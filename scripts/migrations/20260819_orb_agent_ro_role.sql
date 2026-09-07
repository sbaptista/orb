-- ============================================================
-- Agent Capability Broker — Layer 1: read-only agent identity
-- Open findings: docs/agent-enforcement-hardening.md
-- Date: 2026-08-19 — Claude Code (Opus 5)
--
-- Creates `orb_agent_ro`, a SELECT-only role used by the `orb-agent`
-- broker so AI development agents never hold a master credential.
--
-- Read-only is enforced HERE, by the database. The CLI allowlist is
-- defence in depth, not the boundary.
--
-- RUNS IN THE SUPABASE SQL EDITOR (paste whole file) OR psql.
-- No psql meta-commands, no BEGIN/COMMIT, and no RAISE NOTICE for
-- anything you need to see — results come back as a table at the end.
--
-- AFTER THIS: set the password (step 2), then run
-- scripts/migrations/verify-orb-agent-ro.sql (step 3).
-- ============================================================

DROP TABLE IF EXISTS orb_agent_setup_log;
CREATE TEMP TABLE orb_agent_setup_log (
  seq    serial,
  step   text,
  result text
);

-- ------------------------------------------------------------
-- 1. Role — no inheritance, no escalation attributes
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orb_agent_ro') THEN
    CREATE ROLE orb_agent_ro WITH
      LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
    INSERT INTO orb_agent_setup_log (step, result) VALUES ('create role', 'created');
  ELSE
    ALTER ROLE orb_agent_ro WITH
      LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
    INSERT INTO orb_agent_setup_log (step, result) VALUES ('create role', 'already existed — attributes reset');
  END IF;
END
$$;

ALTER ROLE orb_agent_ro CONNECTION LIMIT 4;
ALTER ROLE orb_agent_ro SET search_path = public;

-- Read-only at the session level as well as by grant. NOTE: per-role
-- settings apply to real LOGINS only, so `SET ROLE` testing in the editor
-- will not exercise this one. The grants below are what SET ROLE tests.
ALTER ROLE orb_agent_ro SET default_transaction_read_only = on;

-- Lets the owner SET ROLE orb_agent_ro to run the verification script.
-- This grants postgres nothing it does not already have.
GRANT orb_agent_ro TO current_user;

-- ------------------------------------------------------------
-- 2. Strip anything ambient, then grant exactly what is needed
-- ------------------------------------------------------------
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM orb_agent_ro;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM orb_agent_ro;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM orb_agent_ro;
REVOKE ALL ON SCHEMA public FROM orb_agent_ro;

GRANT USAGE ON SCHEMA public TO orb_agent_ro;

-- The eight tables the documented agent workflows actually need.
-- Mirrors lib/db-schema.ts ALLOWED_TABLES minus audit_log.
--
-- audit_log is DELIBERATELY EXCLUDED: its before/after JSONB columns can
-- contain arbitrary prior row contents and it carries user_id. No
-- documented agent workflow needs it.
GRANT SELECT ON public.todos          TO orb_agent_ro;
GRANT SELECT ON public.projects       TO orb_agent_ro;
GRANT SELECT ON public.statuses       TO orb_agent_ro;
GRANT SELECT ON public.priorities     TO orb_agent_ro;
GRANT SELECT ON public.categories     TO orb_agent_ro;
GRANT SELECT ON public.groups         TO orb_agent_ro;
GRANT SELECT ON public.knowledge_repo TO orb_agent_ro;
GRANT SELECT ON public.tickets        TO orb_agent_ro;

-- Future tables in public must NOT become readable by default.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM orb_agent_ro;

-- ------------------------------------------------------------
-- 3. RLS policies scoped to the role
--
-- orb_agent_ro is NOBYPASSRLS and is not a member of service_role, so on
-- an RLS-enabled table it would read zero rows without an explicit policy.
-- These are SELECT-only with constant predicates, so they add no per-row
-- auth.uid() evaluation and are exempt from the initplan-wrapping rule.
--
-- Soft delete is enforced in the policy WHERE RLS IS ALREADY ENABLED.
-- Where RLS is off, the broker's own `deleted_at IS NULL` filter applies,
-- so both layers filter independently.
-- ------------------------------------------------------------
--
-- WHY `tickets` USES `true` RATHER THAN `deleted_at IS NULL` (verified
-- 2026-08-19): permissive policies are OR'd and evaluated AS THE QUERYING
-- ROLE. `tickets_admin_all` is `TO public`, so it applies to orb_agent_ro
-- too, and it dereferences public.users (id, role_id) — which this role has
-- no grant on. `true OR <anything>` is constant-folded away at plan time, so
-- the users subquery never enters the plan; `deleted_at IS NULL OR <...>`
-- cannot be folded, so it does, and the read fails with "permission denied
-- for table users". Using `true` here avoids granting ANY access to
-- public.users. Soft-delete filtering for tickets is then carried by the
-- broker's own `WHERE deleted_at IS NULL`, which it already applies.
--
-- The same applies to knowledge_repo, whose policies also reference users.
-- If a users-referencing policy is ever added to todos, categories, or
-- groups, their broker reads will start failing CLOSED and section C of
-- verify-orb-agent-ro.sql will catch it.
DO $$
DECLARE
  soft_delete_tables text[] := ARRAY['todos', 'categories', 'groups'];
  plain_tables       text[] := ARRAY['projects', 'statuses', 'priorities', 'knowledge_repo', 'tickets'];
  t         text;
  rls_on    boolean;
  predicate text;
BEGIN
  FOREACH t IN ARRAY (soft_delete_tables || plain_tables) LOOP
    SELECT c.relrowsecurity INTO rls_on
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = t;

    IF rls_on IS NULL THEN
      INSERT INTO orb_agent_setup_log (step, result)
        VALUES ('policy ' || t, 'SKIPPED — table not found');
      CONTINUE;
    END IF;

    -- CRITICAL: do NOT enable RLS on a table that has it off. Enabling it
    -- here with only an orb_agent_ro policy present would deny every
    -- authenticated application read and break the app. Where RLS is off,
    -- the GRANT above is already the complete boundary.
    IF NOT rls_on THEN
      INSERT INTO orb_agent_setup_log (step, result)
        VALUES ('policy ' || t, 'no policy needed — RLS is OFF on this table; grant alone governs');
      CONTINUE;
    END IF;

    IF t = ANY (soft_delete_tables) THEN
      predicate := 'deleted_at IS NULL';
    ELSE
      predicate := 'true';
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS "agent_ro: select" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "agent_ro: select" ON public.%I FOR SELECT TO orb_agent_ro USING (%s)',
      t, predicate);
    INSERT INTO orb_agent_setup_log (step, result)
      VALUES ('policy ' || t, 'created — USING (' || predicate || ')');
  END LOOP;
END
$$;

-- ------------------------------------------------------------
-- 4. Statistics access for `orb-agent db health`
--
-- May be refused by Supabase's privilege model. Refusal must not abort:
-- the health verb degrades and says so rather than presenting partial
-- output as complete.
-- ------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    EXECUTE 'GRANT pg_read_all_stats TO orb_agent_ro';
    INSERT INTO orb_agent_setup_log (step, result) VALUES ('pg_read_all_stats', 'granted');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO orb_agent_setup_log (step, result)
      VALUES ('pg_read_all_stats', 'NOT granted (' || SQLERRM || ') — db health will report reduced coverage');
  END;

  BEGIN
    EXECUTE 'GRANT USAGE ON SCHEMA extensions TO orb_agent_ro';
    EXECUTE 'GRANT SELECT ON extensions.pg_stat_statements TO orb_agent_ro';
    INSERT INTO orb_agent_setup_log (step, result) VALUES ('pg_stat_statements', 'granted');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO orb_agent_setup_log (step, result)
      VALUES ('pg_stat_statements', 'NOT granted (' || SQLERRM || ') — disk-read audit unavailable');
  END;
END
$$;

-- ------------------------------------------------------------
-- 5. Report — read this output
-- ------------------------------------------------------------
SELECT step, result FROM orb_agent_setup_log ORDER BY seq;
