-- Add system_info JSONB column to audit_log for environment context
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS system_info jsonb;

COMMENT ON COLUMN audit_log.system_info IS 'Client environment: browser, os, os_version, viewport';
