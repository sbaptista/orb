-- ORB-309: User-facing performance instrumentation.
-- Append-only by default from the telemetry endpoint, admin-managed from Settings.

CREATE TABLE IF NOT EXISTS public.performance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  environment text NOT NULL DEFAULT 'unknown',
  app_version text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id uuid,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  route text NOT NULL,
  focus text NOT NULL,
  flow text NOT NULL,
  interaction text NOT NULL,
  surface text NOT NULL,
  platform text,
  browser text,
  viewport jsonb,
  duration_ms integer NOT NULL,
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  success boolean NOT NULL DEFAULT true,
  failure_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_performance_events_created_at
  ON public.performance_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_events_environment_created_at
  ON public.performance_events (environment, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_events_focus_created_at
  ON public.performance_events (focus, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_events_flow_interaction_created_at
  ON public.performance_events (flow, interaction, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_events_platform_created_at
  ON public.performance_events (platform, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_events_user_created_at
  ON public.performance_events (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_performance_events_correlation_id
  ON public.performance_events (correlation_id);

CREATE INDEX IF NOT EXISTS idx_performance_events_search
  ON public.performance_events
  USING gin (
    (
      route || ' ' || focus || ' ' || flow || ' ' || interaction || ' ' ||
      surface || ' ' || coalesce(platform, '') || ' ' || coalesce(browser, '') ||
      ' ' || coalesce(failure_code, '') || ' ' || metadata::text
    ) gin_trgm_ops
  );

ALTER TABLE public.performance_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to performance_events" ON public.performance_events;
CREATE POLICY "Service role full access to performance_events"
  ON public.performance_events FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Admins can manage performance_events" ON public.performance_events;
CREATE POLICY "Admins can manage performance_events"
  ON public.performance_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
        AND u.role_id IN (1, 3)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
        AND u.role_id IN (1, 3)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_events TO service_role;
