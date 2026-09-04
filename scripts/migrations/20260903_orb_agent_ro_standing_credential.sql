-- ============================================================
-- ORB-382 — remove time-boxed agent windows
-- Date: 2026-09-03 — Claude Code (Opus 5)
--
-- `orb-agent-session` minted a fresh password per window and stamped a
-- server-side VALID UNTIL. That mechanism is removed. This migration clears
-- the leftover stamp so the role stops carrying an expiry nobody tracks.
--
-- WHY THE WINDOW WENT AWAY
--
-- VALID UNTIL is an authentication-time check. It gates new logins and does
-- nothing to a connection already established — confirmed by test on
-- 2026-08-20 (F18). Natural expiry fires no event, so a held connection
-- survived until the next mint or an explicit --end. The window was never the
-- boundary; these grants are:
--
--     SELECT on exactly 8 tables, audit_log excluded, NOBYPASSRLS,
--     NOINHERIT, CONNECTION LIMIT 4, default_transaction_read_only = on.
--
-- No INSERT, UPDATE or DELETE grant exists for this role. Removing the window
-- does not widen what the credential can reach.
--
-- REVOCATION, after this migration:
--
--     ALTER ROLE orb_agent_ro NOLOGIN;     -- revoke
--     ALTER ROLE orb_agent_ro LOGIN;       -- restore
--
-- Unlike VALID UNTIL, NOLOGIN is still only an authentication-time check. To
-- cut off a connection that is already open, also run:
--
--     SELECT pg_terminate_backend(pid) FROM pg_stat_activity
--      WHERE usename = 'orb_agent_ro' AND pid <> pg_backend_pid();
--
-- RUNS IN THE SUPABASE SQL EDITOR (paste whole file) OR psql.
--
-- AFTER THIS:
--   1. Set a standing password:  \password orb_agent_ro
--      (In the SQL editor instead: ALTER ROLE orb_agent_ro WITH PASSWORD '...')
--   2. Install the pgpass line — run `orb-agent status` for the exact format.
--   3. Verify:  scripts/migrations/verify-orb-agent-ro.sql
-- ============================================================

-- Clear the expiry stamp left by the last minted window. Without this the
-- role keeps refusing logins at a timestamp no launcher manages any more.
ALTER ROLE orb_agent_ro VALID UNTIL 'infinity';

-- DO NOT re-add an attribute-restating line here. An earlier draft carried:
--
--     ALTER ROLE orb_agent_ro WITH
--       LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
--
-- Supabase refused it: "permission denied to alter role — Only roles with the
-- SUPERUSER attribute may alter roles with the SUPERUSER attribute."
--
-- PostgreSQL requires superuser to touch the SUPERUSER, REPLICATION and
-- BYPASSRLS attributes AT ALL, including setting them to off, and Supabase's
-- `postgres` role is not a superuser (the same reason GRANT pg_read_all_stats
-- was refused on 2026-08-19). Note the asymmetry that makes this easy to miss:
-- CREATE ROLE ... NOSUPERUSER is permitted for a CREATEROLE role, which is why
-- 20260819_orb_agent_ro_role.sql applied cleanly, but ALTER ROLE ... NOSUPERUSER
-- is not.
--
-- Restating them was a no-op anyway: the window scheme never changed them, and
-- section A of verify-orb-agent-ro.sql asserts every one of them on each run.
-- That verifier is where those attributes are enforced, not here.
ALTER ROLE orb_agent_ro CONNECTION LIMIT 4;
ALTER ROLE orb_agent_ro SET search_path = public;
ALTER ROLE orb_agent_ro SET default_transaction_read_only = on;

-- Report the resulting state. `rolvaliduntil` should be NULL or infinity, and
-- `rolcanlogin` true. The password is NOT set here: it is set interactively so
-- it never lands in a file, a shell history, or this repository.
SELECT
  rolname,
  rolcanlogin                       AS can_log_in,
  rolvaliduntil                     AS expiry_stamp,
  rolconnlimit                      AS connection_limit,
  (rolpassword IS NOT NULL)         AS password_is_set,
  rolbypassrls                      AS bypasses_rls,
  rolinherit                        AS inherits
FROM pg_roles
WHERE rolname = 'orb_agent_ro';
