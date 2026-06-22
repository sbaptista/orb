-- Add cache token columns and model to orb_metrics
ALTER TABLE orb_metrics
  ADD COLUMN IF NOT EXISTS cache_creation_input_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cache_read_input_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT 'claude-haiku-4-5';

-- Replace unique constraint: one row per user+date+model
ALTER TABLE orb_metrics DROP CONSTRAINT IF EXISTS orb_metrics_user_date_unique;
ALTER TABLE orb_metrics DROP CONSTRAINT IF EXISTS orb_metrics_user_date_model_unique;
ALTER TABLE orb_metrics ADD CONSTRAINT orb_metrics_user_date_model_unique UNIQUE (user_id, date, model);

-- Recreate upsert function with new params
CREATE OR REPLACE FUNCTION upsert_orb_metric(
  p_user_id uuid,
  p_speech_chars integer DEFAULT 0,
  p_voice_speech_chars integer DEFAULT 0,
  p_input_chars integer DEFAULT 0,
  p_tool_call_count integer DEFAULT 0,
  p_ambient_chars integer DEFAULT 0,
  p_input_tokens integer DEFAULT 0,
  p_output_tokens integer DEFAULT 0,
  p_cache_creation_input_tokens integer DEFAULT 0,
  p_cache_read_input_tokens integer DEFAULT 0,
  p_model text DEFAULT 'claude-haiku-4-5'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO orb_metrics (user_id, date, model, call_count, speech_chars, voice_speech_chars, input_chars, tool_call_count, ambient_chars, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens)
  VALUES (p_user_id, CURRENT_DATE, p_model, 1, p_speech_chars, p_voice_speech_chars, p_input_chars, p_tool_call_count, p_ambient_chars, p_input_tokens, p_output_tokens, p_cache_creation_input_tokens, p_cache_read_input_tokens)
  ON CONFLICT (user_id, date, model) DO UPDATE SET
    call_count = orb_metrics.call_count + 1,
    speech_chars = orb_metrics.speech_chars + EXCLUDED.speech_chars,
    voice_speech_chars = orb_metrics.voice_speech_chars + EXCLUDED.voice_speech_chars,
    input_chars = orb_metrics.input_chars + EXCLUDED.input_chars,
    tool_call_count = orb_metrics.tool_call_count + EXCLUDED.tool_call_count,
    ambient_chars = orb_metrics.ambient_chars + EXCLUDED.ambient_chars,
    input_tokens = orb_metrics.input_tokens + EXCLUDED.input_tokens,
    output_tokens = orb_metrics.output_tokens + EXCLUDED.output_tokens,
    cache_creation_input_tokens = orb_metrics.cache_creation_input_tokens + EXCLUDED.cache_creation_input_tokens,
    cache_read_input_tokens = orb_metrics.cache_read_input_tokens + EXCLUDED.cache_read_input_tokens;
END;
$$;

-- Must drop first — return type changed
DROP FUNCTION IF EXISTS get_orb_metrics_page(text,date,date,date,text,text,integer,integer);

CREATE OR REPLACE FUNCTION get_orb_metrics_page(
  p_search text DEFAULT '',
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_date_before date DEFAULT NULL,
  p_sort_key text DEFAULT 'date',
  p_sort_dir text DEFAULT 'desc',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  date date,
  model text,
  call_count integer,
  speech_chars integer,
  voice_speech_chars integer,
  input_chars integer,
  tool_call_count integer,
  ambient_chars integer,
  input_tokens integer,
  output_tokens integer,
  cache_creation_input_tokens integer,
  cache_read_input_tokens integer,
  created_at timestamptz,
  user_email text,
  user_name text,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sort_col text;
  sort_direction text;
BEGIN
  sort_col := CASE p_sort_key
    WHEN 'date' THEN 'f.date'
    WHEN 'model' THEN 'f.model'
    WHEN 'call_count' THEN 'f.call_count'
    WHEN 'speech_chars' THEN 'f.speech_chars'
    WHEN 'voice_speech_chars' THEN 'f.voice_speech_chars'
    WHEN 'input_chars' THEN 'f.input_chars'
    WHEN 'tool_call_count' THEN 'f.tool_call_count'
    WHEN 'ambient_chars' THEN 'f.ambient_chars'
    WHEN 'input_tokens' THEN 'f.input_tokens'
    WHEN 'output_tokens' THEN 'f.output_tokens'
    WHEN 'cache_creation_input_tokens' THEN 'f.cache_creation_input_tokens'
    WHEN 'cache_read_input_tokens' THEN 'f.cache_read_input_tokens'
    ELSE 'f.date'
  END;
  sort_direction := CASE WHEN p_sort_dir = 'asc' THEN 'ASC' ELSE 'DESC' END;

  RETURN QUERY EXECUTE format(
    'WITH filtered AS (
      SELECT om.*,
        u.email AS user_email,
        COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '''') || '' '' || COALESCE(u.last_name, '''')), ''''), u.email) AS user_name
      FROM orb_metrics om
      LEFT JOIN users u ON u.id = om.user_id
      WHERE 1=1
        %s %s %s %s
    )
    SELECT f.id, f.user_id, f.date, f.model, f.call_count, f.speech_chars, f.voice_speech_chars,
           f.input_chars, f.tool_call_count, f.ambient_chars, f.input_tokens, f.output_tokens,
           f.cache_creation_input_tokens, f.cache_read_input_tokens,
           f.created_at, f.user_email, f.user_name, count(*) OVER() AS total_count
    FROM filtered f
    ORDER BY %s %s
    LIMIT %s OFFSET %s',
    CASE WHEN p_search IS NOT NULL AND p_search <> '' THEN format('AND (u.email ILIKE ''%%'' || %L || ''%%'' OR u.first_name ILIKE ''%%'' || %L || ''%%'' OR u.last_name ILIKE ''%%'' || %L || ''%%'')', p_search, p_search, p_search) ELSE '' END,
    CASE WHEN p_date_from IS NOT NULL THEN format('AND om.date >= %L', p_date_from) ELSE '' END,
    CASE WHEN p_date_to IS NOT NULL THEN format('AND om.date <= %L', p_date_to) ELSE '' END,
    CASE WHEN p_date_before IS NOT NULL THEN format('AND om.date < %L', p_date_before) ELSE '' END,
    sort_col, sort_direction,
    p_limit, p_offset
  );
END;
$$;
