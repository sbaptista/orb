-- Intentional interrupts only block a confirmed commit.
--
-- Apply after 20260912_orb_command_batches.sql. Paste whole into the Supabase
-- SQL Editor (Path A); no psql meta-commands, no transaction control.
--
-- Why (2026-09-16): a microphone produces interruptions nobody intended — wind,
-- a cough, a siren, someone speaking in another room. Before this change any
-- durable `interrupt` on the confirming turn made the commit fail with
-- 'Confirmation turn was interrupted before commit', so an ordinary acoustic
-- barge-in or a follow-up utterance could silently discard an approved change.
--
-- The client now separates the two kinds (docs/orb-unified-interaction-
-- architecture-plan.md, "Interrupt contract"):
--   * acoustic barge-in pauses speech only and writes nothing;
--   * 'replacement' and 'exit_voice' are recorded but do not cancel a commit;
--   * 'stop' — the Stop button or a bare spoken/typed stop/cancel/wait — is the
--     only reason that blocks a commit that has not yet run.
-- Legacy 'barge_in' rows already stored no longer block anything.
--
-- The two functions below are copied verbatim from their defining migrations
-- with one added predicate: `AND interruption.payload->>'reason' = 'stop'`.
-- CREATE OR REPLACE keeps the existing signature and its grants.

CREATE OR REPLACE FUNCTION public.confirm_orb_mutation(
  p_proposal_id uuid,
  p_user_id uuid,
  p_confirming_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proposal public.orb_realtime_proposals%ROWTYPE;
  v_event public.orb_conversation_events%ROWTYPE;
  v_request_event public.orb_conversation_events%ROWTYPE;
  v_result jsonb;
BEGIN
  SELECT * INTO v_proposal
  FROM public.orb_realtime_proposals
  WHERE id = p_proposal_id
  FOR UPDATE;

  IF NOT FOUND OR v_proposal.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Invalid proposal';
  END IF;

  SELECT * INTO v_event
  FROM public.orb_conversation_events
  WHERE id = p_confirming_event_id
    AND user_id = p_user_id
    AND actor = 'user'
    AND event_type = 'user_message';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid confirming event';
  END IF;

  IF v_proposal.conversation_id IS NULL
     OR v_event.conversation_id <> v_proposal.conversation_id THEN
    RAISE EXCEPTION 'Confirmation must belong to the proposal conversation';
  END IF;

  IF v_proposal.requested_event_id IS NULL
     OR v_proposal.requested_event_id = p_confirming_event_id THEN
    RAISE EXCEPTION 'Confirmation requires a distinct later user turn';
  END IF;

  SELECT * INTO v_request_event
  FROM public.orb_conversation_events
  WHERE id = v_proposal.requested_event_id
    AND user_id = p_user_id
    AND conversation_id = v_proposal.conversation_id
    AND actor = 'user'
    AND event_type = 'user_message';

  IF NOT FOUND OR v_event.sequence <= v_request_event.sequence THEN
    RAISE EXCEPTION 'Confirmation must follow the requesting turn';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.orb_conversation_events interruption
    WHERE interruption.conversation_id = v_event.conversation_id
      AND interruption.turn_id = v_event.turn_id
      AND interruption.event_type = 'interrupt'
      AND interruption.payload->>'reason' = 'stop'
      AND interruption.sequence > v_event.sequence
  ) THEN
    RAISE EXCEPTION 'Confirmation turn was interrupted before commit';
  END IF;

  IF v_proposal.confirmed_by_event_id IS NOT NULL
     AND v_proposal.confirmed_by_event_id <> p_confirming_event_id THEN
    RAISE EXCEPTION 'Proposal was confirmed by a different event';
  END IF;

  IF v_proposal.kind = 'create_ticket' THEN
    v_result := public.confirm_realtime_ticket_mutation(p_proposal_id, p_user_id);
  ELSE
    v_result := public.confirm_realtime_mutation(p_proposal_id, p_user_id);
  END IF;

  UPDATE public.orb_realtime_proposals
  SET confirmed_by_event_id = p_confirming_event_id
  WHERE id = p_proposal_id
    AND confirmed_by_event_id IS NULL;

  RETURN v_result;
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
      AND interruption.payload->>'reason' = 'stop'
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

REVOKE ALL ON FUNCTION public.confirm_orb_mutation(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_orb_command_batch(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_orb_mutation(uuid, uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_orb_command_batch(uuid, uuid, uuid)
  TO service_role;

SELECT
  position('payload->>''reason'' = ''stop''' IN pg_get_functiondef('public.confirm_orb_mutation(uuid,uuid,uuid)'::regprocedure)) > 0
    AS confirm_mutation_blocks_only_on_stop,
  position('payload->>''reason'' = ''stop''' IN pg_get_functiondef('public.confirm_orb_command_batch(uuid,uuid,uuid)'::regprocedure)) > 0
    AS confirm_batch_blocks_only_on_stop,
  has_function_privilege('service_role', 'public.confirm_orb_command_batch(uuid,uuid,uuid)', 'EXECUTE')
    AS service_can_confirm_batch,
  NOT has_function_privilege('authenticated', 'public.confirm_orb_command_batch(uuid,uuid,uuid)', 'EXECUTE')
    AS authenticated_cannot_confirm_batch,
  NOT has_function_privilege('anon', 'public.confirm_orb_mutation(uuid,uuid,uuid)', 'EXECUTE')
    AS anon_cannot_confirm_mutation;
