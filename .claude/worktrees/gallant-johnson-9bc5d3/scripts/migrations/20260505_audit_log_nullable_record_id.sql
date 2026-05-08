-- TODOS-35: Drop NOT NULL on audit_log.record_id
-- System-level audit events (data_import, task_purge, knowledge_purge,
-- bulk operations) don't have a single record they reference. Without
-- this change, logAuditEvent fails silently on those calls.
ALTER TABLE public.audit_log
  ALTER COLUMN record_id DROP NOT NULL;
