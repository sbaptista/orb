-- Store invitee details on the invitation so the user record
-- can be created automatically on acceptance (no create-account page needed).

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS role_id INTEGER DEFAULT 2;
