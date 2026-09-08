-- Give Realtime todo proposals the same rich-field confirmation path as serial.
-- Paste this file whole into the Supabase SQL Editor. The closing SELECT makes
-- successful installation visible.

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

  IF coalesce((v_result->>'replayed')::boolean, false) THEN
    RETURN v_result;
  END IF;

  v_receipt := v_result->'receipt';
  v_observed_at := (v_receipt->>'observedAt')::timestamptz;

  IF v_proposal.channel = 'serial' THEN
    UPDATE public.audit_log
    SET after = coalesce(after, '{}'::jsonb)
      || jsonb_build_object('source', 'orb', 'channel', 'serial')
    WHERE user_id = p_user_id
      AND created_at = v_observed_at;
  END IF;

  IF v_proposal.kind NOT IN ('create_todo', 'update_todo', 'close_todo') THEN
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
    'channel', v_proposal.channel
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

SELECT
  pg_get_functiondef('public.confirm_realtime_mutation(uuid, uuid)'::regprocedure)
    LIKE '%v_proposal.kind NOT IN (%' AS todo_full_field_parity_installed;
