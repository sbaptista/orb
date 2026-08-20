-- ============================================================
-- CONFIRMED VULNERABILITY FIX — identity forgery + authenticated write reach
-- Date: 2026-08-20 — Claude Code (Opus 5)
--
-- FINDING 1 (G3, CONFIRMED by test, predicted by Codex R2-Q2):
-- orb_agent_ro can `SET request.jwt.claim.sub` to a real UUID read from
-- public.projects.created_by. is_admin() is SECURITY DEFINER, so it runs as
-- its OWNER and can reach auth.uid() even though the agent role cannot. It
-- then returns TRUE. Admin RLS predicates match, and because permissive
-- policies are OR'd, row visibility widens past the agent's own policy —
-- soft-deleted rows being the concrete case.
--
-- Writes remain blocked: table GRANTs are checked independently of RLS and
-- orb_agent_ro holds SELECT only. The ceiling is row visibility, not writes.
--
-- WHY NOT REWRITE is_admin: its definition is not in the committed migration
-- history, so replacing the body would destroy logic that cannot be reviewed.
-- Instead the agent loses EXECUTE entirely — it cannot forge what it cannot
-- call. This is reversible and immediately testable.
--
-- RISK, STATED PLAINLY: if any RLS policy on the eight granted tables calls
-- is_admin(), the agent's reads will now fail with "permission denied for
-- function is_admin" — the F9 failure class. That is why section C of the
-- verifier exists. Run it immediately after this. If C fails, we know exactly
-- which table and can fold that table's agent policy to USING (true).
--
-- FINDING 2 (verifier section F, informational row):
-- `authenticated` can execute four SECURITY DEFINER financial routines,
-- including import_ai_financial_rows, which WRITES. Alpha testers hold the
-- authenticated role. Every call site verified at 0f501ab uses ctx.admin.rpc,
-- and the original migrations granted service_role ONLY — this restores that
-- documented intent.
--
-- RUNS IN THE SUPABASE SQL EDITOR OR psql. Read the returned table, then
-- IMMEDIATELY re-run verify-orb-agent-ro.sql.
-- ============================================================

DROP TABLE IF EXISTS orb_isadmin_log;
CREATE TEMP TABLE orb_isadmin_log (seq serial, item text, action text);

-- 1. is_admin — remove the agent's ability to call it at all.
DO $$
DECLARE sig text;
BEGIN
  FOR sig IN SELECT p.oid::regprocedure::text FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname='public' AND p.proname='is_admin' LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', sig);
      INSERT INTO orb_isadmin_log(item, action)
        VALUES (sig, 'PUBLIC revoked; anon/authenticated/service_role granted — orb_agent_ro can no longer call it');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO orb_isadmin_log(item, action) VALUES (sig, 'FAILED: ' || SQLERRM);
    END;
  END LOOP;
END
$$;

-- 2. Financial routines — service_role only, as their own migrations intended.
DO $$
DECLARE
  targets text[] := ARRAY['get_ai_cost_history','get_ai_cost_summary_rollups',
                          'get_ai_provider_burn','import_ai_financial_rows'];
  fn text; sig text;
BEGIN
  FOREACH fn IN ARRAY targets LOOP
    FOR sig IN SELECT p.oid::regprocedure::text FROM pg_proc p
               JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname='public' AND p.proname=fn LOOP
      BEGIN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);
        INSERT INTO orb_isadmin_log(item, action) VALUES (sig, 'service_role ONLY');
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO orb_isadmin_log(item, action) VALUES (sig, 'FAILED: ' || SQLERRM);
      END;
    END LOOP;
  END LOOP;
END
$$;

SELECT item, action FROM orb_isadmin_log ORDER BY seq;

-- Resulting reach. is_admin must show anon/authenticated but NOT orb_agent_ro.
SELECT p.proname AS routine,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
       has_function_privilege('service_role', p.oid, 'EXECUTE')  AS service_role,
       has_function_privilege('orb_agent_ro', p.oid, 'EXECUTE')  AS orb_agent_ro
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public' AND p.prosecdef
  AND (has_function_privilege('anon', p.oid, 'EXECUTE')
    OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
    OR has_function_privilege('orb_agent_ro', p.oid, 'EXECUTE'))
ORDER BY p.proname;
