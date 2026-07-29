# ORB-366 — Topbar and Projects Bar Plan

## Goal

Clarify Orb's global navigation by separating project-scoped actions from app-wide destinations, while keeping the shared topbar coherent across the dashboard, Settings, Help, and Account.

## UI assembly

- **Global navigation:** existing `appnav` family in `components/AppNav.tsx`.
- **Projects bar:** a new dashboard `ud-*` row inside the existing list pane, directly above `ud-list-toolbar`; its buttons reuse the established `appnav-btn` vertical icon-and-label treatment.
- **Commands dialog:** existing `modal-center`, `modal-header`, and `ud-commands-*` family.
- **Settings shell:** existing `CollapsibleSidebar`; remove its version labels rather than replacing the shell.

The Projects bar is an explicit new ORB-366 surface and will be documented in `docs/ui-catalog.md` in the same change.

## Changes

1. Move Change Project and + Project out of `AppNav` and into a right-aligned Projects bar above the list toolbar.
2. Make the shared dashboard topbar center group Settings, Commands, and Account.
3. Use the gear for Settings and the existing four-square command-grid icon for Commands; rename the visible Menu label to Commands.
4. On Settings routes, keep Dashboard at the far left and center disabled/current Settings plus Commands.
5. Remove Settings from the Commands dialog, retain Help and always-present Print, and add a divider with the current Orb version below. Pages without a current project open Print in all-project mode.
6. Remove all desktop and mobile version labels from the Settings sidebar.
7. Update stale “Menu” onboarding copy and audit all `AppNav` call sites.
8. Verify Mac, iPad, and iPhone layouts and interaction targets.

## Performance instrumentation

Required because ORB-366 relocates modal-open workflows. Preserve the existing `project_create_modal_open` span and add an immediate `project_search_modal_open` span for Change Project. Route navigation and project selection retain their existing instrumentation. Update the performance matrix to record modal-open coverage.

## Database impact

- Add nullable `users.current_project_id uuid` referencing `projects.id` with `ON DELETE SET NULL`.
- Backfill each existing user to their first active owned project in project sort order.
- No index is needed: current-project reads already locate one `users` row by its primary key, and no query filters or joins users by `current_project_id`.
- Project selection adds one low-frequency user-preference update, never a render/keystroke write.
- App initialization validates the stored project against the user’s current visible project list and repairs invalid/null state to the first available project.
- Shared non-dashboard navigation resolves the saved project server-side so Print exposes both All Projects and Current Project.
- No Realtime subscription. Cross-device persistence is last-write-wins on the next route initialization; continuous live sync is unnecessary.

## Verification

- TypeScript check and production build.
- Browser verification on dashboard, Settings, Help, and Account.
- Mac, iPad, and iPhone viewport checks.
- Commands dialog contains Help/Print as applicable and the version footer, but no Settings item.
- Settings sidebar contains no version label.
- No Orb conversation capability changes; no eval case is required.
