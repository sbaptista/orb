-- 20260522_rls_initplan_fix.sql
-- ORB-131: Fix RLS initplan issue — wrap auth.uid() and auth.role() in (select ...)
-- so Postgres evaluates them once per query instead of once per row.
-- Also consolidates redundant priorities policies.

BEGIN;

-- ============================================================
-- USERS
-- ============================================================

ALTER POLICY "users: select own" ON users
  USING ((select auth.uid()) = id);

ALTER POLICY "users: insert own" ON users
  WITH CHECK ((select auth.uid()) = id);

ALTER POLICY "users: update own" ON users
  USING ((select auth.uid()) = id);

-- ============================================================
-- PROJECTS
-- ============================================================

ALTER POLICY "projects: select own" ON projects
  USING (created_by = (select auth.uid()));

ALTER POLICY "projects: insert own" ON projects
  WITH CHECK ((select auth.uid()) IS NOT NULL);

ALTER POLICY "projects: update own" ON projects
  USING (created_by = (select auth.uid()));

ALTER POLICY "projects: delete own" ON projects
  USING (created_by = (select auth.uid()));

-- ============================================================
-- TODOS
-- ============================================================

ALTER POLICY "todos: select own" ON todos
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = todos.product_id
      AND projects.created_by = (select auth.uid())
  ));

ALTER POLICY "todos: insert own" ON todos
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = todos.product_id
      AND projects.created_by = (select auth.uid())
  ));

ALTER POLICY "todos: update own" ON todos
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = todos.product_id
      AND projects.created_by = (select auth.uid())
  ));

ALTER POLICY "todos: delete own" ON todos
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = todos.product_id
      AND projects.created_by = (select auth.uid())
  ));

-- ============================================================
-- CATEGORIES
-- ============================================================

ALTER POLICY "categories: select own" ON categories
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = categories.product_id
      AND projects.created_by = (select auth.uid())
  ));

ALTER POLICY "categories: insert own" ON categories
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = categories.product_id
      AND projects.created_by = (select auth.uid())
  ));

ALTER POLICY "categories: update own" ON categories
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = categories.product_id
      AND projects.created_by = (select auth.uid())
  ));

ALTER POLICY "categories: delete own" ON categories
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = categories.product_id
      AND projects.created_by = (select auth.uid())
  ));

-- ============================================================
-- GROUPS
-- ============================================================

ALTER POLICY "groups: select own" ON groups
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = groups.product_id
      AND projects.created_by = (select auth.uid())
  ));

ALTER POLICY "groups: insert own" ON groups
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = groups.product_id
      AND projects.created_by = (select auth.uid())
  ));

ALTER POLICY "groups: update own" ON groups
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = groups.product_id
      AND projects.created_by = (select auth.uid())
  ));

ALTER POLICY "groups: delete own" ON groups
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = groups.product_id
      AND projects.created_by = (select auth.uid())
  ));

-- ============================================================
-- KNOWLEDGE_REPO
-- ============================================================

ALTER POLICY "knowledge_repo: select own" ON knowledge_repo
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = knowledge_repo.product_id
      AND EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()))
  ));

ALTER POLICY "knowledge_repo: insert own" ON knowledge_repo
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = knowledge_repo.product_id
      AND EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()))
  ));

ALTER POLICY "knowledge_repo: update own" ON knowledge_repo
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = knowledge_repo.product_id
      AND EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = knowledge_repo.product_id
      AND EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()))
  ));

ALTER POLICY "knowledge_repo: delete own" ON knowledge_repo
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = knowledge_repo.product_id
      AND EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()))
  ));

-- ============================================================
-- TODO_PLATFORMS
-- ============================================================

ALTER POLICY "todo_platforms: select own" ON todo_platforms
  USING (EXISTS (
    SELECT 1 FROM todos
    WHERE todos.id = todo_platforms.todo_id
      AND EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()))
  ));

ALTER POLICY "todo_platforms: insert own" ON todo_platforms
  WITH CHECK (EXISTS (
    SELECT 1 FROM todos
    WHERE todos.id = todo_platforms.todo_id
      AND EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()))
  ));

ALTER POLICY "todo_platforms: delete own" ON todo_platforms
  USING (EXISTS (
    SELECT 1 FROM todos
    WHERE todos.id = todo_platforms.todo_id
      AND EXISTS (SELECT 1 FROM users WHERE users.id = (select auth.uid()))
  ));

-- ============================================================
-- AUDIT_LOG
-- ============================================================

ALTER POLICY "audit_log: select own" ON audit_log
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
        AND users.role_id = ANY (ARRAY[1, 3])
    )
  );

ALTER POLICY "audit_log: insert own" ON audit_log
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE users.id = (select auth.uid())
  ));

-- ============================================================
-- PLATFORMS (simple auth check)
-- ============================================================

ALTER POLICY "platforms: select authenticated" ON platforms
  USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "platforms: insert authenticated" ON platforms
  WITH CHECK ((select auth.uid()) IS NOT NULL);

ALTER POLICY "platforms: update authenticated" ON platforms
  USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY "platforms: delete authenticated" ON platforms
  USING ((select auth.uid()) IS NOT NULL);

-- ============================================================
-- STATUSES
-- ============================================================

ALTER POLICY "statuses: all authenticated" ON statuses
  USING ((select auth.uid()) IS NOT NULL);

-- ============================================================
-- PUSH_SUBSCRIPTIONS
-- ============================================================

ALTER POLICY "push_subscriptions: select own" ON push_subscriptions
  USING (user_id = (select auth.uid()));

ALTER POLICY "push_subscriptions: insert own" ON push_subscriptions
  WITH CHECK (user_id = (select auth.uid()));

ALTER POLICY "push_subscriptions: delete own" ON push_subscriptions
  USING (user_id = (select auth.uid()));

-- ============================================================
-- ROLES
-- ============================================================

ALTER POLICY "roles: select all" ON roles
  USING ((select auth.role()) = 'authenticated'::text);

-- ============================================================
-- INVITATIONS
-- ============================================================

ALTER POLICY "admin_full_access" ON invitations
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())
      AND users.role_id >= 1
  ));

-- ============================================================
-- PRIORITIES — consolidate overlapping policies
-- The ALL policy already covers insert/update/delete.
-- Drop the redundant individual policies.
-- ============================================================

-- Fix the ALL policy first
ALTER POLICY "priorities: full crud authenticated" ON priorities
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Drop redundant individual policies (ALL already covers these)
DROP POLICY IF EXISTS "priorities: insert" ON priorities;
DROP POLICY IF EXISTS "priorities: update" ON priorities;
DROP POLICY IF EXISTS "priorities: delete" ON priorities;

-- The select public policy (USING true) is fine — keep it for unauthenticated reads if needed.

COMMIT;
