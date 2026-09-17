import { hasCompletionLanguage, hasProposalLanguage, stripHistoryProvenanceLabels } from '../orb-model/false-claim-guard'

/**
 * Provenance of an assistant message as the model sees it in history.
 *
 * The durable conversation gives the model earlier turns as plain text, never
 * the tool calls behind them. Without provenance, a server-issued proposal
 * ("I'm about to create … Want me to go ahead?") and a database receipt
 * ("Created the project “X”.") look like ordinary replies, and the model learns
 * to answer the next request by writing the same sentences instead of calling
 * the tool. That happened on 2026-09-16: four voice project requests got a
 * proposal nobody stored and two confirmations got a receipt nobody issued.
 *
 * Shared by production history projection and the eval route so the two
 * cannot drift.
 */
export type OrbModelHistoryProvenance =
  | 'server_proposal'
  | 'server_receipt'
  | 'unverified_mutation_claim'

export type OrbModelHistoryEntry = {
  role: 'user' | 'assistant'
  text: string
  provenance?: OrbModelHistoryProvenance
}

const PROVENANCE_LABELS: Record<OrbModelHistoryProvenance, string> = {
  server_proposal: '[Server-issued confirmation request: a mutation tool call stored this exact proposal, and the server — not you — wrote this text. Do not reproduce it; call the mutation tool instead.]',
  server_receipt: '[Server-issued database receipt: the confirmation transaction committed this change, and the database — not you — wrote this text. Do not reproduce it.]',
  unverified_mutation_claim: '[Unverified: no tool call, stored proposal, or database receipt backs this message, so nothing was proposed or changed. Never write text like this; call the tool.]',
}

/** Classify an assistant message that has no server proposal or receipt behind it. */
export function unbackedAssistantProvenance(text: string): OrbModelHistoryProvenance | undefined {
  return hasCompletionLanguage(text) || hasProposalLanguage(text)
    ? 'unverified_mutation_claim'
    : undefined
}

// The label follows the message. Placed first (2026-09-16) it taught the model
// to open its own replies with a bracketed label, which then streamed to the
// user.
export function frameModelHistoryEntry(entry: OrbModelHistoryEntry): { role: 'user' | 'assistant'; text: string } {
  if (entry.role !== 'assistant' || !entry.provenance) return { role: entry.role, text: entry.text }
  return { role: entry.role, text: `${entry.text}\n\n${PROVENANCE_LABELS[entry.provenance]}` }
}

function comparableSpeech(text: string): string {
  return stripHistoryProvenanceLabels(text)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * True only when the most recent go-ahead question the user saw is the stored
 * pending proposal's own wording.
 *
 * On 2026-09-16 the stored proposal was "Test eight", the model then showed a
 * go-ahead for "test8" that was never stored, and "yes" committed "Test eight".
 * A confirmation must approve what was shown, so if a different go-ahead was
 * shown later — or none survives in history (for example a proposal turn that
 * was interrupted before its reply was recorded) — the server restates the
 * stored proposal instead of committing.
 */
export function lastShownProposalMatches(
  history: Array<{ role: 'user' | 'assistant'; text: string }>,
  canonicalProposalSpeech: string,
): boolean {
  const lastShown = [...history].reverse().find(entry =>
    entry.role === 'assistant' && hasProposalLanguage(stripHistoryProvenanceLabels(entry.text)))
  if (!lastShown) return false
  return comparableSpeech(lastShown.text).includes(comparableSpeech(canonicalProposalSpeech))
}
