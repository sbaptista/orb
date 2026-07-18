-- ORB-325 typed parity, Phase 2: durable Realtime project mutations.
--
-- Project codes are generated in the application by lib/project-codes.ts and
-- stored in the proposal. Confirmation re-validates the candidate under a
-- per-owner transaction advisory lock, so the web UI and Realtime operator
-- share one generator without allowing a confirmation-time race.

ALTER TABLE public.orb_realtime_proposals
  DROP CONSTRAINT IF EXISTS orb_realtime_proposals_kind_check;

ALTER TABLE public.orb_realtime_proposals
  ADD CONSTRAINT orb_realtime_proposals_kind_check
  CHECK (
    kind IN (
      'create_todo', 'update_todo', 'delete_todo', 'move_todo', 'close_todo',
      'create_project', 'update_project', 'delete_project'
    )
  );

CREATE OR REPLACE FUNCTION public.confirm_realtime_project_mutation(
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
  v_role_id integer;
  v_candidate_code text;
  v_new_name text;
  v_new_description text;
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

  IF v_proposal.kind NOT IN ('create_project', 'update_project', 'delete_project') THEN
    RAISE EXCEPTION 'Unsupported project proposal kind';
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

  IF v_proposal.kind = 'create_project' THEN
    -- Serialize project namespace allocation even when this user currently has
    -- zero projects (row locks alone cannot lock an empty set).
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

    v_candidate_code := upper(btrim(coalesce(v_proposal.params->>'candidate_code', '')));
    IF v_candidate_code !~ '^[A-Z0-9]{1,10}$' THEN
      RAISE EXCEPTION 'The proposed project code is invalid';
    END IF;
    IF char_length(btrim(v_proposal.title)) NOT BETWEEN 1 AND 240 THEN
      RAISE EXCEPTION 'The proposed project name is invalid';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.projects
      WHERE created_by = p_user_id
        AND deleted_at IS NULL
        AND lower(name) = lower(btrim(v_proposal.title))
    ) THEN
      RAISE EXCEPTION 'A project with that name already exists';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.projects
      WHERE created_by = p_user_id
        AND deleted_at IS NULL
        AND upper(code) = v_candidate_code
    ) THEN
      RAISE EXCEPTION 'The proposed project code is no longer available; propose the project again';
    END IF;

    INSERT INTO public.projects (name, code, description, created_by)
    VALUES (
      btrim(v_proposal.title),
      v_candidate_code,
      nullif(btrim(coalesce(v_proposal.params->>'description', '')), ''),
      p_user_id
    )
    RETURNING * INTO v_project;

    v_after := jsonb_build_object(
      'name', v_project.name,
      'code', v_project.code,
      'description', v_project.description,
      'source', 'orb-realtime'
    );
    v_receipt := jsonb_build_object(
      'kind', 'create_project',
      'receiptId', v_proposal.id::text,
      'code', v_project.code,
      'title', v_project.name,
      'project', v_project.name,
      'observedAt', v_observed_at,
      'source', 'database',
      'spokenText', format('Created the project “%s”.', v_project.name)
    );

    INSERT INTO public.audit_log (action, table_name, record_id, after, actor, user_id, created_at)
    VALUES ('project_create', 'projects', v_project.id, v_after, 'orb', p_user_id, v_observed_at);
  ELSE
    SELECT * INTO v_project
    FROM public.projects
    WHERE id = v_proposal.project_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The proposed project is no longer available';
    END IF;
    IF v_project.created_by <> p_user_id AND coalesce(v_role_id, 0) NOT IN (1, 3) THEN
      RAISE EXCEPTION 'The user cannot edit the proposed project';
    END IF;
    IF v_project.updated_at IS DISTINCT FROM (v_proposal.params->>'expected_updated_at')::timestamptz
      OR v_project.name IS DISTINCT FROM v_proposal.params->>'expected_name'
      OR v_project.code IS DISTINCT FROM v_proposal.params->>'expected_code'
      OR coalesce(to_jsonb(v_project.description), 'null'::jsonb)
        IS DISTINCT FROM coalesce(v_proposal.params->'expected_description', 'null'::jsonb) THEN
      RAISE EXCEPTION 'The project changed after the proposal; read it again before changing it';
    END IF;

    v_before := jsonb_build_object(
      'name', v_project.name,
      'code', v_project.code,
      'description', v_project.description
    );

    IF v_proposal.kind = 'update_project' THEN
      IF NOT (v_proposal.params ? 'new_name' OR v_proposal.params ? 'new_description') THEN
        RAISE EXCEPTION 'The update proposal contains no changes';
      END IF;
      IF v_proposal.params ? 'new_name'
        AND char_length(btrim(v_proposal.params->>'new_name')) NOT BETWEEN 1 AND 240 THEN
        RAISE EXCEPTION 'The proposed project name is invalid';
      END IF;

      PERFORM pg_advisory_xact_lock(hashtextextended(v_project.created_by::text, 0));
      v_new_name := CASE
        WHEN v_proposal.params ? 'new_name' THEN btrim(v_proposal.params->>'new_name')
        ELSE v_project.name
      END;
      IF EXISTS (
        SELECT 1
        FROM public.projects
        WHERE created_by = v_project.created_by
          AND deleted_at IS NULL
          AND id <> v_project.id
          AND lower(name) = lower(v_new_name)
      ) THEN
        RAISE EXCEPTION 'A project with that name already exists';
      END IF;
      v_new_description := CASE
        WHEN v_proposal.params ? 'new_description'
          THEN nullif(btrim(coalesce(v_proposal.params->>'new_description', '')), '')
        ELSE v_project.description
      END;

      UPDATE public.projects
      SET name = v_new_name,
          description = v_new_description
      WHERE id = v_project.id
      RETURNING * INTO v_project;

      v_after := jsonb_build_object(
        'name', v_project.name,
        'code', v_project.code,
        'description', v_project.description,
        'source', 'orb-realtime'
      );
      v_receipt := jsonb_build_object(
        'kind', 'update_project',
        'receiptId', v_proposal.id::text,
        'code', v_project.code,
        'title', v_project.name,
        'project', v_project.name,
        'observedAt', v_observed_at,
        'source', 'database',
        'spokenText', format('Updated the project “%s”.', v_project.name)
      );

      INSERT INTO public.audit_log (action, table_name, record_id, before, after, actor, user_id, created_at)
      VALUES ('project_update', 'projects', v_project.id, v_before, v_after, 'orb', p_user_id, v_observed_at);
    ELSE
      DELETE FROM public.projects
      WHERE id = v_project.id;

      v_receipt := jsonb_build_object(
        'kind', 'delete_project',
        'receiptId', v_proposal.id::text,
        'code', v_project.code,
        'title', v_project.name,
        'project', v_project.name,
        'observedAt', v_observed_at,
        'source', 'database',
        'spokenText', format('Permanently deleted the project “%s” and all of its todos.', v_project.name)
      );

      INSERT INTO public.audit_log (action, table_name, record_id, before, actor, user_id, created_at)
      VALUES ('project_delete', 'projects', v_project.id, v_before, 'orb', p_user_id, v_observed_at);
    END IF;
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

REVOKE ALL ON FUNCTION public.confirm_realtime_project_mutation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_realtime_project_mutation(uuid, uuid) TO service_role;

-- One application entry point keeps confirmation generic while the stable todo
-- transaction and the project transaction remain independently reviewable.
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
  RETURN public.confirm_realtime_todo_mutation(p_proposal_id, p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_realtime_mutation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_realtime_mutation(uuid, uuid) TO service_role;
