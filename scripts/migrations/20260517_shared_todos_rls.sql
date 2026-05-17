-- Shared project todos: SELECT and INSERT for all release_stage users
-- UPDATE and DELETE only for project owner or admins

-- SELECT: own projects OR shared projects
DROP POLICY IF EXISTS "todos: select own" ON todos;
CREATE POLICY "todos: select own" ON todos FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = todos.product_id
    AND (
      projects.created_by = auth.uid()
      OR (projects.is_shared = true AND EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.release_stage IS NOT NULL
      ))
    )
  )
);

-- INSERT: own projects OR shared projects
DROP POLICY IF EXISTS "todos: insert own" ON todos;
CREATE POLICY "todos: insert own" ON todos FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = todos.product_id
    AND (
      projects.created_by = auth.uid()
      OR (projects.is_shared = true AND EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.release_stage IS NOT NULL
      ))
    )
  )
);

-- UPDATE: own projects OR admin on shared projects
DROP POLICY IF EXISTS "todos: update own" ON todos;
CREATE POLICY "todos: update own" ON todos FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = todos.product_id
    AND (
      projects.created_by = auth.uid()
      OR (projects.is_shared = true AND EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (1, 3)
      ))
    )
  )
);

-- DELETE: own projects OR admin on shared projects
DROP POLICY IF EXISTS "todos: delete own" ON todos;
CREATE POLICY "todos: delete own" ON todos FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = todos.product_id
    AND (
      projects.created_by = auth.uid()
      OR (projects.is_shared = true AND EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id IN (1, 3)
      ))
    )
  )
);
