-- EMERGENCY ONLY: roll back ORB-337 while maintenance mode remains enabled.
--
-- This deliberately restores the unsafe MAX(todo_number) + 1 behavior. Do not
-- take the application out of maintenance until the matching pre-ORB-337
-- application is also running. The snapshot table is intentionally retained.

BEGIN;

LOCK TABLE public.todos IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.project_todo_number_counters IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE public.project_todo_number_counters_rollback_snapshot_20260718 AS
SELECT *, clock_timestamp() AS captured_at
FROM public.project_todo_number_counters;

REVOKE ALL ON public.project_todo_number_counters_rollback_snapshot_20260718
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.project_todo_number_counters_rollback_snapshot_20260718
  TO service_role;

DROP FUNCTION IF EXISTS public.restore_todos_from_archive(jsonb);

DROP TRIGGER IF EXISTS todos_assign_number_on_insert ON public.todos;
DROP TRIGGER IF EXISTS todos_assign_number_on_move ON public.todos;

ALTER TABLE public.todos
  DROP CONSTRAINT IF EXISTS todos_product_todo_number_key;
ALTER TABLE public.todos
  DROP CONSTRAINT IF EXISTS todos_todo_number_positive;
ALTER TABLE public.todos
  ALTER COLUMN todo_number DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_todo_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT coalesce(max(todo_number), 0) + 1
  INTO NEW.todo_number
  FROM public.todos
  WHERE product_id = NEW.product_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER set_todo_number
  BEFORE INSERT ON public.todos
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_todo_number();

-- Restore the pre-ORB-337 Realtime move allocator. Fail closed if the aligned
-- post-migration fragment is not present.
DO $rewrite_realtime$
DECLARE
  v_source text;
  v_old_fragment text := E'      UPDATE public.todos\n'
    || E'      SET product_id = v_destination.id';
  v_new_fragment text := E'      SELECT coalesce(max(todo_number), 0) + 1 INTO v_next_number\n'
    || E'      FROM public.todos\n'
    || E'      WHERE product_id = v_destination.id;\n\n'
    || E'      UPDATE public.todos\n'
    || E'      SET product_id = v_destination.id,\n'
    || E'          todo_number = v_next_number';
BEGIN
  SELECT p.prosrc INTO v_source
  FROM pg_proc p
  WHERE p.oid = 'public.confirm_realtime_todo_mutation(uuid,uuid)'::regprocedure;

  IF v_source IS NULL
    OR position(v_old_fragment IN v_source) = 0
    OR position('v_next_number' IN v_source) > 0 THEN
    RAISE EXCEPTION 'Realtime todo rollback fragment did not match the ORB-337 function';
  END IF;

  v_source := replace(v_source, E'  v_receipt jsonb;\n', E'  v_next_number integer;\n  v_receipt jsonb;\n');
  v_source := replace(v_source, v_old_fragment, v_new_fragment);

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.confirm_realtime_todo_mutation('
    || 'p_proposal_id uuid, p_user_id uuid) '
    || 'RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER '
    || 'SET search_path = public, pg_temp AS %L',
    v_source
  );
END;
$rewrite_realtime$;

REVOKE ALL ON FUNCTION public.confirm_realtime_todo_mutation(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_realtime_todo_mutation(uuid, uuid)
  TO service_role;

DROP TABLE public.project_todo_number_counters;

COMMIT;
