-- ORB-361 Phase 1 follow-up: persist the picked city label ("Boston, MA").
-- The IANA zone alone cannot reproduce it (America/New_York → "New York"),
-- and Stan's list-view display rule is city/state-or-country, not the zone
-- abbreviation. Display-only metadata; NULL falls back to the zone's city.
-- Idempotent / rerun-safe.

BEGIN;

ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS due_city text;

-- Extend the restore RPC once more so Backup & Recovery round-trips due_city.
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
    reminder_lead_unit, due_city
  )
  SELECT
    incoming.id, incoming.product_id, incoming.group_id, incoming.category_id,
    incoming.priority_value, incoming.title, incoming.description,
    incoming.resolution_notes, incoming.status, incoming.urls,
    incoming.sort_order, incoming.created_at, incoming.updated_at,
    incoming.closed_at, incoming.deleted_at, incoming.todo_number,
    incoming.priority_id, incoming.archived_at, incoming.due_at,
    incoming.reminded_at, incoming.ticket_id, incoming.due_timezone,
    incoming.reminder_lead_value, incoming.reminder_lead_unit, incoming.due_city
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
    due_city = EXCLUDED.due_city;

  GET DIAGNOSTICS v_restored = ROW_COUNT;
  PERFORM set_config('orb.restore_todo_numbers', 'off', true);

  RETURN jsonb_build_object('restored', v_restored);
END;
$function$;

COMMIT;
