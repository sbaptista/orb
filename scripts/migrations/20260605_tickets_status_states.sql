-- ORB-213: Support new ticket statuses (pending, awaiting_input, pending_release, pending_verification, deferred, on_hold) and add resolution/override columns
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public' 
          AND rel.relname = 'tickets' 
          AND con.contype = 'c' 
          AND con.conname LIKE '%status%'
    ) LOOP
        EXECUTE 'ALTER TABLE tickets DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE tickets ADD CONSTRAINT tickets_status_check CHECK (status IN (
  'open', 'in_progress', 'pending', 'awaiting_input', 'pending_release', 'pending_verification', 'on_hold', 'deferred', 'closed', 'dismissed'
));

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS version TEXT;
