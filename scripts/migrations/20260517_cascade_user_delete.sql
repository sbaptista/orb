-- Change projects.created_by FK to CASCADE on user delete.
-- Shared projects are reassigned to super admin in application code before delete.
ALTER TABLE projects
  DROP CONSTRAINT projects_created_by_fkey,
  ADD CONSTRAINT projects_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;
