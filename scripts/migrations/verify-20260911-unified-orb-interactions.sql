-- Read-only structural verification for 20260911_unified_orb_interactions.sql.
-- Run after applying the migration. Every reported value must be true.

WITH required_tables(name) AS (
  VALUES
    ('orb_conversations'),
    ('orb_conversation_events'),
    ('orb_conversation_acknowledgements')
),
required_proposal_columns(name) AS (
  VALUES
    ('conversation_id'),
    ('origin_modality'),
    ('requested_event_id'),
    ('confirmed_by_event_id')
)
SELECT
  NOT EXISTS (
    SELECT 1 FROM required_tables
    WHERE to_regclass('public.' || name) IS NULL
  ) AS all_interaction_tables_exist,
  NOT EXISTS (
    SELECT 1
    FROM required_proposal_columns required
    WHERE NOT EXISTS (
      SELECT 1
      FROM information_schema.columns columns
      WHERE columns.table_schema = 'public'
        AND columns.table_name = 'orb_realtime_proposals'
        AND columns.column_name = required.name
    )
  ) AS all_proposal_columns_exist,
  to_regprocedure('public.confirm_orb_mutation(uuid,uuid,uuid)') IS NOT NULL
    AS confirmation_function_exists,
  has_function_privilege(
    'service_role',
    'public.confirm_orb_mutation(uuid,uuid,uuid)',
    'EXECUTE'
  ) AS service_role_can_confirm,
  NOT has_function_privilege(
    'authenticated',
    'public.confirm_orb_mutation(uuid,uuid,uuid)',
    'EXECUTE'
  ) AS authenticated_cannot_confirm,
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_orb_conversations_one_active_per_user'
  ) AS one_active_conversation_index_exists,
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_orb_proposals_confirming_event'
  ) AS confirming_event_uniqueness_exists,
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_orb_conversation_events_receipt_outbox'
  ) AS receipt_outbox_index_exists,
  position(
    'interruption.sequence > v_event.sequence'
    IN pg_get_functiondef('public.confirm_orb_mutation(uuid,uuid,uuid)'::regprocedure)
  ) > 0 AS interrupt_before_commit_guard_exists;
