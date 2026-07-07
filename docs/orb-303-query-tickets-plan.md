# ORB-303 — `query_tickets` Read Tool Plan

Status: **implemented** (v0.6.161, 2026-07-07).
Date: 2026-07-07.
Related: ORB-303, ORB-301 (`query_projects` — direct precedent), ORB-302 (`update_knowledge`/`search_knowledge` — the "add a tool to a create-only surface" precedent), `docs/object-capability-matrix.md`.

## Scope (confirmed with Stan)

A single new Orb tool: **`query_tickets`**, read-only, **admins only**. No `update_ticket`. No changes to the Settings UI or its table — the admin UI (`SettingsTickets.tsx`) already fully complies with catalog standards (`SettingsCrudList`, rich mobile cards, dual search modals) and is untouched by this work.

Two earlier framings of this todo were superseded during scoping: a fuller CRUD proposal, and a UI-catalog-compliance angle. Both are dropped — confirmed there is no UI surface for this at all (see below).

## Research summary

**Precedent — `query_projects` (ORB-301, `lib/orb-contract.ts`):** a read tool added to fill a real gap, filtering by name (partial/fuzzy), with `include_dormant` and `max_results` options. Same shape applies here: filter by status/type, look up one ticket by code, cap results.

**No UI needed, confirmed:** read tools (`query_projects`, `search_knowledge`) render as plain conversational speech/transcript text — no dedicated modal or card. `QueryResultsModal.tsx` exists in the codebase but is dead code, imported by nothing. Per the UI catalog's Builder Protocol, there's no existing "query result" UI pattern to reuse because none of the other read tools use one — so none is created here either.

**Existing action layer to reuse, not duplicate:** `app/actions/ticket-actions.ts` already has `getTickets(options)` — filters by `status`, `scope` (`active` / `all` / a specific status), `search` (summary/type substring), and date range; joins reporter name and linked todo/project code; already gated by `requireAdmin()`. The tool handler should call this directly rather than writing a second, parallel Supabase query — the ORB-306/307 lesson this session (two independent implementations of "the same" thing silently drift) applies here as much as anywhere.

**Admin gate — reuse `auth.isAdmin`, don't invent a new flag:** `auth.isAdmin` (from `lib/auth.ts`, `ADMIN_ROLE_IDS = [1, 3]`) already matches `ticket-actions.ts`'s own admin definition exactly (`requireAdmin()`, `getAdmins()` both use role_id 1/3). The existing precedent for gating an entire tool by role is `query_repository`, filtered out of `availableOrbTools` for non-qualifying users (`orb-converse.ts` ~985-990) plus a conditional prompt line. `query_tickets` follows the identical mechanism, keyed on `auth.isAdmin` instead of a new capability check.

**Ticket identity:** tickets use `TICKETS-{ticket_number}` as their user-facing code (see `createTicket`'s return, `TICKETS-${ticket.ticket_number}`), not a UUID. Single-ticket lookup parses this the same way `query_todos` parses `PROJECTCODE-N` — split on `-`, parse the trailing number, ignore the fixed `TICKETS` prefix.

**RLS:** `tickets_admin_all` already grants full read to role_id 1/3; `getTickets()` uses the service-role admin client via `requireAdmin()`, so RLS is not the enforcement layer here — the application-level `isAdmin` check (both in `orb-converse.ts`'s tool filtering and inherently in `getTickets()`) is what matters. No RLS or migration changes needed.

**Audit logging:** not needed. No other read tool (`query_todos`, `query_projects`, `search_knowledge`) logs to `audit_log` — reads aren't mutations. Consistent with precedent.

## Proposed design

**1. Tool definition** — add to `docs/api-spec.yaml`'s `x-orb-internal-tools` (source of truth; regenerates into `lib/orb-contract.ts` via `npm run generate-contract`, same as every other tool):

```yaml
query_tickets:
  confidence: new
  description: >
    Look up reporter-filed tickets (bugs, suggestions, capability gaps, workflow
    friction) — status, type, summary, linked todo. Admin-only. Use for "what's
    the status of ticket X", "any open bugs", "show tickets about Y". NOT for
    engineering todos (use query_todos) — tickets are the reporter-facing
    feedback queue that create_ticket writes to.
  input_schema:
    type: object
    properties:
      code: { type: string, description: 'Exact ticket code, e.g. "TICKETS-42". Overrides all other filters.' }
      status: { type: string, description: 'Filter by exact status (open, in_progress, closed, dismissed, etc.).' }
      scope: { type: string, enum: ['active', 'all'], description: 'active = not closed/dismissed. Defaults to active.' }
      type: { type: string, description: 'Filter by type: bug, suggestion, capability_gap, workflow_friction.' }
      search: { type: string, description: 'Text search against summary.' }
      max_results: { type: integer, description: 'Max tickets to return. Default 20.' }
```

**2. Gating (`app/actions/orb-converse.ts`)** — mirror the `query_repository` pattern exactly:
```ts
const availableOrbTools = auth.canInspectRepository ? ORB_TOOLS : ORB_TOOLS.filter(t => t.name !== 'query_repository')
// becomes:
const availableOrbTools = ORB_TOOLS.filter(t =>
  (t.name !== 'query_repository' || auth.canInspectRepository) &&
  (t.name !== 'query_tickets' || auth.isAdmin)
)
```
Add a conditional prompt line for non-admins, matching `repositoryAccessPrompt`'s shape, so the model knows the tool is gated rather than silently missing.

**3. Handler** — new branch in the tool-dispatch switch, calling `getTickets()` with mapped options, then formatting a compact result (code, type, status, summary, reporter name if present, linked todo code if present — NOT the raw `detail` JSONB blob, to avoid dumping unstructured noise into context, matching how other tools return curated fields rather than raw rows).

**4. Voice/speech policy:** no new rule needed — the existing brevity/no-long-inventory voice rules already cover any tool's output. A ticket list follows the same "headline + count, point to transcript for detail" shape as `query_todos`/`query_projects` results.

## Object Capability Matrix update (mandatory, same change)

Update the `tickets` row in `docs/object-capability-matrix.md`:
- `Orb Tool (C/R/U/D)`: `✅create(create_ticket) / ✅read(query_tickets, admin-only, v0.6.x — ORB-303) / ❌no update / ❌no delete`
- Mark ORB-303 in "Tracked gaps" as read-only scope, not the fuller read/update/delete originally listed — note the scope was narrowed during planning.

## Eval suite (mandatory, same change)

- Tier 1: a direct admin query ("what's the status of ticket TICKETS-3", or "any open bugs?") asserts `expectTool: { name: 'query_tickets' }`.
- Admin-gating regression case: check whether `EvalCase` supports simulating a non-admin caller (need to confirm — `userEmail` exists for "admin context for strategic evaluations", worth checking if a non-admin identity can be simulated the same way before committing to this case; if not cleanly testable, note it as a manual verification item instead of forcing a fragile eval case).

## Platform verification

No new UI, so no new platform-specific rendering exists to test. Verification is the same conversational surface already covered by the voice-operator-runtime work — confirm on Mac/iPad/iPhone that asking about tickets in both text and voice mode produces a correctly brief, admin-gated response. Not a new platform surface, just confirming the existing one handles a new tool correctly.

## Decisions (confirmed 2026-07-07)

1. **Field detail is two-tier**, matching the `query_todos` convention: a list/bulk query returns the compact set (code, type, status, summary, reporter name, linked todo code); looking up one specific ticket by code additionally returns `detail`, `conversation_snippet`, `source`, `dismiss_reason`/`resolution_notes` (when present), `created_at`/`closed_at`. Approved as designed — adjustable later if real usage shows the list view wants more.

2. **Also add `tickets` to `lib/db-schema.ts`'s `ALLOWED_TABLES`.** This turned out not to be redundant with the admin-only `query_tickets` tool: `query_db` isn't gated as a whole — it runs with the caller's actual RLS-scoped client for non-admins and the admin client for admins. `tickets`' existing RLS (`tickets_admin_all` / `tickets_reporter_select`) already splits this correctly, so adding it lets an ordinary user ask Orb about *their own* filed tickets via the safe RLS-scoped fallback — a different, complementary capability to the admin-only dedicated tool, not a duplicate of it. Approved.

## Approval

Approved. Ready to build.
