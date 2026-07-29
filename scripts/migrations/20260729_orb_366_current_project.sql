-- ORB-366: make the current project a per-user, cross-device preference.
-- No index is required: consumers locate users by users.id and read this value.

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS current_project_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_current_project_id_fkey'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_current_project_id_fkey
      FOREIGN KEY (current_project_id)
      REFERENCES public.projects(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

COMMENT ON COLUMN public.users.current_project_id IS
  'The user''s current active project across sessions, browsers, and devices.';

UPDATE public.users AS target
SET current_project_id = (
  SELECT project.id
  FROM public.projects AS project
  WHERE project.created_by = target.id
    AND project.is_dormant = false
  ORDER BY project.sort_order NULLS LAST, project.created_at, project.id
  LIMIT 1
)
WHERE target.current_project_id IS NULL;

COMMIT;
