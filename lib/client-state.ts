// Cross-version client-state invalidation (ORB-322).
//
// Some client storage is *version-coupled*: its serialized shape is tied to the
// app version and a value left over from an older bundle can break a newer one
// (the Orb conversation transcript, pending input, action sets, command history).
// Preferences, dismissals, login convenience, and dev-tooling state are NOT
// version-coupled and must survive deploys — they are deliberately excluded here.
//
// This list is the single source of truth. It is consumed in two places that
// must never drift:
//   1. The pre-hydration boot script in app/layout.tsx (runs on every load,
//      clears automatically when the running bundle's version differs from the
//      last version we cleared for).
//   2. applyUpdate() in components/SystemStateProvider.tsx (the explicit
//      "Update" button path).

export const VERSION_VOLATILE_SESSION_KEYS = [
  'todos_orb_input',
  'todos_orb_conversation',
  'todos_orb_action_sets',
  'todos_orb_cmd_hist',
] as const

// localStorage marker: the last app version whose version-volatile state was cleared.
export const LAST_APPLIED_VERSION_KEY = 'orb_last_applied_version'

/** Remove all version-volatile session state. Safe to call anywhere client-side. */
export function clearVersionVolatileState(): void {
  if (typeof window === 'undefined') return
  for (const key of VERSION_VOLATILE_SESSION_KEYS) {
    try {
      sessionStorage.removeItem(key)
    } catch {}
  }
}
