-- ORB-373 Phase 0: separate funding configuration and provider-consumption
-- snapshots from the legacy orb_cost_reconciliations table, which currently
-- mixes cumulative provider snapshots with card purchases and subscriptions.

CREATE TABLE IF NOT EXISTS public.orb_ai_funding_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_key text NOT NULL UNIQUE,
  provider text NOT NULL,
  display_name text NOT NULL,
  funding_mode text NOT NULL CHECK (funding_mode IN ('prepaid_credit', 'subscription_quota', 'subscription_cash')),
  spending_cap_usd numeric(12, 2) CHECK (spending_cap_usd IS NULL OR spending_cap_usd >= 0),
  recurring_cost_usd numeric(12, 2) CHECK (recurring_cost_usd IS NULL OR recurring_cost_usd >= 0),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CHECK (pool_key ~ '^[a-z0-9_]+$'),
  CHECK (funding_mode = 'prepaid_credit' OR spending_cap_usd IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_orb_ai_funding_pools_active_sort
  ON public.orb_ai_funding_pools (active, sort_order, display_name);

ALTER TABLE public.orb_ai_funding_pools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to orb_ai_funding_pools" ON public.orb_ai_funding_pools;
CREATE POLICY "Service role full access to orb_ai_funding_pools"
  ON public.orb_ai_funding_pools FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Admins can manage orb_ai_funding_pools" ON public.orb_ai_funding_pools;
CREATE POLICY "Admins can manage orb_ai_funding_pools"
  ON public.orb_ai_funding_pools FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid()) AND u.role_id IN (1, 3)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid()) AND u.role_id IN (1, 3)
  ));

INSERT INTO public.orb_ai_funding_pools
  (pool_key, provider, display_name, funding_mode, spending_cap_usd, active, sort_order)
SELECT 'anthropic_api', 'anthropic', 'Anthropic API', 'prepaid_credit', NULLIF(anthropic_spend_cap_usd, 0), true, 10
FROM public.orb_ai_policy WHERE id IS TRUE
ON CONFLICT (pool_key) DO NOTHING;

INSERT INTO public.orb_ai_funding_pools
  (pool_key, provider, display_name, funding_mode, spending_cap_usd, active, sort_order)
SELECT 'openai_api', 'openai', 'OpenAI API', 'prepaid_credit', NULLIF(openai_spend_cap_usd, 0), true, 20
FROM public.orb_ai_policy WHERE id IS TRUE
ON CONFLICT (pool_key) DO NOTHING;

INSERT INTO public.orb_ai_funding_pools
  (pool_key, provider, display_name, funding_mode, active, sort_order)
VALUES
  ('mistral_api', 'mistral', 'Mistral API', 'prepaid_credit', true, 30),
  ('elevenlabs', 'elevenlabs', 'ElevenLabs', 'subscription_quota', true, 40),
  ('claude_subscription', 'anthropic', 'Claude.ai', 'subscription_cash', true, 110),
  ('chatgpt_subscription', 'openai', 'ChatGPT', 'subscription_cash', true, 120),
  ('perplexity_subscription', 'perplexity', 'Perplexity', 'subscription_cash', true, 130),
  ('github_subscription', 'github', 'GitHub Copilot', 'subscription_cash', true, 140)
ON CONFLICT (pool_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.orb_provider_consumption_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_key text NOT NULL REFERENCES public.orb_ai_funding_pools(pool_key) ON UPDATE CASCADE ON DELETE RESTRICT,
  provider text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  spending_usd numeric(12, 4) CHECK (spending_usd IS NULL OR spending_usd >= 0),
  usage_value numeric(18, 4) CHECK (usage_value IS NULL OR usage_value >= 0),
  usage_limit numeric(18, 4) CHECK (usage_limit IS NULL OR usage_limit >= 0),
  usage_unit text,
  source text NOT NULL DEFAULT 'provider_api',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start),
  CHECK (spending_usd IS NOT NULL OR usage_value IS NOT NULL),
  UNIQUE (pool_key, period_start, period_end, source)
);

CREATE INDEX IF NOT EXISTS idx_orb_provider_snapshots_pool_fetched
  ON public.orb_provider_consumption_snapshots (pool_key, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_orb_provider_snapshots_provider_period
  ON public.orb_provider_consumption_snapshots (provider, period_start DESC, period_end DESC);

ALTER TABLE public.orb_provider_consumption_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to orb_provider_consumption_snapshots" ON public.orb_provider_consumption_snapshots;
CREATE POLICY "Service role full access to orb_provider_consumption_snapshots"
  ON public.orb_provider_consumption_snapshots FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Admins can read orb_provider_consumption_snapshots" ON public.orb_provider_consumption_snapshots;
CREATE POLICY "Admins can read orb_provider_consumption_snapshots"
  ON public.orb_provider_consumption_snapshots FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid()) AND u.role_id IN (1, 3)
  ));

-- Preserve the latest historical provider snapshots without copying manual
-- card/invoice rows. The legacy table remains untouched for rollback and for
-- the existing reconciliation UI during the remaining ORB-373 phases.
INSERT INTO public.orb_provider_consumption_snapshots
  (pool_key, provider, period_start, period_end, spending_usd, source, fetched_at, created_at)
SELECT
  CASE r.provider WHEN 'anthropic' THEN 'anthropic_api' WHEN 'openai' THEN 'openai_api' END,
  r.provider,
  r.period_start,
  r.period_end,
  r.actual_orb_cost_usd,
  'provider_api',
  r.created_at,
  r.created_at
FROM public.orb_cost_reconciliations r
WHERE r.provider IN ('anthropic', 'openai')
  AND r.notes LIKE 'Auto-populated by the ORB-353 usage-check cron%'
ON CONFLICT (pool_key, period_start, period_end, source) DO UPDATE SET
  spending_usd = EXCLUDED.spending_usd,
  fetched_at = EXCLUDED.fetched_at;

DROP FUNCTION IF EXISTS public.get_ai_provider_burn(timestamptz);
CREATE FUNCTION public.get_ai_provider_burn(p_as_of timestamptz DEFAULT now())
RETURNS TABLE (
  provider text,
  cost_7d numeric,
  cost_30d numeric,
  cost_current_month numeric,
  eval_cost_7d numeric,
  product_cost_7d numeric,
  latest_request_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.provider,
    COALESCE(SUM(r.estimated_cost_usd) FILTER (WHERE r.created_at >= p_as_of - interval '7 days'), 0)::numeric AS cost_7d,
    COALESCE(SUM(r.estimated_cost_usd), 0)::numeric AS cost_30d,
    COALESCE(SUM(r.estimated_cost_usd) FILTER (WHERE r.created_at >= date_trunc('month', p_as_of)), 0)::numeric AS cost_current_month,
    COALESCE(SUM(r.estimated_cost_usd) FILTER (WHERE r.created_at >= p_as_of - interval '7 days' AND r.source = 'eval'), 0)::numeric AS eval_cost_7d,
    COALESCE(SUM(r.estimated_cost_usd) FILTER (WHERE r.created_at >= p_as_of - interval '7 days' AND r.source <> 'eval'), 0)::numeric AS product_cost_7d,
    MAX(r.created_at) AS latest_request_at
  FROM public.orb_model_requests r
  WHERE r.success IS TRUE
    AND r.created_at >= p_as_of - interval '30 days'
    AND r.created_at < p_as_of
  GROUP BY r.provider
  ORDER BY r.provider;
$$;

REVOKE ALL ON FUNCTION public.get_ai_provider_burn(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_provider_burn(timestamptz) TO service_role;
