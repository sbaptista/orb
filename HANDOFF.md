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

**ORB-196: Unified Toolbar Merge + SearchModal — 2026-06-10 (Session 76, Claude Code)**

### What was done

**Toolbar merge (ORB-196 — first priority):**
Merged AppNav + CommandBar (92px two-bar chrome) into a single ~48px unified toolbar. Same layout on ALL screens — no desktop/mobile split.

Layout: `[Orb] ··· [Search][+Project] | [More][Account] ··· [List]`

- **`components/AppNav.tsx`** — Complete rewrite. New props: `orbToggle`, `listToggle`, `onSearchProjects`, `onAddProject`. Removed old `children`/`mobileCommands` pattern. Commands modal contains Print/Help/Settings. Account is standalone (not inside Commands). Six buttons, same on every screen.
- **`components/UnifiedDashboard.tsx`** — Updated to pass new AppNav props. Orb/List toggles use `appnav-btn appnav-edge`. Dead code removed: `projectSearchQuery`, `blurTimeoutRef`, `adminSearchResults`, `handleSearchFocus`, `handleSearchBlur`. SearchModal wired to `adminProjects` data.
- **`app/globals.css`** — Replaced entire old appnav CSS block (appnav-left/right/desktop/mobile, nav-btn overrides, appnav-commands-btn, ud-cmd-btn) with new unified classes: `.appnav-btn` (vertical icon + label), `.appnav-btn-icon`, `.appnav-btn-label`, `.appnav-group` (pairs), `.appnav-spacer` (flex pushers), `.appnav-edge` (accent color for Orb/List), `.appnav-back` (horizontal back button). Mobile: spacers collapse, tighter padding. Removed stale mobile selectors (ud-panel-toggle, appnav-hide-mobile, tv-admin-search, ud-cmd-btn family).

**SearchModal (reusable component):**
- **`components/ui/SearchModal.tsx`** — NEW. Auto-focus input, keyboard nav (↑↓ Enter Esc), filtered results, highlight tracking with scroll-into-view, footer with keyboard hints. Designed for reuse across the app (Stan: "If this looks world class we may adopt it in many places").
- **SearchModal CSS** — Frosted overlay (blur + fade-in animation), slide-in modal, search icon + clear button, highlighted list items (`data-highlighted`), `<kbd>` styled keyboard hints in footer. All using CSS variables.

**Status:** TypeScript clean, lint clean (0 errors). **NOT YET TESTED** on any device — Stan needs to test on Mac, iPad, iPhone before committing.

### Uncommitted Changes

- `components/AppNav.tsx` — Complete rewrite with unified toolbar pattern
- `components/UnifiedDashboard.tsx` — Updated for new AppNav API + SearchModal integration
- `components/ui/SearchModal.tsx` — NEW reusable search/picker modal
- `app/globals.css` — New appnav-btn/group/spacer/edge CSS + SearchModal CSS, old selectors removed
- `docs/ui-catalog.md` — Updated (command bar → unified nav bar, z-index)
- `AGENTS.md` — Minor update
- `app/actions/dev-log.ts` — Antigravity artifact (untracked, can be deleted)
- `docs/Fix_Mobile_More_Dropdown.md` — Antigravity artifact (untracked, can be deleted)
- `docs/design-brief.md` — Design brief (untracked)

---

## Earlier Sessions

**CSS Variable Uniformity Sweep (ORB-237) + More Kebab Fix (ORB-236) — 2026-06-10 (Session 75, Claude Code)**
- ORB-236: Fixed kebab button with textareaRef focus + preventDefault pattern. Beautified More menu.
- ORB-237: Replaced ~300 hardcoded text values with CSS variables (font-size, weight, family, line-height, letter-spacing, opacity). Three-tier responsive scaling. 40 files changed.

**Mobile "More" Kebab Touch Fix (ORB-235) — 2026-06-09 (Session 74, Antigravity)**
- Attempted fix with delayed blur, handleTouchOrClick, document-level click-outside. Did not resolve the issue. Fixed in Session 75 by Claude Code.

**Table Improvements completion (ORB-233) — 2026-06-08 (Session 72, Claude Code)**
- Single-column resize fix, table card shrink-wrap, stale localStorage fix, priorities simplification, tickets overflow menu, table headings, standardized action columns, removed Order columns, invitations kebab, Audit Log on SettingsCrudList, iPad touch stability. v0.5.177–v0.5.184.

**Assisted Ticket Lifecycle Progression (ORB-190) — 2026-06-08 (Sessions 69-70, Antigravity)**
- Manual progression model, Settings UI warning systems, conversational Orb changes, eval suite test case. v0.5.174–v0.5.175.

---

## Key Decisions

- **Unified toolbar: same 6 buttons on all screens.** No desktop/mobile split. Search is a modal trigger button (Linear Cmd+K pattern), not an inline input. Orb and List are paired edge buttons with accent color.
- **SearchModal is a reusable pattern.** Designed for adoption across the app — project search is the first use case.
- **Git push is NEVER automatic.** Structural enforcement: `Bash(git push *)` removed from all project allowlists. Behavioral enforcement: shared AGENTS.md + project AGENTS.md + knowledge repo.
- **Disabled opacity normalized to 0.7** across the entire app (Stan's explicit preference).
- **Three-tier font scaling:** Desktop → Tablet (touch) → Phone. iPad was missing its own tier — now has intermediate bumps.
- **CSS variable categories:** `--fs-*` (font size), `--fw-*` (weight), `--font-*` (family), `--lh-*` (line height), `--ls-*` (letter spacing), `--opacity-*` (opacity), `--sp-*` (spacing). All text properties are now single-knob tunable.
- **Staging environment removed.** Two-tier workflow: localhost → production.
- **Orb identity: Brownie temperament, butler intelligence.**

---

## Next Priorities

1. **Test unified toolbar on all three platforms** (Mac, iPad, iPhone). Stan hasn't seen it yet — may need iteration.
2. **Version bump + changelog** once toolbar is approved and ready to commit.
3. **ORB-196 remaining pillars:** Table row padding (12→16px), designed empty states, panel transitions (200ms), filter presentation (pill toggles vs native select), loading state (skeleton shimmer).
4. **Clean up Antigravity artifacts.** Delete `app/actions/dev-log.ts` and `docs/Fix_Mobile_More_Dropdown.md`.
5. **ORB-192: Data privacy model.** Gates behavioral observation, internet research, Orb memory.
6. **ORB-226: User reordering of task lists.**

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Never `git push` without Stan's explicit in-chat approval** — structural enforcement via settings.local.json
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

## AI Tool Used Last Session

`2026-06-10 — Claude Code (Claude Opus 4.6) — Session 76`

---

*Updated by AI at end of each session. Committed with session code changes.*
