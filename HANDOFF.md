# HANDOFF.md

> Living session-to-session context for the Orb project.  
> Every AI reads this at session start. Every AI updates it at session end.  
> Committed with each session's code changes. No Downloads exports needed.


## App State

- **Version:** v0.4.87 (canonical in [package.json](file:///Users/stanleybaptista/Projects/orb/package.json))
- **Branch:** main
- **Dev server:** user-started on localhost:3001
- **Live URL:** https://orb-eight-lake.vercel.app

---

## Last Session Completed

**Status terminology overhaul + count consistency — 2026-05-19**

Three interconnected problems fixed:

### 1. Urgency state rename: "Active" to "Busy"

The Orb surface displayed "ACTIVE" as a state (>5 items), but "active" also meant a grouping of statuses (open + in progress). Collision resolved by renaming the urgency state to "BUSY" on the Orb surface, keeping "active" for the status grouping only.

**Files:** `AmbientDashboard.tsx`, `MuralCanvas.tsx`, `OrbDevPanel.tsx`, `OrbHelp.tsx`

- `Urgency` type: `'active'` → `'busy'` across all three components
- All `Record<Urgency, ...>` keys renamed (ORB_SPEED, ORB_GLOW, ORB_STYLE, ORB_ANIMATION, COLOR_MAPS, ZOOM_SPEED, COLOR_SHIFT_SPEED)
- CSS keyframes: `todos-orb-active` → `todos-orb-busy`, `todos-glow-active` → `todos-glow-busy`
- Orb surface state arc now shows "BUSY" instead of "ACTIVE"
- Dev panel button renamed
- All urgency transition messages updated ("Orb shifted busy", etc.)

### 2. Status classification — single source of truth

Multiple files each defined their own version of "active" vs "parked" status sets. Created `lib/status-groups.ts` as the single authority, same pattern as `lib/auth.ts` for authorization.

**New file:** `lib/status-groups.ts`
- `ACTIVE_STATUSES`: open + in progress
- `PARKED_STATUSES`: deferred + on hold
- Helper functions: `isActive()`, `isParked()`, `filterActive()`, `filterParked()`

**All consumers now import from it:**
- `lib/insights.ts` → `filterActive`, `filterParked` (was inline `new Set`)
- `components/AmbientDashboard.tsx` → `isActive` (was `t.status === 'open' || t.status === 'in progress'`)
- `components/TodoView.tsx` → `ACTIVE_STATUSES`, `PARKED_STATUSES` (was `useMemo(() => new Set(...))`)
- `app/actions/orb-converse.ts` → `isActive` (backlog context now split into ACTIVE/PARKED sections)

### 3. Count consistency across all surfaces

The Orb surface, TodoView, insights greeting, and AI conversation all reported different counts because each filtered differently.

**Root causes fixed:**
- `openTodos` in AmbientDashboard counted non-closed (included deferred/on-hold) → now `activeTodos` via `isActive()`
- `computeUrgency` used same wrong filter → now uses `isActive()`
- `insights.ts` summary said "open tasks" but meant active → now says "active tasks"
- Backlog context in AI system prompt showed all non-closed as one flat list → now split into labeled ACTIVE and PARKED sections
- Greeting for admins showed cross-user totals without context → now splits "your projects" vs "all projects"

**AI prompt changes:**
- STATUS LANGUAGE block rewritten: explicitly defines active vs parked, tells AI "never count parked as active"
- Backlog context pre-splits tasks so AI doesn't have to classify
- `query_todos` tool description clarifies default includes deferred/on-hold
- Removed "warnings/nudges" tally from insights summary (internal jargon that leaked to user)

### 6. Project switch summary race condition fix

The summary useEffect depended on `[todos, selectedId]`. When `selectedId` changed, the effect fired immediately with stale `todos` from the previous project (the async fetch hadn't completed yet). This caused the summary to report wrong counts (e.g. "5 active" when the Orb showed 4). Fixed by depending only on `[todos]` — the `projectSwitchingRef` flag is set by the `selectedId` effect, and the summary fires when `fetchTodos` completes with correct data. Also removed closed count from summary (not actionable).

### 4. TodoView filter overhaul (from earlier in session, before context compaction)

- Default filter changed from `'open'` to `'active'`
- Dropdown options: All, Active (Open + In Progress), Inactive (Deferred + On Hold), Open, In Progress, Deferred, On Hold, Closed
- Empty state: "Nothing active — you're clear."
- Done section appears under 'active' filter

### 5. Help system updated

- New "Counting" section: documents Active / Parked / Closed classification
- States section: CALM / BUSY / URGENT with accurate descriptions
- Navigation: "active todo count" instead of "open todo count"
- About section: "busy when the backlog builds" instead of "active"

---

## Uncommitted Changes

**New file:**
- `lib/status-groups.ts` — single source of truth for active/parked status classification

**Modified:**
- `app/actions/orb-converse.ts` — imports `isActive`, backlog split into ACTIVE/PARKED sections, STATUS LANGUAGE rewritten, `created_by` added to projects select, passes userId+isAdmin to computeInsights
- `components/AmbientDashboard.tsx` — Urgency type `active→busy`, `openTodos→activeTodos` via `isActive()`, `computeUrgency` uses `isActive()`, all text/transition messages updated
- `components/MuralCanvas.tsx` — Urgency type `active→busy`, all Record keys renamed
- `components/OrbDevPanel.tsx` — MoodOverride type `active→busy`, button label
- `components/OrbHelp.tsx` — new Counting section, States updated (BUSY), Navigation updated, About updated
- `components/TodoView.tsx` — imports from `status-groups.ts` instead of inline sets, default filter `'active'`, dropdown options
- `lib/insights.ts` — imports `filterActive`/`filterParked`, admin summary splits "your projects" vs "all", removed warnings/nudges tally, all messages say "active" not "open"
- `lib/orb-contract.ts` — `query_todos` description clarifies default includes deferred/on-hold
- `lib/version.ts` — v0.4.87
- `package.json` — v0.4.87

---

## Key Decisions

*   **Email is the stable identity, not auth UUID.** Supabase can replace auth UUIDs on invite/re-invite.
*   **Atomic ID reconciliation via Postgres function.** Supabase JS client can't do multi-statement transactions.
*   **Lazy SDK initialization in server actions.** Module-scope SDK constructors crash Vercel function chunks.
*   **Insight engine is zero-cost.** Pure computation on server — no AI calls.
*   **Conversational tuning over settings UI.** User tells the Orb scope preferences, AI respects them.
*   **Single source of truth for dormancy filtering.** `visibleProjectsQuery()` in `lib/projects.ts`.
*   **Single source of truth for status classification.** `lib/status-groups.ts` — ACTIVE (open + in progress), PARKED (deferred + on hold). All consumers import from here.
*   **"Active" not "open" for counts.** Active = open + in progress. Parked = deferred + on hold. "Open" is a specific status only.
*   **"Busy" not "active" for urgency state.** The Orb surface shows BUSY/CALM/URGENT. "Active" is reserved for the status grouping.
*   **Database is the source of truth — period.** No silent scoping, no in-memory divergence.
*   **Single auth authority.** `getAuthContext()` / `requireAdmin()` in `lib/auth.ts` is the only path. Exceptions: `complete-onboarding.ts` (bootstrap), `friction-actions.ts` / `ticket-actions.ts` (system-level), REST API routes (shared secret).
*   **RLS is the safety net.** Regular Supabase client for user operations, admin client only for intentional cross-user access.
*   **Admin insights split "yours" vs "all".** Admins see all users' data via RLS bypass — insights summary separates own-project counts from cross-user totals so numbers align with the Orb surface.

---

## Next Priorities

1. **Push v0.4.87** — All changes are uncommitted and ready. Commit, push, verify on live.
2. **Test count consistency** — After deploy, verify Orb number, greeting, and conversation all report matching active counts.
3. **Close ORB-113** — move_todo + auth consolidation was completed last session but not formally closed. Write resolution notes + knowledge repo entry.
4. **ORB-116** — Build Helm-style offline page to replace OfflineBanner.
5. **ORB-109** — Session persistence.

---

## AI Tool Used Last Session

`2026-05-19 — Claude Code (claude-opus-4-6)`

---

*Updated by AI at end of each session. Committed with session code changes.*
