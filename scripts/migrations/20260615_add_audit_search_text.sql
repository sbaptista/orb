DROP FUNCTION IF EXISTS search_audit_record_ids(text);
DROP FUNCTION IF EXISTS search_audit_log_ids(text);

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS search_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS user_name_snapshot text,
  ADD COLUMN IF NOT EXISTS user_email_snapshot text;

CREATE OR REPLACE FUNCTION set_audit_log_search_text()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  audit_user record;
BEGIN
  IF NEW.user_id IS NOT NULL
    AND (NEW.user_name_snapshot IS NULL OR NEW.user_email_snapshot IS NULL)
  THEN
    SELECT
      NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), '') AS full_name,
      u.email
    INTO audit_user
    FROM users u
    WHERE u.id = NEW.user_id;

    NEW.user_name_snapshot := COALESCE(NEW.user_name_snapshot, audit_user.full_name);
    NEW.user_email_snapshot := COALESCE(NEW.user_email_snapshot, audit_user.email);
  END IF;

  NEW.search_text := concat_ws(
    ' ',
    NEW.table_name,
    NEW.action,
    NEW.user_name_snapshot,
    NEW.user_email_snapshot,
    NEW.actor,
    NEW.record_id::text,
    NEW.before::text,
    NEW.after::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_log_set_search_text ON audit_log;
CREATE TRIGGER audit_log_set_search_text
BEFORE INSERT OR UPDATE OF table_name, action, user_id, user_name_snapshot, user_email_snapshot, actor, record_id, before, after
ON audit_log
FOR EACH ROW
EXECUTE FUNCTION set_audit_log_search_text();

UPDATE audit_log
SET
  user_name_snapshot = COALESCE(
    user_name_snapshot,
    (
      SELECT NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), '')
      FROM users u
      WHERE u.id = audit_log.user_id
    )
  ),
  user_email_snapshot = COALESCE(
    user_email_snapshot,
    (
      SELECT u.email
      FROM users u
      WHERE u.id = audit_log.user_id
    )
  );

UPDATE audit_log
SET search_text = concat_ws(
  ' ',
  table_name,
  action,
  user_name_snapshot,
  user_email_snapshot,
  actor,
  record_id::text,
  before::text,
  after::text
);

CREATE INDEX IF NOT EXISTS idx_audit_log_search_text_trgm
  ON audit_log
  USING gin (search_text extensions.gin_trgm_ops);

CREATE OR REPLACE FUNCTION get_audit_log_page(
  p_search text DEFAULT '',
  p_created_from timestamptz DEFAULT NULL,
  p_created_to timestamptz DEFAULT NULL,
  p_created_before timestamptz DEFAULT NULL,
  p_sort_key text DEFAULT 'created_at',
  p_sort_dir text DEFAULT 'desc',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  table_name text,
  record_id uuid,
  action text,
  before jsonb,
  after jsonb,
  user_id uuid,
  created_at timestamptz,
  actor text,
  system_info jsonb,
  search_text text,
  user_name_snapshot text,
  user_email_snapshot text,
  users jsonb,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      NULLIF(trim(p_search), '') AS search_term,
      '%' || replace(replace(replace(replace(trim(p_search), '\', '\\'), '%', '\%'), '_', '\_'), '*', '\*') || '%' AS search_pattern,
      LEAST(GREATEST(p_limit, 1), 100) AS safe_limit,
      GREATEST(p_offset, 0) AS safe_offset
  ),
  filtered AS (
    SELECT
      a.*,
      jsonb_build_object(
        'first_name', u.first_name,
        'last_name', u.last_name,
        'email', u.email
      ) AS user_json
    FROM audit_log a
    LEFT JOIN users u ON u.id = a.user_id
    CROSS JOIN params p
    WHERE (p.search_term IS NULL OR a.search_text ILIKE p.search_pattern ESCAPE '\')
      AND (p_created_from IS NULL OR a.created_at >= p_created_from)
      AND (p_created_to IS NULL OR a.created_at <= p_created_to)
      AND (p_created_before IS NULL OR a.created_at < p_created_before)
  ),
  counted AS (
    SELECT filtered.*, count(*) OVER() AS total_count
    FROM filtered
  )
  SELECT
    c.id,
    c.table_name,
    c.record_id,
    c.action,
    c.before,
    c.after,
    c.user_id,
    c.created_at,
    c.actor,
    c.system_info,
    c.search_text,
    c.user_name_snapshot,
    c.user_email_snapshot,
    c.user_json AS users,
    c.total_count
  FROM counted c
  CROSS JOIN params p
  ORDER BY
    CASE WHEN p_sort_key = 'table_name' AND p_sort_dir = 'asc' THEN c.table_name END ASC NULLS LAST,
    CASE WHEN p_sort_key = 'table_name' AND p_sort_dir = 'desc' THEN c.table_name END DESC NULLS LAST,
    CASE WHEN p_sort_key = 'action' AND p_sort_dir = 'asc' THEN c.action END ASC NULLS LAST,
    CASE WHEN p_sort_key = 'action' AND p_sort_dir = 'desc' THEN c.action END DESC NULLS LAST,
    CASE WHEN p_sort_key = 'actor' AND p_sort_dir = 'asc' THEN c.actor END ASC NULLS LAST,
    CASE WHEN p_sort_key = 'actor' AND p_sort_dir = 'desc' THEN c.actor END DESC NULLS LAST,
    CASE WHEN p_sort_key = 'created_at' AND p_sort_dir = 'asc' THEN c.created_at END ASC,
    CASE WHEN p_sort_key = 'created_at' AND p_sort_dir = 'desc' THEN c.created_at END DESC,
    c.created_at DESC
  LIMIT (SELECT safe_limit FROM params)
  OFFSET (SELECT safe_offset FROM params);
$$;
