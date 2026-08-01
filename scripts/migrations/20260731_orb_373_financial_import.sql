-- ORB-373 Phase 1: financial transactions, reviewable statement imports,
-- exact descriptor classification, and compact history rollups.

CREATE TABLE IF NOT EXISTS public.orb_financial_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  statement_key text,
  row_count integer NOT NULL CHECK (row_count >= 0),
  imported_count integer NOT NULL CHECK (imported_count >= 0),
  excluded_count integer NOT NULL CHECK (excluded_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

-- Historical classification target only. Google Cloud is not an active
-- funding pool and never appears in runway, but its one recorded credit must
-- remain classifiable and total correctly.
INSERT INTO public.orb_ai_funding_pools
  (pool_key, provider, display_name, funding_mode, active, sort_order)
VALUES ('google_cloud_historical', 'google', 'Google Cloud (historical)', 'prepaid_credit', false, 900)
ON CONFLICT (pool_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_orb_financial_import_batches_created
  ON public.orb_financial_import_batches (created_at DESC);

CREATE TABLE IF NOT EXISTS public.orb_financial_descriptor_rules (
  normalized_descriptor text NOT NULL,
  match_kind text NOT NULL CHECK (match_kind IN ('top_up', 'subscription', 'grant', 'refund', 'adjustment', 'expiration')),
  disposition text NOT NULL CHECK (disposition IN ('include', 'exclude')),
  pool_key text REFERENCES public.orb_ai_funding_pools(pool_key) ON UPDATE CASCADE ON DELETE SET NULL,
  transaction_kind text CHECK (transaction_kind IS NULL OR transaction_kind IN ('top_up', 'subscription', 'grant', 'refund', 'adjustment', 'expiration')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CHECK (
    (disposition = 'exclude' AND pool_key IS NULL AND transaction_kind IS NULL)
    OR (disposition = 'include' AND pool_key IS NOT NULL AND transaction_kind IS NOT NULL)
  ),
  PRIMARY KEY (normalized_descriptor, match_kind)
);

CREATE TABLE IF NOT EXISTS public.orb_financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id uuid REFERENCES public.orb_financial_import_batches(id) ON DELETE SET NULL,
  transaction_date date NOT NULL,
  company text NOT NULL,
  amount_usd numeric(12, 2) NOT NULL CHECK (amount_usd <> 0),
  transaction_kind text NOT NULL CHECK (transaction_kind IN ('top_up', 'subscription', 'grant', 'refund', 'adjustment', 'expiration')),
  pool_key text NOT NULL REFERENCES public.orb_ai_funding_pools(pool_key) ON UPDATE CASCADE ON DELETE RESTRICT,
  model text,
  notes text,
  external_reference text,
  source_row_number integer CHECK (source_row_number IS NULL OR source_row_number > 0),
  source_occurrence integer NOT NULL DEFAULT 1 CHECK (source_occurrence > 0),
  source_fingerprint text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE (import_batch_id, source_row_number)
);

CREATE INDEX IF NOT EXISTS idx_orb_financial_transactions_date
  ON public.orb_financial_transactions (transaction_date DESC, id);
CREATE INDEX IF NOT EXISTS idx_orb_financial_transactions_pool_date
  ON public.orb_financial_transactions (pool_key, transaction_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orb_financial_transactions_fingerprint
  ON public.orb_financial_transactions (source_fingerprint, source_occurrence)
  WHERE source_fingerprint IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orb_financial_transactions_external_ref
  ON public.orb_financial_transactions (external_reference)
  WHERE external_reference IS NOT NULL;

ALTER TABLE public.orb_financial_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orb_financial_descriptor_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orb_financial_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to orb_financial_import_batches" ON public.orb_financial_import_batches;
CREATE POLICY "Service role full access to orb_financial_import_batches"
  ON public.orb_financial_import_batches FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');
DROP POLICY IF EXISTS "Admins can manage orb_financial_import_batches" ON public.orb_financial_import_batches;
CREATE POLICY "Admins can manage orb_financial_import_batches"
  ON public.orb_financial_import_batches FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role_id IN (1, 3)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role_id IN (1, 3)));

DROP POLICY IF EXISTS "Service role full access to orb_financial_descriptor_rules" ON public.orb_financial_descriptor_rules;
CREATE POLICY "Service role full access to orb_financial_descriptor_rules"
  ON public.orb_financial_descriptor_rules FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');
DROP POLICY IF EXISTS "Admins can manage orb_financial_descriptor_rules" ON public.orb_financial_descriptor_rules;
CREATE POLICY "Admins can manage orb_financial_descriptor_rules"
  ON public.orb_financial_descriptor_rules FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role_id IN (1, 3)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role_id IN (1, 3)));

DROP POLICY IF EXISTS "Service role full access to orb_financial_transactions" ON public.orb_financial_transactions;
CREATE POLICY "Service role full access to orb_financial_transactions"
  ON public.orb_financial_transactions FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');
DROP POLICY IF EXISTS "Admins can manage orb_financial_transactions" ON public.orb_financial_transactions;
CREATE POLICY "Admins can manage orb_financial_transactions"
  ON public.orb_financial_transactions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role_id IN (1, 3)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role_id IN (1, 3)));

-- Canonical exact descriptors. These are deliberately exact rules rather
-- than fuzzy heuristics; unknown descriptors remain in the import preview.
INSERT INTO public.orb_financial_descriptor_rules
  (normalized_descriptor, match_kind, disposition, pool_key, transaction_kind)
VALUES
  ('anthropic', 'top_up', 'include', 'anthropic_api', 'top_up'),
  ('anthropic', 'subscription', 'include', 'claude_subscription', 'subscription'),
  ('anthropic pbc', 'top_up', 'include', 'anthropic_api', 'top_up'),
  ('claude.ai', 'subscription', 'include', 'claude_subscription', 'subscription'),
  ('openai', 'top_up', 'include', 'openai_api', 'top_up'),
  ('openai', 'subscription', 'include', 'chatgpt_subscription', 'subscription'),
  ('openai api', 'top_up', 'include', 'openai_api', 'top_up'),
  ('chatgpt', 'subscription', 'include', 'chatgpt_subscription', 'subscription'),
  ('openai *chatgpt subscr', 'subscription', 'include', 'chatgpt_subscription', 'subscription'),
  ('elevenlabs', 'subscription', 'include', 'elevenlabs', 'subscription'),
  ('elevenlabs.io', 'subscription', 'include', 'elevenlabs', 'subscription'),
  ('mistral', 'top_up', 'include', 'mistral_api', 'top_up'),
  ('perplexity', 'subscription', 'include', 'perplexity_subscription', 'subscription'),
  ('github copilot', 'subscription', 'include', 'github_subscription', 'subscription')
ON CONFLICT (normalized_descriptor, match_kind) DO NOTHING;

-- Move legacy manual entries into the transaction ledger once. Automated
-- provider snapshots were already separated by the Phase 0 migration.
INSERT INTO public.orb_financial_transactions
  (transaction_date, company, amount_usd, transaction_kind, pool_key, notes, source_fingerprint, created_at, updated_at, created_by, updated_by)
SELECT
  r.period_start,
  CASE r.provider
    WHEN 'anthropic' THEN 'Anthropic'
    WHEN 'openai' THEN 'OpenAI'
    WHEN 'google' THEN 'Google Cloud'
    WHEN 'mistral' THEN 'Mistral'
    WHEN 'elevenlabs' THEN 'ElevenLabs'
    ELSE initcap(r.provider)
  END,
  r.actual_orb_cost_usd,
  CASE
    WHEN lower(COALESCE(r.notes, '')) LIKE '%grant%' THEN 'grant'
    WHEN lower(COALESCE(r.notes, '')) LIKE '%monthly%' OR lower(COALESCE(r.notes, '')) LIKE '%yearly%' OR lower(COALESCE(r.notes, '')) LIKE '%subscription%' THEN 'subscription'
    ELSE 'top_up'
  END,
  CASE
    WHEN r.provider = 'anthropic' AND (lower(COALESCE(r.notes, '')) LIKE '%yearly%' OR lower(COALESCE(r.notes, '')) LIKE '%subscription%') THEN 'claude_subscription'
    WHEN r.provider = 'anthropic' THEN 'anthropic_api'
    WHEN r.provider = 'openai' AND lower(COALESCE(r.notes, '')) LIKE '%monthly%' THEN 'chatgpt_subscription'
    WHEN r.provider = 'openai' THEN 'openai_api'
    WHEN r.provider = 'mistral' THEN 'mistral_api'
    WHEN r.provider = 'elevenlabs' THEN 'elevenlabs'
    WHEN r.provider = 'google' THEN 'google_cloud_historical'
    ELSE 'google_cloud_historical'
  END,
  r.notes,
  'legacy-reconciliation:' || r.id::text,
  r.created_at,
  r.created_at,
  r.created_by,
  r.created_by
FROM public.orb_cost_reconciliations r
WHERE r.notes IS NULL OR r.notes NOT LIKE 'Auto-populated by the ORB-353 usage-check cron%'
ON CONFLICT DO NOTHING;

DROP FUNCTION IF EXISTS public.get_ai_cost_history(integer);
DROP FUNCTION IF EXISTS public.get_ai_cost_history(integer, text);
CREATE FUNCTION public.get_ai_cost_history(p_days integer DEFAULT 30, p_time_zone text DEFAULT 'UTC')
RETURNS TABLE (
  usage_date date,
  provider text,
  usage_scope text,
  estimated_cost_usd numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (r.created_at AT TIME ZONE p_time_zone)::date AS usage_date,
    r.provider,
    CASE WHEN r.source = 'eval' THEN 'eval' ELSE 'product' END AS usage_scope,
    SUM(COALESCE(r.estimated_cost_usd, 0))::numeric AS estimated_cost_usd
  FROM public.orb_model_requests r
  WHERE r.success IS TRUE
    AND r.created_at >= date_trunc('day', now()) - make_interval(days => LEAST(GREATEST(p_days, 1), 366) - 1)
  GROUP BY 1, 2, 3
  ORDER BY 1, 2, 3;
$$;

REVOKE ALL ON FUNCTION public.get_ai_cost_history(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_cost_history(integer, text) TO service_role;

DROP FUNCTION IF EXISTS public.import_ai_financial_rows(text, text, jsonb, uuid);
CREATE FUNCTION public.import_ai_financial_rows(
  p_file_name text,
  p_statement_key text,
  p_rows jsonb,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id uuid;
  v_row jsonb;
  v_disposition text;
  v_kind text;
  v_pool_key text;
  v_descriptor text;
  v_fingerprint text;
BEGIN
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 OR jsonb_array_length(p_rows) > 2000 THEN
    RAISE EXCEPTION 'Import must contain between 1 and 2,000 rows.';
  END IF;

  INSERT INTO public.orb_financial_import_batches
    (file_name, statement_key, row_count, imported_count, excluded_count, created_by)
  SELECT
    NULLIF(trim(p_file_name), ''),
    NULLIF(trim(p_statement_key), ''),
    jsonb_array_length(p_rows),
    count(*) FILTER (WHERE value->>'disposition' = 'include'),
    count(*) FILTER (WHERE value->>'disposition' = 'exclude'),
    p_user_id
  FROM jsonb_array_elements(p_rows)
  RETURNING id INTO v_batch_id;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    v_disposition := v_row->>'disposition';
    v_kind := v_row->>'kind';
    v_pool_key := NULLIF(v_row->>'poolKey', '');
    v_descriptor := lower(trim(regexp_replace(v_row->>'company', '\s+', ' ', 'g')));

    IF v_disposition NOT IN ('include', 'exclude') THEN
      RAISE EXCEPTION 'Every row must be included or excluded.';
    END IF;
    IF v_disposition = 'include' AND (v_kind IS NULL OR v_kind NOT IN ('top_up', 'subscription', 'grant', 'refund', 'adjustment', 'expiration')) THEN
      RAISE EXCEPTION 'Invalid transaction kind.';
    END IF;

    IF COALESCE((v_row->>'rememberDecision')::boolean, false)
      AND v_kind IN ('top_up', 'subscription', 'grant', 'refund', 'adjustment', 'expiration') THEN
      INSERT INTO public.orb_financial_descriptor_rules
        (normalized_descriptor, match_kind, disposition, pool_key, transaction_kind, updated_at, updated_by)
      VALUES (
        v_descriptor,
        v_kind,
        v_disposition,
        CASE WHEN v_disposition = 'include' THEN v_pool_key ELSE NULL END,
        CASE WHEN v_disposition = 'include' THEN v_kind ELSE NULL END,
        now(),
        p_user_id
      )
      ON CONFLICT (normalized_descriptor, match_kind) DO UPDATE SET
        disposition = EXCLUDED.disposition,
        pool_key = EXCLUDED.pool_key,
        transaction_kind = EXCLUDED.transaction_kind,
        updated_at = now(),
        updated_by = p_user_id;
    END IF;

    IF v_disposition = 'include' THEN
      IF v_pool_key IS NULL THEN RAISE EXCEPTION 'Included rows require a destination.'; END IF;
      v_fingerprint := NULLIF(v_row->>'fingerprint', '');
      IF COALESCE((v_row->>'allowDuplicate')::boolean, false) AND v_fingerprint IS NOT NULL THEN
        v_fingerprint := v_fingerprint || ':confirmed:' || v_batch_id::text;
      END IF;

      INSERT INTO public.orb_financial_transactions
        (import_batch_id, transaction_date, company, amount_usd, transaction_kind, pool_key,
         model, notes, external_reference, source_row_number, source_occurrence,
         source_fingerprint, created_by, updated_by)
      VALUES (
        v_batch_id,
        (v_row->>'date')::date,
        trim(v_row->>'company'),
        (v_row->>'amountUsd')::numeric,
        v_kind,
        v_pool_key,
        NULLIF(trim(v_row->>'model'), ''),
        NULLIF(trim(v_row->>'notes'), ''),
        NULLIF(trim(v_row->>'externalReference'), ''),
        (v_row->>'rowNumber')::integer,
        COALESCE((v_row->>'occurrence')::integer, 1),
        v_fingerprint,
        p_user_id,
        p_user_id
      );
    END IF;
  END LOOP;

  UPDATE public.orb_ai_funding_pools p
  SET recurring_cost_usd = latest.amount_usd,
      updated_at = now(),
      updated_by = p_user_id
  FROM (
    SELECT DISTINCT ON (t.pool_key) t.pool_key, abs(t.amount_usd) AS amount_usd
    FROM public.orb_financial_transactions t
    WHERE t.transaction_kind = 'subscription'
      AND t.import_batch_id = v_batch_id
    ORDER BY t.pool_key, t.transaction_date DESC, t.created_at DESC
  ) latest
  WHERE p.pool_key = latest.pool_key
    AND p.funding_mode IN ('subscription_cash', 'subscription_quota');

  RETURN v_batch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.import_ai_financial_rows(text, text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_ai_financial_rows(text, text, jsonb, uuid) TO service_role;
