# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.5.34 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**ORB-155, ORB-156, ORB-148 (plan) — 2026-05-25 (Session 20)**

### ORB-155 — Checklist Mode (v0.5.33, shipped)
- Added `view_mode TEXT DEFAULT 'list'` column to `projects` table via `scripts/migrations/20260525_project_view_mode.sql`
- `TodoView.tsx`: toggle button in toolbar switches between list and checklist skin; mode persists to DB; open items first, closed below with strikethrough; tap circle to complete/reopen, tap label to open detail
- Checklist rows show todo ref (e.g. `ORB-155`) as muted sub-label
- `app/globals.css`: `.tv-checklist`, `.tv-cl-row`, `.tv-cl-check`, `.tv-cl-label` styles added
- Help text updated in `OrbHelp.tsx` (List & Checklist section)

### ORB-156 — Smooth Orb Mode Transition (v0.5.34, shipped)
- Root cause: `transform-origin` snaps instantly when `data-mode` changes on `.dash-orb-wrap`, causing a jarring visual jump
- Fix: `orbFading` state + `isFirstRender` ref in `AmbientDashboard.tsx`; on every `conversationActive` toggle, sets `opacity: 0` (0.35s ease), holds 400ms, fades back in — snap occurs under opacity 0
- Both `orbFading` state and `orbFadeRef` timer cleanup added; skips initial mount via `isFirstRender`

### ORB-148 — Dedicated Ticketing System (IN PROGRESS — plan drafted, awaiting approval)
- Decision: replace the todos-in-TICKETS-project approach with a proper two-layer system (Zendesk/Jira pattern)
- **Implementation plan saved at:** `/Users/stanleybaptista/.gemini/antigravity/brain/127a1ebd-b820-4b5a-ab76-68a651038cae/implementation_plan.md`
- See **Next Priorities** below for open questions to resolve before starting

---

## ORB-148 Implementation Plan Summary

The full plan is at the path above. Key points:

**New `tickets` table** — replaces todos-in-Tickets-project:
- Fields: `ticket_number`, `type`, `source`, `summary`, `detail`, `conversation_snippet`, `reported_by UUID → users`, `status` (open/in_progress/closed/dismissed), `dismiss_reason`, `todo_id UUID → todos`, `notified_in_progress`, `notified_closed`

**New `ticket_id UUID` column on `todos`** — the coordination link

**Status propagation:** when a linked todo changes status → ticket status updates → reporter gets push + email notification (with dedup via `notified_*` flags)

**New server actions in `ticket-actions.ts`:** `updateTicketStatus`, `createTodoFromTicket`, `dismissTicket`, `getTickets`

**Admin UI:** `components/settings/SettingsTickets.tsx` — table of all tickets, "Create todo" button (links to project), "Dismiss" button

**Migration:** one-time script migrates existing TICKETS todos → `tickets` table; Tickets project goes dormant

**Open questions before starting:**
1. Email to reporters at launch, or push-only?
2. Dismiss status (with reason) — yes or no?
3. Should the Orb AI get an `update_ticket` tool, or only affect tickets via the linked todo?

---

## Uncommitted Changes

All changes from this session are committed and pushed. No local-only state.

---

## Key Decisions

- **Dedicated `tickets` table replaces TICKETS project todos.** The TICKETS project approach conflated external-facing reporter experience with internal work tracking. A two-layer model (tickets + todos linked by `ticket_id` FK) is the correct architecture. Migration will preserve all existing ticket data. *(Decision reached ORB-148 planning, 2026-05-25)*
- **Checklist mode is per-project, persists to DB.** `projects.view_mode` column drives it. *(ORB-155, 2026-05-25)*
- **Orb mode transition uses opacity fade, not CSS-only.** `transform-origin` is not animatable in CSS; opacity fade via React state is the correct workaround. *(ORB-156, 2026-05-25)*
- **Persist conversation transcript across page transitions.** Previously, `AmbientDashboard` completely cleared `SS_CONVERSATION` on mount. Reading from `sessionStorage` on mount preserves context. *(ORB-154)*
- **`query_db` replaces whack-a-mole filter additions.** Declarative JSON query format with table allowlist, filter array, select, order, limit. RLS-scoped. 200-row cap.
- **Keep `query_todos` for simple lookups.** `query_db` supplements it for complex/structural questions.
- **Shift top-right navigation instead of hiding.** Hiding the navigation buttons in dialogue mode degrades UX.
- **Email is the stable identity, not auth UUID.** Supabase can replace auth UUIDs on invite/re-invite.
- **Atomic ID reconciliation via Postgres function.** Supabase JS client can't do multi-statement transactions.
- **Lazy SDK initialization in server actions.** Module-scope SDK constructors crash Vercel function chunks.
- **Insight engine is zero-cost.** Pure computation on server — no AI calls.
- **Single source of truth for dormancy filtering.** `visibleProjectsQuery()` in `lib/projects.ts`.
- **Single source of truth for status classification.** `lib/status-groups.ts` — ACTIVE (open + in progress), PARKED (deferred + on hold).
- **Database is the source of truth — period.** No silent scoping, no in-memory divergence.
- **Single auth authority.** `getAuthContext()` / `requireAdmin()` in `lib/auth.ts`. Exceptions: `complete-onboarding.ts`, `friction-actions.ts` / `ticket-actions.ts` (system-level), REST API routes.
- **RLS is the safety net.** Regular Supabase client for user operations, admin client only for intentional cross-user access.
- **Print is browser-native window.print().** No jspdf/html2canvas dependencies.

---

## Next Priorities

1. **ORB-148** — Dedicated ticketing system. Implementation plan drafted and awaiting Stan's approval on 3 open questions (email at launch? dismiss status? Orb `update_ticket` tool?). Plan at `/Users/stanleybaptista/.gemini/antigravity/brain/127a1ebd-b820-4b5a-ab76-68a651038cae/implementation_plan.md`.
2. **ORB-132** — Verify RLS initplan fix impact on Supabase disk I/O budget.
3. **JSON export/import** — second offboarding path (complement to print/PDF).
4. **iPhone update flow retest** — Stan deleted Home Screen PWA and will test UpdateBanner on next version bump.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing

---

## AI Tool Used Last Session

`2026-05-25 — Antigravity (Claude Sonnet 4.6)`

---

*Updated by AI at end of each session. Committed with session code changes.*
