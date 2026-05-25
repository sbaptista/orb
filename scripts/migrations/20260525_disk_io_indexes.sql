-- ORB-132: Add missing indexes to reduce disk I/O from sequential scans
-- Root causes identified 2026-05-25:
--   - todos: 60,094 seq scans, 10.7M rows read — no index on (product_id, status)
--   - projects: 94,111 seq scans driven by RLS subquery — no index on created_by
--   - audit_log: 3,293 seq scans, 530K rows read — no index on user_id or created_at

-- 1. todos: composite partial index for the standard fetchTodos query pattern
--    Covers: .eq('product_id', id) + .in('status', [...]) + .is('deleted_at', null)
CREATE INDEX IF NOT EXISTS idx_todos_product_status_deleted
  ON todos (product_id, status)
  WHERE deleted_at IS NULL;

-- 2. todos: status-only index for admin "all products" view (no product_id filter)
CREATE INDEX IF NOT EXISTS idx_todos_status_deleted
  ON todos (status)
  WHERE deleted_at IS NULL;

-- 3. projects: index on created_by to speed up RLS correlated subquery on todos
--    The todos RLS policy does EXISTS(SELECT 1 FROM projects WHERE created_by = auth.uid())
--    on every row — this makes that lookup O(1) instead of O(n).
CREATE INDEX IF NOT EXISTS idx_projects_created_by
  ON projects (created_by)
  WHERE deleted_at IS NULL;

-- 4. audit_log: index on user_id for RLS and user-scoped queries
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id
  ON audit_log (user_id);

-- 5. audit_log: index on created_at for the settings audit view (ordered DESC)
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON audit_log (created_at DESC);
