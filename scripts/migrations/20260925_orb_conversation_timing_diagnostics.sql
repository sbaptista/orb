-- Add correlated client/server timing rows to the capability-scoped
-- conversation diagnostic export. The agent role still receives no direct
-- table access and cannot enumerate performance or conversation records.

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
    ), '[]'::jsonb),
    'timings', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'created_at', p.created_at,
        'correlation_id', p.correlation_id,
        'focus', p.focus,
        'flow', p.flow,
        'interaction', p.interaction,
        'surface', p.surface,
        'platform', p.platform,
        'browser', p.browser,
        'duration_ms', p.duration_ms,
        'stages', p.stages,
        'success', p.success,
        'failure_code', p.failure_code,
        'metadata', p.metadata
      ) ORDER BY p.created_at)
      FROM public.performance_events p
      WHERE p.user_id = c.user_id
        AND p.correlation_id IN (
          SELECT DISTINCT e.turn_id
          FROM public.orb_conversation_events e
          WHERE e.conversation_id = c.id
        )
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
  NOT has_table_privilege('orb_agent_ro', 'public.performance_events', 'SELECT') AS no_direct_performance_select;
