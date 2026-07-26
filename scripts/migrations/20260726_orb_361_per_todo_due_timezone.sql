-- ORB-361 Phase 1: per-todo due timezone + opt-in reminders
-- Plan: docs/per-todo-due-time-and-reminders-plan.md §2
--
-- 1. todos.due_at: timestamp without time zone → timestamptz.
--    Existing naive values are wall-clock readings in Pacific/Honolulu (every
--    dated row belongs to Stan — asserted below, migration aborts otherwise).
-- 2. New todos.due_timezone (IANA zone the due time is expressed in).
-- 3. New todos.reminder_lead_value / reminder_lead_unit (opt-in reminder lead;
--    both NULL = no reminder; value 0 = at due time). Pair enforced by CHECK.
-- 4. restore_todos_from_archive extended with the three new columns so
--    Backup & Recovery round-trips them (its INSERT list is explicit).
--
-- Deliberately NO "due_timezone required when due_at set" CHECK: the live app
-- (one release behind during the deploy window) still writes due_at without a
-- zone; the app treats NULL due_timezone as "fall back to the user's zone".
-- Idempotent / rerun-safe: every step guards on current state.

BEGIN;

-- Abort if any dated todo cannot be attributed to the Pacific/Honolulu user.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.todos t
    JOIN public.projects p ON p.id = t.product_id
    JOIN public.users u ON u.id = p.created_by
    WHERE t.due_at IS NOT NULL
      AND u.timezone IS DISTINCT FROM 'Pacific/Honolulu'
  ) THEN
    RAISE EXCEPTION 'ORB-361 migration aborted: found a dated todo whose project owner is not the Pacific/Honolulu user — backfill attribution is wrong, review before rerunning';
  END IF;
END $$;

-- 1. Type change (guarded: only if still naive). Interprets stored wall-clocks
--    as Pacific/Honolulu and stores the true instant.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'todos'
      AND column_name = 'due_at' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE public.todos
      ALTER COLUMN due_at TYPE timestamptz
      USING (due_at AT TIME ZONE 'Pacific/Honolulu');
  END IF;
END $$;

-- 2 + 3. New columns.
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS due_timezone text;
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS reminder_lead_value smallint;
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS reminder_lead_unit text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'todos_reminder_lead_pair_check') THEN
    ALTER TABLE public.todos ADD CONSTRAINT todos_reminder_lead_pair_check
      CHECK ((reminder_lead_value IS NULL) = (reminder_lead_unit IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'todos_reminder_lead_value_check') THEN
    ALTER TABLE public.todos ADD CONSTRAINT todos_reminder_lead_value_check
      CHECK (reminder_lead_value IS NULL OR (reminder_lead_value >= 0 AND reminder_lead_value <= 99));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'todos_reminder_lead_unit_check') THEN
    ALTER TABLE public.todos ADD CONSTRAINT todos_reminder_lead_unit_check
      CHECK (reminder_lead_unit IS NULL OR reminder_lead_unit IN ('minutes', 'hours', 'days', 'weeks', 'months'));
  END IF;
END $$;

-- Backfill the zone on every already-dated row.
UPDATE public.todos SET due_timezone = 'Pacific/Honolulu'
WHERE due_at IS NOT NULL AND due_timezone IS NULL;

-- 4. Extend the restore RPC (full replacement of the live definition, which
--    validates via jsonb_populate_recordset but inserts an explicit list).
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
    id,
    product_id,
    group_id,
    category_id,
    priority_value,
    title,
    description,
    resolution_notes,
    status,
    urls,
    sort_order,
    created_at,
    updated_at,
    closed_at,
    deleted_at,
    todo_number,
    priority_id,
    archived_at,
    due_at,
    reminded_at,
    ticket_id,
    due_timezone,
    reminder_lead_value,
    reminder_lead_unit
  )
  SELECT
    incoming.id,
    incoming.product_id,
    incoming.group_id,
    incoming.category_id,
    incoming.priority_value,
    incoming.title,
    incoming.description,
    incoming.resolution_notes,
    incoming.status,
    incoming.urls,
    incoming.sort_order,
    incoming.created_at,
    incoming.updated_at,
    incoming.closed_at,
    incoming.deleted_at,
    incoming.todo_number,
    incoming.priority_id,
    incoming.archived_at,
    incoming.due_at,
    incoming.reminded_at,
    incoming.ticket_id,
    incoming.due_timezone,
    incoming.reminder_lead_value,
    incoming.reminder_lead_unit
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
    reminder_lead_unit = EXCLUDED.reminder_lead_unit;

  GET DIAGNOSTICS v_restored = ROW_COUNT;
  PERFORM set_config('orb.restore_todo_numbers', 'off', true);

  RETURN jsonb_build_object('restored', v_restored);
END;
$function$;

COMMIT;
