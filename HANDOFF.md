# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

### Last Session Completed

**ORB-260, ORB-261, ORB-262 — Auth & Settings overhaul — 2026-06-13 (Claude Code, Opus 4.6)**

### What was done

1. **ORB-261 (Re-examine Login):** Restored explicit passkey button on login page. Fixed stale passkey flows — delete now signs user out and redirects through a dedicated re-registration page (`/auth/passkey-removed` → `/auth/passkey-reregister`) with email pre-filled. Warning (amber) styling on delete UI. Actionable error messages for stale passkeys. Closed.

2. **ORB-260 (Simplify Settings):** Split compound Data page into separate Backup and Archive sidebar entries. Removed entire breadcrumb system (SettingsTopbar, Breadcrumbs, BreadcrumbOverridesProvider). Added inline back links on admin detail sub-pages. Closed.

3. **ORB-262 (Migrate passkeys to Account page):** Moved passkey management from Settings sidebar to the Account page (conditionally rendered when `isPasskeyAvailable()`). Built full email change flow:
   - `app/actions/change-email.ts` — server action using admin API for instant email change (no confirmation email), syncs users/invitations tables, deletes all webauthn factors, logs audit event.
   - `ChangeEmailModal` — guided modal with current email read-only, new email input, validation, contextual guidance text. Calls server action, refreshes session in place, redirects to passkey setup.
   - No sign-out or OTP needed — session refreshes via `supabase.auth.refreshSession()` and PasskeyGate handles re-registration.
   - Setup-passkey page shows contextual messaging ("Your email was changed and your old passkey was removed") when arriving from email change.
   - Fixed Supabase MFA `deleteFactor` param (`factorId` → `id`) in both `change-email.ts` and `auth/callback/route.ts`.
   Closed.

4. **Other:** Removed 30-second polling from SystemStateProvider. Added 60-second cache to /api/version. Unified topbar to AppNav (ORB-259). Removed version labels from all pages (ORB-258).

### Key Files Changed

- `app/actions/change-email.ts` — NEW: instant email change server action
- `app/auth/callback/route.ts` — email_change handler + MFA param fix
- `app/auth/passkey-removed/page.tsx` — explanation page after passkey deletion
- `app/auth/passkey-reregister/page.tsx` — email-only login for re-registration
- `app/auth/setup-passkey/page.tsx` — contextual messaging from email change
- `app/settings/backup/page.tsx` — NEW: standalone Backup page
- `app/settings/archive/page.tsx` — NEW: standalone Archive page
- `components/settings/ChangeEmailModal.tsx` — rewritten for admin API flow
- `components/settings/SettingsAccount.tsx` — Account page with passkeys + email change
- `components/settings/SettingsPasskeys.tsx` — embeddable cards, delete with sign-out
- `components/settings/SettingsSidebar.tsx` — Backup/Archive entries, passkeys removed
- `components/settings/SettingsBackup.tsx` — NEW
- `components/settings/SettingsArchive.tsx` — NEW
- `components/SystemStateProvider.tsx` — removed polling
- `app/api/version/route.ts` — 60s cache

### Deleted Files

- `app/settings/data/page.tsx`, `app/settings/passkeys/page.tsx`
- `components/settings/SettingsData.tsx`, `components/settings/SettingsTopbar.tsx`
- `components/ui/Breadcrumbs.tsx`, `lib/hooks/useBreadcrumbOverrides.tsx`

### Closed Todos This Session

- **ORB-258** — Remove version labels from pages
- **ORB-259** — Topbar consistency
- **ORB-260** — Simplify Settings
- **ORB-261** — Re-examine Login
- **ORB-262** — Migrate passkeys to user account page

### Verification

- `npx tsc --noEmit` — passes
- Production tested: email change flow, passkey deletion, re-registration all working
- Version: v0.5.224

### Key Lesson

When changing a user's email via admin API, don't sign them out and make them OTP back in — just refresh the session in place with `supabase.auth.refreshSession()`. The OTP path creates conflicting auth state and "expired" errors. Also: browser passkey credentials persist after server-side deletion — users must manually remove them from their device's Passwords app before re-registering.

---

## Panel Transitions — Design Notes for Next AI

The orb panel and list panel currently use **conditional rendering** (mount/unmount) to show/hide. This means CSS transitions can't animate them — the element doesn't exist in the DOM before it appears.

**Current pattern** (UnifiedDashboard.tsx):
```
{showOrb && <OrbConversation ... />}
{showList && <div className="ud-list-content">...</div>}
```

**To add transitions, the next AI needs to:**
1. Keep both panels always mounted in the DOM
2. Use CSS classes to control visibility (`opacity`, `transform`, `pointer-events`)
3. Toggle a class like `panel--visible` / `panel--hidden` instead of conditional rendering
4. Add CSS transitions (~200ms) for the opacity/transform change
5. Use `pointer-events: none` on hidden panels to prevent interaction
6. Consider: hidden panels still run effects/subscriptions — may need to gate data fetching behind visibility state to avoid unnecessary API calls

**Complexity:** Medium-high. The panels have state (conversation history, scroll position) that benefits from staying mounted. But they also have polling/subscriptions that shouldn't run when hidden. Test on all three platforms — the resize handle between panels also needs to work correctly with always-mounted panels.

---

## Earlier Sessions

**ORB-255 global filtering + ORB-252 repository inspection — 2026-06-12 (Codex)**
- Full-dataset filtering/sorting on Knowledge Repository and Audit Log. Repository access for Admin/Super Admin/Developer roles. Developer role migration. Orb processing recovery fix. General UI ambiguity behavior.

**ORB-196: Unified Toolbar + Modal Conformity — 2026-06-10 (Session 76, Claude Code)**
- Merged AppNav + CommandBar into single unified toolbar. SearchModal component. Modal footer standardization. Empty states with OrbMini illustration. "Ask Orb" text consistency.

**CSS Variable Uniformity Sweep (ORB-237) + More Kebab Fix (ORB-236) — 2026-06-10 (Session 75, Claude Code)**
- ORB-236: Fixed kebab button with textareaRef focus + preventDefault pattern. Beautified More menu.
- ORB-237: Replaced ~300 hardcoded text values with CSS variables. Three-tier responsive scaling. 40 files changed.

**Table Improvements completion (ORB-233) — 2026-06-08 (Session 72, Claude Code)**
- Single-column resize fix, table card shrink-wrap, stale localStorage fix, priorities simplification, tickets overflow menu, table headings, standardized action columns, removed Order columns, invitations kebab, Audit Log on SettingsCrudList, iPad touch stability. v0.5.177–v0.5.184.

---

## Key Decisions

- **Unified toolbar: same 6 buttons on all screens.** No desktop/mobile split. Search is a modal trigger button (Linear Cmd+K pattern), not an inline input. Orb and List are paired edge buttons with accent color.
- **Modal conformity:** All modals use `modal-footer` with `justify-content: flex-end`. Cancel = `btn-cancel` (looks like text). Primary = `btn-primary` (green fill). Delete = `btn-danger` (red fill) with `marginRight: auto` (far left). X close button top-right.
- **Filter presentation:** Kebab menus, not native selects or pills. Consistent with commands rule: styled dropdown triggered by a button. Accessibility contract: menu/menuitemradio pattern with keyboard support.
- **Accessibility hardening boundary:** No redesign unless a real contrast/motion failure is found. Prefer visible titles and labels as accessible names; attach destructive confirmation text to the final destructive action.
- **Resize divider behavior:** Do not snap the divider back to preset ratios after drag. Persist the exact user-selected position; use a 40px coarse-pointer gutter on iPad/touch.
- **Project switcher language:** The dashboard project selector is "Change Project", not "Search"; `SearchModal` remains reusable with a default title of "Search".
- **Empty states:** OrbMini SVG illustration + message. 5 variants. "Ask Orb" not "Ask the Orb".
- **Loading states:** Skeleton shimmer rows, never bare "Loading…" text.
- **Git push is NEVER automatic.** Structural enforcement via settings.local.json.
- **Disabled opacity normalized to 0.7** across the entire app.
- **Three-tier font scaling:** Desktop → Tablet (touch) → Phone.
- **Staging environment removed.** Two-tier workflow: localhost → production.
- **Orb identity: Brownie temperament, butler intelligence.**
- **Email change: instant via admin API.** No confirmation email, no sign-out. Session refreshes in place, PasskeyGate handles re-registration.

---

## Next Priorities

1. Review open backlog for next work items.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Never `git push` without Stan's explicit in-chat approval** — structural enforcement via settings.local.json
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

## AI Tool Used Last Session

`2026-06-13 — Claude Code (Opus 4.6)`

---

*Updated by AI at end of each session. Committed with session code changes.*
