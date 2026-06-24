# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app
- **Version:** 0.6.53

---

### Last Session Completed

**ORB-265: Configurable AI model routing and cost controls — 2026-06-24 (Codex, GPT-5)**

1. Completed the Haiku, Gemini, and Mistral evidence set. Gemini 3.1 Pro Preview qualified for explicit strategic reads; Haiku remains the operational baseline; Mistral did not qualify for either production role.
2. Added administrator-configurable role routing in Settings > Orb AI, model catalog choices, rate cards, actual provider-cost reconciliation, monthly/role budget gates, and provider-and-role incident handling. The architecture is role-based, not permanently two-model.
3. Added durable request-level telemetry for provider, model, role, token/cache usage, latency, estimated cost, and response text. Evaluation traffic is excluded from live budget accounting.
4. Verified live Gemini strategic routing and Haiku operational/one-model routing. The final Tier 1 Orb evaluation passed **18/18** on 2026-06-24; TypeScript passed.
5. Fixed a Settings > Orb AI failed-action retry loop that could flood the UI with repeated error messages. Closed ORB-265 with resolution notes and Knowledge Repository entry `54590c36-111c-4023-ba6f-06768db71ebc`.
6. Corrected the historical-completion-claim evaluation fixture so it does not accidentally test the independent duplicate-search policy; the mutation-integrity assertion remains unchanged.
7. Created ORB-292 for future user-facing AI modes and Orb-proposed tuning, with explicit user consent required for changes.

### Uncommitted Changes

ORB-265 work is ready for the requested commit and push. The commit includes the routing, ledger, settings, evaluator, migrations, release notes, and this handoff. `WIP.md` is removed at final staging.

### Key Lesson

**Evaluate the complete integration, not model prose alone.** Model quality, native tool behavior, response-cap configuration, cost, latency, and checkpoint integrity are separate gates. Route by role rather than model name; the catalog can grow or collapse to one model without changing safety boundaries.

**Settings grouping:** Keep Orb-related pages together: Orb Memory, Orb Metrics, and Orb AI.

---

### Not started

- **ORB-292:** Design user-facing Value/Balanced/Deep Thinking modes, per-user allowances, and consent-based Orb tuning proposals.
- **ORB-287:** Investigate dashboard background polling overhead.
- **ORB-254 remaining:** Blank User columns when filtering by date.

### Needs testing

- **Full lint:** currently blocked by pre-existing errors in `app/prototype/voice/page.tsx` and the missing `react-compiler/react-compiler` rule referenced by `lib/hooks/useVoiceMode.ts`. Targeted lint for v0.6.29 changes passes.

---

### Prior Session Context

**ORB-251 close + typography + metrics tokens — 2026-06-21 (Claude Code, Opus 4.6)**

1. Bumped nav bar label font size from `--fs-version` (11px) to `--fs-base` (15px) across all pages.
2. iPhone dashboard: two-bar nav — top bar centers Change Project, +Project, Menu, Account; second bar pins Orb (left) and List (right).
3. Added Typography & Text Styling section to `docs/ui-catalog.md` — font families, size tokens, weights, colors, line height, letter spacing, opacity, common patterns.
4. Orb Metrics: added input/output token columns, sortable headers, editable $/MTok rate fields with localStorage persistence, LLM cost estimate. Fixed DB RPC sort alias bug and removed stale overload.
5. Closed ORB-251 with resolution notes and Knowledge Repo entry `3ee86b10-a148-4a7b-8aa7-0fd1faa11089`.

**ORB-270: Responsive iPhone cards + Audit Log performance — 2026-06-21 (Codex, GPT-5)**

Standardized responsive collections, cursor pagination for Audit Log, mobile cards, modal scroll locking, Orb approval hardening (v0.6.19–v0.6.27).

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

**ORB-266: Ghost in the Machine — 2026-06-18 (Codex, GPT-5)**
- Cross-session memory/voice, self-adaptation proposals, insight rendering, mutation integrity fix. v0.6.6.

**ORB-254: Audit the Audit Log — 2026-06-16 (Claude Code, Opus 4.6)**
- Modal search, toolbar redesign, scroll nav fix, mobile version label. Bumped to v0.6.0.

**ORB-254: Audit Log stages 1–3 + Stage 4 partial — 2026-06-15 (Codex, GPT-5)**
- System info collection, audit log completeness, Orb auto-tickets, table UX with sticky columns. v0.5.232.

**ORB-260, ORB-261, ORB-262 — Auth & Settings overhaul — 2026-06-13 (Claude Code, Opus 4.6)**
- Restored explicit passkey button on login. Stale passkey flows. Split compound Data page. Removed breadcrumbs. Passkey migration to Account page. Email change flow. v0.5.224.

---

## Key Decisions

- **Unified toolbar: same 6 buttons on all screens.** No desktop/mobile split. Search is a modal trigger button (Linear Cmd+K pattern), not an inline input. Orb and List are paired edge buttons with accent color.
- **Modal conformity:** All modals use `modal-footer` with `justify-content: flex-end`. Cancel = `btn-cancel` (looks like text). Primary = `btn-primary` (green fill). Delete = `btn-danger` (red fill) with `marginRight: auto` (far left). X close button top-right.
- **Search modals use `<form onSubmit>`** — Enter key submits, cancel/clear buttons are `type="button"`, submit button is `type="submit"`. Reusable pattern for future modals.
- **Modal keyboard shortcuts:** EditorModal owns Shift+Return = save and close, plus Escape/backdrop/X guarded dismissal. Plain Return is not intercepted. Search, command, and confirmation dialogs retain their own keyboard contracts.
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
- **Voice mode: continuous conversation, not walkie-talkie.** Tap Orb to start, silence auto-submits, TTS auto-plays, mic auto-resumes. Voice bar has three explicit buttons (Continue/Stop/End). Two entry points: Orb tap and "Talk to Orb" in More menu ("second door to the same room"). ⌘ Shift O keyboard shortcut.
- **Voice preferences in localStorage, not DB.** Browser voices differ per device — a DB column gives false portability.
- **Voice testing: Chrome/Safari/Edge only.** Comet is unreliable for speechSynthesis. Cause unknown.

---

## Next Priorities

1. **ORB-292** — design user-facing Value/Balanced/Deep Thinking modes, per-user allowances, and consent-based Orb tuning proposals.
2. **ORB-287** — investigate dashboard background polling overhead.
3. **ORB-254 remaining** — blank User columns when filtering by date.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Never `git push` without Stan's explicit in-chat approval** — structural enforcement via settings.local.json
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

## AI Tool Used Last Session

`2026-06-24 — Codex (GPT-5)`

---

*Updated by AI at end of each session. Committed with session code changes.*
