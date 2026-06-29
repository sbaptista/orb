-- Mutation Reliability Rework: server-held pending mutation store.
-- Implements the propose -> confirm -> execute flow (see WIP.md).
-- A gated mutation tool PROPOSES (resolve target, write one pending row);
-- a separate confirm step EXECUTES the stored intent exactly once.
--
-- Server-only: written and read solely by the orb-converse server action via
-- the service role. The browser never touches it, so there is deliberately NO
-- `authenticated` grant -- the pending store is invisible to clients.
-- RLS is enabled as defense-in-depth.

CREATE TABLE IF NOT EXISTS orb_pending_mutations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool        text NOT NULL,
  target_id   uuid,                                  -- resolved entity id; NULL for creates. Polymorphic (project/todo) so no FK; re-validated at execute time.
  params      jsonb NOT NULL DEFAULT '{}'::jsonb,    -- full resolved intent
  summary     text NOT NULL,                         -- human-readable proposal text (re-narration / audit)
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  UNIQUE (user_id)                                   -- one active pending per user; a new proposal supersedes via upsert
);

-- RLS: defense-in-depth. Access is service-role-only, but scope every row to its owner anyway.
ALTER TABLE orb_pending_mutations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pending mutations"
  ON orb_pending_mutations
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- The UNIQUE (user_id) constraint already provides the lookup index (lookup is by user_id).
-- Server-only table: grant to service_role exclusively. No `authenticated` grant by design.
GRANT SELECT, INSERT, UPDATE, DELETE ON orb_pending_mutations TO service_role;
