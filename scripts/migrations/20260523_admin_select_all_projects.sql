-- ORB-138: Allow admins (role_id 1 or 3) to SELECT all projects and their todos.
-- Non-admins continue to see only their own projects/todos.

BEGIN;

-- Replace the projects SELECT policy to include admin bypass
DROP POLICY IF EXISTS "projects: select own" ON projects;
CREATE POLICY "projects: select own or admin" ON projects
  FOR SELECT
  USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role_id IN (1, 3)
    )
  );

-- Replace the todos SELECT policy to include admin bypass
DROP POLICY IF EXISTS "todos: select own" ON todos;
CREATE POLICY "todos: select own or admin" ON todos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = todos.product_id
        AND projects.created_by = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role_id IN (1, 3)
    )
  );

COMMIT;
