ALTER TABLE public.orb_model_requests
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'unknown';

ALTER TABLE public.orb_model_requests
  DROP CONSTRAINT IF EXISTS orb_model_requests_platform_check;

ALTER TABLE public.orb_model_requests
  ADD CONSTRAINT orb_model_requests_platform_check
  CHECK (platform IN ('mac', 'ipad', 'iphone', 'server', 'unknown'));

COMMENT ON COLUMN public.orb_model_requests.platform IS
  'Shared client-environment platform classification; server denotes headless eval requests and unknown preserves legacy rows.';
