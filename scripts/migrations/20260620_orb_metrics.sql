-- Orb usage metrics: one row per user per day
CREATE TABLE IF NOT EXISTS orb_metrics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  call_count integer NOT NULL DEFAULT 0,
  speech_chars integer NOT NULL DEFAULT 0,
  voice_speech_chars integer NOT NULL DEFAULT 0,
  input_chars integer NOT NULL DEFAULT 0,
  tool_call_count integer NOT NULL DEFAULT 0,
  ambient_chars integer NOT NULL DEFAULT 0,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT orb_metrics_user_date_unique UNIQUE (user_id, date)
);

CREATE INDEX idx_orb_metrics_date ON orb_metrics (date DESC);
CREATE INDEX idx_orb_metrics_user_date ON orb_metrics (user_id, date DESC);

-- RLS: admin-only read
ALTER TABLE orb_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read orb_metrics"
  ON orb_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (SELECT auth.uid())
        AND u.role_id IN (1, 3)
    )
  );

-- Upsert function for incrementing metrics from server actions
CREATE OR REPLACE FUNCTION upsert_orb_metric(
  p_user_id uuid,
  p_speech_chars integer DEFAULT 0,
  p_voice_speech_chars integer DEFAULT 0,
  p_input_chars integer DEFAULT 0,
  p_tool_call_count integer DEFAULT 0,
  p_ambient_chars integer DEFAULT 0,
  p_input_tokens integer DEFAULT 0,
  p_output_tokens integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO orb_metrics (user_id, date, call_count, speech_chars, voice_speech_chars, input_chars, tool_call_count, ambient_chars, input_tokens, output_tokens)
  VALUES (p_user_id, CURRENT_DATE, 1, p_speech_chars, p_voice_speech_chars, p_input_chars, p_tool_call_count, p_ambient_chars, p_input_tokens, p_output_tokens)
  ON CONFLICT (user_id, date) DO UPDATE SET
    call_count = orb_metrics.call_count + 1,
    speech_chars = orb_metrics.speech_chars + EXCLUDED.speech_chars,
    voice_speech_chars = orb_metrics.voice_speech_chars + EXCLUDED.voice_speech_chars,
    input_chars = orb_metrics.input_chars + EXCLUDED.input_chars,
    tool_call_count = orb_metrics.tool_call_count + EXCLUDED.tool_call_count,
    ambient_chars = orb_metrics.ambient_chars + EXCLUDED.ambient_chars,
    input_tokens = orb_metrics.input_tokens + EXCLUDED.input_tokens,
    output_tokens = orb_metrics.output_tokens + EXCLUDED.output_tokens;
END;
$$;

-- Paginated query function for the settings page (with text search for user)
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
  call_count integer,
  speech_chars integer,
  voice_speech_chars integer,
  input_chars integer,
  tool_call_count integer,
  ambient_chars integer,
  input_tokens integer,
  output_tokens integer,
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
    WHEN 'call_count' THEN 'f.call_count'
    WHEN 'speech_chars' THEN 'f.speech_chars'
    WHEN 'voice_speech_chars' THEN 'f.voice_speech_chars'
    WHEN 'input_chars' THEN 'f.input_chars'
    WHEN 'tool_call_count' THEN 'f.tool_call_count'
    WHEN 'ambient_chars' THEN 'f.ambient_chars'
    WHEN 'input_tokens' THEN 'f.input_tokens'
    WHEN 'output_tokens' THEN 'f.output_tokens'
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
    SELECT f.id, f.user_id, f.date, f.call_count, f.speech_chars, f.voice_speech_chars,
           f.input_chars, f.tool_call_count, f.ambient_chars, f.input_tokens, f.output_tokens,
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
