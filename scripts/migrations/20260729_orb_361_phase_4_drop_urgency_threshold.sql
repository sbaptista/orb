-- ORB-361 Phase 4 — drop users.urgency_threshold_hours
--
-- The last step of the plan. Phase 2 replaced this single global "warn me N
-- hours before everything" number with per-priority runway windows, and Phase 3
-- added per-project overrides; Settings → Urgency Threshold was deleted in
-- v0.6.245. Nothing has read this column since.
--
-- Verified before dropping (2026-07-29):
--   * No reference in any .ts/.tsx/.sql/.yaml outside scripts/migrations/.
--   * Values at drop time, recorded because the drop destroys them:
--       24 -> 1 user, 0 -> 2 users. Column default was 0.
--     None is recoverable or meaningful under the new model — a single hour
--     count cannot express per-priority, per-project windows.
--
-- IRREVERSIBLE. A rollback can re-add the column but not its values; there is
-- deliberately no rollback script, because restoring a column nothing reads
-- would restore nothing useful.
--
-- Idempotent / rerun-safe.

ALTER TABLE public.users DROP COLUMN IF EXISTS urgency_threshold_hours;

-- Verification (run manually after applying):
--   SELECT count(*) FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='users'
--     AND column_name='urgency_threshold_hours';   -- expect 0
