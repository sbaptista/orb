-- ORB-293: TTS provider integration (OpenAI + ElevenLabs)
-- Adds TTS configuration to the policy singleton and seeds rate cards.

-- 1. Extend orb_ai_policy with TTS provider settings
ALTER TABLE public.orb_ai_policy
  ADD COLUMN IF NOT EXISTS tts_provider text NOT NULL DEFAULT 'browser',
  ADD COLUMN IF NOT EXISTS tts_model text,
  ADD COLUMN IF NOT EXISTS tts_voice_id text;

-- 2. Add 'voice_tts' to the source check on orb_model_requests
-- The existing check constraint name varies; drop-if-exists + re-add.
DO $$
BEGIN
  -- Try dropping the old constraint (may not exist or have a generated name)
  BEGIN
    ALTER TABLE public.orb_model_requests DROP CONSTRAINT IF EXISTS orb_model_requests_source_check;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.orb_model_requests DROP CONSTRAINT IF EXISTS orb_model_requests_source_check1;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
END $$;

ALTER TABLE public.orb_model_requests
  DROP CONSTRAINT IF EXISTS orb_model_requests_source_check;

ALTER TABLE public.orb_model_requests
  ADD CONSTRAINT orb_model_requests_source_check
  CHECK (source IN (
    'conversation', 'greeting', 'distillation', 'eval',
    'strategic_review', 'proactive_observation', 'adaptation_proposal',
    'voice_tts'
  ));

-- 3. Seed rate cards for TTS providers (per-million characters, not tokens)
INSERT INTO public.orb_model_rate_cards
  (provider, model, effective_from, input_per_million, output_per_million, cached_input_per_million, cache_write_per_million, notes)
VALUES
  ('openai', 'tts-1', CURRENT_DATE, 15, 0, NULL, NULL, 'OpenAI TTS standard — $15/1M chars (input_per_million = chars)'),
  ('openai', 'tts-1-hd', CURRENT_DATE, 30, 0, NULL, NULL, 'OpenAI TTS HD — $30/1M chars'),
  ('elevenlabs', 'eleven_turbo_v2_5', CURRENT_DATE, 66, 0, NULL, NULL, 'ElevenLabs Turbo v2.5 — ~$66/1M chars (starter tier)')
ON CONFLICT (provider, model, effective_from) DO NOTHING;
