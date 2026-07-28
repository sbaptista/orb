-- ORB-361 Phase 3 — urgency windows gain units (hours/days/weeks/months)
--
-- Follows 20260728_orb_361_urgency_windows.sql, which stored bare hour counts.
-- Stan asked for the same value+unit control the reminder field already uses,
-- so "3 days" is stated as three days rather than as 72 hours — and so a window
-- can be expressed in months at all.
--
-- Shape changes from:
--   {"2": {"runway_hours": 72, "imminent_hours": 24}}
-- to:
--   {"2": {"runway": {"value": 3, "unit": "days"},
--          "imminent": {"value": 1, "unit": "days"}}}
--
-- **No data migration is needed or performed.** The previous shape existed only
-- on Stan's local branch and never reached production; at the time of writing
-- every projects.urgency_windows is NULL. parseUrgencyWindows() still reads the
-- old shape as an equivalent hours lead regardless, so any row written by the
-- interim build keeps working and is rewritten in the new shape on its next
-- save. That is belt-and-braces, not a migration path to rely on.
--
-- The CHECK constraint is unchanged — it only guarantees "object or NULL", and
-- full shape validation remains server-side in parseUrgencyWindows().
--
-- Months are CALENDAR months wherever this value is used: isDueWithinLead()
-- resolves them through reminderTriggerInstant(), the same day-clamping rule
-- reminders use (due Jul 31, one month before -> Jun 30). A 30-day
-- approximation would make the urgency control and the reminder control
-- disagree about what "1 month" means.
--
-- Idempotent: this migration only replaces a column comment.

COMMENT ON COLUMN public.projects.urgency_windows IS
  'ORB-361 Phase 3. Per-priority urgency windows overriding lib/orb-state.ts DEFAULT_URGENCY_WINDOWS. NULL = use defaults (never a copy of them). Shape {"<priority value>": {"runway": {"value": int 0-99, "unit": hours|days|weeks|months}, "imminent": {...}}}. Months are calendar months (day-clamped). Validated server-side by parseUrgencyWindows(); never written from client-supplied JSON. The pre-release {"runway_hours": int} shape is still read for compatibility.';

-- Verification (run manually after applying):
--   SELECT code, urgency_windows FROM public.projects WHERE urgency_windows IS NOT NULL;
--   \d+ public.projects
