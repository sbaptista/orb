-- ORB-144: Per-user project code uniqueness
-- Shift from global uniqueness to user-scoped uniqueness so multiple
-- users can have projects with common codes (e.g. TEST, WORK).

BEGIN;

-- Drop the global uniqueness constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS products_code_key;

-- Add composite uniqueness: same user cannot have two active projects with the same code
CREATE UNIQUE INDEX projects_user_code_idx ON projects (created_by, code) WHERE deleted_at IS NULL;

COMMIT;
