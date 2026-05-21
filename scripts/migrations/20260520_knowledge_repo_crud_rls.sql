-- Allow users to update their own knowledge entries (via project ownership)
CREATE POLICY "knowledge_repo: update own" ON knowledge_repo
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = knowledge_repo.product_id
      AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = knowledge_repo.product_id
      AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid())
  ));

-- Allow users to delete their own knowledge entries (via project ownership)
CREATE POLICY "knowledge_repo: delete own" ON knowledge_repo
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = knowledge_repo.product_id
      AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid())
  ));
