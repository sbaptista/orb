-- ORB-323 #6: orb_adaptations.user_id FK -> auth.users was ON DELETE NO ACTION,
-- the same latent orphan-cause as the telemetry FKs fixed under ORB-321. It is only
-- masked today by the explicit cleanup loop in app/actions/delete-user.ts; if that
-- cleanup ever fails, auth.admin.deleteUser() fails on this FK and an orphaned auth
-- user survives with its passkey — reintroducing the ORB-321 login loop.
--
-- orb_adaptations is personal, per-user AI behavior data (not usage/cost telemetry),
-- so it should be DELETED with the user — CASCADE — matching its siblings
-- orb_memory, orb_preferences, and orb_pending_mutations (all ON DELETE CASCADE).
-- (Telemetry tables orb_metrics / orb_model_requests / performance_events remain
-- ON DELETE SET NULL because that data must outlive the user.)

ALTER TABLE public.orb_adaptations
  DROP CONSTRAINT orb_adaptations_user_id_fkey,
  ADD CONSTRAINT orb_adaptations_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
