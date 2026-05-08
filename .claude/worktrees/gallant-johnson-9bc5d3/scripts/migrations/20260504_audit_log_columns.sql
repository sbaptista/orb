-- TODOS-35: Add missing columns to audit_log table
-- The initial audit_log table was created without action and record_id columns.
-- This migration adds them so logAuditEvent writes succeed.
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS record_id UUID;
