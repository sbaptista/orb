# Consolidate API Health and Version Polling via SystemStateProvider

We will refactor the redundant, duplicate polling of `/api/health` and `/api/version` currently run by multiple components on window focus, visibility shifts, and interval timers. We will introduce a unified `SystemStateProvider` to manage these states centrally.

## User Review Required

> [!IMPORTANT]
> The `/api/version` endpoint performs Supabase database queries to check maintenance mode status, while `/api/health` is a static, lightweight endpoint. By consolidating queries:
> - We reduce database connection/query overhead from maintenance checks (halving the query rate from 4/min to 2/min when idle).
> - We reduce focus/visibility event triggers from 5 individual calls down to exactly 2 calls (1 lightweight health call, 1 version/maintenance call) per focus event.

## Proposed Changes

### Components & Hooks

#### [NEW] [SystemStateProvider.tsx](file:///Users/stanleybaptista/Projects/orb/components/SystemStateProvider.tsx)
Create a new React Context Provider to manage the centralized system state:
*   **State managed:**
    *   `isOnline`: boolean
    *   `version`: string
    *   `maintenance`: boolean
    *   `lockedOut`: boolean
*   **Deduplication & Event Handling:**
    *   Listens to window `focus`, `visibilitychange`, and online/offline event triggers.
    *   Uses a **500ms trailing debounce** on window focus and visibility change event listeners to prevent double-firing queries since browsers fire `focus` and `visibilitychange` back-to-back.
*   **DEV Panel Simulation Support:**
    *   Inherits custom event listeners for `todos-dev-offline-change` and `todos-dev-update-change` dispatched by the DEV panel toggles.
    *   Preserves the `localStorage` checks for `todos_dev_simulate_offline` and `todos_dev_simulate_update` so offline/update simulations still work.
*   **Optimized Polling:**
    *   Health check (/api/health) interval relaxed from **10s to 30s** (browser level `online`/`offline` events notify immediately, interval is only a fallback).
    *   Version check (/api/version) interval set to **30s**.
    *   **Pause polling when tab is hidden:** Both health and version intervals skip ticks when `document.visibilityState === 'hidden'`.
    *   If `isOnline` is false, `/api/version` fetches are skipped entirely to save network resources.

#### [MODIFY] [useOnlineStatus.ts](file:///Users/stanleybaptista/Projects/orb/hooks/useOnlineStatus.ts)
Deprecate all internal polling, listeners, and intervals. Rewrite it to consume the `isOnline` state from `SystemStateContext`:
```typescript
import { useSystemState } from '@/components/SystemStateProvider'
export function useOnlineStatus() {
  return useSystemState().isOnline
}
```

#### [MODIFY] [MaintenanceOverlay.tsx](file:///Users/stanleybaptista/Projects/orb/components/MaintenanceOverlay.tsx)
Remove the independent `setInterval`, `focus`, and `visibilitychange` listeners. Consume `lockedOut` from `SystemStateContext`. The overlay still gates rendering when `pathname === '/maintenance'` to prevent self-lockouts on the maintenance page itself.

#### [MODIFY] [MaintenanceBanner.tsx](file:///Users/stanleybaptista/Projects/orb/components/MaintenanceBanner.tsx)
Remove the independent `setInterval`, `focus`, and `visibilitychange` listeners. Consume `maintenance` and `lockedOut` from `SystemStateContext` to determine visibility.

#### [MODIFY] [UpdateBanner.tsx](file:///Users/stanleybaptista/Projects/orb/components/UpdateBanner.tsx)
Remove the independent `setInterval`, `visibilitychange` listeners, and `checkVersion` fetch. Consume `version` from `SystemStateContext` and compare it to the local client `VERSION` to trigger update availability. Keeps UI actions (`handleUpdate` logic for service worker updates + `window.location.reload()`) in the component.

#### [MODIFY] [Providers.tsx](file:///Users/stanleybaptista/Projects/orb/components/Providers.tsx)
Wrap `<ToastProvider>` in `<SystemStateProvider>` so the system context is available layout-wide:
```tsx
import { SystemStateProvider } from './SystemStateProvider'
// ...
return (
  <SystemStateProvider>
    <ToastProvider>{children}</ToastProvider>
  </SystemStateProvider>
)
```

### Versioning & Changelog

#### [MODIFY] [package.json](file:///Users/stanleybaptista/Projects/orb/package.json)
*   Bump patch version to `0.5.99`.

#### [MODIFY] [version.ts](file:///Users/stanleybaptista/Projects/orb/lib/version.ts)
*   Update to `v0.5.99`.

#### [MODIFY] [changelog.ts](file:///Users/stanleybaptista/Projects/orb/lib/changelog.ts)
*   Document changes under `v0.5.99`.

#### [MODIFY] [HANDOFF.md](file:///Users/stanleybaptista/Projects/orb/HANDOFF.md)
*   Update handoff list of uncommitted changes and last session details.

---

## Verification Plan

### ORB-326 follow-up

`SystemStateProvider` now derives `isOnline` from the existing `/api/version` request, reducing every initial, interval, focus/visibility, online-event, manual-refresh, and DEV-simulation check from two client requests to one. `/api/health` remains deployed for possible external probes but has no app-shell caller. Optional `background / system-state / version_poll` telemetry records success, HTTP/network failure, and simulated-offline checks; ordinary runs enqueue no measurement traffic unless background performance telemetry is enabled.

### Automated Tests
*   Run `npm run build` to verify Next.js compiles successfully.

### Manual Verification
*   Open the dev server, open Chrome DevTools Network panel, and focus/unfocus the browser tab. Confirm that exactly one `/api/version` request and zero `/api/health` requests are made by the app shell.
*   Simulate offline mode (via developer panel or DevTools) and verify the `OfflinePage` breathing Julia set overlay displays correctly.
*   Verify the update/maintenance overlays function normally.
