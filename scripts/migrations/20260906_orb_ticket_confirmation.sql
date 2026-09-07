-- Route user-requested Orb ticket creation through the same durable
-- proposal/confirmation boundary used by todo, project, and Knowledge writes.

ALTER TABLE public.orb_realtime_proposals
  DROP CONSTRAINT IF EXISTS orb_realtime_proposals_kind_check;

ALTER TABLE public.orb_realtime_proposals
  ADD CONSTRAINT orb_realtime_proposals_kind_check
  CHECK (
    kind = ANY (ARRAY[
      'create_todo', 'update_todo', 'delete_todo', 'move_todo', 'close_todo',
      'create_project', 'update_project', 'delete_project',
      'add_knowledge', 'update_knowledge',
      'batch_todo_action', 'create_ticket'
    ])
  );

CREATE OR REPLACE FUNCTION public.confirm_realtime_ticket_mutation(
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
  v_ticket public.tickets%ROWTYPE;
  v_ticket_number integer;
  v_type text;
  v_source text;
  v_summary text;
  v_detail jsonb;
  v_observed_at timestamptz := clock_timestamp();
  v_receipt jsonb;
BEGIN
  SELECT * INTO v_proposal
  FROM public.orb_realtime_proposals
  WHERE id = p_proposal_id
  FOR UPDATE;

  IF NOT FOUND OR v_proposal.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Invalid proposal';
  END IF;
  IF v_proposal.kind <> 'create_ticket' THEN
    RAISE EXCEPTION 'Unsupported ticket proposal kind';
  END IF;
  IF v_proposal.status = 'executed' THEN
    RETURN jsonb_build_object('receipt', v_proposal.receipt, 'replayed', true);
  END IF;
  IF v_proposal.expires_at < now() THEN
    RAISE EXCEPTION 'Proposal expired';
  END IF;

  PERFORM 1 FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The user is no longer available';
  END IF;

  v_type := v_proposal.params->>'type';
  v_source := coalesce(nullif(v_proposal.params->>'source', ''), 'user-request');
  v_summary := btrim(coalesce(v_proposal.params->>'summary', v_proposal.title));
  v_detail := coalesce(v_proposal.params->'detail', '{}'::jsonb);

  IF v_type NOT IN ('bug', 'suggestion', 'capability_gap', 'workflow_friction') THEN
    RAISE EXCEPTION 'The proposed ticket type is invalid';
  END IF;
  IF v_source NOT IN ('orb-auto', 'user-request', 'admin') THEN
    RAISE EXCEPTION 'The proposed ticket source is invalid';
  END IF;
  IF char_length(v_summary) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'The proposed ticket summary is invalid';
  END IF;
  IF char_length(coalesce(v_proposal.params->>'conversation_snippet', '')) > 4000 THEN
    RAISE EXCEPTION 'The proposed ticket conversation snippet is too long';
  END IF;

  -- The existing application helper allocated max+1 without serialization.
  -- Serialize this counter so two confirmations cannot choose the same number.
  PERFORM pg_advisory_xact_lock(hashtext('public.tickets.ticket_number'));
  SELECT coalesce(max(ticket_number), 0) + 1 INTO v_ticket_number
  FROM public.tickets;

  INSERT INTO public.tickets (
    ticket_number, type, source, summary, detail,
    conversation_snippet, reported_by, status
  )
  VALUES (
    v_ticket_number,
    v_type,
    v_source,
    v_summary,
    v_detail,
    nullif(v_proposal.params->>'conversation_snippet', ''),
    p_user_id,
    'open'
  )
  RETURNING * INTO v_ticket;

  v_receipt := jsonb_build_object(
    'kind', 'create_ticket',
    'receiptId', v_proposal.id::text,
    'ticketId', v_ticket.id::text,
    'code', 'TICKETS-' || v_ticket.ticket_number::text,
    'title', v_ticket.summary,
    'project', 'Tickets',
    'observedAt', v_observed_at,
    'source', 'database',
    'spokenText', format('Filed TICKETS-%s: %s.', v_ticket.ticket_number, v_ticket.summary)
  );

  UPDATE public.orb_realtime_proposals
  SET status = 'executed',
      receipt = v_receipt,
      executed_at = v_observed_at
  WHERE id = v_proposal.id;

  RETURN jsonb_build_object('receipt', v_receipt, 'replayed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_realtime_ticket_mutation(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_realtime_ticket_mutation(uuid, uuid)
  TO service_role;

SELECT
  pg_get_constraintdef(c.oid) AS proposal_kind_constraint,
  has_function_privilege('service_role', 'public.confirm_realtime_ticket_mutation(uuid,uuid)', 'EXECUTE') AS service_can_confirm_ticket,
  has_function_privilege('authenticated', 'public.confirm_realtime_ticket_mutation(uuid,uuid)', 'EXECUTE') AS authenticated_can_confirm_ticket
FROM pg_constraint c
WHERE c.conname = 'orb_realtime_proposals_kind_check';
