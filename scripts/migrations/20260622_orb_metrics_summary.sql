-- Per-model totals for the metrics summary cards. Keeps aggregation independent
-- from the paginated detail query so summary values cover the full filter set.
CREATE OR REPLACE FUNCTION get_orb_metrics_summary(
  p_search text DEFAULT '',
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_date_before date DEFAULT NULL
)
RETURNS TABLE (
  model text,
  call_count bigint,
  speech_chars bigint,
  voice_speech_chars bigint,
  input_chars bigint,
  tool_call_count bigint,
  ambient_chars bigint,
  input_tokens bigint,
  output_tokens bigint,
  cache_creation_input_tokens bigint,
  cache_read_input_tokens bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    om.model,
    COALESCE(SUM(om.call_count), 0)::bigint,
    COALESCE(SUM(om.speech_chars), 0)::bigint,
    COALESCE(SUM(om.voice_speech_chars), 0)::bigint,
    COALESCE(SUM(om.input_chars), 0)::bigint,
    COALESCE(SUM(om.tool_call_count), 0)::bigint,
    COALESCE(SUM(om.ambient_chars), 0)::bigint,
    COALESCE(SUM(om.input_tokens), 0)::bigint,
    COALESCE(SUM(om.output_tokens), 0)::bigint,
    COALESCE(SUM(om.cache_creation_input_tokens), 0)::bigint,
    COALESCE(SUM(om.cache_read_input_tokens), 0)::bigint
  FROM orb_metrics om
  LEFT JOIN users u ON u.id = om.user_id
  WHERE (p_search = '' OR u.email ILIKE '%' || p_search || '%' OR u.first_name ILIKE '%' || p_search || '%' OR u.last_name ILIKE '%' || p_search || '%')
    AND (p_date_from IS NULL OR om.date >= p_date_from)
    AND (p_date_to IS NULL OR om.date <= p_date_to)
    AND (p_date_before IS NULL OR om.date < p_date_before)
  GROUP BY om.model
  ORDER BY om.model;
$$;
