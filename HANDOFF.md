# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app
- **Version:** 0.6.0

---

### Last Session Completed

**ORB-254: Audit the Audit Log — 2026-06-16 (Claude Code, Opus 4.6)**

Continued from prior Codex session. Major audit log toolbar redesign and persistent scroll detection fix.

**What was done:**

1. **Text search converted to modal pattern** — inline text search field replaced with a "Search by Text" button that opens a modal. Modal uses `<form onSubmit>` for native Enter-key submission. Same pattern applied to existing date search modal.

2. **Toolbar redesign** — three primary buttons: Search by Text, Search by Date, Reset. All render as `btn-primary` (green) regardless of filter state. Caption reads "Search by text, date, or both."

3. **Subtitle row ranges** — subtitle now shows "Rows N–M of P." instead of plain count.

4. **`externalSearchTerm` CrudList prop** — new config option allowing parent components to manage search state externally while CrudList handles the server request lifecycle.

5. **Scroll navigation arrow fix (root cause found)** — `useEffect` fires after React commit but before browser layout completes for newly mounted elements. `clientWidth`/`scrollWidth` returned 0. Fix: wrap all geometry reads in `requestAnimationFrame`. CSS containment approaches (`display: grid`, `contain: inline-size`) were all dead ends that broke visual styling. Entry written to knowledge_repo (`f98569de`).

6. **Table card borders restored** — reverted to original inline styles (`padding: 0; overflow: hidden` on s-card, `overflow-x: auto` on scroll container). No CSS class containment needed.

7. **Mobile version label** — version now appears at the end of the horizontal settings nav on iPhone, where the sidebar (and its version label) is hidden.

8. **Date range labels** — removed time component (mm/dd/yy only), added en-dash separator between stacked range labels.

### Uncommitted Changes

None. All changes committed and pushed as v0.6.0 (`89f1cac`).

---

### Key Files Modified This Session

- `components/settings/SettingsAudit.tsx` — modal search, toolbar buttons, subtitle, send icons
- `components/settings/SettingsCrudList.tsx` — `externalSearchTerm` prop, rAF scroll fix, subtitle callback extension
- `components/CollapsibleSidebar.tsx` — mobile version label at end of nav
- `app/globals.css` — `.cs-nav-version` mobile-only style, cleanup of removed CSS classes
- `lib/changelog.ts` — v0.6.0 entry
- `lib/version.ts` — v0.6.0
- `package.json` — v0.6.0

---

### Key Lesson

**useEffect scroll measurements can return 0** — `useEffect` runs after React's commit but sometimes before browser layout completes. Wrap geometry reads in `requestAnimationFrame`. CSS containment (`display: grid`, `contain: inline-size`) is not the fix and breaks visual styling. Diagnostic technique: render raw measurements to the UI to confirm timing vs CSS root cause. Full write-up in knowledge_repo entry `f98569de`.

---

### Not started

- **ORB-265:** Full Audit of Orb Instructions — Orb fabricates todo numbers and silently fails operations. Deferred until audit work is complete.
- **Blank User columns when filtering by date** — potential search reliability issue noticed during testing, not yet investigated.

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

**ORB-254: Audit toolbar polish — 2026-06-16 (Claude Code, Opus 4.6)**
- Inline date button, date-only range labels, scroll nav fix, mobile version label. Bumped to v0.6.0.

**ORB-254: Audit Log stages 1–3 + Stage 4 partial — 2026-06-15 (Codex, GPT-5)**
- System info collection, audit log completeness, Orb auto-tickets, table UX with sticky columns. v0.5.232.

**ORB-260, ORB-261, ORB-262 — Auth & Settings overhaul — 2026-06-13 (Claude Code, Opus 4.6)**
- Restored explicit passkey button on login. Stale passkey flows. Split compound Data page. Removed breadcrumbs. Passkey migration to Account page. Email change flow. v0.5.224.

**ORB-255 global filtering + ORB-252 repository inspection — 2026-06-12 (Codex)**
- Full-dataset filtering/sorting on Knowledge Repository and Audit Log. Repository access for Admin/Super Admin/Developer roles.

**ORB-196: Unified Toolbar + Modal Conformity — 2026-06-10 (Session 76, Claude Code)**
- Merged AppNav + CommandBar. SearchModal. Modal footer standardization. Empty states.

---

## Key Decisions

- **Unified toolbar: same 6 buttons on all screens.** No desktop/mobile split. Search is a modal trigger button (Linear Cmd+K pattern), not an inline input. Orb and List are paired edge buttons with accent color.
- **Modal conformity:** All modals use `modal-footer` with `justify-content: flex-end`. Cancel = `btn-cancel` (looks like text). Primary = `btn-primary` (green fill). Delete = `btn-danger` (red fill) with `marginRight: auto` (far left). X close button top-right.
- **Search modals use `<form onSubmit>`** — Enter key submits, cancel/clear buttons are `type="button"`, submit button is `type="submit"`. Reusable pattern for future modals.
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
- **Column resize removed.** Sticky columns + horizontal scroll replaces resize. `stickyColumns` is a per-table config on SettingsCrudList.
- **externalSearchTerm pattern:** Parent manages search UI (modals, buttons), CrudList handles data loading. Clean separation for complex search UIs.

---

## Next Priorities

1. **ORB-254 remaining** — investigate blank User columns when filtering by date. Continue visual testing across Mac, iPad, iPhone.
2. **ORB-265** — Full Audit of Orb Instructions (after audit work is done).

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Never `git push` without Stan's explicit in-chat approval** — structural enforcement via settings.local.json
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

## AI Tool Used Last Session

`2026-06-16 — Claude Code (Opus 4.6)`

---

*Updated by AI at end of each session. Committed with session code changes.*
