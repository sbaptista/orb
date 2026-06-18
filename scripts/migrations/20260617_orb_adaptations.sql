-- ORB-266: Orb Adaptations table
-- Already applied to production DB on 2026-06-17

CREATE TABLE IF NOT EXISTS orb_adaptations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  rule TEXT NOT NULL,
  rationale TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('communication', 'observation', 'coaching', 'workflow')),
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'active', 'rejected', 'retired')),
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE orb_adaptations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own adaptations"
  ON orb_adaptations FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Service role full access on orb_adaptations"
  ON orb_adaptations FOR ALL
  USING (true)
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orb_adaptations_user_status
  ON orb_adaptations (user_id, status);
