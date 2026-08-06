-- knowledge_repo.updated_at never advanced: the table was created without the
-- BEFORE UPDATE trigger that users, todos, tickets, projects, priorities,
-- platforms, groups, and categories all carry, so updated_at has always been a
-- copy of created_at. Every hand-edited entry -- including supersede banners --
-- looked untouched since creation, and anything sorting by "recently changed"
-- was reading a column that never changed.
--
-- Follows the established per-table pattern from 20260525_tickets_table.sql
-- (set_<table>_updated_at + <table>_updated_at), not a shared function.
--
-- No index or read-path change. One BEFORE UPDATE row trigger assigning a
-- single column; write cost is negligible and this table is low-write.
--
-- Scope is deliberately knowledge_repo only. Seven other tables share the gap
-- (orb_ai_funding_pools, orb_ai_policy, orb_financial_descriptor_rules,
-- orb_financial_transactions, orb_memory, orb_preferences, system_settings)
-- and are left alone by decision, not oversight.

BEGIN;

CREATE OR REPLACE FUNCTION set_knowledge_repo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_repo_updated_at
  BEFORE UPDATE ON public.knowledge_repo
  FOR EACH ROW EXECUTE FUNCTION set_knowledge_repo_updated_at();

COMMIT;
