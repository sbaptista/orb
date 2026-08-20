-- ============================================================
-- Agent Broker — close the routine-privilege gap (F11)
-- Plan: docs/agent-enforcement-hardening.md §10 disposition 5
-- Date: 2026-08-19 — Claude Code (Opus 5)
--
-- Found by Codex Round 1 review, then measured: orb_agent_ro could EXECUTE
-- 11 SECURITY DEFINER functions, including get_audit_log_page/_count/
-- _cursor_page. A SECURITY DEFINER function runs as its OWNER, so those
-- bypass every table grant and RLS policy — reaching audit_log, the one
-- table deliberately excluded from the role.
--
-- ROOT CAUSE: `REVOKE ... FROM orb_agent_ro` does NOT remove what PUBLIC
-- grants, and PostgreSQL grants EXECUTE on new functions to PUBLIC by
-- default. There is no per-role DENY in PostgreSQL, so the only fix is to
-- revoke from PUBLIC and grant explicitly to the roles that need it.
--
-- SAFETY: every function below is revoked from PUBLIC and then granted to
-- anon, authenticated, and service_role — the roles the application actually
-- connects as. PUBLIC included those roles, so their effective access is
-- UNCHANGED. orb_agent_ro has no role memberships (verified in section A),
-- so it is the only identity that loses access.
--
-- Trigger functions are included: PostgreSQL does not check EXECUTE when a
-- trigger fires, so revoking from PUBLIC does not stop triggers working.
--
-- `is_admin` is DELIBERATELY EXCLUDED — see the note at the bottom.
--
-- RUNS IN THE SUPABASE SQL EDITOR (paste whole file) OR psql.
-- Afterwards, re-run scripts/migrations/verify-orb-agent-ro.sql:
-- section E must report 0 for all three categories.
-- ============================================================

DROP TABLE IF EXISTS orb_routine_lockdown_log;
CREATE TEMP TABLE orb_routine_lockdown_log (
  seq serial, routine text, action text
);

DO $$
DECLARE
  -- Every routine section E reported as reachable, minus is_admin.
  targets text[] := ARRAY[
    'get_audit_log_page',
    'get_audit_log_count',
    'get_audit_log_cursor_page',
    'set_audit_log_search_text',
    'get_orb_metrics_page',
    'get_orb_metrics_summary',
    'upsert_orb_metric',
    'assign_todo_number',
    'rls_auto_enable',
    'note_project_deleted_on_knowledge',
    'reconcile_user_id',
    'set_knowledge_repo_updated_at',
    'set_tickets_updated_at',
    'set_updated_at'
  ];
  fn_name text;
  sig     text;
  found   boolean;
BEGIN
  FOREACH fn_name IN ARRAY targets LOOP
    found := false;
    -- Loop over every overload of this name (upsert_orb_metric has two).
    FOR sig IN
      SELECT p.oid::regprocedure::text
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn_name
    LOOP
      found := true;
      BEGIN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', sig);
        INSERT INTO orb_routine_lockdown_log (routine, action)
          VALUES (sig, 'revoked from PUBLIC; granted to anon, authenticated, service_role');
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO orb_routine_lockdown_log (routine, action)
          VALUES (sig, 'FAILED: ' || SQLERRM);
      END;
    END LOOP;

    IF NOT found THEN
      INSERT INTO orb_routine_lockdown_log (routine, action)
        VALUES (fn_name, 'not found in schema public — skipped');
    END IF;
  END LOOP;
END
$$;

-- Future functions must not silently become PUBLIC-executable again.
-- This affects only functions created LATER by the current role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ------------------------------------------------------------
-- Report
-- ------------------------------------------------------------
SELECT routine, action FROM orb_routine_lockdown_log ORDER BY seq;

-- ------------------------------------------------------------
-- WHY `is_admin` IS LEFT ALONE — a deliberate decision, not an oversight.
--
-- `is_admin` is a boolean predicate about the CURRENT user and is commonly
-- called from inside RLS policies. Revoking it from PUBLIC would mean that
-- when orb_agent_ro evaluates any policy that calls it, the read fails with
-- "permission denied for function is_admin" — the same class of breakage as
-- the `tickets` / public.users problem (F9), and it would silently break the
-- broker's reads.
--
-- It leaks nothing and mutates nothing: for orb_agent_ro, auth.uid() is NULL,
-- so it returns false. That reasoning is INFERRED, not tested. The verifier
-- now checks it explicitly rather than trusting this comment.
-- ------------------------------------------------------------
