-- Keep statement-import accounting pools aligned with the canonical model
-- catalog. Kimi K3 was added after the original ORB-373 funding-pool seed.

INSERT INTO public.orb_ai_funding_pools
  (pool_key, provider, display_name, funding_mode, active, sort_order)
VALUES
  ('moonshot_api', 'moonshot', 'Moonshot API', 'prepaid_credit', true, 40)
ON CONFLICT (pool_key) DO UPDATE SET
  provider = EXCLUDED.provider,
  display_name = EXCLUDED.display_name,
  funding_mode = EXCLUDED.funding_mode,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.orb_financial_descriptor_rules
  (normalized_descriptor, match_kind, disposition, pool_key, transaction_kind)
VALUES
  ('moonshot', 'top_up', 'include', 'moonshot_api', 'top_up'),
  ('moonshot ai', 'top_up', 'include', 'moonshot_api', 'top_up')
ON CONFLICT (normalized_descriptor, match_kind) DO NOTHING;
