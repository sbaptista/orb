-- Drop the tickets table — feedback is now stored as todos in the TICKETS project.
-- All existing ticket data was migrated to the TICKETS project before this migration.
-- The orb_friction table remains (separate concern — raw friction/issue logs from users).

DROP TABLE IF EXISTS tickets;
