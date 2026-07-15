-- Knowledge Repo entries must outlive the project they came from.
--
-- knowledge_repo.product_id was ON DELETE CASCADE, so hard-deleting a project
-- permanently destroyed every distilled lesson that originated from it — including
-- the entries the Realtime closing workflow (ORB-325 Phase 1) now writes on every
-- close. That contradicts the Repo's purpose: knowledge is shared, not siloed, and
-- is meant to outlive the work that produced it. It also contradicts the ORB-323
-- FK convention: data that should outlive its parent is SET NULL; only personal
-- per-user data cascades. (origin_todo_id was already correctly SET NULL.)
--
-- SET NULL alone would silently orphan the entry, so a BEFORE DELETE trigger on
-- projects annotates each affected entry first — while the project name is still
-- readable — using the same banner convention as SUPERSEDED entries: banner on
-- top, original content preserved untouched below.

ALTER TABLE public.knowledge_repo
  DROP CONSTRAINT IF EXISTS knowledge_repo_product_id_fkey;

ALTER TABLE public.knowledge_repo
  ADD CONSTRAINT knowledge_repo_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.note_project_deleted_on_knowledge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Runs BEFORE the row is deleted, so product_id still resolves to OLD.id and
  -- OLD.name is still readable. The FK then clears product_id to NULL.
  UPDATE public.knowledge_repo
  SET content = format(
        E'**ORIGINATING PROJECT DELETED (%s):** the project “%s” no longer exists, so this entry is retained without project attribution.\n\n%s',
        to_char(now(), 'YYYY-MM-DD'),
        OLD.name,
        content
      ),
      updated_at = now()
  WHERE product_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS projects_note_knowledge_before_delete ON public.projects;

CREATE TRIGGER projects_note_knowledge_before_delete
  BEFORE DELETE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.note_project_deleted_on_knowledge();
