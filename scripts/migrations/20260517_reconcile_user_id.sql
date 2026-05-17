-- Atomic user ID reconciliation: migrates all FK references from old_id to new_id
-- Used by resolveUser() when Supabase auth replaces a user's UUID
CREATE OR REPLACE FUNCTION reconcile_user_id(old_id UUID, new_id UUID)
RETURNS VOID AS $$
DECLARE
  v_email TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_role_id INTEGER;
  v_onboarded_at TIMESTAMPTZ;
  v_created_at TIMESTAMPTZ;
BEGIN
  -- Capture old row data
  SELECT email, first_name, last_name, role_id, onboarded_at, created_at
    INTO v_email, v_first_name, v_last_name, v_role_id, v_onboarded_at, v_created_at
    FROM users WHERE id = old_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'No user found with id %', old_id;
  END IF;

  -- Clear old row's email to avoid unique constraint
  UPDATE users SET email = 'reconciling-' || old_id::TEXT WHERE id = old_id;

  -- Insert new row with current auth ID
  INSERT INTO users (id, email, first_name, last_name, role_id, onboarded_at, created_at, updated_at)
    VALUES (new_id, v_email, v_first_name, v_last_name, v_role_id, v_onboarded_at, v_created_at, NOW());

  -- Migrate FK references
  UPDATE projects SET created_by = new_id WHERE created_by = old_id;
  UPDATE invitations SET invited_by = new_id WHERE invited_by = old_id;
  UPDATE audit_log SET user_id = new_id WHERE user_id = old_id;

  -- Remove old row
  DELETE FROM users WHERE id = old_id;
END;
$$ LANGUAGE plpgsql;
