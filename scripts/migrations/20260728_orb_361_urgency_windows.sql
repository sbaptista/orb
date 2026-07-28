-- ORB-361 Phase 3 — per-project urgency windows
--
-- Phase 2 derived the orb's mood from priority-based runway windows using one
-- global default table (lib/orb-state.ts DEFAULT_URGENCY_WINDOWS). This adds
-- the per-project override layer: how early a deadline starts pressing can
-- differ between a hobby project and a client deadline.
--
-- Storage decisions (docs/per-todo-due-time-and-reminders-plan.md §3):
--   * jsonb column, not a child table — it is read only alongside the project
--     row the app already fetches, is never queried by its contents, and needs
--     no index. Per the AGENTS.md design-time checklist this adds NO new query
--     pattern, so no index is created here deliberately.
--   * NULL means "use the global defaults" and is the default state. It is not
--     a copy of the default numbers, so future changes to the defaults flow
--     through to every project that never customised. "Reset to defaults"
--     writes NULL for exactly this reason.
--   * Keyed by priorities.value as a string ("2"/"3"/"4"), since jsonb object
--     keys are always text. Priority 1 is flagged is_urgent and short-circuits
--     the window check entirely, so a "1" key is accepted but never consulted.
--
-- Shape: {"2": {"runway_hours": 72, "imminent_hours": 24}, "3": {...}}
--
-- The CHECK below only guarantees "object or NULL". Full shape validation is
-- server-side in lib/orb-state.ts parseUrgencyWindows(), called by the write
-- path in app/actions/manage-project.ts — the client is never trusted with
-- this JSON. The constraint exists so a careless future writer (REST, a
-- migration, psql) cannot store an array or a scalar that every reader would
-- then have to defend against.
--
-- Idempotent and rerun-safe.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS urgency_windows jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_urgency_windows_is_object'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_urgency_windows_is_object
      CHECK (urgency_windows IS NULL OR jsonb_typeof(urgency_windows) = 'object');
  END IF;
END $$;

COMMENT ON COLUMN public.projects.urgency_windows IS
  'ORB-361 Phase 3. Per-priority urgency windows overriding lib/orb-state.ts DEFAULT_URGENCY_WINDOWS. NULL = use defaults (never a copy of them). Shape {"<priority value>": {"runway_hours": int, "imminent_hours": int}}. Validated server-side by parseUrgencyWindows(); never written from client-supplied JSON.';

-- Verification (run manually after applying):
--   SELECT code, urgency_windows FROM public.projects ORDER BY sort_order;
--   -- every row should read NULL immediately after this migration
