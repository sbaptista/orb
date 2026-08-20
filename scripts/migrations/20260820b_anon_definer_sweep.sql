-- ============================================================
-- URGENT #2 — sweep every SECURITY DEFINER routine away from anon
-- Found by verifier section F. Date: 2026-08-20 — Claude Code (Opus 5)
--
-- Section F found four MORE anon-reachable SECURITY DEFINER routines that the
-- hand-written list in 20260820 missed:
--   get_ai_cost_history, get_ai_cost_summary_rollups, get_ai_provider_burn,
--   import_ai_financial_rows   <-- this one WRITES
--
-- ROOT CAUSE: their original migrations granted service_role ONLY and did
-- revoke from PUBLIC. The grant came back later — almost certainly a DROP +
-- CREATE, which resets a function's privileges to the default PUBLIC EXECUTE.
-- This is exactly the durability gap Codex raised in R2-Q1: ALTER DEFAULT
-- PRIVILEGES only covers functions created later by the role that ran it.
--
-- THEREFORE THIS SWEEPS BY RULE, NOT BY LIST. Hand-written lists are what let
-- these four through. Every SECURITY DEFINER routine in `public` loses PUBLIC
-- and anon, except an explicit, justified allowlist.
--
-- `authenticated` is deliberately NOT swept here: the blast radius has not been
-- measured, and breaking the application to close a hole anon already lost is a
-- bad trade. The verifier now reports what authenticated can reach so the next
-- decision is made from data.
--
-- ALLOWLIST:
--   is_admin — called from RLS policies; revoking breaks policy evaluation.
--              Returns a boolean about the caller and leaks nothing.
--
-- RUNS IN THE SUPABASE SQL EDITOR OR psql. Read the returned table.
-- ============================================================

DROP TABLE IF EXISTS orb_anon_sweep_log;
CREATE TEMP TABLE orb_anon_sweep_log (seq serial, routine text, action text);

DO $$
DECLARE
  allowlist text[] := ARRAY['is_admin'];
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT (p.proname = ANY (allowlist))
      AND (has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('public', p.oid, 'EXECUTE'))
    ORDER BY p.proname
  LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
      -- Restore the documented intent of the original migrations.
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
      INSERT INTO orb_anon_sweep_log(routine, action)
        VALUES (r.sig, 'PUBLIC + anon revoked; service_role granted');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO orb_anon_sweep_log(routine, action)
        VALUES (r.sig, 'FAILED: ' || SQLERRM);
    END;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM orb_anon_sweep_log) THEN
    INSERT INTO orb_anon_sweep_log(routine, action)
      VALUES ('(nothing)', 'no anon-reachable SECURITY DEFINER routines found');
  END IF;
END
$$;

SELECT routine, action FROM orb_anon_sweep_log ORDER BY seq;

-- What anon and authenticated can still reach, so the next decision has data.
SELECT p.proname AS routine,
       p.prosecdef AS security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef
  AND (has_function_privilege('anon', p.oid, 'EXECUTE')
    OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
ORDER BY p.proname;
