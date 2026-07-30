-- ORB-342: make the existing Realtime proposal spine transport-neutral.
--
-- The table name remains unchanged for deployment compatibility. `channel`
-- prevents a serial turn from consuming an unrelated Realtime proposal, while
-- `summary` lets the serial confirmation prompt describe server-held intent
-- without putting that intent back in the browser.

BEGIN;

ALTER TABLE public.orb_realtime_proposals
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'realtime'
    CHECK (channel IN ('serial', 'realtime')),
  ADD COLUMN IF NOT EXISTS summary text;

CREATE INDEX IF NOT EXISTS idx_orb_realtime_proposals_user_channel_pending
  ON public.orb_realtime_proposals (user_id, channel, created_at DESC)
  WHERE status = 'proposed';

-- Canonical batch implementation: preserve the serial tool's richer todo
-- fields while retaining Realtime's one-transaction, replay-safe semantics.
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

      INSERT INTO public.todos (
        product_id, title, status, description, priority_value,
        due_at, due_timezone, due_city, reminder_lead_value, reminder_lead_unit
      )
      VALUES (
        v_project.id,
        v_op->>'title',
        'open',
        nullif(v_op->>'description', ''),
        nullif(v_op->>'priority_value', '')::integer,
        nullif(v_op->>'due_at', '')::timestamptz,
        nullif(v_op->>'due_timezone', ''),
        nullif(v_op->>'due_city', ''),
        nullif(v_op->>'reminder_lead_value', '')::smallint,
        nullif(v_op->>'reminder_lead_unit', '')
      )
      RETURNING * INTO v_todo;

      v_new_code := coalesce(v_project.code, '') || '-' || v_todo.todo_number::text;
      v_after := jsonb_build_object('code', v_new_code, 'title', v_todo.title, 'description', v_todo.description, 'priority_value', v_todo.priority_value, 'due_at', v_todo.due_at, 'source', 'orb');
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
      v_before := jsonb_build_object('code', v_old_code, 'title', v_todo.title, 'status', v_todo.status, 'priority_value', v_todo.priority_value, 'description', v_todo.description, 'resolution_notes', v_todo.resolution_notes, 'urls', v_todo.urls, 'due_at', v_todo.due_at, 'project', v_project.name);

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
            priority_value = CASE WHEN v_op ? 'new_priority' THEN (v_op->>'new_priority')::integer ELSE priority_value END,
            description = CASE WHEN v_op ? 'new_description' THEN nullif(v_op->>'new_description', '') ELSE description END,
            resolution_notes = CASE WHEN v_op ? 'resolution_notes' THEN nullif(v_op->>'resolution_notes', '') ELSE resolution_notes END,
            urls = CASE WHEN v_op ? 'urls' THEN coalesce(v_op->'urls', '[]'::jsonb) ELSE urls END,
            due_at = CASE WHEN v_op ? 'due_at' THEN nullif(v_op->>'due_at', '')::timestamptz ELSE due_at END,
            due_timezone = CASE WHEN v_op ? 'due_timezone' THEN nullif(v_op->>'due_timezone', '') ELSE due_timezone END,
            due_city = CASE WHEN v_op ? 'due_city' THEN nullif(v_op->>'due_city', '') ELSE due_city END,
            reminder_lead_value = CASE WHEN v_op ? 'reminder_lead_value' THEN nullif(v_op->>'reminder_lead_value', '')::smallint ELSE reminder_lead_value END,
            reminder_lead_unit = CASE WHEN v_op ? 'reminder_lead_unit' THEN nullif(v_op->>'reminder_lead_unit', '') ELSE reminder_lead_unit END,
            reminded_at = CASE
              WHEN v_op ? 'due_at' OR v_op ? 'reminder_lead_value' OR v_op ? 'reminder_lead_unit' THEN NULL
              ELSE reminded_at
            END,
            reminder_nudge_dismissed_at = CASE
              WHEN coalesce((v_op->>'dismiss_reminder_nudge')::boolean, false) THEN v_observed_at
              ELSE reminder_nudge_dismissed_at
            END
        WHERE id = v_todo.id
        RETURNING * INTO v_todo;

        v_after := jsonb_build_object('code', v_old_code, 'title', v_todo.title, 'status', v_todo.status, 'priority_value', v_todo.priority_value, 'description', v_todo.description, 'resolution_notes', v_todo.resolution_notes, 'urls', v_todo.urls, 'due_at', v_todo.due_at, 'project', v_project.name, 'source', 'orb');
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


-- Keep the proven domain-specific transactions independently reviewable, but
-- make their dispatcher transport-neutral. Serial's richer todo schema is
-- applied inside the same outer transaction after the proven core has locked,
-- stale-checked, mutated, audited, receipted, and marked the proposal executed.
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
  v_proposal public.orb_realtime_proposals%ROWTYPE;
  v_result jsonb;
  v_receipt jsonb;
  v_todo public.todos%ROWTYPE;
  v_before_extra jsonb;
  v_after_extra jsonb;
  v_observed_at timestamptz;
BEGIN
  SELECT * INTO v_proposal
  FROM public.orb_realtime_proposals
  WHERE id = p_proposal_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid proposal';
  END IF;

  IF v_proposal.kind IN ('create_project', 'update_project', 'delete_project') THEN
    v_result := public.confirm_realtime_project_mutation(p_proposal_id, p_user_id);
  ELSIF v_proposal.kind IN ('add_knowledge', 'update_knowledge') THEN
    v_result := public.confirm_realtime_knowledge_mutation(p_proposal_id, p_user_id);
  ELSIF v_proposal.kind = 'batch_todo_action' THEN
    v_result := public.confirm_realtime_batch_todo_mutation(p_proposal_id, p_user_id);
  ELSE
    v_result := public.confirm_realtime_todo_mutation(p_proposal_id, p_user_id);
  END IF;

  -- Replays return the already-complete receipt and must perform no second
  -- write. Mark serial audit provenance before any operation-specific extras.
  IF coalesce((v_result->>'replayed')::boolean, false) THEN
    RETURN v_result;
  END IF;

  IF v_proposal.channel = 'serial' THEN
    v_receipt := v_result->'receipt';
    v_observed_at := (v_receipt->>'observedAt')::timestamptz;
    UPDATE public.audit_log
    SET after = coalesce(after, '{}'::jsonb)
      || jsonb_build_object('source', 'orb', 'channel', 'serial')
    WHERE user_id = p_user_id
      AND created_at = v_observed_at;
  END IF;

  -- Realtime proposals do not contain the serial-only fields.
  IF v_proposal.channel <> 'serial'
    OR v_proposal.kind NOT IN ('create_todo', 'update_todo', 'close_todo') THEN
    RETURN v_result;
  END IF;

  SELECT * INTO v_proposal
  FROM public.orb_realtime_proposals
  WHERE id = p_proposal_id;

  SELECT * INTO v_todo
  FROM public.todos
  WHERE id = coalesce(v_proposal.todo_id, v_proposal.target_todo_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The confirmed todo is no longer available';
  END IF;

  v_before_extra := jsonb_build_object(
    'priority_value', v_todo.priority_value,
    'description', v_todo.description,
    'resolution_notes', v_todo.resolution_notes,
    'urls', v_todo.urls,
    'due_at', v_todo.due_at,
    'due_timezone', v_todo.due_timezone,
    'due_city', v_todo.due_city,
    'reminder_lead_value', v_todo.reminder_lead_value,
    'reminder_lead_unit', v_todo.reminder_lead_unit,
    'reminder_nudge_dismissed_at', v_todo.reminder_nudge_dismissed_at
  );

  UPDATE public.todos
  SET priority_value = CASE
        WHEN v_proposal.params ? 'priority_value'
          THEN nullif(v_proposal.params->>'priority_value', '')::integer
        ELSE priority_value
      END,
      description = CASE
        WHEN v_proposal.params ? 'description' THEN nullif(v_proposal.params->>'description', '')
        WHEN v_proposal.params ? 'new_description' THEN nullif(v_proposal.params->>'new_description', '')
        ELSE description
      END,
      resolution_notes = CASE
        WHEN v_proposal.params ? 'resolution_notes' THEN nullif(v_proposal.params->>'resolution_notes', '')
        ELSE resolution_notes
      END,
      urls = CASE
        WHEN v_proposal.params ? 'urls' THEN coalesce(v_proposal.params->'urls', '[]'::jsonb)
        ELSE urls
      END,
      due_at = CASE
        WHEN v_proposal.params ? 'due_at' THEN nullif(v_proposal.params->>'due_at', '')::timestamptz
        ELSE due_at
      END,
      due_timezone = CASE
        WHEN v_proposal.params ? 'due_timezone' THEN nullif(v_proposal.params->>'due_timezone', '')
        ELSE due_timezone
      END,
      due_city = CASE
        WHEN v_proposal.params ? 'due_city' THEN nullif(v_proposal.params->>'due_city', '')
        ELSE due_city
      END,
      reminder_lead_value = CASE
        WHEN v_proposal.params ? 'reminder_lead_value'
          THEN nullif(v_proposal.params->>'reminder_lead_value', '')::smallint
        ELSE reminder_lead_value
      END,
      reminder_lead_unit = CASE
        WHEN v_proposal.params ? 'reminder_lead_unit'
          THEN nullif(v_proposal.params->>'reminder_lead_unit', '')
        ELSE reminder_lead_unit
      END,
      reminded_at = CASE
        WHEN v_proposal.params ? 'due_at'
          OR v_proposal.params ? 'reminder_lead_value'
          OR v_proposal.params ? 'reminder_lead_unit'
          THEN NULL
        ELSE reminded_at
      END,
      reminder_nudge_dismissed_at = CASE
        WHEN coalesce((v_proposal.params->>'dismiss_reminder_nudge')::boolean, false)
          THEN clock_timestamp()
        ELSE reminder_nudge_dismissed_at
      END
  WHERE id = v_todo.id
  RETURNING * INTO v_todo;

  v_after_extra := jsonb_build_object(
    'priority_value', v_todo.priority_value,
    'description', v_todo.description,
    'resolution_notes', v_todo.resolution_notes,
    'urls', v_todo.urls,
    'due_at', v_todo.due_at,
    'due_timezone', v_todo.due_timezone,
    'due_city', v_todo.due_city,
    'reminder_lead_value', v_todo.reminder_lead_value,
    'reminder_lead_unit', v_todo.reminder_lead_unit,
    'reminder_nudge_dismissed_at', v_todo.reminder_nudge_dismissed_at,
    'channel', 'serial'
  );

  UPDATE public.audit_log
  SET before = coalesce(before, '{}'::jsonb) || v_before_extra,
      after = coalesce(after, '{}'::jsonb) || v_after_extra
  WHERE record_id = v_todo.id
    AND user_id = p_user_id
    AND created_at = v_observed_at;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_realtime_mutation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_realtime_mutation(uuid, uuid) TO service_role;

COMMIT;
