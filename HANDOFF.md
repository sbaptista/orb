# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**Table conformity, passkey domain gate, UI polish, Orb self-awareness — 2026-05-30 (Session 33)**

### Tickets closed
- **ORB-174:** Hide passkey UI on non-production domains (v0.5.80)
- **ORB-179:** Table conformity rework — modal edit, HScrollNav, bulk actions, Users/Invitations migrated to SettingsCrudList (v0.5.81)
- **ORB-182:** Knowledge Repo and Audit Log promoted to own settings pages
- **ORB-183:** Account initial in circle, Commands label on mobile, unified icon label CSS
- **ORB-184:** Check for Update button in What's New + Orb capability
- **ORB-185:** Orb urgency rules added to system prompt (root cause was overdue due date, not priority)

### What was done
- **v0.5.80:** `isPasskeyAvailable()` domain check — hides passkey UI on localhost/staging
- **v0.5.81:** All settings tables share SettingsCrudList. Floating modal edit. HScrollNav (desktop: flanking arrows, mobile: above table). Row click triggers edit. Bulk dismiss for Tickets, bulk delete for Audit Log. Responsive grid-2col.
- **v0.5.82:** Account avatar circle, Commands label, Check for Update, Knowledge/Audit own pages, Orb urgency rules, staging removal
- Removed staging environment from development workflow (WebAuthn RP ID prevents passkey testing on staging)
- Created ORB-186 analysis plan: `docs/orb-186-plan.md` — adaptive Orb identity, per-user preferences, proactive guidance
- Created ORB-180: investigate soft-delete strategy and data retention

### Version bumps
- v0.5.80 → v0.5.81 → v0.5.82

### Pushed to production
- v0.5.80 pushed
- v0.5.81 pushed to staging only (awaiting production push with v0.5.82)

---

## Uncommitted Changes

None — all changes committed and pushed.

---

## Key Decisions

- **Staging environment removed.** WebAuthn RP ID is bound to the production domain — staging can't test passkeys. Two-tier workflow: localhost → production. *(2026-05-30, supersedes 2026-05-28)*
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

1. **ORB-186: Adaptive Orb identity.** Plan in `docs/orb-186-plan.md`. Phase 1 (prompt architecture) is next — separate principles / domain knowledge / behavioral guidelines. Then Phase 2 (per-user preferences).
2. **ORB-173: Pre-Alpha Checklist.** Overdue (due 2026-05-29). Gate 4 (first impression) is the main gap.
3. **ORB-169: Source file audit.** UnifiedDashboard is now primary — old AmbientDashboard and TodoView routes are orphaned.
4. **ORB-180: Investigate soft-delete strategy and data retention.**
5. **Update `docs/ui-catalog.md`** with AppNav, nav-avatar, crud-table-scroll, modal edit patterns.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

---

## AI Tool Used Last Session

`2026-05-30 — Claude Code (Claude Opus 4.6) — Session 33`

---

*Updated by AI at end of each session. Committed with session code changes.*
