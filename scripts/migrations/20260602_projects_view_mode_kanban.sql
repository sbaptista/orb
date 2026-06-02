ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_view_mode_check;
ALTER TABLE projects ADD CONSTRAINT projects_view_mode_check CHECK (view_mode IN ('list', 'checklist', 'kanban'));
