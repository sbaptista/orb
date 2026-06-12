# ORB-252 — Repository Access

## Decision

Repository inspection is a role capability, not an account status. Admin, Super Admin, and Developer may use it. Developer remains a non-admin role everywhere else.

## Sources

- `local`: the current working tree; available only to localhost Orb.
- `production`: a sanitized source bundle generated during the current Vercel build; available to both localhost and production Orb.

The production source is deployment-specific rather than a one-time application snapshot. Each Vercel deployment regenerates and carries its own source bundle.

## Security Boundary

- Read-only `list`, `search`, and ranged `read` operations.
- Allowlisted source directories, root configuration files, and text extensions.
- Hidden paths, traversal, symlinks, oversized files, and environment files are rejected.
- Production requests require the Orb API secret, an authenticated user ID, and a live role lookup.
- Unauthorized users do not receive the repository tool in their model tool set.

## Database Impact

This adds one row to the existing `roles` table and no new query pattern, table, column, Realtime subscription, or frequent write path. Existing unique indexes on `roles.name` and `roles.value` cover the migration.
