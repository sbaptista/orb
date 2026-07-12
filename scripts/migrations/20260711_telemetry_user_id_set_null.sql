-- 20260711_telemetry_user_id_set_null.sql
-- Telemetry durability: decouple usage/cost telemetry from live users.
--
-- Problem
--   public.orb_metrics.user_id and public.orb_model_requests.user_id were
--   NOT NULL with a NO ACTION FK to auth.users. That had two consequences:
--     1. It BLOCKED user deletion (auth.admin.deleteUser hit a FK violation and
--        was swallowed as a warning), leaving orphaned auth.users rows whose
--        passkeys survived — the root cause of the phantom-passkey login loop.
--     2. It contradicted the product requirement that usage/cost telemetry must
--        OUTLIVE the user (a user stops using Orb and is deleted, but their
--        collected telemetry must remain and be usable) and may later be fully
--        anonymized (no user reference at all).
--
-- Fix
--   Make user_id nullable and change the FK to ON DELETE SET NULL — matching the
--   existing performance_events pattern (already SET NULL). Deleting a user now
--   PRESERVES their telemetry (user_id -> NULL) instead of blocking, and the data
--   is ready for future anonymization. Inserts are unaffected (the app always
--   supplies user_id at write time); nullability only takes effect on user delete.
--
-- Idempotent-ish: safe to run once. Wrapped in a transaction (all-or-nothing).

BEGIN;

-- ── orb_metrics ─────────────────────────────────────────────────────────────
ALTER TABLE public.orb_metrics ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.orb_metrics DROP CONSTRAINT orb_metrics_user_id_fkey;
ALTER TABLE public.orb_metrics
  ADD CONSTRAINT orb_metrics_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── orb_model_requests ──────────────────────────────────────────────────────
ALTER TABLE public.orb_model_requests ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.orb_model_requests DROP CONSTRAINT orb_model_requests_user_id_fkey;
ALTER TABLE public.orb_model_requests
  ADD CONSTRAINT orb_model_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMIT;

-- Verify after running:
--   SELECT conrelid::regclass AS tbl, conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid IN ('public.orb_metrics'::regclass,'public.orb_model_requests'::regclass)
--     AND contype='f' AND confrelid='auth.users'::regclass;
--   -- expect: ... ON DELETE SET NULL
--   SELECT table_name, is_nullable FROM information_schema.columns
--   WHERE table_name IN ('orb_metrics','orb_model_requests') AND column_name='user_id';
--   -- expect: is_nullable = YES
