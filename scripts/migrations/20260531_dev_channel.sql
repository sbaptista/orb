-- Developer-to-Orb Communication Channel
-- Bidirectional message table for AI developer tools to communicate with the Orb.

CREATE TABLE dev_channel (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction       TEXT NOT NULL CHECK (direction IN ('dev_to_orb', 'orb_to_dev')),
  sender_label    TEXT NOT NULL,
  content         TEXT NOT NULL,
  product_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  session_summary TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'delivered', 'processed')),
  orb_response    TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at    TIMESTAMPTZ,
  processed_at    TIMESTAMPTZ
);

CREATE INDEX idx_dev_channel_status ON dev_channel (status) WHERE status = 'pending';
CREATE INDEX idx_dev_channel_product ON dev_channel (product_id);

-- RLS: admin-only access (same pattern as tickets table, ORB-131 initplan wrapper)
ALTER TABLE dev_channel ENABLE ROW LEVEL SECURITY;

CREATE POLICY dev_channel_admin_all ON dev_channel
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role_id IN (1, 3))
  );
