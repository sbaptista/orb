# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app
- **Version:** 0.6.28

---

### Last Session Completed

**ORB-251 close + typography + metrics tokens — 2026-06-21 (Claude Code, Opus 4.6)**

1. Bumped nav bar label font size from `--fs-version` (11px) to `--fs-base` (15px) across all pages.
2. iPhone dashboard: two-bar nav — top bar centers Change Project, +Project, Menu, Account; second bar pins Orb (left) and List (right).
3. Added Typography & Text Styling section to `docs/ui-catalog.md` — font families, size tokens, weights, colors, line height, letter spacing, opacity, common patterns.
4. Orb Metrics: added input/output token columns, sortable headers, editable $/MTok rate fields with localStorage persistence, LLM cost estimate. Fixed DB RPC sort alias bug and removed stale overload.
5. Closed ORB-251 with resolution notes and Knowledge Repo entry `3ee86b10-a148-4a7b-8aa7-0fd1faa11089`.

### Uncommitted Changes

None after this release commit.

### Prior Session Context

**ORB-270: Responsive iPhone cards + Audit Log performance — 2026-06-21 (Codex, GPT-5)**

Standardized responsive collections, cursor pagination for Audit Log, mobile cards, modal scroll locking, Orb approval hardening (v0.6.19–v0.6.27).

**ORB-251: Voice mode build + latency optimization + debugging — 2026-06-19 (Claude Code, Opus 4.6)**

Two sessions combined. First built the full voice conversation mode (v0.6.16), then attempted latency optimizations and debugged TTS failures (v0.6.17).

**Voice mode (v0.6.16):**
1. Voice mode hook (`lib/hooks/useVoiceMode.ts`) — recognition, TTS, silence detection, voice selection, auto-resume. iOS-specific: non-continuous recognition with auto-restart, TTS primer, sentence-chunked TTS, debounced transcript state.
2. Continuous conversation flow — tap Orb to start, silence auto-submits, TTS auto-plays, mic auto-resumes.
3. Voice bar (`OrbConversation.tsx`) — replaces text input during voice mode. Three 44px SVG icon buttons with labels: Continue, Stop, End.
4. "Talk to Orb" in More menu — second entry point under Voice group header.
5. Orb visual states — teal/cyan while listening, warm gold while speaking, voice-mode ring.
6. Spoken acknowledgment — `speakBrief()` plays random phrase on submit before API response arrives.
7. Long response handling — prompt brevity threshold + client-side 500-char truncation.
8. Voice settings page (`app/settings/voice/`, `components/settings/SettingsVoice.tsx`).
9. Conversational voice control — `set_voice`, `exit_voice` in `lib/orb-contract.ts`.
10. Keyboard shortcut — ⌘ Shift O.
11. Help page — Voice topic with SVG icons for controls.
12. Guided tour — "Or just talk" step.
13. Eval cases — `voice-list-voices` (Tier 2), `voice-exit-command` (Tier 1).

**Latency & debugging (v0.6.17):**
1. Silence timeout reduced 2000ms → 1200ms.
2. Interim transcripts enabled (`interimResults: true`) for live partial text while speaking.
3. Prompt caching — system prompt split into stable (cached with `cache_control: ephemeral`) and dynamic blocks to reduce TTFT on consecutive turns.
4. Fixed stale closure bug — `onSend` callback used `voiceSendRef` indirection so `handleSubmit` always has current `voice.voiceActive` (was always `false` before, causing Orb to not know it was in voice mode).
5. Fixed Chrome cancel+speak bug — 80ms delay after `speechSynthesis.cancel()` before queuing new utterance.
6. `speakStreaming()` method added to hook (streams TTS sentence-by-sentence during LLM streaming) but NOT wired up — reverted auto-TTS to proven transition-detection pattern after stability issues.
7. Voice prototype page (`app/prototype/voice/page.tsx`) — minimal STT → API → TTS test page with debug logging, no hooks or Orb dependencies. Used to isolate browser-specific TTS issues.

**Critical finding:** Comet browser does not work reliably for voice. Exact cause unknown. Chrome and Safari both work. Stan will use Chrome/Safari/Edge for voice testing going forward.

**Not yet validated:** The full conversational voice flow (Orb hearing, responding, mic resuming) has NOT been tested end-to-end on any working browser. The prototype's TTS-only test works on Chrome/Safari, but the complete dashboard voice experience is unvalidated.

### Key Lesson

**Browser-specific TTS failures waste debugging time.** The entire voice pipeline appeared broken but the root cause was Comet browser's unreliable `speechSynthesis`. A minimal prototype page (`/prototype/voice`) with "Test TTS Only" button would have caught this in minutes instead of hours. Always isolate the browser layer first.

**Chrome cancel+speak bug:** `speechSynthesis.cancel()` followed immediately by `speechSynthesis.speak()` silently drops the new utterance. Must add a short delay (~80ms) between cancel and the next speak call.

**Stale closures in React effects with `[]` deps:** If a callback registered in a mount-only effect calls functions that read React state, those functions capture the initial render's values forever. Use ref indirection (`ref.current = latestFn`) to ensure the callback always uses current state.

---

### Not started

- **ORB-287:** Investigate dashboard background polling overhead.
- **ORB-265:** Full Audit of Orb Instructions.
- **ORB-254 remaining:** Blank User columns when filtering by date.

### Needs testing

- **Eval suite:** must run before production push — `NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/orb-eval.ts` — Tier 1 must be green.
- **iPhone two-bar nav:** Verify Orb/List bar renders correctly below the main nav on iPhone, and that desktop/iPad layout is unchanged.

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

1. **Run eval suite** — Tier 1 must be green before production push.
2. **ORB-287** — investigate dashboard background polling overhead.
3. **ORB-265** — full audit of Orb instructions.
4. **ORB-254 remaining** — blank User columns when filtering by date.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Never `git push` without Stan's explicit in-chat approval** — structural enforcement via settings.local.json
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

## AI Tool Used Last Session

`2026-06-21 — Claude Code (Opus 4.6)`

---

*Updated by AI at end of each session. Committed with session code changes.*
