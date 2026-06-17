# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app
- **Version:** 0.6.1

---

### Last Session Completed

**ORB-266: Ghost in the Machine — 2026-06-17 (Claude Code, Opus 4.6)**

Full implementation of cross-session memory and voice personality with adjustable openness.

**What was done:**

1. **Cross-session memory** — `orb_memory` table (migration already applied), `save_memory` and `recall_memories` tools wired into Orb conversation loop, memory loaded into system prompt context, behavioral protocol governing when/how memories are saved (autonomous vs offered tracks).

2. **Voice personality** — replaced static `ORB_VOICE`, `ORB_FEEDBACK_TONE`, `ORB_PROACTIVE_TONE` constants with `buildVoicePrompt(openness)`, `buildFeedbackTonePrompt(openness)`, `buildProactiveTonePrompt(openness)`. One personality at three volumes: reserved/natural/open.

3. **New preference keys** — `openness` (reserved/natural/open) and `memory_level` (off/session/full) added to `VALID_PREFERENCE_KEYS`.

4. **Settings > Orb Memory** — table UI using SettingsCrudList with `hideAdd` (new prop). Users can view, edit, search, and delete memories. Bulk delete supported.

5. **CrudList improvements** — `hideAdd` prop, `btn-danger-outline` CSS class for bulk delete, toolbar `maxWidth` constrained to `tableMinWidth` for narrower tables.

6. **Eval cases** — 2 new Tier 1 cases (memory-save-offered, memory-recall). Full suite: **Tier 1: 10/10 green**.

7. **Version bumped to v0.6.1** — changelog, version.ts, package.json.

### Uncommitted Changes

- `lib/orb-prompt.ts` — voice functions, memory tools, memory prompt, preference keys
- `lib/orb-contract.ts` — save_memory/recall_memories tool labels
- `app/actions/orb-converse.ts` — memory loading, tool handlers, voice/memory wiring
- `app/actions/dev-channel.ts` — updated ORB_VOICE → buildVoicePrompt import
- `app/api/orb-eval/route.ts` — same import updates, memory tools/prompts added
- `app/actions/get-memory-entries.ts` — NEW: server action for memory CRUD
- `components/settings/SettingsMemory.tsx` — NEW: memory settings page
- `app/settings/memory/page.tsx` — NEW: route
- `components/settings/SettingsSidebar.tsx` — Orb Memory nav entry
- `components/settings/SettingsCrudList.tsx` — hideAdd prop, btn-danger-outline, toolbar maxWidth
- `app/globals.css` — btn-danger-outline class
- `docs/ui-catalog.md` — btn-danger-outline documented
- `scripts/eval-cases.ts` — 2 new Tier 1 cases
- `scripts/migrations/20260617_orb_memory.sql` — NEW (already applied to DB)
- `lib/changelog.ts` — v0.6.1 entry
- `lib/version.ts` — v0.6.1
- `package.json` — v0.6.1
- `WIP.md` — detailed status file (delete at commit time)

---

### Key Lesson

**CrudList table width alignment** — When a CrudList table uses pixel column widths and is narrower than the viewport, the toolbar (search + scroll controls) extends wider than the table. Fix: set `maxWidth` on the toolbar div to `tableMinWidth + selectionColumnWidth`. The table itself must keep `width` + `minWidth` + `tableLayout: fixed` (established in ORB-233) — removing `width` breaks the Audit Log table. Knowledge repo entry `93b80281` documents the original table width fix.

---

### Not started

- **ORB-265:** Full Audit of Orb Instructions — Orb fabricates todo numbers and silently fails operations.
- **ORB-254 remaining:** Blank User columns when filtering by date.

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

**ORB-254: Audit the Audit Log — 2026-06-16 (Claude Code, Opus 4.6)**
- Modal search, toolbar redesign, scroll nav fix, mobile version label. Bumped to v0.6.0.

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
- **Voice personality: one personality at three volumes** (reserved/natural/open), not three different characters. Adjustable via `openness` preference.
- **Two-track memory model:** autonomous (Orb saves silently after 2+ observations) and offered (user confirms before saving). All memories visible in Settings > Orb Memory.
- **CrudList toolbar maxWidth:** When table uses pixel column widths, toolbar maxWidth is constrained to tableMinWidth so controls align with the table edge.

---

## Next Priorities

1. **ORB-266 testing** — test memory + voice on all three platforms (Mac, iPad, iPhone). Verify Audit Log table not broken by toolbar maxWidth change.
2. **ORB-265** — Full Audit of Orb Instructions.
3. **ORB-254 remaining** — blank User columns when filtering by date.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Never `git push` without Stan's explicit in-chat approval** — structural enforcement via settings.local.json
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

## AI Tool Used Last Session

`2026-06-17 — Claude Code (Opus 4.6)`

---

*Updated by AI at end of each session. Committed with session code changes.*
