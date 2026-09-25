-- Make Realtime voice transport an explicit model role in the shared AI
-- policy. Existing rows receive the cost-first Mini default.

ALTER TABLE public.orb_ai_policy
  ADD COLUMN IF NOT EXISTS voice_provider text NOT NULL DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS voice_model text NOT NULL DEFAULT 'gpt-realtime-2.1-mini';

UPDATE public.orb_ai_policy
SET
  voice_provider = 'openai',
  voice_model = 'gpt-realtime-2.1-mini',
  updated_at = now()
WHERE id = true
  AND (
    voice_provider IS DISTINCT FROM 'openai'
    OR voice_model IS DISTINCT FROM 'gpt-realtime-2.1-mini'
  );

SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orb_ai_policy'
      AND column_name = 'voice_provider'
  ) AS voice_provider_column_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orb_ai_policy'
      AND column_name = 'voice_model'
  ) AS voice_model_column_exists,
  COALESCE((
    SELECT voice_provider = 'openai'
      AND voice_model = 'gpt-realtime-2.1-mini'
    FROM public.orb_ai_policy
    WHERE id = true
  ), false) AS voice_defaults_to_mini;
