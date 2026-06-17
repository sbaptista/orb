-- ORB-266: Cross-session memory for the Orb AI companion
-- Stores observations, patterns, and user-confirmed memories across sessions.
-- Two tracks: autonomous (Orb grows silently) and offered (user confirms).

CREATE TABLE IF NOT EXISTS orb_memory (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track      text NOT NULL CHECK (track IN ('autonomous', 'offered')),
  category   text NOT NULL CHECK (category IN ('pattern', 'rhythm', 'preference', 'emotional', 'milestone')),
  content    text NOT NULL,
  context    text,
  confidence integer DEFAULT 1 CHECK (confidence BETWEEN 1 AND 5),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orb_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own memories"
  ON orb_memory
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE INDEX idx_orb_memory_user_cat ON orb_memory (user_id, category);
CREATE INDEX idx_orb_memory_user_expires ON orb_memory (user_id, expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON orb_memory TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON orb_memory TO service_role;
