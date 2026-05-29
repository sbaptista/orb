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

**ORB-175 mobile list fix + ORB-153 passkey implementation (stashed) — 2026-05-28 (Session 31)**

### Tickets closed this session
- **ORB-175:** Prototype (iPhone) — actions now on same line as title. Wrapped title+ref in `div.tv-td-content-row` flex container inside the `<td>`, with `div.tv-td-content-inner` (flex:1, min-width:0) for title/ref and `tv-mobile-actions` (flex-shrink:0) for buttons. Title clamped to 1 line on mobile. Safari iOS gotcha: `display:flex` on a `<td>` does not work in WebKit — must use a wrapper div.

### ORB-153: Passkey auth — implemented but stashed
- All 5 phases built and compiling clean (client config, utility module, login page, settings page, enrollment interstitial).
- **Blocked by ORB-177** (staging environment) — cannot test passkey WebAuthn ceremony on production while alpha testers are using it. WebAuthn requires RP ID to match the origin domain, so localhost/IP testing is impossible.
- Code preserved on local branch `passkey-auth` (1 commit: `b4c0964`).
- Plan preserved in Stan's Downloads: `snoopy-zooming-manatee.md`.
- Supabase dashboard passkey config is enabled (RP ID: `orb-eight-lake.vercel.app`, origins: production URL).

### Other fixes
- `app/loading.tsx`: fixed duplicate `minHeight` property (TS error from previous session).

---

## Uncommitted Changes

- `package.json` — version bumped to 0.5.76 + Supabase SDK upgrade (supabase-js ^2.106.2, ssr ^0.10.3)
- `lib/version.ts` — v0.5.76
- `lib/changelog.ts` — v0.5.76 entry (loading indicator)
- `app/loading.tsx` — NEW: breathing orb loading indicator (minHeight fix applied)
- `app/globals.css` — ORB-175: mobile actions same line as title (tv-td-content-row, tv-td-content-inner)
- `components/UnifiedDashboard.tsx` — ORB-175: wrapper div structure for mobile flex layout
- `package-lock.json` — updated from SDK upgrade
- `.claude/settings.local.json` — modified

---

## Key Decisions

- **Passkey testing requires a staging environment.** WebAuthn RP ID must match the origin domain — can't test on localhost/IP. Can't test experimental features on production once alpha testers are using it. Staging env needed (ORB-177). *(2026-05-28)*
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

## Passkey Branch (`passkey-auth`)

Local branch with all ORB-153 implementation. Merge to main after ORB-177 (staging env) is set up and passkeys are tested.

**New files on branch:**
- `lib/passkey.ts` — utility module (isPasskeySupported, authenticateWithPasskey, registerPasskey, listPasskeys, renamePasskey, removePasskey)
- `app/auth/setup-passkey/page.tsx` — post-OTP enrollment interstitial
- `app/settings/passkeys/page.tsx` — settings route
- `components/settings/SettingsPasskeys.tsx` — passkey list/register/rename/delete UI

**Modified files on branch:**
- `lib/supabase/client.ts` — `auth.experimental.passkey: true`
- `app/auth/login/page.tsx` — passkey-first button + "or" divider + OTP below
- `app/auth/verify-otp/page.tsx` — conditional redirect to setup-passkey
- `components/settings/SettingsSidebar.tsx` — passkeys nav entry
- `components/settings/SettingsAccount.tsx` — "Manage Passkeys" card

---

## Next Priorities

1. **ORB-177: Set up staging environment.** Blocks ORB-153 passkey testing. Needs separate Vercel deployment with own WebAuthn RP ID config.
2. **ORB-153: Test and deploy passkey auth.** Code complete on `passkey-auth` branch. Merge after staging env is ready.
3. **Push v0.5.76** — loading indicator + SDK upgrade + ORB-175 fix. Ready to push (no passkey code included).
4. **ORB-169: Source file audit.** Parked — revisit once UnifiedDashboard replaces the old two dashboards.
5. **Test wake-from-sleep fixes** on production after push.
6. **Monitor Disk IO Budget** — Check Supabase Dashboard → Observability → Disk IO chart.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

---

## AI Tool Used Last Session

`2026-05-28 — Claude Code (Claude Opus 4.6)`

---

*Updated by AI at end of each session. Committed with session code changes.*
