# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app
- **Staging URL:** https://orb-staging-azure.vercel.app (deploys from `staging` branch)

---

## Last Session Completed

**UnifiedDashboard promotion, global AppNav, Disk IO fix — 2026-05-28/29 (Session 32)**

### Tickets progressed
- **ORB-173:** Pre-Alpha Checklist — wrote full definition (5 gates), assessed current status, produced Monday sprint plan. Work starts next session.

### What was done
- **v0.5.78:** Eliminated 60-second background polling interval from `useVisibilityRefetch`. Data now refreshes only on tab-focus and page-show. Dramatically reduces Supabase Disk IO (~15-20 queries/min → zero while idle). Purged 285 stale `auth.flow_state` rows (oldest from April). VACUUM'd bloated tables.
- **v0.5.79:** Promoted UnifiedDashboard as the main `/dashboard` view (split-pane Orb + task list with draggable divider). Created `AppNav` global navigation component — Print, Help, Settings, Account accessible from every page (dashboard, settings, account). Desktop: slim frosted bar. Mobile: compact commands button. Removed global nav from UnifiedDashboard command bar (now page-specific: Orb toggle, project search, list toggle only). Fixed breadcrumbs to start at "Settings" instead of "Dashboard" (AppNav handles that). Added `PARENT_CRUMBS` map so Knowledge page shows `Settings / Data / Knowledge`.
- Configured Vercel **orb** production project: Ignored Build Step → "Only build production" to prevent preview deploys queuing ahead of production.
- Saved Orb Conceptual Plan (Perplexity) to `docs/`.

### Version bumps
- v0.5.78: Disk IO fix (remove polling)
- v0.5.79: UnifiedDashboard + AppNav

### Pushed to production
- v0.5.79 pushed to both staging and production

---

## Uncommitted Changes

None — all changes committed and pushed.

---

## Key Decisions

- **Passkey testing only works on production.** WebAuthn RP ID must match origin domain. Staging URL differs, so passkey ceremony fails there. UI testing on staging is fine. Passkeys are admin-gated so alpha testers are unaffected. *(2026-05-28)*
- **Staging environment for pre-production testing.** Three tiers: localhost (fast iteration) → staging (verification on any device) → production (alpha testers). See AGENTS.md Environments section. *(2026-05-28)*
- **Safari iOS: display:flex on `<td>` does not work.** Same class of issue as the box-shadow border workaround. Use a wrapper div inside the td as the flex parent. Knowledge repo entry created. *(2026-05-28)*
- **Passkeys as primary auth, OTP as bootstrap/recovery.** No passwords ever. Users that don't support passkeys can't use the product. OTP remains for first login (after invitation) and device recovery. Interstitial enrollment prompt after first OTP login. *(2026-05-28)*
- **Supabase passkey API is experimental.** Requires `auth.experimental.passkey: true` in client config. Requires dashboard config: RP ID, RP Name, allowed origins. No Pro plan gate found. *(2026-05-28)*
- **Explicit DB grants + ALTER DEFAULT PRIVILEGES future-proof new tables.** Supabase will stop auto-exposing new public tables to the Data API on Oct 30, 2026. Migration `20260527_explicit_grants.sql` tightens existing grants and sets defaults so new tables created via psql get correct grants automatically. See knowledge repo entry for full details. *(2026-05-27)*
- **Server Actions called inside client-side background polling or mount effects require robust client-side error handling.** Otherwise, when a device wakes up from sleep or backgrounds/foregrounds while offline, the failing `fetch` call will throw an uncaught promise rejection that crashes the entire React application shell before OS offline detection can update the UI. *(2026-05-27)*
- **Zero-Row Project Switcher preserves iPhone real estate.** By integrating the switcher dropdown directly into the topbar title button and removing the project pill bar row, we save ~48px of vertical screen height on narrow devices. *(2026-05-26)*
- **OTP requests require client-side rate-limiting.** Because GoTrue does not automatically expire or delete abandoned `auth.flow_state` rows immediately, any public-facing sign-in path can trigger persistent write-bloat if users repeatedly request OTPs. Client-side cooldown is a simple, effective mitigation. *(2026-05-26)*
- **Orb needs space — cramped is a dealbreaker.** The prototype's 60/40 split makes the Orb feel squeezed. The spaciousness of AmbientDashboard is a feature. Next iteration must preserve that breathing room. *(2026-05-25)*
- **The Orb is a presence, not a chat box.** Any unified layout must keep the Orb visually dominant. Demoting it to a sidebar kills what makes the product distinctive. *(v0.5.56, 2026-05-25)*
- **Prototype direction for DashboardView:** Don't promote the list and demote the Orb. Instead, keep the Orb center stage (existing AmbientDashboard layout) and add a task list as a flyout panel that coexists with it. *(2026-05-25)*
- **iPhone-first table design.** TodoView table is designed mobile-first: actions collapse inline below title on iPhone, expand to their own column on desktop. No horizontal scrolling needed. *(v0.5.54, 2026-05-25)*
- **Box-shadow for iOS table row borders.** Safari iOS drops `border-bottom` on `<td>` even with `border-collapse: separate`. `box-shadow: inset 0 -1px 0 0` is the reliable cross-browser pattern. *(v0.5.54, 2026-05-25)*
- **No bulk edits in checklist mode.** Checklist is a quick tap-to-complete interface. Bulk operations belong in list view. *(v0.5.54, 2026-05-25)*
- **Background poll must not flash loading state.** `setLoading(true)` only on initial load, not on poll refetches. *(v0.5.54, 2026-05-25)*
- **60s poll interval is sufficient for single-user.** Reduced from 30s to halve query volume. *(v0.5.57, 2026-05-25)*
- **DB health is a first-class concern.** AGENTS.md now enforces design-time DB impact analysis and periodic health review for every session. *(2026-05-25)*
- **No Realtime subscriptions for single-user views.** `useVisibilityRefetch` is the correct pattern. *(ORB-132, 2026-05-25)*
- **Checklist mode is per-project, persists to DB.** `projects.view_mode` column. *(ORB-155)*
- **`query_db` replaces whack-a-mole filter additions.** Declarative JSON query format. RLS-scoped. 200-row cap.
- **Email is the stable identity, not auth UUID.**
- **Database is the source of truth — period.**
- **Single auth authority.** `getAuthContext()` / `requireAdmin()` in `lib/auth.ts`.
- **RLS is the safety net.** All new RLS policies use `(SELECT auth.uid())` wrapper.

---

## Prototype Files (isolated, safe to delete if direction changes)

| File | Purpose |
|---|---|
| `app/prototype/page.tsx` | Server component — auth gate, renders UnifiedDashboard |
| `components/UnifiedDashboard.tsx` | Client component — unified split-pane Orb + task list |
| `components/DragDivider.tsx` | Pointer-event draggable split divider with snap points |
| `components/UnifiedView.tsx` | (Old prototype) task list + OrbPanel side by side — superseded |
| `components/OrbPanel.tsx` | (Old prototype) standalone Orb conversation panel — superseded |
| `app/globals.css` (`.ud-*`, `.up-*` rules) | Scoped styles for unified dashboard |

---

## Next Priorities

1. **Pre-Alpha Sprint (ORB-173).** Monday target. Gate 4 (first impression) is the main gap — new-user empty state, onboarding clarity. Gates 1, 2, 5 largely done. Gate 3 (infrastructure) needs IO budget monitoring over next few days.
2. **Monitor Disk IO Budget** — Polling eliminated. Check Supabase Dashboard → Observability → Disk IO chart over next 48h to confirm budget stabilizes.
3. **ORB-169: Source file audit.** UnifiedDashboard is now primary — old AmbientDashboard and TodoView routes are orphaned. Good time to audit.
4. **Set up periodic `flow_state` cleanup** — pg_cron or edge function to prevent reaccumulation.
5. **Consider: make passkey enrollment prompt visible to non-admins** once feature is proven stable.
6. **Clean up `passkey-auth` branch** — can be deleted now that it's merged to main.
7. **Update `docs/ui-catalog.md`** with AppNav documentation.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made
- **Push to staging first** for pre-production testing before pushing to main/production

---

## AI Tool Used Last Session

`2026-05-29 — Claude Code (Claude Opus 4.6) — Session 32`

---

*Updated by AI at end of each session. Committed with session code changes.*
