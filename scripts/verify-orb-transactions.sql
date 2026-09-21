-- Optional MODEL-FREE integration checks. Not a migration or production script.
-- Requires a locally hosted disposable database named orb_interaction_test,
-- the complete current Orb schema/migrations, and at least one synthetic user.
-- Disable outbound notification integrations in that database before use.
-- Run as its test owner. All row changes roll back; identity sequences may advance.
-- Does not establish multi-connection concurrency or device/audio correctness.
BEGIN;
DO $$
DECLARE
  actor uuid;
  conversation uuid := gen_random_uuid();
  request_event uuid := gen_random_uuid();
  approve_event uuid := gen_random_uuid();
  approve_turn uuid := gen_random_uuid();
  batch uuid := gen_random_uuid();
  replacement uuid := gen_random_uuid();
  proposal uuid := gen_random_uuid();
  code text := 'T' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 9));
  title text := 'Offline fixture ' || gen_random_uuid()::text;
  commands jsonb;
  result jsonb;
  replay jsonb;
  refused boolean;
BEGIN
  IF current_database() <> 'orb_interaction_test'
     OR (inet_server_addr() IS NOT NULL AND inet_server_addr() NOT IN ('127.0.0.1'::inet, '::1'::inet)) THEN
    RAISE EXCEPTION 'Refusing: use only the local disposable orb_interaction_test database';
  END IF;
  SELECT id INTO actor FROM public.users ORDER BY id LIMIT 1;
  IF actor IS NULL THEN RAISE EXCEPTION 'Create a synthetic user in the disposable fixture first'; END IF;

  INSERT INTO public.orb_conversations(id, user_id, status, closed_at)
    VALUES (conversation, actor, 'closed', now());
  INSERT INTO public.orb_conversation_events(id, conversation_id, user_id, turn_id, actor, event_type, modality, visibility, payload)
    VALUES (request_event, conversation, actor, gen_random_uuid(), 'user', 'user_message', 'text', 'visible', '{"text":"Create fixture"}');
  INSERT INTO public.orb_conversation_events(id, conversation_id, user_id, turn_id, actor, event_type, modality, visibility, payload)
    VALUES (approve_event, conversation, actor, approve_turn, 'user', 'user_message', 'voice', 'visible', '{"text":"yes"}');
  commands := jsonb_build_array(jsonb_build_object(
    'proposal_id', proposal, 'tool_use_id', 'create-fixture', 'kind', 'create_project',
    'title', title, 'summary', 'create fixture', 'params', jsonb_build_object('candidate_code', code)));
  PERFORM public.prepare_orb_command_batch(batch, actor, conversation, request_event, 'text', 'create fixture', now() + interval '30 minutes', commands);

  refused := false;
  BEGIN PERFORM public.confirm_orb_command_batch(batch, actor, request_event);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Confirmation requires a distinct later user turn' THEN RAISE; END IF;
    refused := true;
  END;
  IF NOT refused THEN RAISE EXCEPTION 'Same-turn confirmation was accepted'; END IF;

  refused := false;
  BEGIN PERFORM public.confirm_orb_command_batch(batch, gen_random_uuid(), approve_event);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Invalid command batch' THEN RAISE; END IF;
    refused := true;
  END;
  IF NOT refused THEN RAISE EXCEPTION 'Wrong actor was accepted'; END IF;

  INSERT INTO public.orb_conversation_events(conversation_id, user_id, turn_id, actor, event_type, modality, visibility, payload)
    VALUES (conversation, actor, approve_turn, 'system', 'interrupt', 'voice', 'control', '{"reason":"stop"}');
  refused := false;
  BEGIN PERFORM public.confirm_orb_command_batch(batch, actor, approve_event);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Confirmation turn was interrupted before commit' THEN RAISE; END IF;
    refused := true;
  END;
  IF NOT refused THEN RAISE EXCEPTION 'Stop-before-commit was ignored'; END IF;
  DELETE FROM public.orb_conversation_events WHERE conversation_id = conversation AND event_type = 'interrupt';

  UPDATE public.orb_command_batches SET expires_at = now() - interval '1 second' WHERE id = batch;
  refused := false;
  BEGIN PERFORM public.confirm_orb_command_batch(batch, actor, approve_event);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Command batch expired' THEN RAISE; END IF;
    refused := true;
  END;
  IF NOT refused THEN RAISE EXCEPTION 'Expired batch was accepted'; END IF;
  UPDATE public.orb_command_batches SET expires_at = now() + interval '30 minutes' WHERE id = batch;

  -- Acoustic interruption is not a cancellation. Cross-modal approval executes.
  INSERT INTO public.orb_conversation_events(conversation_id, user_id, turn_id, actor, event_type, modality, visibility, payload)
    VALUES (conversation, actor, approve_turn, 'system', 'interrupt', 'voice', 'control', '{"reason":"barge_in"}');
  result := public.confirm_orb_command_batch(batch, actor, approve_event);
  replay := public.confirm_orb_command_batch(batch, actor, approve_event);
  IF result->'receipt' IS NULL OR replay->'receipt' IS DISTINCT FROM result->'receipt'
     OR replay->>'replayed' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Receipt replay changed or disappeared';
  END IF;
  IF (SELECT count(*) FROM public.projects WHERE name = title AND created_by = actor) <> 1 THEN
    RAISE EXCEPTION 'Repeated confirmation did not produce exactly one fixture row';
  END IF;

  -- The second command deliberately fails; the first command must roll back too.
  batch := gen_random_uuid();
  title := 'Rollback fixture ' || gen_random_uuid()::text;
  commands := jsonb_build_array(
    jsonb_build_object('proposal_id', gen_random_uuid(), 'tool_use_id', 'first', 'kind', 'create_project',
      'title', title, 'summary', 'first', 'params', jsonb_build_object('candidate_code', 'R' || substr(code, 2))),
    jsonb_build_object('proposal_id', gen_random_uuid(), 'tool_use_id', 'second', 'kind', 'create_project',
      'title', title || ' invalid', 'summary', 'second', 'params', jsonb_build_object('candidate_code', '!invalid')));
  PERFORM public.prepare_orb_command_batch(batch, actor, conversation, request_event, 'text', 'rollback fixture', now() + interval '30 minutes', commands);
  refused := false;
  BEGIN PERFORM public.confirm_orb_command_batch(batch, actor, approve_event);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'The proposed project code is invalid' THEN RAISE; END IF;
    refused := true;
  END;
  IF NOT refused OR EXISTS (SELECT 1 FROM public.projects WHERE name = title AND created_by = actor)
     OR EXISTS (SELECT 1 FROM public.orb_command_batches WHERE id = batch AND receipt IS NOT NULL) THEN
    RAISE EXCEPTION 'Batch failure left a partial mutation or receipt';
  END IF;

  -- A replacement invalidates authorization of the old version.
  commands := jsonb_set(commands, '{0,proposal_id}', to_jsonb(gen_random_uuid()));
  commands := jsonb_set(commands, '{1,proposal_id}', to_jsonb(gen_random_uuid()));
  PERFORM public.prepare_orb_command_batch(replacement, actor, conversation, request_event, 'text', 'replacement', now() + interval '30 minutes', commands);
  refused := false;
  BEGIN PERFORM public.confirm_orb_command_batch(batch, actor, approve_event);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Command batch is no longer pending' THEN RAISE; END IF;
    refused := true;
  END;
  IF NOT refused THEN RAISE EXCEPTION 'Superseded batch was accepted'; END IF;
  RAISE NOTICE 'Model-free transaction checks passed; fixture row changes will roll back.';
END;
$$;
ROLLBACK;
