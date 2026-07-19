-- ORB-337: todo addresses are never recycled within a project.
--
-- The permanent identity is todos.id. The project code + todo_number is the
-- current address: moves allocate a fresh destination address, while deletes
-- and moves never return the old number to the pool.

BEGIN;

-- Keep the seed, constraints, and trigger swap as one coherent cutover.
LOCK TABLE public.projects IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.todos IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.audit_log IN SHARE MODE;

DO $preconditions$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.todos WHERE todo_number IS NULL OR todo_number <= 0
  ) THEN
    RAISE EXCEPTION 'ORB-337 requires every surviving todo to have a positive number';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.todos
    GROUP BY product_id, todo_number
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'ORB-337 found duplicate surviving project/number addresses';
  END IF;
END;
$preconditions$;

CREATE TABLE public.project_todo_number_counters (
  project_id uuid PRIMARY KEY
    REFERENCES public.projects(id) ON DELETE CASCADE,
  last_issued_number integer NOT NULL
    CHECK (last_issued_number >= 0)
);

ALTER TABLE public.project_todo_number_counters ENABLE ROW LEVEL SECURITY;

-- Diagnostic reads only. Allocation writes are owned by the hardened trigger.
CREATE POLICY "Owners and admins read todo number counters"
  ON public.project_todo_number_counters
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_todo_number_counters.project_id
        AND (
          p.created_by = (SELECT auth.uid())
          OR (SELECT public.is_admin())
        )
    )
  );

REVOKE ALL ON public.project_todo_number_counters FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.project_todo_number_counters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_todo_number_counters TO service_role;

-- Seed from both surviving rows (including soft-deleted todos) and every
-- parseable historical code in audit_log. Current-row MAX alone is unsafe:
-- multiple projects already have retired audited numbers above that maximum.
WITH current_max AS (
  SELECT product_id, max(todo_number) AS max_number
  FROM public.todos
  GROUP BY product_id
),
audited_numbers AS (
  SELECT
    p.id AS project_id,
    substring(code_value.code FROM char_length(p.code) + 2)::integer AS todo_number
  FROM public.projects p
  CROSS JOIN public.audit_log a
  CROSS JOIN LATERAL (
    VALUES (a.before->>'code'), (a.after->>'code')
  ) AS code_value(code)
  WHERE a.table_name = 'todos'
    AND p.code IS NOT NULL
    AND code_value.code LIKE p.code || '-%'
    AND substring(code_value.code FROM char_length(p.code) + 2) ~ '^[0-9]+$'
),
audit_max AS (
  SELECT project_id, max(todo_number) AS max_number
  FROM audited_numbers
  GROUP BY project_id
)
INSERT INTO public.project_todo_number_counters (project_id, last_issued_number)
SELECT
  p.id,
  greatest(
    coalesce(current_max.max_number, 0),
    coalesce(audit_max.max_number, 0)
  )
FROM public.projects p
LEFT JOIN current_max ON current_max.product_id = p.id
LEFT JOIN audit_max ON audit_max.project_id = p.id;

-- Fail closed if either recoverable history source exceeds the seeded counter.
DO $validate_seed$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.todos t
    JOIN public.project_todo_number_counters c ON c.project_id = t.product_id
    GROUP BY t.product_id, c.last_issued_number
    HAVING max(t.todo_number) > c.last_issued_number
  ) THEN
    RAISE EXCEPTION 'ORB-337 seed is below a surviving todo number';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.project_todo_number_counters c ON c.project_id = p.id
    CROSS JOIN public.audit_log a
    CROSS JOIN LATERAL (
      VALUES (a.before->>'code'), (a.after->>'code')
    ) AS code_value(code)
    WHERE a.table_name = 'todos'
      AND p.code IS NOT NULL
      AND code_value.code LIKE p.code || '-%'
      AND substring(code_value.code FROM char_length(p.code) + 2) ~ '^[0-9]+$'
    GROUP BY p.id, c.last_issued_number
    HAVING max(substring(code_value.code FROM char_length(p.code) + 2)::integer)
      > c.last_issued_number
  ) THEN
    RAISE EXCEPTION 'ORB-337 seed is below an audited todo number';
  END IF;
END;
$validate_seed$;

CREATE OR REPLACE FUNCTION public.assign_todo_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_restore_mode boolean :=
    coalesce(current_setting('orb.restore_todo_numbers', true), '') = 'on';
BEGIN
  -- Backup & Recovery is the sole path allowed to preserve an explicit
  -- historical address. The service-role-only restore function enables this
  -- transaction-local mode while the triggers remain active.
  IF v_restore_mode THEN
    IF NEW.todo_number IS NULL OR NEW.todo_number <= 0 THEN
      RAISE EXCEPTION 'Restored todos require a positive todo_number';
    END IF;

    INSERT INTO public.project_todo_number_counters (
      project_id,
      last_issued_number
    )
    VALUES (NEW.product_id, NEW.todo_number)
    ON CONFLICT (project_id) DO UPDATE
      SET last_issued_number = greatest(
        public.project_todo_number_counters.last_issued_number,
        EXCLUDED.last_issued_number
      );

    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.project_todo_number_counters (
      project_id,
      last_issued_number
    )
    VALUES (NEW.product_id, 1)
    ON CONFLICT (project_id) DO UPDATE
      SET last_issued_number =
        public.project_todo_number_counters.last_issued_number + 1
    RETURNING last_issued_number INTO NEW.todo_number;

    RETURN NEW;
  END IF;

  IF NEW.product_id IS DISTINCT FROM OLD.product_id THEN
    INSERT INTO public.project_todo_number_counters (
      project_id,
      last_issued_number
    )
    VALUES (NEW.product_id, 1)
    ON CONFLICT (project_id) DO UPDATE
      SET last_issued_number =
        public.project_todo_number_counters.last_issued_number + 1
    RETURNING last_issued_number INTO NEW.todo_number;

    RETURN NEW;
  END IF;

  IF NEW.todo_number IS DISTINCT FROM OLD.todo_number THEN
    RAISE EXCEPTION 'todo_number is immutable unless the todo moves project';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_todo_number ON public.todos;
DROP TRIGGER IF EXISTS todos_assign_number_on_insert ON public.todos;
DROP TRIGGER IF EXISTS todos_assign_number_on_move ON public.todos;

CREATE TRIGGER todos_assign_number_on_insert
  BEFORE INSERT ON public.todos
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_todo_number();

CREATE TRIGGER todos_assign_number_on_move
  BEFORE UPDATE OF product_id, todo_number ON public.todos
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_todo_number();

ALTER TABLE public.todos
  ALTER COLUMN todo_number SET NOT NULL;

ALTER TABLE public.todos
  ADD CONSTRAINT todos_todo_number_positive
  CHECK (todo_number > 0);

ALTER TABLE public.todos
  ADD CONSTRAINT todos_product_todo_number_key
  UNIQUE (product_id, todo_number);

-- Backup & Recovery promises to restore/merge an exported archive. Preserve
-- UUIDs and addresses through one service-role-only batch operation; normal
-- clients can never enable restore mode or supply their own number.
CREATE OR REPLACE FUNCTION public.restore_todos_from_archive(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
    ticket_id
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
    incoming.ticket_id
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
    ticket_id = EXCLUDED.ticket_id;

  GET DIAGNOSTICS v_restored = ROW_COUNT;
  PERFORM set_config('orb.restore_todo_numbers', 'off', true);

  RETURN jsonb_build_object('restored', v_restored);
END;
$$;

REVOKE ALL ON FUNCTION public.restore_todos_from_archive(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_todos_from_archive(jsonb)
  TO service_role;

-- Keep the latest production Realtime confirmation body intact while removing
-- its duplicate MAX()+1 allocator. The move update then relies on the same
-- destination trigger as every other path. Fail closed if the expected current
-- fragment is absent or another MAX(todo_number) allocator remains.
DO $rewrite_realtime$
DECLARE
  v_source text;
  v_old_fragment text := E'      SELECT coalesce(max(todo_number), 0) + 1 INTO v_next_number\n'
    || E'      FROM public.todos\n'
    || E'      WHERE product_id = v_destination.id;\n\n'
    || E'      UPDATE public.todos\n'
    || E'      SET product_id = v_destination.id,\n'
    || E'          todo_number = v_next_number';
  v_new_fragment text := E'      UPDATE public.todos\n'
    || E'      SET product_id = v_destination.id';
BEGIN
  SELECT p.prosrc INTO v_source
  FROM pg_proc p
  WHERE p.oid = 'public.confirm_realtime_todo_mutation(uuid,uuid)'::regprocedure;

  IF v_source IS NULL THEN
    RAISE EXCEPTION 'confirm_realtime_todo_mutation(uuid, uuid) is missing';
  END IF;

  IF position(v_old_fragment IN v_source) = 0 THEN
    RAISE EXCEPTION 'Realtime todo allocator fragment did not match the production function';
  END IF;

  v_source := replace(v_source, E'  v_next_number integer;\n', '');
  v_source := replace(v_source, v_old_fragment, v_new_fragment);

  IF position('max(todo_number)' IN lower(v_source)) > 0
    OR position('v_next_number' IN v_source) > 0 THEN
    RAISE EXCEPTION 'Realtime todo allocator rewrite left legacy allocation code';
  END IF;

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

COMMIT;
