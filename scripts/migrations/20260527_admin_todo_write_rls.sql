-- ORB-162: Allow admins (role_id 1 or 3) to insert, update, and delete todos across all projects,
-- and update/delete projects.

BEGIN;

-- Todos: drop old write policies
DROP POLICY IF EXISTS "todos: insert own" ON todos;
DROP POLICY IF EXISTS "todos: update own" ON todos;
DROP POLICY IF EXISTS "todos: delete own" ON todos;

-- Todos: create new write policies with admin bypass
CREATE POLICY "todos: insert own or admin" ON todos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = todos.product_id
        AND projects.created_by = (SELECT auth.uid())
    )
    OR (SELECT is_admin())
  );

CREATE POLICY "todos: update own or admin" ON todos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = todos.product_id
        AND projects.created_by = (SELECT auth.uid())
    )
    OR (SELECT is_admin())
  );

CREATE POLICY "todos: delete own or admin" ON todos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = todos.product_id
        AND projects.created_by = (SELECT auth.uid())
    )
    OR (SELECT is_admin())
  );

-- Projects: drop old write policies
DROP POLICY IF EXISTS "projects: update own" ON projects;
DROP POLICY IF EXISTS "projects: delete own" ON projects;

-- Projects: create new write policies with admin bypass
CREATE POLICY "projects: update own or admin" ON projects
  FOR UPDATE
  USING (
    created_by = (SELECT auth.uid())
    OR (SELECT is_admin())
  );

CREATE POLICY "projects: delete own or admin" ON projects
  FOR DELETE
  USING (
    created_by = (SELECT auth.uid())
    OR (SELECT is_admin())
  );

COMMIT;
