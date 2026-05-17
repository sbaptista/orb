-- Invitations table: tracks invite lifecycle (pending → accepted / declined).
-- Separate from users — an invitee may already be a user (e.g. tester cohort invite).

CREATE TABLE IF NOT EXISTS public.invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  release_stage TEXT NOT NULL DEFAULT 'pre-alpha',
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'declined')),
  invited_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  invited_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at  TIMESTAMPTZ,
  decline_reason TEXT
);

-- Index for quick lookups by email and status
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);

-- RLS: admin-only access
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access" ON public.invitations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role_id >= 1
    )
  );
