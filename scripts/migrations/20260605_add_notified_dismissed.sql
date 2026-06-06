-- ORB-213: Add notified_dismissed flag for decline email deduplication
ALTER TABLE tickets ADD COLUMN notified_dismissed boolean NOT NULL DEFAULT false;
