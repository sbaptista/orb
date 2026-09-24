-- Capability-scoped diagnostic read for orb-agent.
--
-- The agent role receives no SELECT grant on the underlying conversation
-- tables and cannot enumerate conversations. Possession of one exact UUID,
-- copied from the admin-only Orb diagnostic export, authorizes reading that
-- conversation's durable event, command-batch, and acknowledgement trace.

CREATE OR REPLACE FUNCTION public.agent_read_orb_conversation_diagnostics(
  p_conversation_id uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'conversation', to_jsonb(c),
    'events', COALESCE((
      SELECT jsonb_agg(to_jsonb(e) ORDER BY e.sequence)
      FROM public.orb_conversation_events e
      WHERE e.conversation_id = c.id
    ), '[]'::jsonb),
    'batches', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(b) || jsonb_build_object(
          'items', COALESCE((
            SELECT jsonb_agg(to_jsonb(i) ORDER BY i.sequence)
            FROM public.orb_command_batch_items i
            WHERE i.batch_id = b.id
          ), '[]'::jsonb)
        ) ORDER BY b.created_at
      )
      FROM public.orb_command_batches b
      WHERE b.conversation_id = c.id
    ), '[]'::jsonb),
    'acknowledgements', COALESCE((
      SELECT jsonb_agg(to_jsonb(a) ORDER BY a.acknowledged_at)
      FROM public.orb_conversation_acknowledgements a
      WHERE a.conversation_id = c.id
    ), '[]'::jsonb)
  )
  FROM public.orb_conversations c
  WHERE c.id = p_conversation_id;
$$;

REVOKE ALL ON FUNCTION public.agent_read_orb_conversation_diagnostics(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_read_orb_conversation_diagnostics(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_read_orb_conversation_diagnostics(uuid) TO orb_agent_ro;

SELECT
  to_regprocedure('public.agent_read_orb_conversation_diagnostics(uuid)') IS NOT NULL AS diagnostic_function_exists,
  has_function_privilege('orb_agent_ro', 'public.agent_read_orb_conversation_diagnostics(uuid)', 'EXECUTE') AS agent_can_execute,
  NOT has_function_privilege('anon', 'public.agent_read_orb_conversation_diagnostics(uuid)', 'EXECUTE') AS anon_cannot_execute,
  NOT has_function_privilege('authenticated', 'public.agent_read_orb_conversation_diagnostics(uuid)', 'EXECUTE') AS authenticated_cannot_execute,
  NOT has_table_privilege('orb_agent_ro', 'public.orb_conversations', 'SELECT') AS no_direct_conversation_select,
  NOT has_table_privilege('orb_agent_ro', 'public.orb_conversation_events', 'SELECT') AS no_direct_event_select,
  NOT has_table_privilege('orb_agent_ro', 'public.orb_command_batches', 'SELECT') AS no_direct_batch_select,
  NOT has_table_privilege('orb_agent_ro', 'public.orb_conversation_acknowledgements', 'SELECT') AS no_direct_ack_select;
