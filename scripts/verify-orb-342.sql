-- Transactional verification for ORB-342's canonical serial confirmation.
-- Every write is rolled back; ON_ERROR_STOP makes any failed assertion fatal.

BEGIN;

DO $$
DECLARE
  v_todo public.todos%ROWTYPE;
  v_project public.projects%ROWTYPE;
  v_user_id uuid;
  v_proposal_id uuid := gen_random_uuid();
  v_marker text := 'ORB-342 rollback verification';
  v_result jsonb;
  v_replay jsonb;
  v_description text;
  v_batch_proposal_id uuid := gen_random_uuid();
  v_batch_title text := 'ORB-342 rollback batch ' || substr(gen_random_uuid()::text, 1, 8);
  v_created public.todos%ROWTYPE;
  v_project_proposal_id uuid := gen_random_uuid();
  v_project_code text := 'Z' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_project_name text := 'ORB-342 rollback project ' || substr(gen_random_uuid()::text, 1, 8);
  v_knowledge_proposal_id uuid := gen_random_uuid();
  v_knowledge_update_id uuid := gen_random_uuid();
  v_knowledge public.knowledge_repo%ROWTYPE;
  v_knowledge_title text := 'ORB-342 rollback knowledge ' || substr(gen_random_uuid()::text, 1, 8);
BEGIN
  SELECT t.*
  INTO v_todo
  FROM public.todos t
  JOIN public.projects p ON p.id = t.product_id
  WHERE t.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND p.created_by IS NOT NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORB-342 verification needs one accessible todo';
  END IF;

  SELECT created_by INTO v_user_id
  FROM public.projects
  WHERE id = v_todo.product_id;

  INSERT INTO public.orb_realtime_proposals (
    id, user_id, project_id, kind, title, params, target_todo_id,
    channel, summary, expires_at
  ) VALUES (
    v_proposal_id,
    v_user_id,
    v_todo.product_id,
    'update_todo',
    v_todo.title,
    jsonb_build_object(
      'expected_updated_at', v_todo.updated_at,
      'expected_title', v_todo.title,
      'expected_status', v_todo.status,
      'expected_priority', v_todo.priority_value,
      'expected_product_id', v_todo.product_id,
      'expected_todo_number', v_todo.todo_number,
      'new_title', v_todo.title,
      'new_description', v_marker
    ),
    v_todo.id,
    'serial',
    'verify a canonical serial update',
    now() + interval '5 minutes'
  );

  v_result := public.confirm_realtime_mutation(v_proposal_id, v_user_id);
  IF coalesce((v_result->>'replayed')::boolean, true) THEN
    RAISE EXCEPTION 'First ORB-342 confirmation was incorrectly marked replayed';
  END IF;
  IF v_result->'receipt'->>'kind' <> 'update_todo' THEN
    RAISE EXCEPTION 'ORB-342 confirmation returned the wrong receipt: %', v_result;
  END IF;

  SELECT description INTO v_description
  FROM public.todos
  WHERE id = v_todo.id;
  IF v_description IS DISTINCT FROM v_marker THEN
    RAISE EXCEPTION 'Serial-only fields were not applied in the canonical transaction';
  END IF;

  v_replay := public.confirm_realtime_mutation(v_proposal_id, v_user_id);
  IF NOT coalesce((v_replay->>'replayed')::boolean, false) THEN
    RAISE EXCEPTION 'Second ORB-342 confirmation was not replay-safe';
  END IF;

  SELECT * INTO v_todo FROM public.todos WHERE id = v_todo.id;
  INSERT INTO public.orb_realtime_proposals (
    id, user_id, project_id, kind, title, params,
    channel, summary, expires_at
  ) VALUES (
    v_batch_proposal_id,
    v_user_id,
    v_todo.product_id,
    'batch_todo_action',
    'ORB-342 rich batch verification',
    jsonb_build_object(
      'operations',
      jsonb_build_array(
        jsonb_build_object(
          'action', 'create',
          'title', v_batch_title,
          'project_id', v_todo.product_id,
          'description', 'batch create metadata',
          'priority_value', 2
        ),
        jsonb_build_object(
          'action', 'update',
          'todo_id', v_todo.id,
          'expected_updated_at', v_todo.updated_at,
          'expected_title', v_todo.title,
          'expected_status', v_todo.status,
          'expected_priority', v_todo.priority_value,
          'expected_product_id', v_todo.product_id,
          'expected_todo_number', v_todo.todo_number,
          'new_title', v_todo.title,
          'new_description', 'batch update metadata'
        )
      )
    ),
    'serial',
    'verify a canonical rich batch',
    now() + interval '5 minutes'
  );

  v_result := public.confirm_realtime_mutation(v_batch_proposal_id, v_user_id);
  IF v_result->'receipt'->>'kind' <> 'batch_todo_action' THEN
    RAISE EXCEPTION 'ORB-342 batch returned the wrong receipt: %', v_result;
  END IF;
  SELECT * INTO v_created
  FROM public.todos
  WHERE product_id = v_todo.product_id
    AND title = v_batch_title;
  IF v_created.description IS DISTINCT FROM 'batch create metadata'
    OR v_created.priority_value IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Canonical batch create lost serial metadata';
  END IF;
  SELECT description INTO v_description FROM public.todos WHERE id = v_todo.id;
  IF v_description IS DISTINCT FROM 'batch update metadata' THEN
    RAISE EXCEPTION 'Canonical batch update lost serial metadata';
  END IF;
  v_replay := public.confirm_realtime_mutation(v_batch_proposal_id, v_user_id);
  IF NOT coalesce((v_replay->>'replayed')::boolean, false) THEN
    RAISE EXCEPTION 'ORB-342 batch confirmation was not replay-safe';
  END IF;

  INSERT INTO public.orb_realtime_proposals (
    id, user_id, kind, title, params, channel, summary, expires_at
  ) VALUES (
    v_project_proposal_id,
    v_user_id,
    'create_project',
    v_project_name,
    jsonb_build_object('candidate_code', v_project_code, 'description', 'rollback only'),
    'serial',
    'verify a canonical project create',
    now() + interval '5 minutes'
  );
  v_result := public.confirm_realtime_mutation(v_project_proposal_id, v_user_id);
  IF v_result->'receipt'->>'kind' <> 'create_project'
    OR v_result->'receipt'->>'code' <> v_project_code THEN
    RAISE EXCEPTION 'Canonical project confirmation returned the wrong receipt: %', v_result;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE created_by = v_user_id AND code = v_project_code AND name = v_project_name
  ) THEN
    RAISE EXCEPTION 'Canonical project create did not persist inside the transaction';
  END IF;

  INSERT INTO public.orb_realtime_proposals (
    id, user_id, project_id, kind, title, params, channel, summary, expires_at
  ) VALUES (
    v_knowledge_proposal_id,
    v_user_id,
    v_todo.product_id,
    'add_knowledge',
    v_knowledge_title,
    jsonb_build_object('content', '2026-07-29 — Orb (verification)' || E'\n\nrollback only', 'tags', jsonb_build_array('orb-342')),
    'serial',
    'verify a canonical knowledge save',
    now() + interval '5 minutes'
  );
  v_result := public.confirm_realtime_mutation(v_knowledge_proposal_id, v_user_id);
  IF v_result->'receipt'->>'kind' <> 'add_knowledge' THEN
    RAISE EXCEPTION 'Canonical knowledge create returned the wrong receipt: %', v_result;
  END IF;
  SELECT * INTO v_knowledge
  FROM public.knowledge_repo
  WHERE id = (v_result->'receipt'->>'knowledgeEntryId')::uuid;
  IF v_knowledge.title IS DISTINCT FROM v_knowledge_title THEN
    RAISE EXCEPTION 'Canonical knowledge create did not persist inside the transaction';
  END IF;

  INSERT INTO public.orb_realtime_proposals (
    id, user_id, project_id, kind, title, params, channel, summary, expires_at
  ) VALUES (
    v_knowledge_update_id,
    v_user_id,
    v_knowledge.product_id,
    'update_knowledge',
    v_knowledge.title,
    jsonb_build_object(
      'knowledge_id', v_knowledge.id,
      'expected_updated_at', v_knowledge.updated_at,
      'expected_title', v_knowledge.title,
      'expected_content', v_knowledge.content,
      'expected_product_id', v_knowledge.product_id,
      'expected_tags', v_knowledge.tags,
      'new_content', '2026-07-29 — Orb (verification)' || E'\n\nupdated rollback only'
    ),
    'serial',
    'verify a canonical knowledge update',
    now() + interval '5 minutes'
  );
  v_result := public.confirm_realtime_mutation(v_knowledge_update_id, v_user_id);
  IF v_result->'receipt'->>'kind' <> 'update_knowledge' THEN
    RAISE EXCEPTION 'Canonical knowledge update returned the wrong receipt: %', v_result;
  END IF;

  SELECT * INTO v_project
  FROM public.projects
  WHERE id = v_todo.product_id;
  RAISE NOTICE 'ORB-342 canonical confirmation verified with rollback on %-% in %',
    v_project.code, v_todo.todo_number, v_project.name;
END;
$$;

ROLLBACK;
