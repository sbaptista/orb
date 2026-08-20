-- ============================================================
-- Restore agent reads on todos after the is_admin lockdown
-- Date: 2026-08-20 — Claude Code (Opus 5)
--
-- After 20260820c revoked is_admin from PUBLIC, three verifier rows failed:
--   B  soft-deleted todos hidden        permission denied for function is_admin
--   C  todos readable                   permission denied for function is_admin
--   C  todos JOIN projects              permission denied for function is_admin
-- Only `todos`. Some pre-existing policy on that table calls is_admin().
--
-- MECHANISM (same as F9): permissive policies are OR'd and evaluated as the
-- querying role. The agent policy `deleted_at IS NULL` is not constant-
-- foldable, so the planner keeps the other policy in the plan and the executor
-- permission-checks is_admin(). `true OR <anything>` IS folded at plan time, so
-- the other policy is never reached.
--
-- THE TRADE, STATED PLAINLY: todos loses DB-level soft-delete filtering for
-- this role. Deleted rows become visible to orb_agent_ro at the database layer.
-- Soft-delete for todos is then carried solely by the broker's own
-- `WHERE t.deleted_at IS NULL` (scripts/security/orb-agent, todos list/get).
-- That is one layer where there were two. It is accepted because the
-- alternative — granting is_admin back — reopens a CONFIRMED identity-forgery
-- vector (G3), and because the worst case here is an agent seeing a deleted
-- todo, not assuming an admin identity.
--
-- categories and groups keep `deleted_at IS NULL`: their reads still pass, so
-- nothing forces them to be folded.
--
-- RUNS IN THE SUPABASE SQL EDITOR OR psql.
-- ============================================================

-- Diagnostic FIRST: which todos policies exist, and which mention is_admin?
-- Read this — it tells us whether a better fix (ALTER POLICY ... TO, excluding
-- orb_agent_ro while keeping the expression) is available as a follow-up.
SELECT policyname, cmd, roles::text,
       (qual ILIKE '%is_admin%') AS calls_is_admin,
       left(coalesce(qual, ''), 160) AS predicate
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'todos'
ORDER BY policyname;

-- The fix.
DROP POLICY IF EXISTS "agent_ro: select" ON public.todos;
CREATE POLICY "agent_ro: select" ON public.todos
  FOR SELECT TO orb_agent_ro USING (true);

SELECT 'todos agent policy folded to USING (true)' AS action,
       'soft-delete for todos is now enforced by the broker only' AS consequence;
