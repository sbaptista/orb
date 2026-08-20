-- ============================================================
-- URGENT — per-signature least privilege for SECURITY DEFINER routines
-- Found by Codex Round 2 (R2-Q3). Date: 2026-08-20 — Claude Code (Opus 5)
--
-- WHAT WENT WRONG
-- 20260819b removed orb_agent_ro's reach by revoking from PUBLIC and
-- re-granting to anon, authenticated, and service_role — reasoning that this
-- "preserved existing application access". It did. It also made explicit a
-- PRE-EXISTING and dangerous grant: `anon` can execute SECURITY DEFINER
-- readers over audit_log and orb metrics.
--
-- In Supabase, a function in the exposed `public` schema that `anon` may
-- execute is reachable through the Data API using the PUBLISHABLE key, which
-- ships in the browser bundle. SECURITY DEFINER means it runs as its owner and
-- RLS does not apply. That is unauthenticated read access to the audit log.
--
-- This was not introduced by 20260819b — PUBLIC already granted it — but that
-- migration locked it in while being presented as a lockdown.
--
-- VERIFIED CALL SITES at 0f501ab: every caller uses the admin/service client.
--   app/actions/get-audit-logs.ts:56,100   ctx.admin.rpc(...)
--   app/actions/get-orb-metrics.ts:61,68   ctx.admin.rpc(...)
-- Neither anon nor authenticated needs EXECUTE on any of these.
--
-- Trigger functions need NO execute grant at all: PostgreSQL does not check
-- EXECUTE privilege when a trigger fires.
--
-- RUNS IN THE SUPABASE SQL EDITOR OR psql. Returns a grants table — read it.
-- Then re-run verify-orb-agent-ro.sql (now includes section F for anon).
-- ============================================================

DROP TABLE IF EXISTS orb_lp_log;
CREATE TEMP TABLE orb_lp_log (seq serial, routine text, action text);

DO $$
DECLARE
  -- Callable only by the server, via the service role.
  service_only text[] := ARRAY[
    'get_audit_log_page', 'get_audit_log_count', 'get_audit_log_cursor_page',
    'get_orb_metrics_page', 'get_orb_metrics_summary',
    'upsert_orb_metric', 'reconcile_user_id'
  ];
  -- Trigger / internal functions: no caller needs EXECUTE.
  no_caller text[] := ARRAY[
    'set_audit_log_search_text', 'set_knowledge_repo_updated_at',
    'set_tickets_updated_at', 'set_updated_at',
    'assign_todo_number', 'note_project_deleted_on_knowledge',
    'rls_auto_enable'
  ];
  fn text; sig text; found boolean;
BEGIN
  FOREACH fn IN ARRAY service_only LOOP
    found := false;
    FOR sig IN SELECT p.oid::regprocedure::text FROM pg_proc p
               JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname='public' AND p.proname=fn LOOP
      found := true;
      BEGIN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);
        INSERT INTO orb_lp_log(routine, action) VALUES (sig, 'service_role ONLY (anon + authenticated revoked)');
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO orb_lp_log(routine, action) VALUES (sig, 'FAILED: ' || SQLERRM);
      END;
    END LOOP;
    IF NOT found THEN INSERT INTO orb_lp_log(routine, action) VALUES (fn, 'not found — skipped'); END IF;
  END LOOP;

  FOREACH fn IN ARRAY no_caller LOOP
    found := false;
    FOR sig IN SELECT p.oid::regprocedure::text FROM pg_proc p
               JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname='public' AND p.proname=fn LOOP
      found := true;
      BEGIN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', sig);
        INSERT INTO orb_lp_log(routine, action) VALUES (sig, 'no grants (owner only) — triggers do not need EXECUTE');
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO orb_lp_log(routine, action) VALUES (sig, 'FAILED: ' || SQLERRM);
      END;
    END LOOP;
    IF NOT found THEN INSERT INTO orb_lp_log(routine, action) VALUES (fn, 'not found — skipped'); END IF;
  END LOOP;
END
$$;

-- Resulting grants, so the outcome is read rather than assumed.
SELECT p.proname AS routine,
       p.prosecdef AS security_definer,
       coalesce(
         (SELECT string_agg(g, ', ' ORDER BY g) FROM unnest(ARRAY['anon','authenticated','service_role']) g
          WHERE has_function_privilege(g, p.oid, 'EXECUTE')),
         '(none)') AS can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('get_audit_log_page','get_audit_log_count','get_audit_log_cursor_page',
                    'get_orb_metrics_page','get_orb_metrics_summary','upsert_orb_metric',
                    'reconcile_user_id','rls_auto_enable','set_audit_log_search_text',
                    'set_knowledge_repo_updated_at','set_tickets_updated_at','set_updated_at',
                    'assign_todo_number','note_project_deleted_on_knowledge','is_admin')
ORDER BY p.proname;

-- REQUIRED OUTCOME: no row for an audit/metrics reader may list anon.
