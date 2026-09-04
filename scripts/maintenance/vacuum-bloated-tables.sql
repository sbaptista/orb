-- ============================================================
-- Dead-row maintenance — public schema only
-- Date: 2026-09-03 — Claude Code (Opus 5)
--
-- MUST RUN VIA psql, NOT the Supabase SQL Editor.
-- VACUUM cannot run inside a transaction block, and the editor wraps
-- statements in one. See AGENTS.md "Direct SQL Access (psql)" Path B:
--
--   ( export DATABASE_URL="$(/opt/homebrew/bin/openssl enc -d -aes-256-cbc \
--       -pbkdf2 -iter 210000 -in \
--       /Users/stanleybaptista/Project-secrets/orb-secrets/orb.env.enc \
--       | grep '^DATABASE_URL=' | cut -d= -f2-)" \
--     && /opt/homebrew/opt/libpq/bin/psql "$DATABASE_URL" \
--          -f scripts/maintenance/vacuum-bloated-tables.sql )
--
-- SCOPE: schema `public` only. The `auth` schema is owned by
-- supabase_auth_admin; VACUUM there is skipped with a warning and is
-- Supabase's responsibility, not ours. A 2026-09-03 reading of `orb-agent
-- db health` appeared to show five badly bloated tables, but four of them
-- (webauthn_credentials, refresh_tokens, mfa_amr_claims, users at 1366%)
-- were auth.* — the report printed bare relname with no schema, so
-- public.users and auth.users were indistinguishable. That output is now
-- schema-qualified.
--
-- PROPORTION: as of 2026-09-03 the three qualifying public tables held 47,
-- 35 and 29 dead rows. That is kilobytes. Run this when the health report
-- flags something, not on a schedule, and do not read a high dead_pct on a
-- small table as urgent — see the threshold note at the bottom.
-- ============================================================

-- ------------------------------------------------------------
-- 1. What is actually bloated right now, and by how much in absolute terms.
--    Run this first. If nothing comes back, stop — there is nothing to do.
-- ------------------------------------------------------------
SELECT
  schemaname || '.' || relname                       AS qualified_table,
  n_live_tup,
  n_dead_tup,
  CASE WHEN n_live_tup = 0 THEN NULL
       ELSE round(100.0 * n_dead_tup / n_live_tup, 1) END AS dead_pct,
  pg_size_pretty(pg_total_relation_size(relid))      AS total_size,
  last_autovacuum,
  last_vacuum,
  'VACUUM ANALYZE ' || schemaname || '.' || relname || ';' AS statement_to_run
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND n_dead_tup > 1000                    -- absolute floor: ignore trivia
  AND n_live_tup > 0
  AND n_dead_tup::numeric / n_live_tup > 0.20
ORDER BY n_dead_tup DESC;

-- ------------------------------------------------------------
-- 2. The three tables flagged on 2026-09-03. All are far below the absolute
--    floor above, so these are included for completeness and cost nothing;
--    they are not urgent and were not urgent when written.
--
--    VACUUM ANALYZE (not VACUUM FULL): it reclaims space for reuse without
--    an ACCESS EXCLUSIVE lock. VACUUM FULL rewrites the table and blocks all
--    access — do not reach for it on a live database without a specific,
--    measured reason.
-- ------------------------------------------------------------
VACUUM ANALYZE public.project_todo_number_counters;
VACUUM ANALYZE public.orb_provider_consumption_snapshots;
VACUUM ANALYZE public.orb_eval_runs;

-- ------------------------------------------------------------
-- 3. Confirm it took. n_dead_tup should be at or near zero for the three
--    above, and last_vacuum should be within the last minute.
-- ------------------------------------------------------------
SELECT
  schemaname || '.' || relname AS qualified_table,
  n_live_tup,
  n_dead_tup,
  last_vacuum,
  last_analyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN ('project_todo_number_counters',
                  'orb_provider_consumption_snapshots',
                  'orb_eval_runs')
ORDER BY relname;

-- ============================================================
-- ON THE THRESHOLD
--
-- `dead_pct > 20%` alone is not a useful alarm. It is a ratio, so a table
-- with 3 live rows and 50 dead reads as 1666% while holding a few kilobytes
-- of garbage. PostgreSQL's own autovacuum trigger is
-- `50 + 0.2 * n_live_tup`, so orb_eval_runs at 30 live / 29 dead has simply
-- not reached its threshold of 56 — it is behaving correctly, not neglected.
-- An empty `last_autovacuum` on a small, low-churn table is normal.
--
-- Query 1 above therefore pairs the ratio with an absolute floor of 1000
-- dead rows. AGENTS.md's health-review section carries the same floor as of
-- 2026-09-03.
-- ============================================================
