-- Allow the routine local eval suite to select its model independently from
-- Orb's live Operational and Strategic roles. Explicit runner environment
-- overrides remain available for one-off comparisons.

ALTER TABLE public.orb_ai_policy
  ADD COLUMN IF NOT EXISTS evaluation_provider text NOT NULL DEFAULT 'anthropic',
  ADD COLUMN IF NOT EXISTS evaluation_model text NOT NULL DEFAULT 'claude-haiku-4-5';
