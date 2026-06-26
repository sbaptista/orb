ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tts_provider text DEFAULT 'browser',
  ADD COLUMN IF NOT EXISTS tts_model text,
  ADD COLUMN IF NOT EXISTS tts_voice_id text;
