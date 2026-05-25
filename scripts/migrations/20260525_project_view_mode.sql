ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS view_mode TEXT NOT NULL DEFAULT 'list'
  CONSTRAINT projects_view_mode_check CHECK (view_mode IN ('list', 'checklist'));
