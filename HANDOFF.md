# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app
- **Version:** 0.6.64

---

### Last Session Completed

**ORB-293 closed — Voice Mode v2 + API TTS + Stop Reliability — 2026-06-25/26 (Codex, GPT-5)**

Completed and closed ORB-293. The final implementation is v0.6.64.

1. **TTS provider stack:** Voice settings now support browser, OpenAI, and ElevenLabs TTS through `orb_ai_policy`. TTS calls are recorded in the model request ledger with `voice_tts` source and rate-card cost estimates.
2. **Voice interaction model:** `Dictate` remains one-shot speech-to-text. `Talk to Orb` starts hands-free voice conversation. Green/yellow traffic lights are state indicators, red Stop is the escape key, and X exits voice mode.
3. **Streaming voice playback:** API TTS now speaks bounded sentence/chunk queues instead of waiting on long final synthesis. Long or lightly punctuated responses are split to keep latency tolerable.
4. **Stop reliability:** Stop uses `cancelSpeechRef`, `activeAudiosRef`, `speechGenerationRef`, `cancelledConversationRequestIdsRef`, and hard audio teardown. This prevents stale closures, in-flight API TTS replay, late stream chunks, and "green while old audio keeps talking" failures.
5. **Voice routing and accuracy:** Voice no longer forces the strategic/no-tools route. Project health answers get deterministic active/parked/closed summaries. TTS provider/model/voice are passed into Orb context so provider answers come from settings, not guesses.
6. **Voice epistemics:** Garbled transcripts now ask for clarification instead of filling in missing words. Strategic blocker/dependency language now requires explicit evidence; plausible sequencing remains allowed but must be labeled as judgment.
7. **Progress cues:** Slow voice responses can speak delayed progress cues from actual streamed work labels, not invented chain-of-thought.
8. **UI polish:** Removed the confusing pause-bars Orb state; the transient ready state uses the existing listening motif.

### Uncommitted Changes

Pending commit includes the ORB-293 voice work, AI settings/metrics work from ORB-265/294, dev-only login bypass, version/changelog updates through v0.6.64, and this handoff update.

### Known Issues

1. **Safari API TTS** — earlier primer approaches failed with NotAllowedError. If Safari still cannot play API TTS, use an AudioContext/decodeAudioData approach.
2. **Safari SpeechRecognition** — separate microphone permission issue may remain.
3. **Voice progress cues** — newly added and should be watched for helpfulness vs chatty behavior.

### Key Lesson

Voice mode needs an explicit state machine. Stop must invalidate audio generations, stream requests, queued speech, pending transcript timers, and UI streaming flags. Pausing the current audio element alone is not enough because API TTS can finish after Stop and replay into a green/listening microphone.

Strategic voice responses also need epistemic labels. Orb may make judgment calls, but dependencies/blockers require explicit task, audit, or knowledge evidence.

---

### Not started

- **ORB-292:** Design user-facing Value/Balanced/Deep Thinking modes, per-user allowances, and consent-based Orb tuning proposals.
- **ORB-287:** Investigate dashboard background polling overhead.
- **ORB-254 remaining:** Blank User columns when filtering by date.

---

### Prior Session Context

**ORB-293: TTS Provider Integration (OpenAI + ElevenLabs) — 2026-06-24 (Claude Code, Opus 4.6)**

1. Added TTS provider abstraction: browser (free), OpenAI ($15/1M chars), ElevenLabs ($66/1M chars). Provider/model/voice stored in `orb_ai_policy` DB singleton.
2. Created `lib/orb-model/tts.ts` with voice catalogs, API synthesis functions, and usage builder. Created `app/actions/orb-tts.ts` server action calling OpenAI/ElevenLabs APIs with cost instrumentation via `recordOrbModelRequest()`.
3. Extended `OrbAiPolicy` with `tts_provider`, `tts_model`, `tts_voice_id` columns. Migration `20260624_orb_tts.sql` ran successfully.
4. Rewrote `SettingsVoice.tsx` with card layout, 3 provider buttons opening modals, speed slider.
5. Bumped to v0.6.55 with changelog entry.

**ORB-265: Configurable AI model routing and cost controls — 2026-06-24 (Codex, GPT-5)**

1. Completed Haiku, Gemini, and Mistral evidence set. Added administrator-configurable role routing, rate cards, cost reconciliation, monthly/role budget gates, provider-and-role incident handling.
2. Added durable request-level telemetry. Final Tier 1 Orb evaluation passed 18/18.
3. Created ORB-292 for future user-facing AI modes.

**ORB-251 close + typography + metrics tokens — 2026-06-21 (Claude Code, Opus 4.6)**

1. Nav bar font size bump. iPhone two-bar nav. Typography catalog. Orb Metrics token columns. Closed ORB-251.

**ORB-270: Responsive iPhone cards + Audit Log performance — 2026-06-21 (Codex, GPT-5)**

Standardized responsive collections, cursor pagination for Audit Log, mobile cards, modal scroll locking, Orb approval hardening (v0.6.19–v0.6.27).

## Panel Transitions — Design Notes for Next AI

The orb panel and list panel currently use **conditional rendering** (mount/unmount) to show/hide. This means CSS transitions can't animate them — the element doesn't exist in the DOM before it appears.

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
- **Voice mode v2: traffic-light UI.** Green/Yellow are state indicators (not buttons). Red is always-interactive Stop. X exits voice mode. Voice input box matches text input dimensions. Orb shows state icons (sound waves, lightbulb) + thought progress. Blurred transcript behind. Client-side greeting on start. Single TTS path — zero speechSynthesis when API TTS configured.
- **Voice preferences in localStorage, not DB.** Browser voices differ per device — a DB column gives false portability. API TTS provider/model/voice stored in `orb_ai_policy` DB table.
- **Voice testing: Chrome/Safari/Edge only.** Comet is unreliable for speechSynthesis. Cause unknown.

---

## Next Priorities

1. **Test production voice mode after deploy** — Stop while speaking/thinking, green/listening recovery, provider answer, garbled transcript clarification, and progress cue feel.
2. **Safari API TTS** — if still failing, investigate AudioContext/decodeAudioData playback.
3. **ORB-292** — design user-facing Value/Balanced/Deep Thinking modes.
4. **ORB-287** — investigate dashboard background polling overhead.
5. **ORB-254 remaining** — blank User columns when filtering by date.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Never `git push` without Stan's explicit in-chat approval** — structural enforcement via settings.local.json
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

## AI Tool Used Last Session

`2026-06-25 — Codex (GPT-5)`

---

*Updated by AI at end of each session. Committed with session code changes.*
