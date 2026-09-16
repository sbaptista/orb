-- One ordered mutation batch for every unified Orb turn, whether it contains
-- one command or many. Apply after 20260911_unified_orb_interactions.sql.

CREATE TABLE IF NOT EXISTS public.orb_command_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.orb_conversations(id) ON DELETE CASCADE,
  requested_event_id uuid NOT NULL REFERENCES public.orb_conversation_events(id) ON DELETE RESTRICT,
  origin_modality text NOT NULL CHECK (origin_modality IN ('text', 'voice')),
  summary text NOT NULL CHECK (char_length(btrim(summary)) BETWEEN 1 AND 4000),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'executed', 'rejected')),
  expires_at timestamptz NOT NULL,
  confirmed_by_event_id uuid REFERENCES public.orb_conversation_events(id) ON DELETE RESTRICT,
  receipt jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz,
  rejected_at timestamptz,
  CONSTRAINT orb_command_batches_result_shape CHECK (
    (status = 'proposed' AND confirmed_by_event_id IS NULL AND receipt IS NULL AND executed_at IS NULL AND rejected_at IS NULL)
    OR (status = 'executed' AND confirmed_by_event_id IS NOT NULL AND receipt IS NOT NULL AND executed_at IS NOT NULL AND rejected_at IS NULL)
    OR (status = 'rejected' AND receipt IS NULL AND executed_at IS NULL AND rejected_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.orb_command_batch_items (
  batch_id uuid NOT NULL REFERENCES public.orb_command_batches(id) ON DELETE CASCADE,
  sequence integer NOT NULL CHECK (sequence >= 0),
  proposal_id uuid NOT NULL UNIQUE REFERENCES public.orb_realtime_proposals(id) ON DELETE CASCADE,
  tool_use_id text NOT NULL CHECK (char_length(btrim(tool_use_id)) BETWEEN 1 AND 240),
  kind text NOT NULL,
  summary text NOT NULL CHECK (char_length(btrim(summary)) BETWEEN 1 AND 1000),
  PRIMARY KEY (batch_id, sequence)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orb_command_batches_one_pending
  ON public.orb_command_batches (user_id, conversation_id)
  WHERE status = 'proposed';

CREATE INDEX IF NOT EXISTS idx_orb_command_batches_receipt_recovery
  ON public.orb_command_batches (user_id, executed_at DESC)
  WHERE status = 'executed';

ALTER TABLE public.orb_command_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orb_command_batch_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.orb_command_batches FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.orb_command_batch_items FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orb_command_batches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orb_command_batch_items TO service_role;

CREATE OR REPLACE FUNCTION public.prepare_orb_command_batch(
  p_batch_id uuid,
  p_user_id uuid,
  p_conversation_id uuid,
  p_requested_event_id uuid,
  p_origin_modality text,
  p_summary text,
  p_expires_at timestamptz,
  p_commands jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request_event public.orb_conversation_events%ROWTYPE;
  v_existing_batch_id uuid;
  v_item jsonb;
  v_ordinal bigint;
  v_proposal_id uuid;
  v_count integer;
BEGIN
  IF p_origin_modality NOT IN ('text', 'voice') THEN
    RAISE EXCEPTION 'Invalid command batch modality';
  END IF;
  IF p_expires_at <= now() THEN
    RAISE EXCEPTION 'Command batch expiry must be in the future';
  END IF;
  IF jsonb_typeof(p_commands) <> 'array' THEN
    RAISE EXCEPTION 'Command batch commands must be an array';
  END IF;
  v_count := jsonb_array_length(p_commands);
  IF v_count < 1 OR v_count > 20 THEN
    RAISE EXCEPTION 'Command batches must contain between 1 and 20 commands';
  END IF;

  SELECT * INTO v_request_event
  FROM public.orb_conversation_events
  WHERE id = p_requested_event_id
    AND conversation_id = p_conversation_id
    AND user_id = p_user_id
    AND actor = 'user'
    AND event_type = 'user_message';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid command batch request event';
  END IF;

  SELECT id INTO v_existing_batch_id
  FROM public.orb_command_batches
  WHERE id = p_batch_id
    AND user_id = p_user_id
    AND conversation_id = p_conversation_id
    AND requested_event_id = p_requested_event_id;
  IF v_existing_batch_id IS NOT NULL THEN
    RETURN jsonb_build_object('batchId', p_batch_id, 'commandCount', v_count, 'replayed', true);
  END IF;

  v_existing_batch_id := NULL;
  SELECT id INTO v_existing_batch_id
  FROM public.orb_command_batches
  WHERE user_id = p_user_id
    AND conversation_id = p_conversation_id
    AND status = 'proposed'
  FOR UPDATE;

  IF v_existing_batch_id IS NOT NULL THEN
    DELETE FROM public.orb_realtime_proposals proposal
    USING public.orb_command_batch_items item
    WHERE item.batch_id = v_existing_batch_id
      AND proposal.id = item.proposal_id
      AND proposal.status = 'proposed';
    UPDATE public.orb_command_batches
    SET status = 'rejected', rejected_at = clock_timestamp()
    WHERE id = v_existing_batch_id;
  END IF;

  INSERT INTO public.orb_command_batches (
    id, user_id, conversation_id, requested_event_id, origin_modality,
    summary, expires_at
  ) VALUES (
    p_batch_id, p_user_id, p_conversation_id, p_requested_event_id,
    p_origin_modality, btrim(p_summary), p_expires_at
  );

  FOR v_item, v_ordinal IN
    SELECT value, ordinality
    FROM jsonb_array_elements(p_commands) WITH ORDINALITY
  LOOP
    v_proposal_id := (v_item->>'proposal_id')::uuid;
    INSERT INTO public.orb_realtime_proposals (
      id, user_id, project_id, kind, title, params, channel, summary,
      target_todo_id, destination_project_id, expires_at,
      conversation_id, requested_event_id, origin_modality
    ) VALUES (
      v_proposal_id,
      p_user_id,
      nullif(v_item->>'project_id', '')::uuid,
      v_item->>'kind',
      v_item->>'title',
      coalesce(v_item->'params', '{}'::jsonb),
      CASE WHEN p_origin_modality = 'voice' THEN 'realtime' ELSE 'serial' END,
      v_item->>'summary',
      nullif(v_item->>'target_todo_id', '')::uuid,
      nullif(v_item->>'destination_project_id', '')::uuid,
      p_expires_at,
      p_conversation_id,
      p_requested_event_id,
      p_origin_modality
    );

    INSERT INTO public.orb_command_batch_items (
      batch_id, sequence, proposal_id, tool_use_id, kind, summary
    ) VALUES (
      p_batch_id,
      (v_ordinal - 1)::integer,
      v_proposal_id,
      v_item->>'tool_use_id',
      v_item->>'kind',
      v_item->>'summary'
    );
  END LOOP;

  RETURN jsonb_build_object('batchId', p_batch_id, 'commandCount', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_orb_command_batch(
  p_batch_id uuid,
  p_user_id uuid,
  p_confirming_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch public.orb_command_batches%ROWTYPE;
  v_event public.orb_conversation_events%ROWTYPE;
  v_request_event public.orb_conversation_events%ROWTYPE;
  v_item record;
  v_result jsonb;
  v_receipts jsonb := '[]'::jsonb;
  v_receipt jsonb;
  v_spoken_text text;
  v_observed_at timestamptz := clock_timestamp();
BEGIN
  SELECT * INTO v_batch
  FROM public.orb_command_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF NOT FOUND OR v_batch.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Invalid command batch';
  END IF;
  IF v_batch.status = 'executed' THEN
    RETURN jsonb_build_object('receipt', v_batch.receipt, 'replayed', true);
  END IF;
  IF v_batch.status <> 'proposed' THEN
    RAISE EXCEPTION 'Command batch is no longer pending';
  END IF;
  IF v_batch.expires_at < now() THEN
    RAISE EXCEPTION 'Command batch expired';
  END IF;

  SELECT * INTO v_event
  FROM public.orb_conversation_events
  WHERE id = p_confirming_event_id
    AND user_id = p_user_id
    AND actor = 'user'
    AND event_type = 'user_message';
  IF NOT FOUND OR v_event.conversation_id <> v_batch.conversation_id THEN
    RAISE EXCEPTION 'Invalid command batch confirming event';
  END IF;

  SELECT * INTO v_request_event
  FROM public.orb_conversation_events
  WHERE id = v_batch.requested_event_id
    AND user_id = p_user_id
    AND conversation_id = v_batch.conversation_id
    AND actor = 'user'
    AND event_type = 'user_message';
  IF NOT FOUND OR v_event.sequence <= v_request_event.sequence THEN
    RAISE EXCEPTION 'Confirmation requires a distinct later user turn';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.orb_conversation_events interruption
    WHERE interruption.conversation_id = v_event.conversation_id
      AND interruption.turn_id = v_event.turn_id
      AND interruption.event_type = 'interrupt'
      AND interruption.sequence > v_event.sequence
  ) THEN
    RAISE EXCEPTION 'Confirmation turn was interrupted before commit';
  END IF;

  FOR v_item IN
    SELECT item.sequence, item.kind, item.proposal_id
    FROM public.orb_command_batch_items item
    WHERE item.batch_id = p_batch_id
    ORDER BY item.sequence
  LOOP
    IF v_item.kind = 'create_ticket' THEN
      v_result := public.confirm_realtime_ticket_mutation(v_item.proposal_id, p_user_id);
    ELSE
      v_result := public.confirm_realtime_mutation(v_item.proposal_id, p_user_id);
    END IF;
    v_receipts := v_receipts || jsonb_build_array(v_result->'receipt');
  END LOOP;

  IF jsonb_array_length(v_receipts) = 0 THEN
    RAISE EXCEPTION 'Command batch has no executable commands';
  END IF;

  SELECT string_agg(receipt->>'spokenText', ' ' ORDER BY ordinal)
  INTO v_spoken_text
  FROM jsonb_array_elements(v_receipts) WITH ORDINALITY AS receipts(receipt, ordinal);

  v_receipt := jsonb_build_object(
    'kind', 'command_batch',
    'receiptId', p_batch_id::text,
    'commandCount', jsonb_array_length(v_receipts),
    'receipts', v_receipts,
    'observedAt', v_observed_at,
    'source', 'database',
    'spokenText', v_spoken_text
  );

  UPDATE public.orb_command_batches
  SET status = 'executed',
      confirmed_by_event_id = p_confirming_event_id,
      receipt = v_receipt,
      executed_at = v_observed_at
  WHERE id = p_batch_id;

  RETURN jsonb_build_object('receipt', v_receipt, 'replayed', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pending_orb_command_batch(
  p_user_id uuid,
  p_conversation_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', batch.id,
    'user_id', batch.user_id,
    'conversation_id', batch.conversation_id,
    'summary', batch.summary,
    'created_at', batch.created_at,
    'expires_at', batch.expires_at,
    'commands', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'sequence', item.sequence,
        'proposal_id', item.proposal_id,
        'tool_use_id', item.tool_use_id,
        'kind', item.kind,
        'summary', item.summary,
        'title', proposal.title,
        'project_id', proposal.project_id,
        'target_todo_id', proposal.target_todo_id,
        'destination_project_id', proposal.destination_project_id,
        'params', proposal.params
      ) ORDER BY item.sequence)
      FROM public.orb_command_batch_items item
      JOIN public.orb_realtime_proposals proposal ON proposal.id = item.proposal_id
      WHERE item.batch_id = batch.id
    ), '[]'::jsonb)
  )
  FROM public.orb_command_batches batch
  WHERE batch.user_id = p_user_id
    AND batch.conversation_id = p_conversation_id
    AND batch.status = 'proposed'
    AND batch.expires_at > now()
  ORDER BY batch.created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.reject_orb_command_batch(
  p_batch_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.orb_realtime_proposals proposal
  USING public.orb_command_batch_items item
  WHERE item.batch_id = p_batch_id
    AND proposal.id = item.proposal_id
    AND proposal.user_id = p_user_id
    AND proposal.status = 'proposed';

  UPDATE public.orb_command_batches
  SET status = 'rejected', rejected_at = clock_timestamp()
  WHERE id = p_batch_id
    AND user_id = p_user_id
    AND status = 'proposed';
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_orb_command_batch(uuid, uuid, uuid, uuid, text, text, timestamptz, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_orb_command_batch(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_orb_command_batch(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_pending_orb_command_batch(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_orb_command_batch(uuid, uuid, uuid, uuid, text, text, timestamptz, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_orb_command_batch(uuid, uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_orb_command_batch(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_pending_orb_command_batch(uuid, uuid)
  TO service_role;

SELECT
  to_regclass('public.orb_command_batches') IS NOT NULL AS command_batches_ready,
  to_regclass('public.orb_command_batch_items') IS NOT NULL AS command_batch_items_ready,
  has_function_privilege('service_role', 'public.prepare_orb_command_batch(uuid,uuid,uuid,uuid,text,text,timestamptz,jsonb)', 'EXECUTE') AS service_can_prepare,
  has_function_privilege('service_role', 'public.confirm_orb_command_batch(uuid,uuid,uuid)', 'EXECUTE') AS service_can_confirm,
  has_function_privilege('service_role', 'public.get_pending_orb_command_batch(uuid,uuid)', 'EXECUTE') AS service_can_get_pending,
  NOT has_function_privilege('authenticated', 'public.confirm_orb_command_batch(uuid,uuid,uuid)', 'EXECUTE') AS authenticated_cannot_confirm;
