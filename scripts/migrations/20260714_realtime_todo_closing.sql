-- ORB-325 (typed parity, Phase 1): durable, exactly-once Realtime todo CLOSING.
--
-- Closing is a distinct proposal kind ('close_todo'), not an overloaded update.
-- A close atomically, in one transaction: verifies the row is unchanged and the
-- user may edit it, sets status='closed' + resolution_notes + closed_at, writes
-- ONE knowledge_repo entry (origin_todo_id + product_id), writes ONE audit event,
-- and returns an immutable canonical receipt that replays unchanged.
--
-- Attribution + the exact resolution/knowledge text are composed in the app layer
-- (app/api/orb-realtime/turn) and stored in the proposal params; this RPC only
-- persists them, so it stays model-agnostic.

ALTER TABLE public.orb_realtime_proposals
  DROP CONSTRAINT IF EXISTS orb_realtime_proposals_kind_check;

ALTER TABLE public.orb_realtime_proposals
  ADD CONSTRAINT orb_realtime_proposals_kind_check
  CHECK (kind IN ('create_todo', 'update_todo', 'delete_todo', 'move_todo', 'close_todo'));

CREATE OR REPLACE FUNCTION public.confirm_realtime_todo_mutation(
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
  v_project public.projects%ROWTYPE;
  v_destination public.projects%ROWTYPE;
  v_todo public.todos%ROWTYPE;
  v_role_id integer;
  v_old_code text;
  v_new_code text;
  v_next_number integer;
  v_receipt jsonb;
  v_before jsonb;
  v_after jsonb;
  v_knowledge_id uuid;
  v_knowledge_title text;
  v_knowledge_content text;
  v_resolution_notes text;
  v_observed_at timestamptz := clock_timestamp();
BEGIN
  SELECT * INTO v_proposal
  FROM public.orb_realtime_proposals
  WHERE id = p_proposal_id
  FOR UPDATE;

  IF NOT FOUND OR v_proposal.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Invalid proposal';
  END IF;

  IF v_proposal.status = 'executed' THEN
    RETURN jsonb_build_object('receipt', v_proposal.receipt, 'replayed', true);
  END IF;

  IF v_proposal.expires_at < now() THEN
    RAISE EXCEPTION 'Proposal expired';
  END IF;

  SELECT role_id INTO v_role_id
  FROM public.users
  WHERE id = p_user_id;

  IF v_proposal.kind = 'create_todo' THEN
    SELECT * INTO v_project
    FROM public.projects
    WHERE id = v_proposal.project_id
      AND deleted_at IS NULL
      AND is_dormant = false
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The proposed project is no longer available';
    END IF;
    IF v_project.created_by <> p_user_id AND coalesce(v_role_id, 0) NOT IN (1, 3) THEN
      RAISE EXCEPTION 'The user cannot edit the proposed project';
    END IF;

    INSERT INTO public.todos (product_id, title, status)
    VALUES (v_project.id, v_proposal.title, 'open')
    RETURNING * INTO v_todo;

    v_new_code := coalesce(v_project.code, '') || '-' || v_todo.todo_number::text;
    v_after := jsonb_build_object(
      'code', v_new_code, 'title', v_todo.title, 'source', 'orb-realtime'
    );
    v_receipt := jsonb_build_object(
      'kind', 'create_todo',
      'receiptId', v_proposal.id::text,
      'code', v_new_code,
      'title', v_todo.title,
      'project', v_project.name,
      'observedAt', v_observed_at,
      'source', 'database',
      'spokenText', format('Created %s, “%s”, in %s.', v_new_code, v_todo.title, v_project.name)
    );

    INSERT INTO public.audit_log (action, table_name, record_id, after, actor, user_id, created_at)
    VALUES ('todo_create', 'todos', v_todo.id, v_after, 'orb', p_user_id, v_observed_at);
  ELSE
    SELECT * INTO v_todo
    FROM public.todos
    WHERE id = v_proposal.target_todo_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The proposed todo is no longer available';
    END IF;
    IF v_todo.updated_at IS DISTINCT FROM (v_proposal.params->>'expected_updated_at')::timestamptz
      OR v_todo.title IS DISTINCT FROM v_proposal.params->>'expected_title'
      OR v_todo.status IS DISTINCT FROM v_proposal.params->>'expected_status'
      OR coalesce(to_jsonb(v_todo.priority_value), 'null'::jsonb) IS DISTINCT FROM v_proposal.params->'expected_priority'
      OR v_todo.product_id IS DISTINCT FROM (v_proposal.params->>'expected_product_id')::uuid
      OR v_todo.todo_number IS DISTINCT FROM (v_proposal.params->>'expected_todo_number')::integer THEN
      RAISE EXCEPTION 'The todo changed after the proposal; read it again before changing it';
    END IF;

    IF v_proposal.kind = 'move_todo' THEN
      -- Lock both projects in stable order so opposite-direction moves cannot deadlock.
      PERFORM id
      FROM public.projects
      WHERE id IN (v_todo.product_id, v_proposal.destination_project_id)
      ORDER BY id
      FOR UPDATE;
    ELSE
      PERFORM id
      FROM public.projects
      WHERE id = v_todo.product_id
      FOR UPDATE;
    END IF;

    SELECT * INTO v_project
    FROM public.projects
    WHERE id = v_todo.product_id
      AND deleted_at IS NULL
      AND is_dormant = false;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The todo project is no longer available';
    END IF;
    IF v_project.created_by <> p_user_id AND coalesce(v_role_id, 0) NOT IN (1, 3) THEN
      RAISE EXCEPTION 'The user cannot edit the proposed todo';
    END IF;

    v_old_code := coalesce(v_project.code, '') || '-' || v_todo.todo_number::text;
    v_before := jsonb_build_object(
      'code', v_old_code,
      'title', v_todo.title,
      'status', v_todo.status,
      'priority_value', v_todo.priority_value,
      'project', v_project.name
    );

    IF v_proposal.kind = 'update_todo' THEN
      IF NOT (v_proposal.params ? 'new_title' OR v_proposal.params ? 'new_status' OR v_proposal.params ? 'new_priority') THEN
        RAISE EXCEPTION 'The update proposal contains no changes';
      END IF;
      IF v_proposal.params ? 'new_title'
        AND char_length(btrim(v_proposal.params->>'new_title')) NOT BETWEEN 1 AND 240 THEN
        RAISE EXCEPTION 'The proposed title is invalid';
      END IF;
      IF v_proposal.params ? 'new_status'
        AND (v_proposal.params->>'new_status') NOT IN ('open', 'in progress', 'deferred', 'on hold') THEN
        RAISE EXCEPTION 'Realtime closing is not available through update; use the close workflow';
      END IF;
      IF v_proposal.params ? 'new_priority'
        AND NOT EXISTS (
          SELECT 1 FROM public.priorities
          WHERE value = (v_proposal.params->>'new_priority')::integer
        ) THEN
        RAISE EXCEPTION 'The proposed priority is invalid';
      END IF;

      UPDATE public.todos
      SET title = CASE WHEN v_proposal.params ? 'new_title' THEN btrim(v_proposal.params->>'new_title') ELSE title END,
          status = CASE WHEN v_proposal.params ? 'new_status' THEN v_proposal.params->>'new_status' ELSE status END,
          priority_value = CASE WHEN v_proposal.params ? 'new_priority' THEN (v_proposal.params->>'new_priority')::integer ELSE priority_value END
      WHERE id = v_todo.id
      RETURNING * INTO v_todo;

      v_after := jsonb_build_object(
        'code', v_old_code,
        'title', v_todo.title,
        'status', v_todo.status,
        'priority_value', v_todo.priority_value,
        'project', v_project.name,
        'source', 'orb-realtime'
      );
      v_receipt := jsonb_build_object(
        'kind', 'update_todo',
        'receiptId', v_proposal.id::text,
        'code', v_old_code,
        'title', v_todo.title,
        'project', v_project.name,
        'observedAt', v_observed_at,
        'source', 'database',
        'spokenText', format('Updated %s, “%s”, in %s.', v_old_code, v_todo.title, v_project.name)
      );

      INSERT INTO public.audit_log (action, table_name, record_id, before, after, actor, user_id, created_at)
      VALUES ('todo_update', 'todos', v_todo.id, v_before, v_after, 'orb', p_user_id, v_observed_at);
    ELSIF v_proposal.kind = 'close_todo' THEN
      -- Closing must carry resolution notes and produce a knowledge entry, all in
      -- this one transaction, or it does not happen. The app layer already
      -- attributes and length-caps these strings before storing them.
      IF v_todo.status = 'closed' THEN
        RAISE EXCEPTION 'That todo is already closed';
      END IF;
      v_resolution_notes := btrim(coalesce(v_proposal.params->>'resolution_notes', ''));
      IF char_length(v_resolution_notes) = 0 THEN
        RAISE EXCEPTION 'Closing requires resolution notes';
      END IF;
      v_knowledge_title := btrim(coalesce(v_proposal.params->>'knowledge_title', ''));
      IF char_length(v_knowledge_title) = 0 THEN
        v_knowledge_title := format('%s: %s', v_old_code, v_todo.title);
      END IF;
      v_knowledge_content := btrim(coalesce(v_proposal.params->>'knowledge_content', ''));
      IF char_length(v_knowledge_content) = 0 THEN
        v_knowledge_content := v_resolution_notes;
      END IF;

      UPDATE public.todos
      SET status = 'closed',
          resolution_notes = v_resolution_notes,
          closed_at = v_observed_at
      WHERE id = v_todo.id
      RETURNING * INTO v_todo;

      INSERT INTO public.knowledge_repo (product_id, origin_todo_id, title, content)
      VALUES (v_todo.product_id, v_todo.id, v_knowledge_title, v_knowledge_content)
      RETURNING id INTO v_knowledge_id;

      v_after := jsonb_build_object(
        'code', v_old_code,
        'title', v_todo.title,
        'status', v_todo.status,
        'priority_value', v_todo.priority_value,
        'project', v_project.name,
        'knowledge_entry_id', v_knowledge_id,
        'source', 'orb-realtime'
      );
      v_receipt := jsonb_build_object(
        'kind', 'close_todo',
        'receiptId', v_proposal.id::text,
        'code', v_old_code,
        'title', v_todo.title,
        'project', v_project.name,
        'knowledgeEntryId', v_knowledge_id::text,
        'observedAt', v_observed_at,
        'source', 'database',
        'spokenText', format('Closed %s, “%s”, in %s, with resolution notes and a knowledge entry saved.', v_old_code, v_todo.title, v_project.name)
      );

      INSERT INTO public.audit_log (action, table_name, record_id, before, after, actor, user_id, created_at)
      VALUES ('todo_close', 'todos', v_todo.id, v_before, v_after, 'orb', p_user_id, v_observed_at);
    ELSIF v_proposal.kind = 'delete_todo' THEN
      UPDATE public.todos
      SET deleted_at = v_observed_at
      WHERE id = v_todo.id
      RETURNING * INTO v_todo;

      v_receipt := jsonb_build_object(
        'kind', 'delete_todo',
        'receiptId', v_proposal.id::text,
        'code', v_old_code,
        'title', v_todo.title,
        'project', v_project.name,
        'observedAt', v_observed_at,
        'source', 'database',
        'spokenText', format('Deleted %s, “%s”, from %s.', v_old_code, v_todo.title, v_project.name)
      );

      INSERT INTO public.audit_log (action, table_name, record_id, before, actor, user_id, created_at)
      VALUES ('todo_delete', 'todos', v_todo.id, v_before, 'orb', p_user_id, v_observed_at);
    ELSIF v_proposal.kind = 'move_todo' THEN
      SELECT * INTO v_destination
      FROM public.projects
      WHERE id = v_proposal.destination_project_id
        AND deleted_at IS NULL
        AND is_dormant = false;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'The destination project is no longer available';
      END IF;
      IF v_destination.id = v_project.id THEN
        RAISE EXCEPTION 'The todo is already in that project';
      END IF;
      IF v_destination.created_by <> p_user_id AND coalesce(v_role_id, 0) NOT IN (1, 3) THEN
        RAISE EXCEPTION 'The user cannot move the todo to that project';
      END IF;

      SELECT coalesce(max(todo_number), 0) + 1 INTO v_next_number
      FROM public.todos
      WHERE product_id = v_destination.id;

      UPDATE public.todos
      SET product_id = v_destination.id,
          todo_number = v_next_number
      WHERE id = v_todo.id
      RETURNING * INTO v_todo;

      v_new_code := coalesce(v_destination.code, '') || '-' || v_todo.todo_number::text;
      v_after := jsonb_build_object(
        'code', v_new_code,
        'title', v_todo.title,
        'status', v_todo.status,
        'priority_value', v_todo.priority_value,
        'project', v_destination.name,
        'source', 'orb-realtime'
      );
      v_receipt := jsonb_build_object(
        'kind', 'move_todo',
        'receiptId', v_proposal.id::text,
        'code', v_new_code,
        'oldCode', v_old_code,
        'title', v_todo.title,
        'project', v_destination.name,
        'observedAt', v_observed_at,
        'source', 'database',
        'spokenText', format('Moved %s to %s, “%s”, in %s.', v_old_code, v_new_code, v_todo.title, v_destination.name)
      );

      INSERT INTO public.audit_log (action, table_name, record_id, before, after, actor, user_id, created_at)
      VALUES ('todo_move', 'todos', v_todo.id, v_before, v_after, 'orb', p_user_id, v_observed_at);
    ELSE
      RAISE EXCEPTION 'Unsupported proposal kind';
    END IF;
  END IF;

  UPDATE public.orb_realtime_proposals
  SET status = 'executed', todo_id = v_todo.id, receipt = v_receipt, executed_at = v_observed_at
  WHERE id = v_proposal.id;

  RETURN jsonb_build_object('receipt', v_receipt, 'replayed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_realtime_todo_mutation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_realtime_todo_mutation(uuid, uuid) TO service_role;
