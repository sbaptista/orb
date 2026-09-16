-- Read-only structural verifier for 20260912_orb_command_batches.sql.
-- Every returned column must be true.

SELECT
  to_regclass('public.orb_command_batches') IS NOT NULL AS command_batches_table,
  to_regclass('public.orb_command_batch_items') IS NOT NULL AS command_batch_items_table,
  to_regclass('public.idx_orb_command_batches_one_pending') IS NOT NULL AS one_pending_index,
  to_regclass('public.idx_orb_command_batches_receipt_recovery') IS NOT NULL AS receipt_recovery_index,
  has_table_privilege('service_role', 'public.orb_command_batches', 'SELECT,INSERT,UPDATE,DELETE') AS service_batch_table_access,
  has_table_privilege('service_role', 'public.orb_command_batch_items', 'SELECT,INSERT,UPDATE,DELETE') AS service_item_table_access,
  NOT has_table_privilege('authenticated', 'public.orb_command_batches', 'SELECT') AS authenticated_cannot_read_batches,
  NOT has_table_privilege('authenticated', 'public.orb_command_batch_items', 'SELECT') AS authenticated_cannot_read_items,
  has_function_privilege('service_role', 'public.prepare_orb_command_batch(uuid,uuid,uuid,uuid,text,text,timestamptz,jsonb)', 'EXECUTE') AS service_can_prepare,
  has_function_privilege('service_role', 'public.confirm_orb_command_batch(uuid,uuid,uuid)', 'EXECUTE') AS service_can_confirm,
  has_function_privilege('service_role', 'public.reject_orb_command_batch(uuid,uuid)', 'EXECUTE') AS service_can_reject,
  has_function_privilege('service_role', 'public.get_pending_orb_command_batch(uuid,uuid)', 'EXECUTE') AS service_can_get_pending,
  NOT has_function_privilege('authenticated', 'public.prepare_orb_command_batch(uuid,uuid,uuid,uuid,text,text,timestamptz,jsonb)', 'EXECUTE') AS authenticated_cannot_prepare,
  NOT has_function_privilege('authenticated', 'public.confirm_orb_command_batch(uuid,uuid,uuid)', 'EXECUTE') AS authenticated_cannot_confirm,
  NOT has_function_privilege('authenticated', 'public.reject_orb_command_batch(uuid,uuid)', 'EXECUTE') AS authenticated_cannot_reject,
  NOT has_function_privilege('authenticated', 'public.get_pending_orb_command_batch(uuid,uuid)', 'EXECUTE') AS authenticated_cannot_get_pending,
  pg_get_functiondef('public.prepare_orb_command_batch(uuid,uuid,uuid,uuid,text,text,timestamptz,jsonb)'::regprocedure) LIKE '%''replayed'', true%' AS preparation_is_replay_safe,
  pg_get_functiondef('public.confirm_orb_command_batch(uuid,uuid,uuid)'::regprocedure) LIKE '%ORDER BY item.sequence%' AS confirmation_is_ordered,
  pg_get_functiondef('public.confirm_orb_command_batch(uuid,uuid,uuid)'::regprocedure) LIKE '%v_event.sequence <= v_request_event.sequence%' AS distinct_turn_enforced,
  pg_get_functiondef('public.confirm_orb_command_batch(uuid,uuid,uuid)'::regprocedure) LIKE '%v_receipts := v_receipts ||%' AS receipts_are_aggregated;
