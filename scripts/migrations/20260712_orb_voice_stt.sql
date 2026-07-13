-- ORB-325: admit server-side voice transcription in the model request ledger.

ALTER TABLE public.orb_model_requests
  DROP CONSTRAINT IF EXISTS orb_model_requests_source_check;

ALTER TABLE public.orb_model_requests
  ADD CONSTRAINT orb_model_requests_source_check
  CHECK (source IN (
    'conversation', 'greeting', 'distillation', 'eval',
    'strategic_review', 'proactive_observation', 'adaptation_proposal',
    'voice_tts', 'voice_stt'
  ));
