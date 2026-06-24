-- ORB-265: Admin-configurable model routing, rate cards, and reconciled cost.
-- These are deliberately low-volume control-plane tables. Request-level facts
-- remain append-only in orb_model_requests.

CREATE TABLE IF NOT EXISTS public.orb_ai_policy (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  routing_enabled boolean NOT NULL DEFAULT false,
  strategic_reads_enabled boolean NOT NULL DEFAULT true,
  operational_provider text NOT NULL DEFAULT 'anthropic',
  operational_model text NOT NULL DEFAULT 'claude-haiku-4-5',
  strategic_provider text NOT NULL DEFAULT 'google',
  strategic_model text NOT NULL DEFAULT 'gemini-3.1-pro-preview',
  monthly_budget_usd numeric(12, 2) NOT NULL DEFAULT 40 CHECK (monthly_budget_usd >= 0),
  strategic_budget_usd numeric(12, 2) NOT NULL DEFAULT 24 CHECK (strategic_budget_usd >= 0),
  operational_budget_usd numeric(12, 2) NOT NULL DEFAULT 16 CHECK (operational_budget_usd >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CHECK (strategic_budget_usd + operational_budget_usd <= monthly_budget_usd)
);

INSERT INTO public.orb_ai_policy (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.orb_model_rate_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  model text NOT NULL,
  effective_from date NOT NULL,
  input_per_million numeric(12, 6) NOT NULL CHECK (input_per_million >= 0),
  output_per_million numeric(12, 6) NOT NULL CHECK (output_per_million >= 0),
  cached_input_per_million numeric(12, 6),
  cache_write_per_million numeric(12, 6),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE (provider, model, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_orb_model_rate_cards_lookup
  ON public.orb_model_rate_cards (provider, model, effective_from DESC);

CREATE TABLE IF NOT EXISTS public.orb_cost_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  actual_orb_cost_usd numeric(12, 4) NOT NULL CHECK (actual_orb_cost_usd >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CHECK (period_end >= period_start),
  UNIQUE (provider, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_orb_cost_reconciliations_provider_period
  ON public.orb_cost_reconciliations (provider, period_start DESC, period_end DESC);

ALTER TABLE public.orb_model_requests
  ADD COLUMN IF NOT EXISTS route_role text NOT NULL DEFAULT 'operational'
  CHECK (route_role IN ('operational', 'strategic'));

CREATE INDEX IF NOT EXISTS idx_orb_model_requests_role_created_at
  ON public.orb_model_requests (route_role, created_at DESC);

ALTER TABLE public.orb_ai_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orb_model_rate_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orb_cost_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to orb_ai_policy"
  ON public.orb_ai_policy FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');
CREATE POLICY "Admins can read orb_ai_policy"
  ON public.orb_ai_policy FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role_id IN (1, 3)));
CREATE POLICY "Admins can write orb_ai_policy"
  ON public.orb_ai_policy FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role_id IN (1, 3)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role_id IN (1, 3)));

CREATE POLICY "Service role full access to orb_model_rate_cards"
  ON public.orb_model_rate_cards FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');
CREATE POLICY "Admins can manage orb_model_rate_cards"
  ON public.orb_model_rate_cards FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role_id IN (1, 3)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role_id IN (1, 3)));

CREATE POLICY "Service role full access to orb_cost_reconciliations"
  ON public.orb_cost_reconciliations FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');
CREATE POLICY "Admins can manage orb_cost_reconciliations"
  ON public.orb_cost_reconciliations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role_id IN (1, 3)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role_id IN (1, 3)));

INSERT INTO public.orb_model_rate_cards
  (provider, model, effective_from, input_per_million, output_per_million, cached_input_per_million, cache_write_per_million, notes)
VALUES
  ('anthropic', 'claude-haiku-4-5', CURRENT_DATE, 1, 5, 0.1, 1.25, 'Initial ORB-265 rate card'),
  ('google', 'gemini-3.1-pro-preview', CURRENT_DATE, 2, 12, 0.2, NULL, 'Initial ORB-265 evaluation rate card')
ON CONFLICT (provider, model, effective_from) DO NOTHING;
