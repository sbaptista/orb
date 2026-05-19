-- Fix leaky audit_log SELECT policy.
-- Old policy: any authenticated user sees all rows.
-- New policy: admins see all, non-admins see only their own rows.

DROP POLICY IF EXISTS "audit_log: select own" ON audit_log;

CREATE POLICY "audit_log: select own" ON audit_log FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role_id IN (1, 3)  -- admin, super admin
    )
  );
