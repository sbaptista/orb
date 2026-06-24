-- ORB-265: append-only model request ledger.
-- Daily orb_metrics remains the fast aggregate; this table preserves the
-- provider-neutral detail needed for attribution and model evaluation.

CREATE TABLE IF NOT EXISTS public.orb_model_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  provider text NOT NULL,
  model text NOT NULL,
  source text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cached_input_tokens integer,
  cache_write_tokens integer,
  reasoning_tokens integer,
  total_tokens integer,
  client_tool_calls integer NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL,
  attempt_count integer NOT NULL DEFAULT 1,
  success boolean NOT NULL,
  failure_code text,
  estimated_cost_usd numeric(12, 8),
  rate_snapshot jsonb,
  provider_usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id uuid,
  evaluation_case_id text,
  prompt_version text,
  context_packet_version text,
  response_text text
);

CREATE INDEX IF NOT EXISTS idx_orb_model_requests_created_at
  ON public.orb_model_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orb_model_requests_provider_model_created_at
  ON public.orb_model_requests (provider, model, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orb_model_requests_source_created_at
  ON public.orb_model_requests (source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orb_model_requests_user_created_at
  ON public.orb_model_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orb_model_requests_correlation_id
  ON public.orb_model_requests (correlation_id)
  WHERE correlation_id IS NOT NULL;

ALTER TABLE public.orb_model_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to orb_model_requests"
  ON public.orb_model_requests FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

CREATE POLICY "Admins can read orb_model_requests"
  ON public.orb_model_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
        AND u.role_id IN (1, 3)
    )
  );
