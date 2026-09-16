-- One durable conversation and confirmation scope for text and Realtime voice.
-- Apply in the Supabase SQL Editor before enabling
-- Originally deployed behind separate text and voice rollout flags. The
-- permanent runtime cutover no longer reads launcher flags.

CREATE TABLE IF NOT EXISTS public.orb_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CONSTRAINT orb_conversations_lifecycle CHECK (
    (status = 'active' AND closed_at IS NULL)
    OR (status = 'closed' AND closed_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orb_conversations_one_active_per_user
  ON public.orb_conversations (user_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_orb_conversations_user_updated
  ON public.orb_conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.orb_conversation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence bigint GENERATED ALWAYS AS IDENTITY,
  conversation_id uuid NOT NULL REFERENCES public.orb_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  turn_id uuid NOT NULL,
  actor text NOT NULL CHECK (actor IN ('user', 'orb', 'system')),
  event_type text NOT NULL CHECK (event_type IN (
    'user_message', 'assistant_message', 'interrupt',
    'mutation_proposed', 'mutation_rejected', 'mutation_receipt'
  )),
  modality text CHECK (modality IN ('text', 'voice')),
  visibility text NOT NULL CHECK (visibility IN ('visible', 'control')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  proposal_id uuid,
  response_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_orb_conversation_events_ordered
  ON public.orb_conversation_events (conversation_id, sequence);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orb_conversation_events_response
  ON public.orb_conversation_events (response_id)
  WHERE response_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orb_conversation_events_receipt_outbox
  ON public.orb_conversation_events (user_id, created_at DESC)
  WHERE event_type = 'assistant_message' AND proposal_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.orb_conversation_acknowledgements (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.orb_conversations(id) ON DELETE CASCADE,
  client_id text NOT NULL CHECK (char_length(client_id) BETWEEN 1 AND 128),
  event_id uuid NOT NULL REFERENCES public.orb_conversation_events(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, client_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_orb_conversation_ack_client
  ON public.orb_conversation_acknowledgements
  (user_id, conversation_id, client_id, acknowledged_at DESC);

ALTER TABLE public.orb_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orb_conversation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orb_conversation_acknowledgements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.orb_conversations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.orb_conversation_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.orb_conversation_acknowledgements FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.orb_conversations TO service_role;
GRANT SELECT, INSERT ON TABLE public.orb_conversation_events TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.orb_conversation_acknowledgements TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.orb_conversation_events_sequence_seq TO service_role;

ALTER TABLE public.orb_realtime_proposals
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.orb_conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin_modality text CHECK (origin_modality IN ('text', 'voice')),
  ADD COLUMN IF NOT EXISTS requested_event_id uuid REFERENCES public.orb_conversation_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_by_event_id uuid REFERENCES public.orb_conversation_events(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS public.idx_orb_realtime_proposals_user_channel_pending;

CREATE INDEX IF NOT EXISTS idx_orb_proposals_conversation_pending
  ON public.orb_realtime_proposals (user_id, conversation_id, created_at DESC)
  WHERE status = 'proposed';

CREATE UNIQUE INDEX IF NOT EXISTS idx_orb_proposals_confirming_event
  ON public.orb_realtime_proposals (confirmed_by_event_id)
  WHERE confirmed_by_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orb_proposals_receipt_recovery
  ON public.orb_realtime_proposals (user_id, executed_at DESC)
  WHERE status = 'executed' AND conversation_id IS NOT NULL;

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

REVOKE ALL ON FUNCTION public.confirm_orb_mutation(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_orb_mutation(uuid, uuid, uuid)
  TO service_role;

SELECT
  to_regclass('public.orb_conversations') IS NOT NULL AS conversations_ready,
  to_regclass('public.orb_conversation_events') IS NOT NULL AS events_ready,
  to_regclass('public.orb_conversation_acknowledgements') IS NOT NULL AS acknowledgements_ready,
  has_function_privilege(
    'service_role',
    'public.confirm_orb_mutation(uuid,uuid,uuid)',
    'EXECUTE'
  ) AS service_can_confirm,
  has_function_privilege(
    'authenticated',
    'public.confirm_orb_mutation(uuid,uuid,uuid)',
    'EXECUTE'
  ) AS authenticated_can_confirm;
