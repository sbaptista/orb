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

**ORB-175 + ORB-153 + ORB-177 — passkey auth, mobile list fix, staging environment — 2026-05-28 (Session 31)**

### Tickets closed this session
- **ORB-175:** Mobile list view actions on same line as title. Safari iOS flex-on-td workaround — `div.tv-td-content-row` flex container inside the `<td>`. Title clamped to 1 line.
- **ORB-153:** Passkey authentication (admin-only). All 5 phases: client config, utility module (`lib/passkey.ts`), login page (passkey-first + OTP fallback), Settings > Passkeys (admin-gated), post-OTP enrollment interstitial. Tested on production: register, delete, re-register, sign out + sign in with passkey — all working.
- **ORB-177:** Staging environment. `orb-staging-azure.vercel.app` deploys from `staging` branch. Same Supabase instance. AGENTS.md updated with three-tier environment docs and deployment workflow.

### Version bumps
- v0.5.76: Loading indicator (app/loading.tsx) — from previous session
- v0.5.77: Passkey auth, ORB-175 mobile fix, staging env

### Pushed to production
- v0.5.77 pushed to both staging and production

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

1. **ORB-169: Source file audit.** Parked — revisit once UnifiedDashboard replaces the old two dashboards.
2. **Test wake-from-sleep fixes** on production after push.
3. **Monitor Disk IO Budget** — Check Supabase Dashboard → Observability → Disk IO chart.
4. **Consider: make passkey enrollment prompt visible to non-admins** once feature is proven stable.
5. **Clean up `passkey-auth` branch** — can be deleted now that it's merged to main.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made
- **Push to staging first** for pre-production testing before pushing to main/production

---

## AI Tool Used Last Session

`2026-05-28 — Claude Code (Claude Opus 4.6)`

---

*Updated by AI at end of each session. Committed with session code changes.*
