-- Fix: knowledge_repo SELECT RLS policy excludes cross-project entries
-- (product_id IS NULL is the documented convention for cross-project
-- architectural decisions — see shared AGENTS.md Knowledge Repository
-- section: "Use null for product_id when the entry is a cross-project
-- architectural decision.")
--
-- The existing policy's EXISTS join (projects.id = knowledge_repo.product_id)
-- can never match when product_id is NULL, so RLS-scoped reads (the Orb's
-- own topic search, and any future precise-entry lookup) silently exclude
-- these rows entirely. Found live: 8 of 234 knowledge_repo rows have
-- product_id IS NULL and were invisible to conversational Orb tools despite
-- being fully visible/writable via the admin (service role) client used by
-- Settings -> Knowledge and by the Orb's own mutation handlers.
--
-- Fix: widen the SELECT policy only. INSERT/UPDATE/DELETE stay scoped to a
-- real project — all Orb-tool mutations to knowledge_repo already go through
-- the admin (service role) client, so this is purely a read-visibility fix,
-- not a new write surface.

DROP POLICY IF EXISTS "knowledge_repo: select own" ON public.knowledge_repo;

CREATE POLICY "knowledge_repo: select own" ON public.knowledge_repo
  FOR SELECT
  USING (
    product_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = knowledge_repo.product_id
        AND EXISTS (SELECT 1 FROM users WHERE users.id = (SELECT auth.uid()))
    )
  );
