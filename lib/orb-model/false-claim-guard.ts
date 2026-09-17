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

// Receipt-shaped outcome sentences. The database receipts read "Created the
// project “X”." and "Permanently deleted the project “X” and all of its
// todos." — on 2026-09-16 the model reproduced exactly these sentences with no
// tool call behind them, and COMPLETION_LANGUAGE (which only knew "I've
// created…") let them through. The verb must open a sentence or follow a
// first-person subject, so a read-only account like "You created the project
// in August" is not treated as a claim of action.
const MUTATION_OUTCOME_LANGUAGE = /(?:^|[.!?:\n]\s*|\bI(?:['’]ve| have)?\s+)(?:just\s+)?(?:successfully\s+)?(?:permanently\s+)?(?:created|deleted|removed|renamed|updated|closed|reopened|moved|archived|added|filed|saved)\s+(?:the|a|an|your|new|both|all|those|these)\s+(?:\S+\s+){0,2}?(?:projects?|todos?|tasks?|tickets?|knowledge entry|entries|entry)\b/i

// A sentence that places the outcome in the past ("I created that project
// earlier") recounts history rather than claiming this request acted. History
// already labels which of those outcomes a database receipt backs.
const RETROSPECTIVE_OUTCOME = /\b(?:earlier|previously|already|before|ago|yesterday|last (?:week|month|time)|on (?:mon|tues|wednes|thurs|fri|satur|sun)day|in (?:january|february|march|april|may|june|july|august|september|october|november|december))\b/i

function hasPresentMutationOutcome(speech: string): boolean {
  for (const sentence of speech.split(/(?<=[.!?])\s+|\n+/)) {
    if (MUTATION_OUTCOME_LANGUAGE.test(sentence) && !RETROSPECTIVE_OUTCOME.test(sentence)) return true
  }
  return false
}

// Project-switch claims. The prompt already forbids "Switching to…" before the
// switch result, because the model has said it without calling client_action;
// on 2026-09-16 it did so twice ("Switching to Test7.", "Switching to test8.")
// and nothing switched. COMPLETION_LANGUAGE caught "is now active" but not
// these.
const SWITCH_CLAIM_LANGUAGE = /(?:^|[.!?:\n]\s*|\bI(?:['’]m| am| have|['’]ve)\s+)(?:now\s+)?(?:switching|switched)(?:\s+you)?(?:\s+over)?\s+to\b|(?:^|[.!?:\n]\s*)opening (?:that|the|your) project\b/i

export function hasSwitchClaimLanguage(speech: string): boolean {
  return SWITCH_CLAIM_LANGUAGE.test(speech)
}

export function hasCompletionLanguage(speech: string): boolean {
  return COMPLETION_LANGUAGE.test(speech) || hasPresentMutationOutcome(speech) || hasSwitchClaimLanguage(speech)
}

/** Sentences of `speech` that claim an outcome or a project switch, removed. */
export function withoutOutcomeSentences(speech: string): string {
  return speech
    .split(/(?<=[.!?])\s+/)
    .filter(sentence => !hasCompletionLanguage(sentence) && !hasProposalLanguage(sentence))
    .join(' ')
    .trim()
}

// Confirmation-request language. In the unified conversation only the server
// may ask for a mutation go-ahead, and only after it has stored the exact
// proposal. The model copying that question from history ("I'm about to create
// a new project called … Want me to go ahead?") produced a proposal that did
// not exist, so the user's "yes" had nothing to confirm.
const PROPOSAL_LANGUAGE = /\bwant me to go ahead\b|\bshall i (?:go ahead|proceed)\b|\bI(?:['’]m| am) about to\b[^.?!\n]*\b(?:create|add|delete|remove|update|rename|move|close|reopen|archive|file|save|change|set)\b/i

export function hasProposalLanguage(speech: string): boolean {
  return PROPOSAL_LANGUAGE.test(speech)
}

// Provenance labels projected into model history (see
// lib/orb-interaction/model-history.ts). A model may echo one; it must never
// reach the user.
const HISTORY_PROVENANCE_LABEL = /^\s*\[(?:Server-issued|Unverified)[^\]\n]*\]\s*/gim

export function stripHistoryProvenanceLabels(speech: string): string {
  return speech.replace(HISTORY_PROVENANCE_LABEL, '').trim()
}

const PROVENANCE_LABEL_OPENERS = ['[Server-issued', '[Unverified']

/**
 * Streaming-safe form of stripHistoryProvenanceLabels. Mid-stream a label may
 * be incomplete ("[Server-iss"), so text from a line-start "[" that could still
 * become a label is held back until it closes or clearly is not one. On
 * 2026-09-16 a streamed "[Server-issued confirmation request: …] I" reached the
 * screen and stayed there when the turn was stopped.
 */
export function presentableStreamingSpeech(speech: string): string {
  const stripped = speech.replace(HISTORY_PROVENANCE_LABEL, '')
  const lineStart = stripped.lastIndexOf('\n') + 1
  const tail = stripped.slice(lineStart).trimStart()
  if (tail.startsWith('[') && !tail.includes(']')) {
    const couldBeLabel = PROVENANCE_LABEL_OPENERS.some(opener =>
      opener.toLowerCase().startsWith(tail.slice(0, opener.length).toLowerCase()))
    if (couldBeLabel) return stripped.slice(0, lineStart).trimEnd()
  }
  return stripped
}

/** What the user is told when an unbacked claim survives its one repair. */
export const UNBACKED_MUTATION_CLAIM_REPLACEMENT = 'I have not made or proposed that change — nothing was saved. Ask me again and I will set it up for your confirmation.'

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
 *
 * (c) asks for a mutation go-ahead while no proposal backs it (`hasProposal`
 *     is false): neither this request stored one nor is one already pending.
 */
export function isFalseCompletionClaim(
  speech: string,
  toolProducedCodes: Set<string>,
  historyCodes: Set<string>,
  hasActed: boolean,
  hasProposal: boolean,
): boolean {
  const cited = extractCitedCodes(speech)
  const hasPhantomCode = [...cited].some(code => !toolProducedCodes.has(code) && !historyCodes.has(code))
  if (hasPhantomCode) return true
  if (!hasActed && hasCompletionLanguage(speech)) return true
  if (!hasProposal && !hasActed && hasProposalLanguage(speech)) return true
  return false
}

// An action described as happening now. Used only to decide whether opening
// words may be kept; as a stand-alone answer this wording is ordinary.
const IN_PROGRESS_ACTION_LANGUAGE = /(?:^|[.!?:\n]\s*)(?:(?:ok(?:ay)?|sure|alright|got it)[,.!]?\s*(?:[—–-]\s*)?)?(?:I['’]m\s+|I am\s+|now\s+|just\s+)?(?:creating|deleting|removing|renaming|updating|adding|moving|closing|reopening|archiving|saving|filing|switching|changing|setting|making)\b/i

/**
 * The model's own opening words before a tool ran ("You're right, it should be
 * test8."), kept in front of server-written text such as a proposal. Returns ''
 * when there is nothing to keep, when the words would themselves be a false
 * claim — an outcome, a go-ahead question, or a code nothing established — or
 * when this request already sent the model a hidden SYSTEM CORRECTION.
 *
 * After a correction the model's words answer the correction, not the user
 * ("You're right. I need to call the actual deletion tool:"). On 2026-09-16
 * keeping them put that reply to an invisible message on screen three times.
 */
export function presentableLeadIn(
  speech: string,
  toolProducedCodes: Set<string>,
  historyCodes: Set<string>,
  afterCorrection: boolean,
): string {
  if (afterCorrection) return ''
  const text = stripHistoryProvenanceLabels(speech).trim()
  if (!text) return ''
  // "Creating that now." ahead of "Want me to go ahead?" says the change is
  // under way when nothing has run (2026-09-16). The original code discarded
  // lead-ins before proposals for exactly this reason ("Renaming X to Y now.").
  if (IN_PROGRESS_ACTION_LANGUAGE.test(text)) return ''
  if (isFalseCompletionClaim(text, toolProducedCodes, historyCodes, false, false)) return ''
  return text
}

/**
 * The server-written reply for a project switch that actually ran. Keeps the
 * model's non-claim words only when no hidden correction was sent this request.
 */
export function switchConfirmationSpeech(
  modelSpeech: string,
  projectName: string,
  afterCorrection: boolean,
): string {
  const confirmation = `Switched to “${projectName}”.`
  const kept = afterCorrection ? '' : withoutOutcomeSentences(modelSpeech)
  return kept ? `${kept}\n\n${confirmation}` : confirmation
}
