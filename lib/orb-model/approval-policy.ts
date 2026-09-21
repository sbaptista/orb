import { isBareMutationAffirmation, isTypoTolerantBareMutationAffirmation } from './confirmation-grammar'

export function isBareMutationDecline(input: string): boolean {
  return /^(?:(?:no|nope|nah|cancel|stop|don['’]?t|do not|never mind|nevermind|leave it|skip it|forget it)[,.!\s]*)+$/i.test(input.trim())
}

// An approval act aimed at the pending change, phrased as a sentence rather
// than a bare token: "I approve", "I confirm the change", "yes, apply the
// change". Requiring only bare tokens rejected every natural explicit approval
// and left users unable to authorize anything at all.
//
// Kept as named parts because an approval is routinely a conjunction of two
// acts — "go ahead and do it", "confirm and proceed" — which a single flat
// alternation cannot express.
const APPROVAL_OBJECT = '(?:it|that|this|the (?:change|changes|update|edit|proposal|action|batch))'
const APPROVAL_ACT = '(?:(?:i\\s+)?(?:approve|confirm|authorize|authorise)(?:\\s+' + APPROVAL_OBJECT + ')?'
  + '|(?:apply|execute|make|do)\\s+' + APPROVAL_OBJECT
  + '|(?:go ahead|proceed)(?:\\s+with\\s+' + APPROVAL_OBJECT + ')?)'

// Anchored at both ends on purpose: an utterance carrying any extra content
// falls through to the semantic classifier instead of matching here.
const MUTATION_APPROVAL_ACT = new RegExp(
  '^(?:(?:yes|yeah|yep|yup|sure|okay|ok)[,!. ]+)?(?:please\\s+)?'
  + APPROVAL_ACT
  + '(?:[,\\s]+(?:and|then)\\s+' + APPROVAL_ACT + ')*'
  + '(?:[, ]+please)?[.!\\s]*$',
  'i',
)

// Framing that means the user is DISCUSSING permission rather than granting it
// now — "I already said you had my permission", "why are you asking again?".
// This is what keeps a complaint from authorizing its own pending mutation.
const RETROSPECTIVE_FRAMING = /\b(?:already|should\s+have|should['’]ve|told\s+you|again|why)\b/i

const NEGATION = /\b(?:no|nope|nah|not|don['’]?t|do\s+not|never|cancel|stop|wait|hold\s+off|nevermind|never\s+mind|skip|forget)\b/i

// A condition or exception attached to the reply: whatever is being approved,
// it is not the proposal exactly as it stands.
const QUALIFYING_CONDITION = /\b(?:but|except|unless|instead|rather|if|provided|actually|first|before|after|only)\b/i

// Letters spoken one at a time ("T-E-S-T") — a spelling correction.
const SPELLED_IDENTIFIER = /(?<![A-Za-z0-9])[a-z0-9](?:\s*-\s*[a-z0-9])+(?![A-Za-z0-9])/i

// Edit verbs: the user is describing a different change, not approving the
// pending one. "the change(s)" is stripped first so "apply the change" — an
// approval of the proposal as it stands — is not mistaken for one.
//
// KNOWN NARROWNESS: this also refuses "yes, remove it" against a pending
// deletion, where the verb echoes the proposal rather than revising it.
// Distinguishing the two reliably would mean either delegating the judgment to
// the classifier, which would let a model decide an authorization boundary, or
// matching on the object being a bare pronoun, which is brittle. Left strict on
// purpose; "yes" and "go ahead" both work. Revisit only as a deliberate policy
// decision, not as a passing fix.
const EDIT_INTENT = /\b(?:change|rename|replace|spell|spelled|spelling|add|remove)\b/i

// Shared hard filter: a question, a negation, a qualifying condition, a spelled
// identifier, or retrospective framing never authorizes anything, in the fast
// English path or the semantic fallback below. Applying this before any model
// call keeps the model narrowly scoped to "is this a genuine yes" — it never
// has to independently discover these guardrails, and a fast deterministic
// "no"/"already told you" never needs a network round trip to be rejected.
//
// `and` was a veto here until 2026-09-21. It is not evidence of anything: it
// rejected "go ahead and do it" and "confirm and proceed" outright, and because
// this filter also gates the semantic fallback, those approvals had no path to
// succeed at all. The anchored act above is what keeps mixed content out.
export function failsMutationApprovalGuards(text: string): boolean {
  if (!text.trim()) return true
  if (/[?？]/.test(text)) return true
  if (SPELLED_IDENTIFIER.test(text)) return true
  if (QUALIFYING_CONDITION.test(text)) return true
  if (EDIT_INTENT.test(text.replace(/\bthe changes?\b/gi, ''))) return true
  if (NEGATION.test(text)) return true
  if (RETROSPECTIVE_FRAMING.test(text)) return true
  return false
}

export function isExplicitMutationApproval(input: string): boolean {
  const text = input.trim()
  if (failsMutationApprovalGuards(text)) return false
  return MUTATION_APPROVAL_ACT.test(text)
}

/** Production and offline checks use this same decision boundary. */
export async function evaluateMutationApproval(
  input: string,
  semanticApproval: (text: string) => Promise<boolean>,
): Promise<boolean> {
  if (failsMutationApprovalGuards(input)) return false
  if (isBareMutationAffirmation(input) || isExplicitMutationApproval(input)) return true
  if (isTypoTolerantBareMutationAffirmation(input)) return true
  try { return await semanticApproval(input.trim()) === true } catch { return false }
}

/** A turn can request authorization at several dispatch points; classify once. */
export function oncePerTurnApproval(input: string, classify: (text: string) => Promise<boolean>) {
  let result: Promise<boolean> | undefined
  return () => result ??= classify(input)
}
