-- Add onboarded_at timestamp to track when a user completes account setup.
-- NULL = invited but hasn't completed onboarding yet.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

-- Backfill all existing users as already onboarded.
UPDATE public.users
  SET onboarded_at = NOW()
  WHERE onboarded_at IS NULL;
