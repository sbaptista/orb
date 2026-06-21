-- Audit Log browsing must remain proportional to the page size as the log grows.
-- The prior RPC used count(*) over() and selected full JSON payloads before LIMIT.

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at_id
  ON public.audit_log (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_name_id
  ON public.audit_log (table_name, id);

CREATE INDEX IF NOT EXISTS idx_audit_log_action_id
  ON public.audit_log (action, id);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id
  ON public.audit_log ((coalesce(actor, '')), id);

DROP FUNCTION IF EXISTS public.get_audit_log_cursor_page(text, timestamptz, timestamptz, timestamptz, text, text, integer, jsonb);

CREATE OR REPLACE FUNCTION public.get_audit_log_cursor_page(
  p_search text DEFAULT '',
  p_created_from timestamptz DEFAULT NULL,
  p_created_to timestamptz DEFAULT NULL,
  p_created_before timestamptz DEFAULT NULL,
  p_sort_key text DEFAULT 'created_at',
  p_sort_dir text DEFAULT 'desc',
  p_limit integer DEFAULT 50,
  p_cursor jsonb DEFAULT NULL
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
  user_name_snapshot text,
  user_email_snapshot text,
  system_info jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sort_key text := CASE p_sort_key
    WHEN 'table_name' THEN 'table_name'
    WHEN 'action' THEN 'action'
    WHEN 'actor' THEN 'actor'
    ELSE 'created_at'
  END;
  v_sort_dir text := CASE WHEN lower(p_sort_dir) = 'asc' THEN 'ASC' ELSE 'DESC' END;
  v_sort_expr text;
  v_comparison text := CASE WHEN lower(p_sort_dir) = 'asc' THEN '>' ELSE '<' END;
  v_where text := '';
  v_sql text;
BEGIN
  v_sort_expr := CASE v_sort_key
    WHEN 'actor' THEN 'coalesce(a.actor, '''')'
    ELSE format('a.%I', v_sort_key)
  END;
  IF nullif(trim(p_search), '') IS NOT NULL THEN
    v_where := v_where || format(
      ' AND a.search_text ILIKE %L',
      '%' || trim(p_search) || '%'
    );
  END IF;
  IF p_created_from IS NOT NULL THEN v_where := v_where || format(' AND a.created_at >= %L::timestamptz', p_created_from); END IF;
  IF p_created_to IS NOT NULL THEN v_where := v_where || format(' AND a.created_at <= %L::timestamptz', p_created_to); END IF;
  IF p_created_before IS NOT NULL THEN v_where := v_where || format(' AND a.created_at < %L::timestamptz', p_created_before); END IF;
  IF p_cursor IS NOT NULL THEN
    v_where := v_where || CASE v_sort_key
      WHEN 'created_at' THEN format(' AND (%s, a.id) %s (%L::timestamptz, %L::uuid)', v_sort_expr, v_comparison, p_cursor->>'sort', p_cursor->>'id')
      ELSE format(' AND (%s, a.id) %s (%L, %L::uuid)', v_sort_expr, v_comparison, p_cursor->>'sort', p_cursor->>'id')
    END;
  END IF;

  v_sql := format($query$
    SELECT
      a.id,
      a.table_name,
      a.record_id,
      a.action,
      a.before,
      a.after,
      a.user_id,
      a.created_at,
      a.actor,
      a.user_name_snapshot,
      a.user_email_snapshot,
      a.system_info
    FROM public.audit_log a
    WHERE true %2$s
    ORDER BY %1$s %3$s, a.id %3$s
    LIMIT %4$s
  $query$, v_sort_expr, v_where, v_sort_dir, LEAST(GREATEST(p_limit, 1), 101));

  RETURN QUERY EXECUTE v_sql;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_audit_log_count(
  p_search text DEFAULT '',
  p_created_from timestamptz DEFAULT NULL,
  p_created_to timestamptz DEFAULT NULL,
  p_created_before timestamptz DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_where text := '';
  v_count bigint;
BEGIN
  IF nullif(trim(p_search), '') IS NOT NULL THEN
    v_where := v_where || format(' AND a.search_text ILIKE %L', '%' || trim(p_search) || '%');
  END IF;
  IF p_created_from IS NOT NULL THEN v_where := v_where || format(' AND a.created_at >= %L::timestamptz', p_created_from); END IF;
  IF p_created_to IS NOT NULL THEN v_where := v_where || format(' AND a.created_at <= %L::timestamptz', p_created_to); END IF;
  IF p_created_before IS NOT NULL THEN v_where := v_where || format(' AND a.created_at < %L::timestamptz', p_created_before); END IF;

  EXECUTE format('SELECT count(*) FROM public.audit_log a WHERE true %s', v_where) INTO v_count;
  RETURN v_count;
END;
$$;
