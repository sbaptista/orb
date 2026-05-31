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

**Developer-to-Orb Communication Channel — 2026-05-31 (Session 36)**

### What was done

**Dev Channel v1 (v0.5.92) — Developer → Orb direction**
- `dev_channel` database table — bidirectional message storage with status lifecycle (pending → delivered → processed), RLS admin-only
- `POST /api/dev-channel` — developer tools send messages to the Orb, authenticated via ORB_API_SECRET
- `GET /api/dev-channel` — developer tools poll for responses (supports direction, status, since filters)
- `app/actions/dev-channel.ts` — server actions: fetchPendingDevMessages, markDevMessageDelivered, processDevMessage
- Read-only tool restriction — dev channel processing uses only query_todos, search_knowledge, query_db, query_audit_trail, query_capabilities
- DevCard UI component — blue-tinted card with sender label (e.g. "Claude Code (Opus 4.6)"), distinct from user bubbles and Orb cards
- Tab-focus polling in UnifiedDashboard — auto-loads pending dev messages via useVisibilityRefetch
- Knowledge repo integration — all dev-Orb exchanges auto-logged with dev-channel tags

**Dev Channel v2 (v0.5.93) — Orb → Developer direction**
- `send_to_developer` tool added to Orb's tool set (defined in lib/orb-prompt.ts)
- Orb can proactively send messages to developer tools during user conversations (e.g. Stan says "tell Claude Code about ORB-176")
- Messages written to dev_channel with direction='orb_to_dev', developer tools poll via GET /api/dev-channel?direction=orb_to_dev
- System prompt guidance: use for actionable observations (bugs, schema clarifications, verification feedback), not general commentary

**Verified end-to-end:**
- Claude Code → Orb: POST message, tab-focus poll triggers processing, Orb responds with backlog data
- Orb → Claude Code: Stan asked Orb to send ORB-176 details, Orb used send_to_developer, Claude Code polled and received
- Production API: Claude Code can reach production (https://orb-eight-lake.vercel.app/api/dev-channel) but NOT localhost (sandbox restriction)
- Localhost: requires HTTPS (mkcert TLS), curl with -sk flags

**CSS fix**
- Strengthened DevCard blue tint and label contrast after initial testing showed insufficient distinction

### Version bumps
- v0.5.91 → v0.5.92 → v0.5.93

---

## Uncommitted Changes

None — all changes committed and pushed to production.

---

## Key Decisions

- **Dev channel architecture: two complementary reply paths.** `orb_response` field on dev_to_orb messages = direct reply for dev→orb exchanges. `send_to_developer` tool = Orb proactively flagging things during user conversations. No need to merge these.
- **Tickets = strategic backlogs, dev channel = tactical debugging.** Orb's own assessment: "I filed 21 tickets over several weeks. Claude Code just shipped 4 features in one session with direct access to me. Latency matters." The two systems complement, not replace.
- **Dev channel uses read-only tools only.** No mutations without Stan's approval. The Orb tells the developer what it would do; Stan approves through the UI.
- **No Supabase Realtime for dev channel.** Tab-focus polling (useVisibilityRefetch) — consistent with DB health rules.
- **ORB-188 prompt architecture lives in `lib/orb-prompt.ts`.** Separate from the auto-generated `lib/orb-contract.ts` (tools). The generator stays untouched.
- **Preferences have no Settings UI yet.** Managed conversationally via `get_preferences`/`set_preference`. UI deferred until the flow is proven.
- **Observations computed once at context-build time.** Static for the conversation — no mid-conversation proactive interruptions. Fresh context on next conversation.
- **Greeting only fires once per session.** Persisted in sessionStorage. `/clear` resets it. New tab also triggers a fresh greeting.
- **Markdown allowed in Orb responses.** Rendered via react-markdown. Copy button preserves raw markdown. No raw HTML rendering (security).
- **Staging environment removed.** WebAuthn RP ID is bound to the production domain — staging can't test passkeys. Two-tier workflow: localhost → production. *(2026-05-30, supersedes 2026-05-28)*
- **Orb identity: Brownie temperament, butler intelligence.** The Orb quietly helps without demanding spotlight (Brownie ethos) but has judgment and communicates (butler intelligence). User is always in control.
- **Kanban column order: Open → In Progress → Closed → Deferred → On Hold.** Active pipeline first, parked statuses last. Drag-and-drop deferred.
- **Adaptive UI is the long-term direction.** Schema-driven views, Orb `set_view` tool, user-named saved views. Gated by ORB-192 (privacy model) for behavioral observation features.

---

## Prototype Files (isolated, safe to delete if direction changes)

| File | Purpose |
|---|---|
| `app/prototype/page.tsx` | Server component — auth gate, renders UnifiedDashboard |
| `components/UnifiedDashboard.tsx` | Client component — unified split-pane Orb + task list |
| `components/DragDivider.tsx` | Pointer-event draggable split divider with snap points |
| `components/views/TaskListView.tsx` | Extracted list table view |
| `components/views/TaskChecklistView.tsx` | Extracted checklist table view |
| `components/views/TaskKanbanView.tsx` | Kanban board view |
| `components/views/ViewSwitcher.tsx` | View selector bar |
| `components/views/types.ts` | Shared types for view components |
| `components/UnifiedView.tsx` | (Old prototype) task list + OrbPanel side by side — superseded |
| `components/OrbPanel.tsx` | (Old prototype) standalone Orb conversation panel — superseded |
| `app/globals.css` (`.ud-*`, `.up-*`, `.tv-kanban-*`, `.oc-dev-*` rules) | Scoped styles for unified dashboard + dev channel |

---

## Next Priorities

1. **ORB-188 Phase 3: Named views and user-level preferences.** Save filter/sort/view-type combinations as named views in `orb_preferences`.
2. **ORB-188 Phase 4: Orb `set_view` tool.** Conversational view switching ("show me a kanban", "save this view as My Sprint").
3. **Kanban drag-and-drop.** Stan wants this — move tasks between columns by dragging.
4. **ORB-192: Data privacy model.** Gates behavioral observation, internet research, Orb memory. Two dimensions: privacy from users (RLS) and privacy from the Orb (Apple model).
5. **ORB-173: Pre-Alpha Checklist.** Due June 5, 2026. Gate 4 (first impression) depends on ORB-188.
6. **ORB-191: Give Orb UI self-awareness.** Depends on ORB-188 — presentation model determines what context the Orb needs.
7. **ORB-169: Source file audit.** AmbientDashboard is orphaned (zero imports). Classic and prototype routes are dead. TodoView still active at `/dashboard/[productId]`.
8. **Update `docs/ui-catalog.md`** with `components/views/` section, `tv-kanban-*` classes, ViewSwitcher, AppNav, nav-avatar, `.oc-orb-md`, `.oc-dev-*` patterns.

---

## Session Rules (always enforce)

- **Permission required before:** closing a ticket, production push
- **Always bump version** on any user-facing change so Stan can confirm new code is live when testing
- **Run DB health check** (AGENTS.md → Database Health) at the start of any session where DB changes are made

---

## AI Tool Used Last Session

`2026-05-31 — Claude Code (Claude Opus 4.6) — Session 36`

---

*Updated by AI at end of each session. Committed with session code changes.*
