-- ORB-361 Phase 3.4 — the no-reminder nudge
--
-- A dated todo with no reminder is the exposed case: it slides from quiet to
-- overdue with nothing in between. But it is only *sometimes* a gap — a cake
-- due out of the oven needs no reminder; a financial milestone virtually
-- requires one. So the chief-of-staff behaviour Stan specified (2026-07-24) is
-- to point it out once, and stand down when told.
--
-- This column is what "once" and "when told" are made of. It is stamped:
--   1. when the nudge is surfaced into the Orb's context, so the mechanism is
--      structurally incapable of nagging — it cannot fire twice for one todo
--      even if the user never answers; and
--   2. when the user explicitly declines, via update_todo's
--      dismiss_reminder_nudge param or the todo editor.
--
-- Both cases mean the same thing downstream ("this todo's nudge is spent"), so
-- they share one column rather than two that every reader would have to OR
-- together. The name follows the plan; note that a stamp does NOT prove the
-- user was actually told, only that the Orb was given the opportunity —
-- observations are offered to the model, not forced into speech.
--
-- Dismissal deliberately SURVIVES a due-date edit: it is a statement about the
-- todo's nature ("this one never needs reminding"), not about its current date.
-- Nothing clears this column; setting a reminder makes the todo ineligible on
-- its own, without needing the flag reset.
--
-- Database impact (per the AGENTS.md design-time checklist):
--   * New query pattern? No — the nudge filters an in-memory todo list already
--     loaded for context. No index is created, deliberately.
--   * Realtime? No.
--   * Write frequency? At most one write per todo, ever. Negligible.
--   * RLS? Existing todos policies cover it; no new policy.
--
-- Idempotent / rerun-safe.

BEGIN;

ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS reminder_nudge_dismissed_at timestamptz;

COMMENT ON COLUMN public.todos.reminder_nudge_dismissed_at IS
  'ORB-361 Phase 3.4. Non-NULL = the no-reminder nudge for this todo is spent — either surfaced once into the Orb''s context, or explicitly declined by the user. Never cleared; survives due-date edits by design. Setting a reminder makes a todo ineligible for the nudge without touching this column.';

-- Extend the restore RPC so Backup & Recovery round-trips the new column.
-- The column list here is explicit, so a new column that is not added is
-- silently dropped on restore — the same trap Phase 1 handled twice.
CREATE OR REPLACE FUNCTION public.restore_todos_from_archive(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_restored integer;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'Todo archive payload must be a JSON array';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_populate_recordset(NULL::public.todos, p_rows) incoming
    WHERE incoming.id IS NULL
      OR incoming.product_id IS NULL
      OR incoming.todo_number IS NULL
      OR incoming.todo_number <= 0
  ) THEN
    RAISE EXCEPTION 'Todo archive contains a missing or invalid identity/address';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_populate_recordset(NULL::public.todos, p_rows) incoming
    GROUP BY incoming.product_id, incoming.todo_number
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Todo archive contains duplicate project/number addresses';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_populate_recordset(NULL::public.todos, p_rows) incoming
    JOIN public.todos existing
      ON existing.product_id = incoming.product_id
     AND existing.todo_number = incoming.todo_number
     AND existing.id <> incoming.id
  ) THEN
    RAISE EXCEPTION 'Todo archive address belongs to a different todo';
  END IF;

  PERFORM set_config('orb.restore_todo_numbers', 'on', true);

  INSERT INTO public.todos (
    id, product_id, group_id, category_id, priority_value, title, description,
    resolution_notes, status, urls, sort_order, created_at, updated_at,
    closed_at, deleted_at, todo_number, priority_id, archived_at, due_at,
    reminded_at, ticket_id, due_timezone, reminder_lead_value,
    reminder_lead_unit, due_city, reminder_nudge_dismissed_at
  )
  SELECT
    incoming.id, incoming.product_id, incoming.group_id, incoming.category_id,
    incoming.priority_value, incoming.title, incoming.description,
    incoming.resolution_notes, incoming.status, incoming.urls,
    incoming.sort_order, incoming.created_at, incoming.updated_at,
    incoming.closed_at, incoming.deleted_at, incoming.todo_number,
    incoming.priority_id, incoming.archived_at, incoming.due_at,
    incoming.reminded_at, incoming.ticket_id, incoming.due_timezone,
    incoming.reminder_lead_value, incoming.reminder_lead_unit, incoming.due_city,
    incoming.reminder_nudge_dismissed_at
  FROM jsonb_populate_recordset(NULL::public.todos, p_rows) incoming
  ON CONFLICT (id) DO UPDATE SET
    product_id = EXCLUDED.product_id,
    group_id = EXCLUDED.group_id,
    category_id = EXCLUDED.category_id,
    priority_value = EXCLUDED.priority_value,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    resolution_notes = EXCLUDED.resolution_notes,
    status = EXCLUDED.status,
    urls = EXCLUDED.urls,
    sort_order = EXCLUDED.sort_order,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    closed_at = EXCLUDED.closed_at,
    deleted_at = EXCLUDED.deleted_at,
    todo_number = EXCLUDED.todo_number,
    priority_id = EXCLUDED.priority_id,
    archived_at = EXCLUDED.archived_at,
    due_at = EXCLUDED.due_at,
    reminded_at = EXCLUDED.reminded_at,
    ticket_id = EXCLUDED.ticket_id,
    due_timezone = EXCLUDED.due_timezone,
    reminder_lead_value = EXCLUDED.reminder_lead_value,
    reminder_lead_unit = EXCLUDED.reminder_lead_unit,
    due_city = EXCLUDED.due_city,
    reminder_nudge_dismissed_at = EXCLUDED.reminder_nudge_dismissed_at;

  GET DIAGNOSTICS v_restored = ROW_COUNT;
  PERFORM set_config('orb.restore_todo_numbers', 'off', true);

  RETURN jsonb_build_object('restored', v_restored);
END;
$function$;

COMMIT;

-- Verification (run manually after applying):
--   SELECT count(*) FROM public.todos WHERE reminder_nudge_dismissed_at IS NOT NULL;  -- expect 0
--   SELECT pg_get_functiondef('public.restore_todos_from_archive(jsonb)'::regprocedure) LIKE '%reminder_nudge_dismissed_at%';  -- expect t
