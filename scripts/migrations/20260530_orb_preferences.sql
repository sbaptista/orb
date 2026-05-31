-- ORB-186 Phase 2: Per-user Orb preferences
-- Stores calibrations like guidance_level, verbosity, scope_reminders.
-- The Orb reads these at context-build time and writes them conversationally.

CREATE TABLE IF NOT EXISTS orb_preferences (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key        text NOT NULL,
  value      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);

-- RLS: users can only read/write their own preferences
ALTER TABLE orb_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences"
  ON orb_preferences
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Index for context-build lookup
CREATE INDEX idx_orb_preferences_user ON orb_preferences (user_id);

-- Grants for Data API access
GRANT SELECT, INSERT, UPDATE, DELETE ON orb_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON orb_preferences TO service_role;
