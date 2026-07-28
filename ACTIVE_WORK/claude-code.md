# Claude Code — Active Claims

Written only by Claude Code. Rules: `docs/multi-agent-concurrency-protocol.md`.

## Active Claims

- **2026-07-28 19:50** *(refreshed; 3.1 committed, continuing)*
  Surface: ORB-361 Phase 3 — 3.1 per-project urgency windows **done (v0.6.247)**; next 3.2 Help overhaul, 3.3 mood explanation, 3.4 no-reminder nudge
  Files: `scripts/migrations/20260728_orb_361_phase_3*.sql`, `lib/orb-state.ts`, `lib/projects.ts`, `app/actions/urgency-windows.ts`, `components/UnifiedDashboard.tsx`, `components/UrgencyWindowsModal.tsx`, `app/globals.css`, `lib/orb-model/context.ts`, `lib/orb-model/project-health.ts`, `components/OrbHelp.tsx`, `scripts/eval-cases.ts`, `docs/ui-catalog.md`, `docs/object-capability-matrix.md`
  Intent: ORB-361 Phase 3 per `docs/per-todo-due-time-and-reminders-plan.md` §9. **DB schema claim (§7, exclusive)** — adds `projects.urgency_windows jsonb` and later `todos.reminder_nudge_dismissed_at`. Working on branch `claude/orb-361-phase-3` per §4.
  Long-running: yes
