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

**ORB-186 full implementation, markdown rendering, ticket editing — 2026-05-30 (Session 34)**

### Tickets closed
- **ORB-186:** Shift AI guidance from reactive rules to principles and self-diagnostics — all 6 phases (v0.5.83→v0.5.90)

### What was done

**ORB-186 Phase 1 (v0.5.83): Prompt Architecture**
- Monolithic system prompt split into 3 layers in new `lib/orb-prompt.ts`
- Principles, Domain Knowledge, Behavioral Guidelines as named constants
- `orb-converse.ts` assembles from constants instead of inline string

**ORB-186 Phase 2 (v0.5.84): Adaptive Identity**
- `orb_preferences` table (migration `20260530_orb_preferences.sql`)
- Session adaptation protocol — Orb reads conversation signals
- `get_preferences` / `set_preference` tools
- Preference discovery prompt — Orb proposes preferences when it notices patterns
- Three seed keys: `guidance_level`, `verbosity`, `scope_reminders`

**ORB-186 Phase 3 (v0.5.86): Proactive Guidance**
- `computeObservations()` — overdue tasks, stale tasks (30+ days), recent closures, workload imbalance
- `buildObservationsPrompt()` — respects `guidance_level` (quiet/gentle/active)
- Context-aware greeting via `orbGreeting()` — weaves top observation naturally
- Proactive tone rules prompt section

**ORB-186 Phase 4 (v0.5.88): Self-Diagnostics**
- Diagnose protocol — enumerate causes, check data, report before filing
- `query_capabilities` tool — returns principles, tools, preferences, diagnostics
- Ticket deduplication instruction — search existing tickets before `create_ticket`
- `getCapabilities()` function with section filtering

**ORB-186 Phase 5 (v0.5.89): Feedback Loop Closure**
- Last 10 tickets loaded into `buildContext()` with status, type, summary, dismiss reasons
- RECENT TICKETS section in system prompt
- Feedback loop closure prompt — reference resolved issues, avoid duplicates

**ORB-186 Phase 6 (v0.5.90): Versioned Behavior Contract**
- Latest 3 releases from `lib/changelog.ts` injected into system prompt
- Orb can answer "what's new?" conversationally

**Additional changes this session:**
- `max_tokens` increased from 1024 to 4096 (tool call truncation fix)
- Truncated tool call JSON detection with clear error message to model
- `create_todo` title guard — returns error instead of DB constraint violation
- Current date injected into system prompt (`CURRENT_DATE`)
- `query_db` SQL subquery guard in `ORB_QUERY_ROUTING`
- "Work with what you have" principle added — lead with analysis, caveats at end
- Markdown rendering in Orb responses via `react-markdown` (CSS: `.oc-orb-md`)
- Voice rule updated to allow markdown
- Links open in new tabs (`target="_blank"`)
- Tickets: floating modal for view/edit (summary, type, status, detail, conversation snippet)
- Tickets: Edit button added to Actions column
- `updateTicket` server action for general ticket field updates
- `/clear` now resets `greetingFiredRef` so new greeting fires

### Version bumps
- v0.5.82 → v0.5.83 → v0.5.84 → v0.5.85 → v0.5.86 → v0.5.87 → v0.5.88 → v0.5.89 → v0.5.90

---

## Uncommitted Changes

All changes are uncommitted — pending Stan's review and commit permission.

### Modified files
- `app/actions/orb-converse.ts` — system prompt restructured, preference/ticket/changelog context, new tool handlers, truncation guard, date injection
- `app/actions/ticket-actions.ts` — added `updateTicket` action
- `app/globals.css` — `.oc-orb-md` markdown rendering styles
- `components/OrbConversation.tsx` — markdown rendering via react-markdown, auto-scroll fix
- `components/UnifiedDashboard.tsx` — `/clear` resets greeting ref
- `components/settings/SettingsTickets.tsx` — floating edit modal, Edit button in Actions
- `lib/orb-contract.ts` — tool labels for preferences, capabilities
- `lib/changelog.ts` — v0.5.90 release entry
- `lib/version.ts` — v0.5.90
- `package.json` — v0.5.90, added react-markdown dependency
- `package-lock.json` — react-markdown installed

### New files
- `lib/orb-prompt.ts` — prompt architecture (3 layers, observations, preferences, diagnostics, capabilities)
- `scripts/migrations/20260530_orb_preferences.sql` — orb_preferences table
- `docs/orb-188-plan.md` — AI presentation model design exploration

---

## Key Decisions

- **ORB-186 prompt architecture lives in `lib/orb-prompt.ts`.** Separate from the auto-generated `lib/orb-contract.ts` (tools). The generator stays untouched.
- **Preferences have no Settings UI yet.** Managed conversationally via `get_preferences`/`set_preference`. UI deferred until the flow is proven.
- **Observations computed once at context-build time.** Static for the conversation — no mid-conversation proactive interruptions. Fresh context on next conversation.
- **Greeting only fires once per session.** Persisted in sessionStorage. `/clear` resets it. New tab also triggers a fresh greeting.
- **Markdown allowed in Orb responses.** Rendered via react-markdown. Copy button preserves raw markdown. No raw HTML rendering (security).
- **Staging environment removed.** WebAuthn RP ID is bound to the production domain — staging can't test passkeys. Two-tier workflow: localhost → production. *(2026-05-30, supersedes 2026-05-28)*

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

1. **ORB-188: AI presentation model.** Full design exploration at `docs/orb-188-plan.md`. Four directions identified (Orb-primary, List-primary, Mode-switching, User-chosen). Stan's instinct: "it depends on the user." Recommendation: prototype the two extremes and live with each. This decision gates everything else.
2. **ORB-173: Pre-Alpha Checklist.** Due June 5, 2026. Gate 4 (first impression) depends on ORB-188.
3. **ORB-191: Give Orb UI self-awareness.** Depends on ORB-188 — presentation model determines what context the Orb needs.
4. **ORB-169: Source file audit.** AmbientDashboard is orphaned (zero imports). Classic and prototype routes are dead. TodoView still active at `/dashboard/[productId]`.
5. **ORB-180: Investigate soft-delete strategy and data retention.**
6. **Update `docs/ui-catalog.md`** with AppNav, nav-avatar, crud-table-scroll, modal edit, `.oc-orb-md` patterns.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

---

## AI Tool Used Last Session

`2026-05-30 — Claude Code (Claude Opus 4.6) — Session 34`

---

*Updated by AI at end of each session. Committed with session code changes.*
