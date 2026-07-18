-- ORB-325 typed parity, Phase 3: durable Realtime Knowledge Repository writes.

ALTER TABLE public.orb_realtime_proposals
  DROP CONSTRAINT IF EXISTS orb_realtime_proposals_kind_check;

ALTER TABLE public.orb_realtime_proposals
  ADD CONSTRAINT orb_realtime_proposals_kind_check
  CHECK (
    kind IN (
      'create_todo', 'update_todo', 'delete_todo', 'move_todo', 'close_todo',
      'create_project', 'update_project', 'delete_project',
      'add_knowledge', 'update_knowledge'
    )
  );

CREATE OR REPLACE FUNCTION public.confirm_realtime_knowledge_mutation(
  p_proposal_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proposal public.orb_realtime_proposals%ROWTYPE;
  v_project public.projects%ROWTYPE;
  v_entry public.knowledge_repo%ROWTYPE;
  v_role_id integer;
  v_knowledge_id uuid;
  v_tags text[];
  v_receipt jsonb;
  v_before jsonb;
  v_after jsonb;
  v_observed_at timestamptz := clock_timestamp();
BEGIN
  SELECT * INTO v_proposal
  FROM public.orb_realtime_proposals
  WHERE id = p_proposal_id
  FOR UPDATE;

  IF NOT FOUND OR v_proposal.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Invalid proposal';
  END IF;
  IF v_proposal.kind NOT IN ('add_knowledge', 'update_knowledge') THEN
    RAISE EXCEPTION 'Unsupported knowledge proposal kind';
  END IF;
  IF v_proposal.status = 'executed' THEN
    RETURN jsonb_build_object('receipt', v_proposal.receipt, 'replayed', true);
  END IF;
  IF v_proposal.expires_at < now() THEN
    RAISE EXCEPTION 'Proposal expired';
  END IF;

  SELECT role_id INTO v_role_id
  FROM public.users
  WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The user is no longer available';
  END IF;

  IF v_proposal.kind = 'add_knowledge' THEN
    SELECT * INTO v_project
    FROM public.projects
    WHERE id = v_proposal.project_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The proposed project is no longer available';
    END IF;
    IF v_project.created_by <> p_user_id AND coalesce(v_role_id, 0) NOT IN (1, 3) THEN
      RAISE EXCEPTION 'The user cannot add knowledge to the proposed project';
    END IF;
    IF char_length(btrim(v_proposal.title)) NOT BETWEEN 1 AND 240 THEN
      RAISE EXCEPTION 'The proposed knowledge title is invalid';
    END IF;
    IF char_length(btrim(coalesce(v_proposal.params->>'content', ''))) = 0 THEN
      RAISE EXCEPTION 'Knowledge content is required';
    END IF;

    SELECT coalesce(array_agg(value), '{}'::text[]) INTO v_tags
    FROM jsonb_array_elements_text(coalesce(v_proposal.params->'tags', '[]'::jsonb)) AS value;

    INSERT INTO public.knowledge_repo (product_id, title, content, tags)
    VALUES (
      v_project.id,
      btrim(v_proposal.title),
      btrim(v_proposal.params->>'content'),
      v_tags
    )
    RETURNING * INTO v_entry;

    v_after := jsonb_build_object(
      'title', v_entry.title,
      'product_id', v_entry.product_id,
      'tags', v_entry.tags,
      'source', 'orb-realtime'
    );
    v_receipt := jsonb_build_object(
      'kind', 'add_knowledge',
      'receiptId', v_proposal.id::text,
      'code', coalesce(v_project.code, ''),
      'title', v_entry.title,
      'project', v_project.name,
      'knowledgeEntryId', v_entry.id::text,
      'observedAt', v_observed_at,
      'source', 'database',
      'spokenText', format('Saved the knowledge entry “%s” in %s.', v_entry.title, v_project.name)
    );

    INSERT INTO public.audit_log (action, table_name, record_id, after, actor, user_id, created_at)
    VALUES ('knowledge_add', 'knowledge_repo', v_entry.id, v_after, 'orb', p_user_id, v_observed_at);
  ELSE
    v_knowledge_id := nullif(v_proposal.params->>'knowledge_id', '')::uuid;
    SELECT * INTO v_entry
    FROM public.knowledge_repo
    WHERE id = v_knowledge_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The proposed knowledge entry is no longer available';
    END IF;
    IF v_entry.updated_at IS DISTINCT FROM (v_proposal.params->>'expected_updated_at')::timestamptz
      OR v_entry.title IS DISTINCT FROM v_proposal.params->>'expected_title'
      OR v_entry.content IS DISTINCT FROM v_proposal.params->>'expected_content'
      OR coalesce(to_jsonb(v_entry.product_id), 'null'::jsonb)
        IS DISTINCT FROM coalesce(v_proposal.params->'expected_product_id', 'null'::jsonb)
      OR coalesce(to_jsonb(v_entry.tags), '[]'::jsonb)
        IS DISTINCT FROM coalesce(v_proposal.params->'expected_tags', '[]'::jsonb) THEN
      RAISE EXCEPTION 'The knowledge entry changed after the proposal; read it again before changing it';
    END IF;
    IF NOT (v_proposal.params ? 'new_title' OR v_proposal.params ? 'new_content') THEN
      RAISE EXCEPTION 'The update proposal contains no changes';
    END IF;
    IF v_proposal.params ? 'new_title'
      AND char_length(btrim(v_proposal.params->>'new_title')) NOT BETWEEN 1 AND 240 THEN
      RAISE EXCEPTION 'The proposed knowledge title is invalid';
    END IF;
    IF char_length(btrim(coalesce(v_proposal.params->>'new_content', ''))) = 0 THEN
      RAISE EXCEPTION 'The attributed knowledge content is required';
    END IF;

    v_before := jsonb_build_object(
      'title', v_entry.title,
      'content', v_entry.content,
      'product_id', v_entry.product_id,
      'tags', v_entry.tags
    );

    UPDATE public.knowledge_repo
    SET title = CASE
          WHEN v_proposal.params ? 'new_title' THEN btrim(v_proposal.params->>'new_title')
          ELSE title
        END,
        content = btrim(v_proposal.params->>'new_content')
    WHERE id = v_entry.id
    RETURNING * INTO v_entry;

    IF v_entry.product_id IS NOT NULL THEN
      SELECT * INTO v_project
      FROM public.projects
      WHERE id = v_entry.product_id;
    END IF;

    v_after := jsonb_build_object(
      'title', v_entry.title,
      'content', v_entry.content,
      'product_id', v_entry.product_id,
      'tags', v_entry.tags,
      'source', 'orb-realtime'
    );
    v_receipt := jsonb_build_object(
      'kind', 'update_knowledge',
      'receiptId', v_proposal.id::text,
      'code', coalesce(v_project.code, ''),
      'title', v_entry.title,
      'project', coalesce(v_project.name, 'Cross-project knowledge'),
      'knowledgeEntryId', v_entry.id::text,
      'observedAt', v_observed_at,
      'source', 'database',
      'spokenText', format('Updated the knowledge entry “%s”.', v_entry.title)
    );

    INSERT INTO public.audit_log (action, table_name, record_id, before, after, actor, user_id, created_at)
    VALUES ('knowledge_update', 'knowledge_repo', v_entry.id, v_before, v_after, 'orb', p_user_id, v_observed_at);
  END IF;

  UPDATE public.orb_realtime_proposals
  SET status = 'executed',
      todo_id = NULL,
      receipt = v_receipt,
      executed_at = v_observed_at
  WHERE id = v_proposal.id;

  RETURN jsonb_build_object('receipt', v_receipt, 'replayed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_realtime_knowledge_mutation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_realtime_knowledge_mutation(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_realtime_mutation(
  p_proposal_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_kind text;
BEGIN
  SELECT kind INTO v_kind
  FROM public.orb_realtime_proposals
  WHERE id = p_proposal_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid proposal';
  END IF;
  IF v_kind IN ('create_project', 'update_project', 'delete_project') THEN
    RETURN public.confirm_realtime_project_mutation(p_proposal_id, p_user_id);
  END IF;
  IF v_kind IN ('add_knowledge', 'update_knowledge') THEN
    RETURN public.confirm_realtime_knowledge_mutation(p_proposal_id, p_user_id);
  END IF;
  RETURN public.confirm_realtime_todo_mutation(p_proposal_id, p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_realtime_mutation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_realtime_mutation(uuid, uuid) TO service_role;
