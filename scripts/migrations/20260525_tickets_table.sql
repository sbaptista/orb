-- ORB-148: Dedicated tickets table
-- Replaces the todos-in-TICKETS-project approach with a proper two-layer model.

CREATE TABLE tickets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number         INTEGER NOT NULL,
  type                  TEXT NOT NULL CHECK (type IN ('bug', 'suggestion', 'capability_gap', 'workflow_friction')),
  source                TEXT NOT NULL CHECK (source IN ('orb-auto', 'user-request', 'admin')),
  summary               TEXT NOT NULL,
  detail                JSONB DEFAULT '{}',
  conversation_snippet  TEXT,
  reported_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'in_progress', 'closed', 'dismissed')),
  dismiss_reason        TEXT,
  todo_id               UUID REFERENCES todos(id) ON DELETE SET NULL,
  notified_in_progress  BOOLEAN NOT NULL DEFAULT FALSE,
  notified_closed       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at             TIMESTAMPTZ
);

-- Add ticket_id FK on todos (the coordination link)
ALTER TABLE todos
  ADD COLUMN ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL;

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION set_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION set_tickets_updated_at();

-- RLS
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Admins (role_id 1 or 3) can do everything
-- Uses (SELECT auth.uid()) wrapper to prevent per-row initplan evaluation (ORB-131 pattern)
CREATE POLICY tickets_admin_all ON tickets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role_id IN (1, 3))
  );

-- Reporters can only read their own tickets
CREATE POLICY tickets_reporter_select ON tickets
  FOR SELECT USING (reported_by = (SELECT auth.uid()));

-- Indexes: cover RLS lookups and the todo→ticket status propagation join
CREATE INDEX IF NOT EXISTS idx_tickets_reported_by ON tickets (reported_by);
CREATE INDEX IF NOT EXISTS idx_tickets_todo_id ON tickets (todo_id);
CREATE INDEX IF NOT EXISTS idx_todos_ticket_id ON todos (ticket_id) WHERE ticket_id IS NOT NULL;
