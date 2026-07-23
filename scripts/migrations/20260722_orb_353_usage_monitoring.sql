-- ORB-353: proactive AI usage approaching-limit warning.
--
-- Two ceilings, tracked independently: Orb's own internal budget ledger
-- (already existed for operational/strategic; voice now gets a genuine
-- bucket of its own instead of silently folding into operational), and
-- real provider account-level spend (Anthropic, OpenAI, Gemini — pulled
-- live from each provider's own cost API/export, not estimated). Neither
-- Anthropic nor OpenAI nor the Gemini BigQuery export exposes a configured
-- spend cap programmatically, so those three caps are admin-entered here.
-- ElevenLabs is the exception: its API already returns the real character
-- limit, so it needs no cap column.

ALTER TABLE public.orb_model_requests
  DROP CONSTRAINT IF EXISTS orb_model_requests_route_role_check;
ALTER TABLE public.orb_model_requests
  ADD CONSTRAINT orb_model_requests_route_role_check
  CHECK (route_role IN ('operational', 'strategic', 'voice'));

-- Realtime speech-to-speech turns are a genuinely different invocation shape
-- than the old serial engine's separate voice_tts/voice_stt calls.
ALTER TABLE public.orb_model_requests
  DROP CONSTRAINT IF EXISTS orb_model_requests_source_check;
ALTER TABLE public.orb_model_requests
  ADD CONSTRAINT orb_model_requests_source_check
  CHECK (source IN (
    'conversation', 'greeting', 'distillation', 'eval', 'strategic_review',
    'proactive_observation', 'adaptation_proposal', 'voice_tts', 'voice_stt',
    'voice_realtime'
  ));

ALTER TABLE public.orb_ai_policy
  ADD COLUMN IF NOT EXISTS voice_budget_usd numeric(12, 2) NOT NULL DEFAULT 0 CHECK (voice_budget_usd >= 0),
  ADD COLUMN IF NOT EXISTS warning_threshold_pct numeric(5, 2) NOT NULL DEFAULT 80 CHECK (warning_threshold_pct > 0 AND warning_threshold_pct <= 100),
  ADD COLUMN IF NOT EXISTS anthropic_spend_cap_usd numeric(12, 2) NOT NULL DEFAULT 0 CHECK (anthropic_spend_cap_usd >= 0),
  ADD COLUMN IF NOT EXISTS openai_spend_cap_usd numeric(12, 2) NOT NULL DEFAULT 0 CHECK (openai_spend_cap_usd >= 0),
  ADD COLUMN IF NOT EXISTS gemini_spend_cap_usd numeric(12, 2) NOT NULL DEFAULT 0 CHECK (gemini_spend_cap_usd >= 0);

-- A cap of 0 means "not configured yet" and is treated as disabled (skipped)
-- by the cron check, rather than an immediate false-positive warning.

ALTER TABLE public.orb_ai_policy DROP CONSTRAINT IF EXISTS orb_ai_policy_check;
ALTER TABLE public.orb_ai_policy ADD CONSTRAINT orb_ai_policy_check
  CHECK (strategic_budget_usd + operational_budget_usd + voice_budget_usd <= monthly_budget_usd);

-- Dedup ledger: one row per (scope, billing period) once a scope has warned,
-- so the 15-minute cron fires push/email/broadcast exactly once per crossing
-- rather than every cycle it stays above threshold.
CREATE TABLE IF NOT EXISTS public.orb_usage_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  period text NOT NULL,
  warned_at timestamptz NOT NULL DEFAULT now(),
  detail jsonb,
  UNIQUE (scope, period)
);

CREATE INDEX IF NOT EXISTS idx_orb_usage_warnings_scope_period
  ON public.orb_usage_warnings (scope, period);

ALTER TABLE public.orb_usage_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to orb_usage_warnings"
  ON public.orb_usage_warnings FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');
CREATE POLICY "Admins can read orb_usage_warnings"
  ON public.orb_usage_warnings FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role_id IN (1, 3)));
