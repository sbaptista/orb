# ORB-255 Global Filtering Plan

Date: 2026-06-12
Status: Approved by Stan and implemented in local v0.5.209; awaiting localhost testing.

## Goal

Ensure that filtering and sorting on the paginated Knowledge Repository and Audit Log pages operate on the complete dataset rather than only the currently visible page.

## Research Summary

- `SettingsCrudList` loaded one server page, then applied its existing search and sort functions to those returned rows.
- Knowledge Repository therefore searched and sorted only 25 visible entries at a time.
- Audit Log had no search field, while sortable columns reordered only the 50 visible rows.
- Default Audit Log newest-first ordering was already global because the database ordered rows before applying its range.

## Implementation

1. Extended paginated `SettingsCrudList` loads with optional server search and server sort criteria.
2. Added a 300ms search debounce, page-one reset, selected-row reset, accurate filtered counts, and stale-response protection.
3. Added an authenticated Knowledge Repository server function.
   - Searches title, content, project code/name, and tags across the complete repository.
   - Sorts the complete filtered result before returning the requested page.
   - Keeps the common unfiltered and title-sorted paths as database range queries.
4. Extended the authenticated Audit Log server function.
   - Searches table, action, actor, and exact full record ID before pagination.
   - Applies allowlisted database sorting before pagination.
5. Reused the existing `crud-search-input`, table header sorting, and pagination controls.

## Database Impact

- Adds a debounced admin-only read when search text or sort criteria change.
- Adds no writes, tables, columns, Realtime subscriptions, or migrations.
- No index was added: the tables currently contain roughly 136 Knowledge rows and 958 Audit rows, and substring search would require trigram infrastructure to benefit from an index.
- Pre-change health showed effectively 100% cache hits, 5.4% dead rows on `audit_log`, and no unoptimized `auth.uid()` RLS policies.

## Verification

- `npx tsc --noEmit`
- `npm run lint`
- Knowledge: search for an entry known to be outside page one; confirm it appears and the count/page total updates.
- Knowledge: sort Project and Title; confirm ordering remains correct across page navigation.
- Audit: search by table, action, actor, and a full record UUID.
- Audit: sort Table, Action, Actor, and Created; confirm ordering remains correct across page navigation.
- Confirm changing search or sort returns to page one.
- Check Mac, iPad, and iPhone layouts; this change reuses the existing responsive CRUD table.

No Orb eval case is required because this does not change conversational tools, routing, parameters, or speech behavior.
