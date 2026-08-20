-- ============================================================
-- Verify the orb_agent_ro boundary — BOTH DIRECTIONS
-- Plan: docs/agent-capability-broker-plan.md
--
-- RUNS IN THE SUPABASE SQL EDITOR (paste whole file) OR psql.
-- Every test is wrapped so a failure is CAPTURED, not fatal — one run
-- gives the complete report as a table.
--
-- A control that only rejects bad input is half tested. Section B proves
-- writes/reads are DENIED where they must be; Section C proves reads
-- SUCCEED where they must, so "denies everything" cannot pass as "works".
--
-- REQUIRED OUTCOME: every row reads PASS. Any FAIL in section B means the
-- boundary is broken. Any FAIL in section C means reads are over-restricted.
-- Any FAIL in section E means the role can reach a SECURITY DEFINER routine
-- that runs as its owner, which bypasses every table grant and policy tested
-- in A-C. Section E was added after Codex's Round 1 review found that
-- `REVOKE ... FROM orb_agent_ro` does not remove what PUBLIC grants.
-- ============================================================

DROP TABLE IF EXISTS orb_agent_boundary_results;
CREATE TEMP TABLE orb_agent_boundary_results (
  seq      serial,
  section  text,
  test     text,
  expected text,
  outcome  text,
  detail   text
);

-- ------------------------------------------------------------
-- A. Role attributes — every escalation path must be off
-- ------------------------------------------------------------
DO $$
DECLARE
  r        record;
  memberships text;
  privs    text;
BEGIN
  SELECT * INTO r FROM pg_roles WHERE rolname = 'orb_agent_ro';
  IF NOT FOUND THEN
    INSERT INTO orb_agent_boundary_results (section, test, expected, outcome, detail)
      VALUES ('A', 'role exists', 'exists', 'FAIL', 'orb_agent_ro not found — run the migration first');
    RETURN;
  END IF;

  INSERT INTO orb_agent_boundary_results (section, test, expected, outcome, detail) VALUES
    ('A', 'can log in',        'true',  CASE WHEN r.rolcanlogin    THEN 'PASS' ELSE 'FAIL' END, r.rolcanlogin::text),
    ('A', 'not superuser',     'false', CASE WHEN NOT r.rolsuper       THEN 'PASS' ELSE 'FAIL' END, r.rolsuper::text),
    ('A', 'cannot create db',  'false', CASE WHEN NOT r.rolcreatedb    THEN 'PASS' ELSE 'FAIL' END, r.rolcreatedb::text),
    ('A', 'cannot create role','false', CASE WHEN NOT r.rolcreaterole  THEN 'PASS' ELSE 'FAIL' END, r.rolcreaterole::text),
    ('A', 'does not inherit',  'false', CASE WHEN NOT r.rolinherit     THEN 'PASS' ELSE 'FAIL' END, r.rolinherit::text),
    ('A', 'no replication',    'false', CASE WHEN NOT r.rolreplication THEN 'PASS' ELSE 'FAIL' END, r.rolreplication::text),
    ('A', 'cannot bypass RLS', 'false', CASE WHEN NOT r.rolbypassrls   THEN 'PASS' ELSE 'FAIL' END, r.rolbypassrls::text),
    ('A', 'has a password set','true',  CASE WHEN r.rolpassword IS NOT NULL THEN 'PASS' ELSE 'FAIL' END,
       CASE WHEN r.rolpassword IS NOT NULL THEN 'set' ELSE 'NOT SET — open a session' END),
    ('A', 'server-side expiry is stamped', 'VALID UNTIL set',
       CASE WHEN r.rolvaliduntil IS NOT NULL THEN 'PASS' ELSE 'FAIL' END,
       CASE WHEN r.rolvaliduntil IS NULL
            THEN 'no VALID UNTIL — the credential never expires server-side. Open a session with orb-agent-session.'
            WHEN r.rolvaliduntil > now()
            THEN 'active window, expires ' || r.rolvaliduntil::text
            ELSE 'expired at ' || r.rolvaliduntil::text || ' — database is refusing logins (correct when no window is open)' END);

  -- Only pg_read_all_stats is an acceptable membership.
  SELECT coalesce(string_agg(g.rolname, ', ' ORDER BY g.rolname), '(none)') INTO memberships
  FROM pg_auth_members m
  JOIN pg_roles g ON g.oid = m.roleid
  JOIN pg_roles c ON c.oid = m.member
  WHERE c.rolname = 'orb_agent_ro' AND g.rolname <> 'pg_read_all_stats';

  INSERT INTO orb_agent_boundary_results (section, test, expected, outcome, detail)
    VALUES ('A', 'no privileged memberships', '(none)',
            CASE WHEN memberships = '(none)' THEN 'PASS' ELSE 'FAIL' END, memberships);

  SELECT coalesce(string_agg(DISTINCT privilege_type, ', '), '(none)') INTO privs
  FROM information_schema.role_table_grants
  WHERE grantee = 'orb_agent_ro' AND table_schema = 'public';

  INSERT INTO orb_agent_boundary_results (section, test, expected, outcome, detail)
    VALUES ('A', 'only SELECT granted', 'SELECT',
            CASE WHEN privs = 'SELECT' THEN 'PASS' ELSE 'FAIL' END, privs);

  INSERT INTO orb_agent_boundary_results (section, test, expected, outcome, detail)
  SELECT 'A', 'granted table count', '8',
         CASE WHEN count(*) = 8 THEN 'PASS' ELSE 'FAIL' END,
         string_agg(table_name, ', ' ORDER BY table_name)
  FROM (SELECT DISTINCT table_name FROM information_schema.role_table_grants
        WHERE grantee = 'orb_agent_ro' AND table_schema = 'public') q;

  INSERT INTO orb_agent_boundary_results (section, test, expected, outcome, detail)
  SELECT 'A', 'audit_log NOT granted', 'absent',
         CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END, count(*)::text
  FROM information_schema.role_table_grants
  WHERE grantee = 'orb_agent_ro' AND table_schema = 'public' AND table_name = 'audit_log';
END
$$;

-- ------------------------------------------------------------
-- B. NEGATIVE tests — each statement must be REFUSED
-- ------------------------------------------------------------
DO $$
DECLARE
  labels text[] := ARRAY[
    'INSERT into todos',
    'UPDATE todos',
    'DELETE from todos',
    'INSERT into knowledge_repo',
    'SELECT from audit_log',
    'SELECT from auth.users',
    'SELECT from public.users',
    'CREATE TABLE',
    'ALTER TABLE todos'
  ];
  stmts text[] := ARRAY[
    'INSERT INTO public.todos (title, product_id) VALUES (''boundary probe'', gen_random_uuid())',
    'UPDATE public.todos SET title = ''boundary probe'' WHERE false',
    'DELETE FROM public.todos WHERE false',
    'INSERT INTO public.knowledge_repo (title, content) VALUES (''boundary probe'', ''probe'')',
    'SELECT count(*) FROM public.audit_log',
    'SELECT count(*) FROM auth.users',
    'SELECT count(*) FROM public.users',
    'CREATE TABLE public.agent_probe (id int)',
    'ALTER TABLE public.todos ADD COLUMN agent_probe int'
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(labels, 1) LOOP
    BEGIN
      EXECUTE 'SET ROLE orb_agent_ro';
      EXECUTE stmts[i];
      RESET ROLE;
      INSERT INTO orb_agent_boundary_results (section, test, expected, outcome, detail)
        VALUES ('B', labels[i], 'refused', 'FAIL', 'STATEMENT SUCCEEDED — boundary is broken');
    EXCEPTION WHEN OTHERS THEN
      RESET ROLE;
      INSERT INTO orb_agent_boundary_results (section, test, expected, outcome, detail)
        VALUES ('B', labels[i], 'refused', 'PASS', left(SQLERRM, 90));
    END;
  END LOOP;
END
$$;

-- Soft-deleted rows must be invisible. This one returns a VALUE, not an error.
DO $$
DECLARE
  visible bigint;
BEGIN
  BEGIN
    EXECUTE 'SET ROLE orb_agent_ro';
    EXECUTE 'SELECT count(*) FROM public.todos WHERE deleted_at IS NOT NULL' INTO visible;
    RESET ROLE;
    INSERT INTO orb_agent_boundary_results (section, test, expected, outcome, detail)
      VALUES ('B', 'soft-deleted todos hidden', '0',
              CASE WHEN visible = 0 THEN 'PASS' ELSE 'FAIL' END,
              visible || ' deleted row(s) visible');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO orb_agent_boundary_results (section, test, expected, outcome, detail)
      VALUES ('B', 'soft-deleted todos hidden', '0', 'FAIL', left(SQLERRM, 90));
  END;
END
$$;

-- ------------------------------------------------------------
-- C. POSITIVE tests — each must SUCCEED
-- ------------------------------------------------------------
DO $$
DECLARE
  labels text[] := ARRAY[
    'todos readable',
    'projects readable',
    'knowledge_repo readable',
    'statuses readable',
    'priorities readable',
    'categories readable',
    'groups readable',
    'tickets readable',
    'todos JOIN projects (the broker query)',
    'pg_stat_user_tables (db health)'
  ];
  stmts text[] := ARRAY[
    'SELECT count(*) FROM public.todos',
    'SELECT count(*) FROM public.projects',
    'SELECT count(*) FROM public.knowledge_repo',
    'SELECT count(*) FROM public.statuses',
    'SELECT count(*) FROM public.priorities',
    'SELECT count(*) FROM public.categories',
    'SELECT count(*) FROM public.groups',
    'SELECT count(*) FROM public.tickets',
    'SELECT count(*) FROM public.todos t JOIN public.projects p ON p.id = t.product_id',
    'SELECT count(*) FROM pg_stat_user_tables'
  ];
  i int;
  n bigint;
BEGIN
  FOR i IN 1 .. array_length(labels, 1) LOOP
    BEGIN
      EXECUTE 'SET ROLE orb_agent_ro';
      EXECUTE stmts[i] INTO n;
      RESET ROLE;
      INSERT INTO orb_agent_boundary_results (section, test, expected, outcome, detail)
        VALUES ('C', labels[i], 'readable', 'PASS', n || ' row(s) visible');
    EXCEPTION WHEN OTHERS THEN
      RESET ROLE;
      INSERT INTO orb_agent_boundary_results (section, test, expected, outcome, detail)
        VALUES ('C', labels[i], 'readable', 'FAIL', left(SQLERRM, 90));
    END;
  END LOOP;
END
$$;

-- ------------------------------------------------------------
-- D. Contamination check — if any section B write SUCCEEDED, it left a row
-- ------------------------------------------------------------
DO $$
DECLARE
  n_todos bigint;
  n_know  bigint;
  n_tbl   bigint;
BEGIN
  SELECT count(*) INTO n_todos FROM public.todos WHERE title = 'boundary probe';
  SELECT count(*) INTO n_know  FROM public.knowledge_repo WHERE title = 'boundary probe';
  SELECT count(*) INTO n_tbl   FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public' AND c.relname = 'agent_probe';

  INSERT INTO orb_agent_boundary_results (section, test, expected, outcome, detail) VALUES
    ('D', 'no probe row in todos', '0',
       CASE WHEN n_todos = 0 THEN 'PASS' ELSE 'FAIL' END,
       CASE WHEN n_todos = 0 THEN 'clean'
            ELSE n_todos || ' probe row(s) — DELETE FROM public.todos WHERE title = ''boundary probe'';' END),
    ('D', 'no probe row in knowledge_repo', '0',
       CASE WHEN n_know = 0 THEN 'PASS' ELSE 'FAIL' END,
       CASE WHEN n_know = 0 THEN 'clean'
            ELSE n_know || ' probe row(s) — DELETE FROM public.knowledge_repo WHERE title = ''boundary probe'';' END),
    ('D', 'no probe table created', '0',
       CASE WHEN n_tbl = 0 THEN 'PASS' ELSE 'FAIL' END,
       CASE WHEN n_tbl = 0 THEN 'clean' ELSE 'DROP TABLE public.agent_probe;' END);

  -- Undo the column ALTER if it somehow succeeded.
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='todos' AND column_name='agent_probe') THEN
    INSERT INTO orb_agent_boundary_results (section, test, expected, outcome, detail)
      VALUES ('D', 'no probe column on todos', '0', 'FAIL',
              'ALTER TABLE public.todos DROP COLUMN agent_probe;');
  ELSE
    INSERT INTO orb_agent_boundary_results (section, test, expected, outcome, detail)
      VALUES ('D', 'no probe column on todos', '0', 'PASS', 'clean');
  END IF;
END
$$;

-- ------------------------------------------------------------
-- E. ROUTINE privileges — the gap Codex found in Round 1
--
-- `REVOKE ALL ON ALL FUNCTIONS ... FROM orb_agent_ro` does NOT remove what
-- PUBLIC grants, and PostgreSQL grants EXECUTE on new functions to PUBLIC by
-- default. A SECURITY DEFINER function runs as its OWNER, so any such function
-- reachable by this role bypasses every table grant and RLS policy tested above.
--
-- These tests use has_function_privilege() and DO NOT CALL anything, so they
-- are side-effect free.
-- ------------------------------------------------------------
DO $$
DECLARE
  n_secdef   bigint;
  secdef_list text;
  n_audit    bigint;
  audit_list text;
  n_mutation bigint;
  mut_list   text;
  n_total    bigint;
  is_admin_result boolean;
  total_list text;
BEGIN
  -- E1: SECURITY DEFINER functions this role may execute. Each runs with its
  -- owner's privileges, so this must be zero APART FROM the documented
  -- exceptions below, which are carved out by name so the exception is
  -- visible and auditable rather than hidden inside a passing test.
  --
  -- A test that is expected to fail forever trains people to ignore failures,
  -- which is worse than no test. Each exception must be justified here AND
  -- separately proven harmless (is_admin -> E3b).
  --
  -- EXCEPTIONS:
  --   is_admin  — called from RLS policies; revoking it breaks the broker's
  --               own reads (same class as F9). Proven to return false for
  --               this role by test E3b, which calls it.
  SELECT count(*), coalesce(string_agg(p.proname, ', ' ORDER BY p.proname), '(none)')
    INTO n_secdef, secdef_list
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef
    AND p.proname NOT IN ('is_admin')
    AND has_function_privilege('orb_agent_ro', p.oid, 'EXECUTE');

  INSERT INTO orb_agent_boundary_results (section, test, expected, outcome, detail)
    VALUES ('E', 'no SECURITY DEFINER function is executable', '0 (excl. is_admin)',
            CASE WHEN n_secdef = 0 THEN 'PASS' ELSE 'FAIL' END,
            n_secdef || ' executable: ' || left(secdef_list, 260)
              || ' | documented exception carved out: is_admin (see E3b)');

  -- E2: functions whose name implies audit_log access. audit_log is
  -- deliberately excluded from the grants; a function path around that
  -- exclusion defeats it entirely.
  SELECT count(*), coalesce(string_agg(p.proname, ', ' ORDER BY p.proname), '(none)')
    INTO n_audit, audit_list
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname ILIKE '%audit%'
    AND has_function_privilege('orb_agent_ro', p.oid, 'EXECUTE');

  INSERT INTO orb_agent_boundary_results (section, test, expected, outcome, detail)
    VALUES ('E', 'no audit_log function is executable', '0',
            CASE WHEN n_audit = 0 THEN 'PASS' ELSE 'FAIL' END,
            n_audit || ' executable: ' || left(audit_list, 300));

  -- E3: mutation RPCs. These write. None may be reachable.
  SELECT count(*), coalesce(string_agg(p.proname, ', ' ORDER BY p.proname), '(none)')
    INTO n_mutation, mut_list
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (p.proname ILIKE 'confirm_%' OR p.proname ILIKE 'import_%'
      OR p.proname ILIKE 'restore_%' OR p.proname ILIKE 'upsert_%'
      OR p.proname ILIKE 'set_%'     OR p.proname ILIKE 'assign_%'
      OR p.proname ILIKE 'reconcile_%' OR p.proname ILIKE 'note_%')
    AND has_function_privilege('orb_agent_ro', p.oid, 'EXECUTE');

  INSERT INTO orb_agent_boundary_results (section, test, expected, outcome, detail)
    VALUES ('E', 'no mutation RPC is executable', '0',
            CASE WHEN n_mutation = 0 THEN 'PASS' ELSE 'FAIL' END,
            n_mutation || ' executable: ' || left(mut_list, 300));

  -- E3b: is_admin is deliberately left PUBLIC-executable (it is called from
  -- RLS policies and revoking it would break the broker's own reads). Prove
  -- it is harmless rather than trusting the migration's comment: as
  -- orb_agent_ro, auth.uid() is NULL so it must return false.
  BEGIN
    EXECUTE 'SET ROLE orb_agent_ro';
    EXECUTE 'SELECT public.is_admin()' INTO is_admin_result;
    RESET ROLE;
    INSERT INTO orb_agent_boundary_results (section, test, expected, outcome, detail)
      VALUES ('E', 'is_admin() returns false for the agent role', 'false',
              CASE WHEN is_admin_result IS NOT TRUE THEN 'PASS' ELSE 'FAIL' END,
              'returned ' || coalesce(is_admin_result::text, 'null'));
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    -- Refused is also acceptable: it means is_admin is not reachable at all.
    INSERT INTO orb_agent_boundary_results (section, test, expected, outcome, detail)
      VALUES ('E', 'is_admin() returns false for the agent role', 'false or refused',
              'PASS', 'refused: ' || left(SQLERRM, 70));
  END;

  -- E4: informational — total reachable routines in public.
  SELECT count(*), coalesce(string_agg(p.proname, ', ' ORDER BY p.proname), '(none)')
    INTO n_total, total_list
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND has_function_privilege('orb_agent_ro', p.oid, 'EXECUTE');

  -- Named, not just counted: a shrinking number tells you less than knowing
  -- exactly which routines remain reachable and being able to review them.
  INSERT INTO orb_agent_boundary_results (section, test, expected, outcome, detail)
    VALUES ('E', 'reachable routines (review this list)', 'informational', 'PASS',
            n_total || ': ' || left(total_list, 400));
END
$$;

-- ------------------------------------------------------------
-- REPORT — ONE result set. Every row must read PASS.
-- The Supabase SQL Editor shows only the final statement's output, so the
-- verdict is appended as the last row rather than a separate query.
-- ------------------------------------------------------------
SELECT section, test, expected, outcome, detail
FROM (
  SELECT seq, section, test, expected, outcome, detail
  FROM orb_agent_boundary_results
  UNION ALL
  SELECT 2147483647, 'VERDICT',
         (SELECT count(*) FILTER (WHERE outcome='PASS') FROM orb_agent_boundary_results) || ' passed, ' ||
         (SELECT count(*) FILTER (WHERE outcome='FAIL') FROM orb_agent_boundary_results) || ' failed',
         '', 
         CASE WHEN (SELECT count(*) FILTER (WHERE outcome='FAIL') FROM orb_agent_boundary_results) = 0
              THEN 'PASS' ELSE 'FAIL' END,
         CASE WHEN (SELECT count(*) FILTER (WHERE outcome='FAIL') FROM orb_agent_boundary_results) = 0
              THEN 'BOUNDARY VERIFIED — safe to seal a credential'
              ELSE 'DO NOT SEAL — read the FAIL rows above' END
) q
ORDER BY seq;
