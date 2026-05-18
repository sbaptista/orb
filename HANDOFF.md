# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads this at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.4.80 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**Classic Editor Navigation Shortcut — 2026-05-18**

### Classic Editor Access Button
- Added a spreadsheet/table grid icon in `AmbientDashboard`'s top-right navigation section, positioned directly to the left of the Help button.
- If a project is selected, the icon routes to `/dashboard/${selectedId}` using a Next.js `Link`.
- If no project is selected (`noProject` is true), the button is disabled.
- Styled `nav-btn:disabled` in `app/globals.css` with lowered opacity (`0.35`), standard `not-allowed` cursor, and disabled pointer events to cleanly "gray out" the element.

---

## Uncommitted Changes

- `components/AmbientDashboard.tsx` — Add Classic Editor link/disabled button
- `app/globals.css` — Styling for disabled nav-btn
- `scripts/add-classic-editor-knowledge.ts` — Knowledge repo entry script
- `package.json` — v0.4.80
- `lib/version.ts` — v0.4.80
- `HANDOFF.md` — this update

---

## Key Decisions

*   **Email is the stable identity, not auth UUID.** Supabase can replace auth UUIDs on invite/re-invite. All user lookups now go through `resolveUser()` which queries by email first.
*   **Atomic ID reconciliation via Postgres function.** Supabase JS client can't do multi-statement transactions, so FK migration uses a server-side `reconcile_user_id()` function called via `rpc()`.
*   **Shared project access is read+create for users, full access for admins.** Prevents invited users from modifying/deleting feedback they didn't create, while still allowing them to contribute.
*   **Lazy SDK initialization in server actions.** Module-scope SDK constructors crash Vercel function chunks when env vars are missing. Always use lazy getClient() pattern.
*   **Shared projects survive user deletion.** Reassigned to super admin in application code before CASCADE fires. Business rule kept in server action, not DB trigger.
*   **SettingsCrudList for complex tables only.** Statuses and Priorities (short fixed lists) don't need sorting/search/bulk — keep them simple.

---

## Next Priorities

1.  **ORB-105 remaining items** — bulk edits for Priorities and Statuses were deemed overkill; review if any other sub-items remain.
2.  **Monitor production** — verify Settings > Users and Projects pages work correctly after deploy.
3.  **Test cascade delete** — delete a test user and confirm shared projects survive, non-shared projects cascade.

---

## AI Tool Used Last Session

`2026-05-18 — Antigravity (Gemini 3 Flash)`

---

*Updated by AI at end of each session. Committed with session code changes.*
