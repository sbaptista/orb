-- ORB-325: durable proposal and exactly-once receipt boundary for Realtime voice mutations.

CREATE TABLE IF NOT EXISTS public.orb_realtime_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('create_todo')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 240),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'executed')),
  expires_at timestamptz NOT NULL,
  todo_id uuid REFERENCES public.todos(id) ON DELETE SET NULL,
  receipt jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz,
  CONSTRAINT orb_realtime_proposals_execution_shape CHECK (
    (status = 'proposed' AND todo_id IS NULL AND receipt IS NULL AND executed_at IS NULL)
    OR
    (status = 'executed' AND todo_id IS NOT NULL AND receipt IS NOT NULL AND executed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_orb_realtime_proposals_user_created
  ON public.orb_realtime_proposals (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orb_realtime_proposals_pending_expiry
  ON public.orb_realtime_proposals (expires_at)
  WHERE status = 'proposed';

ALTER TABLE public.orb_realtime_proposals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.orb_realtime_proposals FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orb_realtime_proposals TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_realtime_todo_create(
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
  v_todo public.todos%ROWTYPE;
  v_code text;
  v_receipt jsonb;
  v_observed_at timestamptz := clock_timestamp();
BEGIN
  SELECT * INTO v_proposal
  FROM public.orb_realtime_proposals
  WHERE id = p_proposal_id
  FOR UPDATE;

  IF NOT FOUND OR v_proposal.user_id <> p_user_id OR v_proposal.kind <> 'create_todo' THEN
    RAISE EXCEPTION 'Invalid proposal';
  END IF;

  IF v_proposal.status = 'executed' THEN
    RETURN jsonb_build_object('receipt', v_proposal.receipt, 'replayed', true);
  END IF;

  IF v_proposal.expires_at < now() THEN
    RAISE EXCEPTION 'Proposal expired';
  END IF;

  SELECT * INTO v_project
  FROM public.projects
  WHERE id = v_proposal.project_id
    AND deleted_at IS NULL
    AND is_dormant = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The proposed project is no longer available';
  END IF;

  SELECT role_id INTO v_role_id
  FROM public.users
  WHERE id = p_user_id;

  IF v_project.created_by <> p_user_id AND coalesce(v_role_id, 0) NOT IN (1, 3) THEN
    RAISE EXCEPTION 'The user cannot edit the proposed project';
  END IF;

  -- The existing todo-number trigger uses MAX(todo_number) + 1. Locking the
  -- project serializes Realtime creates in this project during allocation.
  INSERT INTO public.todos (product_id, title, status)
  VALUES (v_project.id, v_proposal.title, 'open')
  RETURNING * INTO v_todo;

  v_code := coalesce(v_project.code, '') || '-' || v_todo.todo_number::text;
  v_receipt := jsonb_build_object(
    'kind', 'create_todo',
    'receiptId', v_proposal.id::text,
    'code', v_code,
    'title', v_todo.title,
    'project', v_project.name,
    'observedAt', v_observed_at,
    'source', 'database',
    'spokenText', format('Created %s, “%s”, in %s.', v_code, v_todo.title, v_project.name)
  );

  INSERT INTO public.audit_log (
    action, table_name, record_id, after, actor, user_id, created_at
  ) VALUES (
    'todo_create', 'todos', v_todo.id,
    jsonb_build_object('code', v_code, 'title', v_todo.title, 'source', 'orb-realtime'),
    'orb', p_user_id, v_observed_at
  );

  UPDATE public.orb_realtime_proposals
  SET status = 'executed', todo_id = v_todo.id, receipt = v_receipt, executed_at = v_observed_at
  WHERE id = v_proposal.id;

  RETURN jsonb_build_object('receipt', v_receipt, 'replayed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_realtime_todo_create(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_realtime_todo_create(uuid, uuid) TO service_role;
