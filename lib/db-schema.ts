// ──────────────────────────────────────────────────────────────────────────
// Database schema for the query_db tool
// Allowed tables + columns injected into the AI system prompt
// ──────────────────────────────────────────────────────────────────────────

export const ALLOWED_TABLES = new Set([
  'todos',
  'projects',
  'knowledge_repo',
  'audit_log',
  'statuses',
  'priorities',
  'categories',
  'groups',
])

/** Tables with a deleted_at soft-delete column — auto-filter unless explicitly queried */
export const SOFT_DELETE_TABLES = new Set(['todos', 'categories', 'groups'])

/** Allowed filter operators mapped to Supabase query builder methods */
export const ALLOWED_OPS = new Set([
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
  'like', 'ilike', 'is', 'in',
  'contains', 'overlaps', 'not.is',
])

/** Column name validation — only lowercase letters and underscores */
export const COLUMN_NAME_RE = /^[a-z_]+$/

/**
 * Human-readable schema for system prompt injection.
 * Lists allowed tables and their queryable columns.
 */
export const DB_SCHEMA = `
TABLES (query_db can read these):

todos
  id (uuid), todo_number (int), title (text), description (text), status (text),
  priority_value (int), product_id (uuid → projects.id), created_at (timestamptz),
  updated_at (timestamptz), closed_at (timestamptz), resolution_notes (text),
  due_at (timestamptz), urls (text[]), group_id (uuid → groups.id),
  category_id (uuid → categories.id), deleted_at (timestamptz, soft-delete — auto-filtered)
  Joins: projects(code, name), groups(name), categories(name)

projects
  id (uuid), name (text), code (text), description (text), created_by (uuid),
  is_dormant (bool), sort_order (int)

knowledge_repo
  id (uuid), title (text), content (text), tags (text[]), product_id (uuid → projects.id),
  origin_todo_id (uuid → todos.id), created_at (timestamptz)
  Joins: projects(code, name)

audit_log
  id (uuid), action (text), table_name (text), record_id (uuid), before (jsonb),
  after (jsonb), actor (text), created_at (timestamptz), user_id (uuid)

statuses
  id (uuid), name (text), is_open (bool), is_closed (bool), sort_order (int)

priorities
  id (uuid), value (int), label (text), is_urgent (bool)

categories
  id (uuid), name (text), product_id (uuid → projects.id),
  deleted_at (timestamptz, soft-delete — auto-filtered), sort_order (int)

groups
  id (uuid), name (text), product_id (uuid → projects.id),
  deleted_at (timestamptz, soft-delete — auto-filtered), sort_order (int)

EXCLUDED (sensitive): users, invitations, orb_friction, push_subscriptions, roles, platforms
`.trim()
