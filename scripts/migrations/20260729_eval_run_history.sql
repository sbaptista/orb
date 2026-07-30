-- ORB-364: durable eval outcomes.
--
-- orb_model_requests remains the token/cost ledger. These two append-only
-- tables preserve the evidence that ledger cannot: which suite and commit ran,
-- whether each assertion passed, and why a case failed.

CREATE TABLE IF NOT EXISTS public.orb_eval_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  git_sha text,
  command text NOT NULL,
  selection text NOT NULL,
  tier smallint CHECK (tier IN (1, 2)),
  category text,
  case_count integer NOT NULL CHECK (case_count > 0),
  requested_run_count integer NOT NULL CHECK (requested_run_count > 0),
  passed_case_count integer,
  failed_case_count integer,
  model_call_count integer,
  estimated_cost_usd numeric(12, 8),
  duration_ms integer,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'aborted')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.orb_eval_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.orb_eval_runs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  evaluation_case_id text NOT NULL,
  category text NOT NULL,
  tier smallint NOT NULL CHECK (tier IN (1, 2)),
  passed boolean NOT NULL,
  requested_runs integer NOT NULL CHECK (requested_runs > 0),
  completed_runs integer NOT NULL CHECK (completed_runs >= 0),
  pass_count integer NOT NULL CHECK (pass_count >= 0),
  failures jsonb NOT NULL DEFAULT '[]'::jsonb,
  tool_calls jsonb,
  speech_excerpt text,
  provider text,
  model text,
  model_call_count integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(12, 8),
  duration_ms integer
);

CREATE INDEX IF NOT EXISTS idx_orb_eval_runs_created_at
  ON public.orb_eval_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orb_eval_runs_status_created_at
  ON public.orb_eval_runs (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orb_eval_results_run_id
  ON public.orb_eval_results (run_id);

CREATE INDEX IF NOT EXISTS idx_orb_eval_results_case_created_at
  ON public.orb_eval_results (evaluation_case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orb_eval_results_failed_created_at
  ON public.orb_eval_results (created_at DESC)
  WHERE passed = false;

ALTER TABLE public.orb_eval_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orb_eval_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to orb_eval_runs"
  ON public.orb_eval_runs;
CREATE POLICY "Service role full access to orb_eval_runs"
  ON public.orb_eval_runs FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Admins can read orb_eval_runs"
  ON public.orb_eval_runs;
CREATE POLICY "Admins can read orb_eval_runs"
  ON public.orb_eval_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = (SELECT auth.uid())
        AND u.role_id IN (1, 3)
    )
  );

DROP POLICY IF EXISTS "Service role full access to orb_eval_results"
  ON public.orb_eval_results;
CREATE POLICY "Service role full access to orb_eval_results"
  ON public.orb_eval_results FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Admins can read orb_eval_results"
  ON public.orb_eval_results;
CREATE POLICY "Admins can read orb_eval_results"
  ON public.orb_eval_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = (SELECT auth.uid())
        AND u.role_id IN (1, 3)
    )
  );

GRANT SELECT ON public.orb_eval_runs, public.orb_eval_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.orb_eval_runs, public.orb_eval_results TO service_role;
