-- TODOS-35: Drop the CHECK constraint on audit_log.action
-- The original constraint restricted `action` to a small whitelist of values,
-- which silently rejected every new event the app emits (todo_create,
-- todo_update, todo_close, todo_delete, knowledge_distill, etc.).
-- The action column is informational; the app — not the schema — defines
-- the vocabulary.
ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_action_check;
