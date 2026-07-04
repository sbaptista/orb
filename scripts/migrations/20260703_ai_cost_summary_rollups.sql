-- ORB-311: database-side AI cost accounting rollups.
-- Keeps Settings -> AI Metrics initialization from fetching thousands of
-- request-ledger rows just to calculate summary totals in the server action.

CREATE OR REPLACE FUNCTION public.get_ai_cost_summary_rollups(
  p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL,
  p_provider text DEFAULT NULL,
  p_model text DEFAULT NULL
)
RETURNS TABLE (
  group_type text,
  key text,
  provider text,
  model text,
  route_role text,
  source text,
  request_count bigint,
  input_tokens bigint,
  output_tokens bigint,
  cached_input_tokens bigint,
  cache_write_tokens bigint,
  estimated_cost_usd numeric,
  avg_latency_ms numeric,
  actual_start timestamptz,
  actual_end timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT
      created_at,
      provider,
      model,
      COALESCE(route_role, 'operational') AS route_role,
      COALESCE(source, 'conversation') AS source,
      COALESCE(input_tokens, 0) AS input_tokens,
      COALESCE(output_tokens, 0) AS output_tokens,
      COALESCE(cached_input_tokens, 0) AS cached_input_tokens,
      COALESCE(cache_write_tokens, 0) AS cache_write_tokens,
      COALESCE(estimated_cost_usd, 0) AS estimated_cost_usd,
      COALESCE(latency_ms, 0) AS latency_ms
    FROM public.orb_model_requests
    WHERE success IS TRUE
      AND (p_start IS NULL OR created_at >= p_start)
      AND (p_end IS NULL OR created_at < p_end)
      AND (p_provider IS NULL OR provider = p_provider)
      AND (p_model IS NULL OR model = p_model)
  ),
  model_options AS (
    SELECT DISTINCT
      provider,
      model
    FROM public.orb_model_requests
    WHERE success IS TRUE
  )
  SELECT
    'total'::text AS group_type,
    'total'::text AS key,
    NULL::text AS provider,
    NULL::text AS model,
    NULL::text AS route_role,
    NULL::text AS source,
    COUNT(*)::bigint AS request_count,
    COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
    COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
    COALESCE(SUM(cached_input_tokens), 0)::bigint AS cached_input_tokens,
    COALESCE(SUM(cache_write_tokens), 0)::bigint AS cache_write_tokens,
    COALESCE(SUM(estimated_cost_usd), 0)::numeric AS estimated_cost_usd,
    AVG(latency_ms)::numeric AS avg_latency_ms,
    MIN(created_at) AS actual_start,
    MAX(created_at) AS actual_end
  FROM filtered

  UNION ALL

  SELECT
    'provider'::text,
    provider || ':' || model,
    provider,
    model,
    NULL::text,
    NULL::text,
    COUNT(*)::bigint,
    COALESCE(SUM(input_tokens), 0)::bigint,
    COALESCE(SUM(output_tokens), 0)::bigint,
    COALESCE(SUM(cached_input_tokens), 0)::bigint,
    COALESCE(SUM(cache_write_tokens), 0)::bigint,
    COALESCE(SUM(estimated_cost_usd), 0)::numeric,
    AVG(latency_ms)::numeric,
    MIN(created_at),
    MAX(created_at)
  FROM filtered
  GROUP BY provider, model

  UNION ALL

  SELECT
    'role'::text,
    route_role,
    NULL::text,
    NULL::text,
    route_role,
    NULL::text,
    COUNT(*)::bigint,
    COALESCE(SUM(input_tokens), 0)::bigint,
    COALESCE(SUM(output_tokens), 0)::bigint,
    COALESCE(SUM(cached_input_tokens), 0)::bigint,
    COALESCE(SUM(cache_write_tokens), 0)::bigint,
    COALESCE(SUM(estimated_cost_usd), 0)::numeric,
    AVG(latency_ms)::numeric,
    MIN(created_at),
    MAX(created_at)
  FROM filtered
  GROUP BY route_role

  UNION ALL

  SELECT
    'source'::text,
    source,
    NULL::text,
    NULL::text,
    NULL::text,
    source,
    COUNT(*)::bigint,
    COALESCE(SUM(input_tokens), 0)::bigint,
    COALESCE(SUM(output_tokens), 0)::bigint,
    COALESCE(SUM(cached_input_tokens), 0)::bigint,
    COALESCE(SUM(cache_write_tokens), 0)::bigint,
    COALESCE(SUM(estimated_cost_usd), 0)::numeric,
    AVG(latency_ms)::numeric,
    MIN(created_at),
    MAX(created_at)
  FROM filtered
  GROUP BY source

  UNION ALL

  SELECT
    'model_option'::text,
    provider || ':' || model,
    provider,
    model,
    NULL::text,
    NULL::text,
    0::bigint,
    0::bigint,
    0::bigint,
    0::bigint,
    0::bigint,
    0::numeric,
    NULL::numeric,
    NULL::timestamptz,
    NULL::timestamptz
  FROM model_options
  ORDER BY group_type, key;
$$;

REVOKE ALL ON FUNCTION public.get_ai_cost_summary_rollups(timestamptz, timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_cost_summary_rollups(timestamptz, timestamptz, text, text) TO service_role;
