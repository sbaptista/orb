-- ORB: reduce Supabase Disk IO on hot dashboard and Orb context paths.
-- Live pg_stat_statements on 2026-07-07 showed repeated reads shaped as:
--   todos WHERE deleted_at IS NULL
--   todos WHERE product_id = ANY(...) AND deleted_at IS NULL
--   knowledge_repo ORDER BY created_at DESC
--   projects WHERE is_dormant = false ORDER BY sort_order/name

CREATE INDEX IF NOT EXISTS idx_todos_product_deleted_urgency
  ON public.todos (product_id, status, priority_value, due_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_todos_product_todo_number_deleted
  ON public.todos (product_id, todo_number)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_repo_created_at
  ON public.knowledge_repo (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_active_sort_order
  ON public.projects (sort_order)
  WHERE is_dormant = false AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_active_name
  ON public.projects (name)
  WHERE is_dormant = false AND deleted_at IS NULL;
