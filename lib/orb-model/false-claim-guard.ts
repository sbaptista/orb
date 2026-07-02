// Shared "did the model claim an outcome it didn't back with a tool call" guard.
// Used by both production (app/actions/orb-converse.ts) and the eval mirror
// (app/api/orb-eval/route.ts) — extracted after the two copies silently drifted
// apart: the eval copy had a completion-language check production never got,
// so a real bug (Orb narrating "Switching to X... Done." for client_action /
// switch_project without ever calling the tool) shipped to production
// undetected. A single shared module is what keeps that from happening again.

// Tools whose success represents a real effect (data mutation or a
// navigation/UI-state change), as opposed to a read-only lookup (query_todos,
// search_knowledge, query_db, query_repository, query_projects, etc.). Used
// by the eval mirror to compute `hasActed` from a single-shot tool-call list
// — production tracks `hasActed` procedurally instead (set at each real
// success point), since it has to distinguish a HELD mutation (not yet
// executed) from an actually-executed one, which a static tool-name list
// alone can't do.
export const EFFECTFUL_TOOL_NAMES = new Set([
  'create_todo', 'update_todo', 'delete_todo', 'move_todo',
  'create_project', 'update_project', 'delete_project', 'set_dormancy',
  'create_ticket', 'add_knowledge', 'set_preference',
  'send_to_developer', 'propose_adaptation', 'confirm_mutation', 'client_action',
])

export function extractCitedCodes(speech: string): Set<string> {
  const matches = speech.match(/\b[A-Z][A-Z0-9]{1,15}-\d+\b/g)
  return new Set(matches ?? [])
}

// Deliberately not scoped to todo/project mutation verbs — this also has to
// catch client_action-style claims ("I've switched you to X", "X is now
// active") and any future tool-backed claim, not just create/update/delete.
const COMPLETION_LANGUAGE = /\b(done\s*—|done\.|created as|i'?ve (created|added|filed|updated|changed|closed|completed|deleted|removed|moved|archived|deferred|saved|switched|navigated|opened|exited)|successfully (created|added|updated|deleted|moved|switched|navigated|opened)|is (now )?active(?: now)?|is now (?:viewing|showing|open))\b/i

export function hasCompletionLanguage(speech: string): boolean {
  return COMPLETION_LANGUAGE.test(speech)
}

/**
 * True when the response either:
 * (a) cites a task/project code that no tool produced and no prior context
 *     established (the original phantom-code check), or
 * (b) uses completion language ("Done", "I've switched you to X", "X is now
 *     active") while nothing was actually executed anywhere in this request
 *     (`hasActed` is false).
 *
 * Case (b) is intentionally tool-agnostic: a claim with zero backing tool
 * calls is suspicious regardless of which tool the claim was about. Callers
 * compute `hasActed` themselves — true once any tool call in this request
 * actually took effect (a mutation succeeded, confirm_mutation executed, a
 * client_action succeeded). A merely-held/pending operation (GATED_MUTATIONS)
 * must NOT count as acted — being held is not being done, and a "Done" claim
 * about a held-only operation is exactly the kind of false claim this exists
 * to catch.
 */
export function isFalseCompletionClaim(
  speech: string,
  toolProducedCodes: Set<string>,
  historyCodes: Set<string>,
  hasActed: boolean,
): boolean {
  const cited = extractCitedCodes(speech)
  const hasPhantomCode = [...cited].some(code => !toolProducedCodes.has(code) && !historyCodes.has(code))
  if (hasPhantomCode) return true
  if (!hasActed && hasCompletionLanguage(speech)) return true
  return false
}
