# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app
- **Version:** 0.6.105

---

### Last Session Completed

**Release Coherency + Manual Update Recovery — 2026-06-30 (Codex, GPT-5) — v0.6.104**

Stan's directive: fix the broader release/update problem that affects both development and production. Users should never have to clear browser data, switch tabs, or guess whether the app silently changed under them after a deploy or local dev-server restart.

**Core contract:** Orb may detect that a newer server version or restarted local dev process exists, but it must not present itself as running that new state until the user explicitly applies the update/reconnect.

**What changed:**
- **Next 16 build warning cleanup:** follow-up v0.6.105 migrated `middleware.ts` to `proxy.ts`/`proxy()` and aligned `outputFileTracingRoot` with `turbopack.root` using `process.cwd()`, removing the production build warnings Stan saw after v0.6.104.
- **Central release coordinator:** `SystemStateProvider` owns server/client version state, polls `/api/version` while visible, and exposes one `applyUpdate` path for visible and conversational update actions.
- **Pinned running client version:** the mounted app shell pins `clientVersion` once. Version labels, Settings update checks, and What's New use that pinned value so Fast Refresh/HMR cannot make the app look upgraded before approval.
- **Production update detection:** production can only show the update banner for a real server/client version mismatch. `/api/version` returns `serverBootId: null` outside development.
- **Development restart detection:** local Next/Turbopack restarts are detected with a development-only `serverBootId`. The banner says `Dev only: reconnect to the restarted local server` and the button says `Reconnect`, avoiding production-style update language.
- **Manual-only apply:** automatic reload was removed after mobile testing showed it undermines trust. The app detects automatically, but reloads only when the user taps Update/Reconnect or explicitly applies an update.
- **Scoped state clearing:** `applyUpdate` clears only version-sensitive session state (`todos_orb_input`, `todos_orb_conversation`, `todos_orb_action_sets`) and preserves auth, durable settings, voice preferences, and layout preferences.
- **Push-only service worker lifecycle:** `public/sw.js` now uses `skipWaiting`/`clients.claim` while still avoiding any fetch handler or app asset cache.
- **What's New coherency:** Settings filters the changelog to the pinned running version, labels it `Installed`, and does not present newer release entries as installed before approval.
- **Dev-channel hardening:** the admin developer-channel poll pauses during update/restart recovery and on stale server-action response errors so it does not fire server actions into a rebooting dev server.

**Tracking todo and knowledge:**
- Closed **ORB-300 — Release coherency and automatic update recovery** with server-verified `closed_at`.
- Added linked knowledge entry `Release coherency and manual update recovery contract` (`6d3e884c-0b15-4934-86cf-aa88e5910ce4`).
- Checked related knowledge. `Helm version update system — update banner, changelog, What's New sheet, and SW dev guard` is adjacent prior art, not superseded.

### Changes in this commit (v0.6.99–v0.6.105)

Key files:
- `components/SystemStateProvider.tsx` — release coordinator, pinned client version, update reason, manual apply path, scoped session clearing.
- `app/api/version/route.ts` — no-store version endpoint now includes development-only `serverBootId`.
- `components/UpdateBanner.tsx` — reason-specific copy for real version updates vs dev-only reconnects.
- `components/ui/OrbVersionLabel.tsx` — displays pinned running client version.
- `components/settings/SettingsWhatsNew.tsx` — filters changelog to the installed/running version and uses the shared manual update path.
- `components/UnifiedDashboard.tsx` — conversational check/apply update actions use the release coordinator; dev-channel polling backs off during restart recovery.
- `public/sw.js` — push-only service worker lifecycle update.
- `middleware.ts` → `proxy.ts`, `next.config.ts` — Next 16 proxy convention and aligned build roots.
- `lib/changelog.ts`, `lib/version.ts`, `package.json` — release entries and version bump through v0.6.105.

### Verification Status

- `npx tsc --noEmit` passed.
- Focused ESLint on touched files passed with only existing `UnifiedDashboard` warnings.
- `git diff --check` passed.
- `npm run build` passed after v0.6.105 cleanup; the prior `outputFileTracingRoot`/`turbopack.root` and `middleware` deprecation warnings no longer appeared.
- Manual local testing on iPad/iPhone confirmed: update/reconnect waits for user action, version stamp stays pinned before approval, and dev-only reconnect copy is clear.
- Production verification is next after push. Production should exercise only the version-mismatch path, never the dev-only server-restart path.

### Known Issues / Watch

1. **Production verification pending:** after deploy, test old open tabs on Mac/iPad/iPhone. Expected: banner appears for server/client version mismatch, version stamp remains old until Update is tapped, then reload shows v0.6.105.
2. **Voice production still needs retest:** earlier iPhone voice symptoms may have been affected by stale release state. Retest voice after production release coherency is live.
3. **Full project lint still has unrelated historical errors:** focused lint on touched files is clean, but full `npm run lint` still fails in unrelated prototype/settings files.

### Key Lessons

1. **Detecting an update is not applying an update.** The UI must distinguish “new state exists” from “this app is running new state.”
2. **Running version is a client-shell fact.** Pin it at mount; do not let server version or HMR module replacement rewrite the user's visible installed version before consent.
3. **Development recovery needs development language.** A local dev-server restart is not a production release. Label it as dev-only reconnect so the mechanism builds trust instead of confusion.
4. **Manual consent beats clever auto-reload.** Especially on mobile, silent recovery can feel like the app changed behind the user's back.

---

### Not started

- **ORB-292:** Design user-facing Value/Balanced/Deep Thinking modes, per-user allowances, and consent-based Orb tuning proposals.
- **ORB-287:** Investigate dashboard background polling overhead.
- **ORB-254 remaining:** Blank User columns when filtering by date.

---

### Prior Session Context

**Voice + Todo Action Transaction Release — 2026-06-29 (Codex, GPT-5) — v0.6.97**

v0.6.77–v0.6.97: unified voice speech channel, no silent TTS fallback, deterministic todo action transactions shared by text/voice, session action-set ledger, grouped summaries, concise voice project state, commitment integrity, and eval coverage. Created ORB-299 to continue failure/warning-path work.

**CRUD Reliability — Name-First Context + structural gate — 2026-06-27 (Claude Code, Opus 4.6)**

v0.6.73–v0.6.75: removed regex approval gate, name-first AI context, capability detection, voice structural fixes, first structural mutation gate (now superseded by the propose/confirm/execute flow above).

**Voice mode production fixes — 2026-06-26**

v0.6.67–v0.6.71: silent TTS fix, build gate for TTS keys, iPhone AudioContext volume, selected voice DB load, delete-project loop, duplicate voice race, fader slider.

---

## Key Decisions

- **Name-first context.** The AI's backlog, scope text, observations, and all project references use project NAME as the primary identifier. Code is shown as metadata `[code: XXX]` for tool calls only. Users never interact with codes.
- **Structural mutation gate replaces prompt-only gating.** CRUD tools are held server-side until user confirms. The AI calls the tool immediately, the server holds, the user confirms, the server executes.
- **Prompt aligns with gate.** The mutation prompt says "always call the tool immediately — the server handles confirmation." No conflict between prompt-layer and gate-layer expectations.
- **Project name is the user's identifier.** Tool params for `delete_project` and `update_project` accept `name`, not `project_code`. Handlers look up by name. Code is immutable, auto-generated, internal.
- **Linear processes get structural enforcement.** If steps must happen in a fixed order, code enforces the order. Non-linear processes (queries, reads) stay prompt-guided.
- **Unified toolbar: same 6 buttons on all screens.** No desktop/mobile split.
- **Modal conformity:** All modals use `modal-footer` with `justify-content: flex-end`. Cancel = `btn-cancel`. Primary = `btn-primary`. Delete = `btn-danger` with `marginRight: auto`.
- **Git push is NEVER automatic.** Structural enforcement via settings.local.json.
- **Orb identity: Brownie temperament, butler intelligence.**
- **Voice personality: one personality at three volumes** (reserved/natural/open).
- **Voice preferences in localStorage, not DB.** Browser voices differ per device.
- **Voice testing: Chrome/Safari/Edge only.** Comet is unreliable for voice.

---

## Next Priorities

1. **Production verification for ORB-300:** after deploy, test an already-open production tab plus fresh loads on Mac/iPad/iPhone. Confirm only real version mismatch triggers the production update banner, the version stamp remains pinned before Update, and tapping Update reloads to v0.6.104.
2. **Retest iPhone voice in production:** release coherency should remove stale-app-state as a confounder. If voice still has no sound or gets stuck after greeting, diagnose voice itself next.
3. **Continue ORB-299:** failure/warning tests should deliberately exercise stale references, missing todos, partial delete/update failures, and interrupted/network-aborted sessions.
4. **Latency breakdown:** measure voice turn timing by stage before optimizing.
5. **Consider persistence design later:** pronunciation/user behavior preferences need a separate product design if they should survive beyond the current conversation. Do not imply persistence without a real tool.

---

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

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Never `git push` without Stan's explicit in-chat approval** — structural enforcement via settings.local.json
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

## AI Tool Used Last Session

`2026-06-30 — Codex (GPT-5)`

---

*Updated by AI at end of each session. Committed with session code changes.*
