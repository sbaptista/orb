-- ORB-325 follow-up (2026-07-19): Realtime batch todo mutations.
--
-- Root cause of the reported bug: "delete test1, test2, test3" made the
-- Realtime model call propose_delete_todo three times in one turn, creating
-- three independent proposals with no combined announcement or confirmation
-- (fixed client-side in lib/hooks/useRealtimeVoiceSpike.ts's executeToolBatch,
-- but the deeper gap is that Realtime had no batch-mutation capability at all,
-- unlike the serial engine's todo_action_transaction). This migration gives
-- Realtime its own batch-todo-mutation proposal, built on its existing robust
-- DB-backed proposal/confirm pattern (signed token + one transaction + one
-- durable, replay-safe receipt) rather than serial's weaker client-held
-- mechanism. This is intended as the start of a shared canonical pattern for
-- both engines — see ORB-342 for the fuller serial/Realtime convergence.
--
-- Scope matches serial's todo_action_transaction: create/update/delete/move.
-- Closing is deliberately excluded from batches, same as serial — closing
-- requires resolution notes and a knowledge entry per todo, which does not
-- compress into a combined confirmation the way the other four actions do.
--
-- All-or-nothing: any operation failing its stale-check or resolution at
-- confirm time aborts the whole transaction. No partial batch execution.

BEGIN;

ALTER TABLE public.orb_realtime_proposals
  DROP CONSTRAINT orb_realtime_proposals_kind_check;

ALTER TABLE public.orb_realtime_proposals
  ADD CONSTRAINT orb_realtime_proposals_kind_check
  CHECK (
    kind = ANY (ARRAY[
      'create_todo', 'update_todo', 'delete_todo', 'move_todo', 'close_todo',
      'create_project', 'update_project', 'delete_project',
      'add_knowledge', 'update_knowledge',
      'batch_todo_action'
    ])
  );

CREATE OR REPLACE FUNCTION public.confirm_realtime_batch_todo_mutation(
  p_proposal_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proposal public.orb_realtime_proposals%ROWTYPE;
  v_role_id integer;
  v_op jsonb;
  v_action text;
  v_project public.projects%ROWTYPE;
  v_destination public.projects%ROWTYPE;
  v_todo public.todos%ROWTYPE;
  v_old_code text;
  v_new_code text;
  v_before jsonb;
  v_after jsonb;
  v_item_desc text;
  v_item_descs text[] := '{}';
  v_actions text[] := '{}';
  v_project_names text[] := '{}';
  v_observed_at timestamptz := clock_timestamp();
  v_op_count integer;
  v_receipt jsonb;
  v_spoken text;
  v_uniform_action text;
  v_uniform_project text;
BEGIN
  SELECT * INTO v_proposal
  FROM public.orb_realtime_proposals
  WHERE id = p_proposal_id
  FOR UPDATE;

  IF NOT FOUND OR v_proposal.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Invalid proposal';
  END IF;
  IF v_proposal.kind <> 'batch_todo_action' THEN
    RAISE EXCEPTION 'Unsupported batch proposal kind';
  END IF;
  IF v_proposal.status = 'executed' THEN
    RETURN jsonb_build_object('receipt', v_proposal.receipt, 'replayed', true);
  END IF;
  IF v_proposal.expires_at < now() THEN
    RAISE EXCEPTION 'Proposal expired';
  END IF;

  SELECT role_id INTO v_role_id FROM public.users WHERE id = p_user_id;

  v_op_count := jsonb_array_length(v_proposal.params->'operations');
  IF v_op_count IS NULL OR v_op_count < 1 THEN
    RAISE EXCEPTION 'The batch proposal has no operations';
  END IF;

  FOR v_op IN SELECT * FROM jsonb_array_elements(v_proposal.params->'operations')
  LOOP
    v_action := v_op->>'action';

    IF v_action = 'create' THEN
      SELECT * INTO v_project
      FROM public.projects
      WHERE id = (v_op->>'project_id')::uuid
        AND deleted_at IS NULL
        AND is_dormant = false
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'A batch item''s project is no longer available';
      END IF;
      IF v_project.created_by <> p_user_id AND coalesce(v_role_id, 0) NOT IN (1, 3) THEN
        RAISE EXCEPTION 'The user cannot edit a batch item''s project';
      END IF;

      INSERT INTO public.todos (product_id, title, status)
      VALUES (v_project.id, v_op->>'title', 'open')
      RETURNING * INTO v_todo;

      v_new_code := coalesce(v_project.code, '') || '-' || v_todo.todo_number::text;
      v_after := jsonb_build_object('code', v_new_code, 'title', v_todo.title, 'source', 'orb-realtime');
      v_item_desc := format('created %s, "%s", in %s', v_new_code, v_todo.title, v_project.name);
      v_project_names := array_append(v_project_names, v_project.name);

      INSERT INTO public.audit_log (action, table_name, record_id, after, actor, user_id, created_at)
      VALUES ('todo_create', 'todos', v_todo.id, v_after, 'orb', p_user_id, v_observed_at);

    ELSE
      SELECT * INTO v_todo
      FROM public.todos
      WHERE id = (v_op->>'todo_id')::uuid
        AND deleted_at IS NULL
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'A batch item''s todo is no longer available';
      END IF;
      IF v_todo.updated_at IS DISTINCT FROM (v_op->>'expected_updated_at')::timestamptz
        OR v_todo.title IS DISTINCT FROM v_op->>'expected_title'
        OR v_todo.status IS DISTINCT FROM v_op->>'expected_status'
        OR coalesce(to_jsonb(v_todo.priority_value), 'null'::jsonb) IS DISTINCT FROM coalesce(v_op->'expected_priority', 'null'::jsonb)
        OR v_todo.product_id IS DISTINCT FROM (v_op->>'expected_product_id')::uuid
        OR v_todo.todo_number IS DISTINCT FROM (v_op->>'expected_todo_number')::integer THEN
        RAISE EXCEPTION 'A batch item''s todo changed after the proposal; read it again before changing it';
      END IF;

      IF v_action = 'move' THEN
        PERFORM id FROM public.projects
        WHERE id IN (v_todo.product_id, (v_op->>'destination_project_id')::uuid)
        ORDER BY id FOR UPDATE;
      ELSE
        PERFORM id FROM public.projects WHERE id = v_todo.product_id FOR UPDATE;
      END IF;

      SELECT * INTO v_project
      FROM public.projects
      WHERE id = v_todo.product_id AND deleted_at IS NULL AND is_dormant = false;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'A batch item''s project is no longer available';
      END IF;
      IF v_project.created_by <> p_user_id AND coalesce(v_role_id, 0) NOT IN (1, 3) THEN
        RAISE EXCEPTION 'The user cannot edit a batch item''s todo';
      END IF;

      v_old_code := coalesce(v_project.code, '') || '-' || v_todo.todo_number::text;
      v_before := jsonb_build_object('code', v_old_code, 'title', v_todo.title, 'status', v_todo.status, 'priority_value', v_todo.priority_value, 'project', v_project.name);

      IF v_action = 'update' THEN
        IF NOT (v_op ? 'new_title' OR v_op ? 'new_status' OR v_op ? 'new_priority') THEN
          RAISE EXCEPTION 'A batch update item has no changes';
        END IF;
        IF v_op ? 'new_title' AND char_length(btrim(v_op->>'new_title')) NOT BETWEEN 1 AND 240 THEN
          RAISE EXCEPTION 'A batch item''s new title is invalid';
        END IF;
        IF v_op ? 'new_status' AND (v_op->>'new_status') NOT IN ('open', 'in progress', 'deferred', 'on hold') THEN
          RAISE EXCEPTION 'Realtime closing is not available through batch update';
        END IF;
        IF v_op ? 'new_priority' AND NOT EXISTS (
          SELECT 1 FROM public.priorities WHERE value = (v_op->>'new_priority')::integer
        ) THEN
          RAISE EXCEPTION 'A batch item''s new priority is invalid';
        END IF;

        UPDATE public.todos
        SET title = CASE WHEN v_op ? 'new_title' THEN btrim(v_op->>'new_title') ELSE title END,
            status = CASE WHEN v_op ? 'new_status' THEN v_op->>'new_status' ELSE status END,
            priority_value = CASE WHEN v_op ? 'new_priority' THEN (v_op->>'new_priority')::integer ELSE priority_value END
        WHERE id = v_todo.id
        RETURNING * INTO v_todo;

        v_after := jsonb_build_object('code', v_old_code, 'title', v_todo.title, 'status', v_todo.status, 'priority_value', v_todo.priority_value, 'project', v_project.name, 'source', 'orb-realtime');
        v_item_desc := format('updated %s, "%s"', v_old_code, v_todo.title);
        v_project_names := array_append(v_project_names, v_project.name);

        INSERT INTO public.audit_log (action, table_name, record_id, before, after, actor, user_id, created_at)
        VALUES ('todo_update', 'todos', v_todo.id, v_before, v_after, 'orb', p_user_id, v_observed_at);

      ELSIF v_action = 'delete' THEN
        UPDATE public.todos SET deleted_at = v_observed_at WHERE id = v_todo.id RETURNING * INTO v_todo;
        v_item_desc := format('deleted %s, "%s"', v_old_code, v_todo.title);
        v_project_names := array_append(v_project_names, v_project.name);

        INSERT INTO public.audit_log (action, table_name, record_id, before, actor, user_id, created_at)
        VALUES ('todo_delete', 'todos', v_todo.id, v_before, 'orb', p_user_id, v_observed_at);

      ELSIF v_action = 'move' THEN
        SELECT * INTO v_destination
        FROM public.projects
        WHERE id = (v_op->>'destination_project_id')::uuid AND deleted_at IS NULL AND is_dormant = false;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'A batch item''s destination project is no longer available';
        END IF;
        IF v_destination.id = v_project.id THEN
          RAISE EXCEPTION 'A batch item''s todo is already in that project';
        END IF;
        IF v_destination.created_by <> p_user_id AND coalesce(v_role_id, 0) NOT IN (1, 3) THEN
          RAISE EXCEPTION 'The user cannot move a batch item''s todo to that project';
        END IF;

        UPDATE public.todos SET product_id = v_destination.id WHERE id = v_todo.id RETURNING * INTO v_todo;
        v_new_code := coalesce(v_destination.code, '') || '-' || v_todo.todo_number::text;
        v_after := jsonb_build_object('code', v_new_code, 'title', v_todo.title, 'status', v_todo.status, 'priority_value', v_todo.priority_value, 'project', v_destination.name, 'source', 'orb-realtime');
        v_item_desc := format('moved %s to %s, "%s"', v_old_code, v_new_code, v_todo.title);
        v_project_names := array_append(v_project_names, v_destination.name);

        INSERT INTO public.audit_log (action, table_name, record_id, before, after, actor, user_id, created_at)
        VALUES ('todo_move', 'todos', v_todo.id, v_before, v_after, 'orb', p_user_id, v_observed_at);
      ELSE
        RAISE EXCEPTION 'Unsupported batch operation action';
      END IF;
    END IF;

    v_item_descs := array_append(v_item_descs, v_item_desc);
    v_actions := array_append(v_actions, v_action);
  END LOOP;

  -- Compose ONE combined receipt. If every operation shares the same action
  -- and project, use a compact summary (the common case — "delete these 3");
  -- otherwise itemize each change so nothing is left ambiguous.
  SELECT CASE WHEN count(DISTINCT a) = 1 THEN min(a) END INTO v_uniform_action FROM unnest(v_actions) AS a;
  SELECT CASE WHEN count(DISTINCT p) = 1 THEN min(p) END INTO v_uniform_project FROM unnest(v_project_names) AS p;

  IF v_uniform_action IS NOT NULL THEN
    -- create/update/delete/move all end in "e", so + 'd' is the correct past
    -- tense for all four: created, updated, deleted, moved.
    v_spoken := format(
      '%s %s %s%s.',
      initcap(v_uniform_action) || 'd',
      v_op_count,
      CASE WHEN v_op_count = 1 THEN 'todo' ELSE 'todos' END,
      CASE WHEN v_uniform_project IS NOT NULL THEN format(' in %s', v_uniform_project) ELSE '' END
    );
  ELSE
    v_spoken := array_to_string(v_item_descs, '; ') || '.';
  END IF;

  v_receipt := jsonb_build_object(
    'kind', 'batch_todo_action',
    'receiptId', v_proposal.id::text,
    'code', v_op_count::text || ' todos',
    'title', v_proposal.title,
    'project', coalesce(v_uniform_project, ''),
    'observedAt', v_observed_at,
    'source', 'database',
    'spokenText', v_spoken
  );

  UPDATE public.orb_realtime_proposals
  SET status = 'executed', receipt = v_receipt, executed_at = v_observed_at
  WHERE id = v_proposal.id;

  RETURN jsonb_build_object('receipt', v_receipt, 'replayed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_realtime_batch_todo_mutation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_realtime_batch_todo_mutation(uuid, uuid) TO service_role;

-- Route the new kind through the shared dispatcher.
CREATE OR REPLACE FUNCTION public.confirm_realtime_mutation(
  p_proposal_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_kind text;
BEGIN
  SELECT kind INTO v_kind
  FROM public.orb_realtime_proposals
  WHERE id = p_proposal_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid proposal';
  END IF;
  IF v_kind IN ('create_project', 'update_project', 'delete_project') THEN
    RETURN public.confirm_realtime_project_mutation(p_proposal_id, p_user_id);
  END IF;
  IF v_kind IN ('add_knowledge', 'update_knowledge') THEN
    RETURN public.confirm_realtime_knowledge_mutation(p_proposal_id, p_user_id);
  END IF;
  IF v_kind = 'batch_todo_action' THEN
    RETURN public.confirm_realtime_batch_todo_mutation(p_proposal_id, p_user_id);
  END IF;
  RETURN public.confirm_realtime_todo_mutation(p_proposal_id, p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_realtime_mutation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_realtime_mutation(uuid, uuid) TO service_role;

COMMIT;
