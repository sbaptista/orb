# Plan: `query_db` Tool for Orb

## Context

Orb's AI hallucinates when it can't filter server-side. The `query_todos` handler loads all todos into memory and applies JS filters, but lacks filters for many columns (URLs, groups, categories, dates, etc.). When the AI receives 186 results and tries to post-filter, it fabricates data — e.g., reporting 28 tasks with URLs when only 1 exists. Adding filters one-by-one is "whack-a-mole." The solution: give Orb direct read-only database access via a declarative query tool, so any question the data can answer, it answers accurately.

## Approach

Add a `query_db` tool that accepts a declarative JSON query (table, filters, select, order, limit) and translates it to Supabase query builder calls. This is safe (no raw SQL), RLS-scoped for regular users, and covers any filterable question without needing per-field tool parameters.

## Files to Modify

### 1. New: `lib/db-schema.ts`

Export a `DB_SCHEMA` constant describing the allowed tables and their columns. This gets injected into the system prompt so the AI knows what it can query.

**Allowed tables** (user-facing data only):
- `todos` — id, todo_number, title, description, status, priority_value, product_id, created_at, updated_at, closed_at, resolution_notes, due_at, urls, group_id, category_id, deleted_at
- `projects` — id, name, code, description, created_by, is_dormant, sort_order
- `knowledge_repo` — id, title, content, tags, product_id, origin_todo_id, created_at
- `audit_log` — id, action, table_name, record_id, before, after, actor, created_at, user_id
- `statuses` — id, name, is_open, is_closed, sort_order
- `priorities` — id, value, label, is_urgent
- `categories` — id, name, product_id, deleted_at, sort_order
- `groups` — id, name, product_id, deleted_at, sort_order

**Excluded tables** (sensitive): `users`, `invitations`, `orb_friction`, `push_subscriptions`, `roles`, `platforms`, `tickets` (dropped)

Format: a readable multi-line string for prompt injection, plus a `Set<string>` of allowed table names for validation.

### 2. `lib/orb-contract.ts`

Add the `query_db` tool definition to `ORB_TOOLS` array and `ORB_TOOL_LABELS`:

```ts
{
  name: "query_db",
  description: "[Confidence: new] Execute a read-only database query. Use for questions that query_todos can't answer: filtering by URLs, dates, groups, categories, joins, counts, or cross-table lookups. Returns raw rows up to 200. Always prefer query_todos for simple task lookups by code/status/priority.",
  input_schema: {
    type: "object",
    properties: {
      table: { type: "string", enum: ["todos","projects","knowledge_repo","audit_log","statuses","priorities","categories","groups"], description: "Table to query." },
      select: { type: "string", description: "Comma-separated columns or Supabase select syntax (e.g. '*, projects(code, name)'). Default: *" },
      filters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            column: { type: "string" },
            op: { type: "string", enum: ["eq","neq","gt","gte","lt","lte","like","ilike","is","in","contains","overlaps","not.is"] },
            value: { description: "Filter value. Use null for is/not.is. Use array for in/contains/overlaps." }
          },
          required: ["column","op","value"]
        },
        description: "Array of filter conditions (AND'd together)."
      },
      or_filter: { type: "string", description: "Supabase OR filter string, e.g. 'status.eq.open,status.eq.in progress'. Use sparingly." },
      order: { type: "string", description: "Column to order by. Prefix with - for descending (e.g. '-created_at')." },
      limit: { type: "integer", description: "Max rows (default 50, max 200)." }
    },
    required: ["table"]
  }
}
```

Add label: `query_db: 'Querying database...'`

**Also**: Revert the partial `has_urls`, `has_group`, `has_category` filter params that were added to `query_todos` — these are superseded by `query_db`.

### 3. `app/actions/orb-converse.ts`

**a) Import** `DB_SCHEMA` and `ALLOWED_TABLES` from `lib/db-schema.ts`.

**b) Add handler** in the tool dispatch chain (after existing handlers, before the final else):

```
} else if (tc.name === 'query_db') {
```

Handler logic:
1. Validate `input.table` is in `ALLOWED_TABLES`
2. Validate column names with regex (`/^[a-z_]+$/`) — no injection via column names
3. Use `auth.supabase` for regular users (RLS-scoped), `auth.admin` for admin users
4. Build query: `client.from(table).select(select)`
5. Apply each filter via the corresponding Supabase method (`.eq()`, `.gt()`, `.ilike()`, etc.)
6. For `todos` table: auto-append `.is('deleted_at', null)` unless the AI explicitly filtered on `deleted_at`
7. For `categories`/`groups` tables: same soft-delete guard
8. Apply `or_filter` if provided (sanitize: strip anything that isn't `[a-z_.,()0-9 ]`)
9. Apply order (detect `-` prefix for descending)
10. Apply limit (clamp to 200)
11. Execute query, return `{ count, rows, truncated }` where truncated = rows hit the limit

**c) System prompt additions**:

Add a `DATABASE SCHEMA` section (injected from `DB_SCHEMA` constant) showing allowed tables and columns.

Update the existing `QUERY STRATEGY` section to become `QUERY ROUTING`:
- **Simple task lookups** (by code, status, priority, text match) -> `query_todos` (faster, enriched with owner/group/category)
- **Complex/structural questions** (tasks with URLs, date ranges, cross-table, counts, group-by patterns) -> `query_db`
- **Never guess** — if you can query it, query it. If you got too many results from query_todos and need to filter further, use query_db.

### 4. `docs/api-spec.yaml`

Add `query_db` tool definition (mirrors the orb-contract definition for REST API consumers).

## Reuse

- `getAuthContext()` from `lib/auth.ts` — existing auth pattern with `auth.supabase` (RLS) and `auth.admin` (bypass)
- `logAuditEvent()` — not needed (read-only tool, no mutations)
- `ORB_TOOLS` / `ORB_TOOL_LABELS` from `lib/orb-contract.ts` — existing pattern for adding tools
- `buildContext()` already returns all the context needed; no changes required there

## Security

- **Table allowlist**: Only 8 tables exposed. Sensitive tables excluded.
- **Column name validation**: Regex prevents SQL injection through column names.
- **RLS enforcement**: Regular users go through `auth.supabase` — RLS policies scope data to their user. Admin users use `auth.admin` for cross-user visibility.
- **Supabase query builder**: No raw SQL — `.from().select().eq()` chains are parameterized by the Supabase SDK.
- **Read-only**: No insert/update/delete. The tool only calls `.select()`.
- **Row cap**: 200 rows max with truncation flag so the AI knows when results are incomplete.
- **Soft-delete awareness**: Auto-filters `deleted_at IS NULL` on todos/categories/groups.

## Version Bump & Changelog

After implementation: bump `package.json` and `lib/version.ts` to `v0.5.28`, add changelog entry in `lib/changelog.ts`.

## Verification

1. **Build check**: `npx tsc --noEmit` — no type errors
2. **Orb conversation tests** (via the live app):
   - "Show me tasks that have URLs" -> should use `query_db` with `contains` filter on `urls`, return only ORB-73
   - "How many tasks were closed this month?" -> should use `query_db` filtering `closed_at` with `gte`
   - "Which tasks have a group assigned?" -> should use `query_db` with `not.is` on `group_id`
   - "Show me ORB-73" -> should still use `query_todos` (simple code lookup)
   - "What's on my plate?" -> should still use `query_todos` with `status_group='active'`
3. **Admin vs regular user**: Verify admin sees cross-user data, regular user sees only own
