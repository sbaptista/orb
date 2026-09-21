import { isBareMutationAffirmation, isTypoTolerantBareMutationAffirmation } from './confirmation-grammar'

export function isBareMutationDecline(input: string): boolean {
  return /^(?:(?:no|nope|nah|cancel|stop|don['’]?t|do not|never mind|nevermind|leave it|skip it|forget it)[,.!\s]*)+$/i.test(input.trim())
}

// An approval act aimed at the pending change, phrased as a sentence rather
// than a bare token: "I approve", "I confirm the change", "yes, apply the
// change to close ORB-338". Requiring only bare tokens rejected every natural
// explicit approval and left users unable to authorize anything at all.
const MUTATION_APPROVAL_ACT = /^(?:(?:yes|okay|ok)[,!. ]+)?(?:please\s+)?(?:(?:i\s+)?(?:approve|confirm|authorize|authorise)(?:\s+(?:it|that|this|the (?:change|changes|proposal|action|batch)))?|(?:apply|execute|make|do)\s+(?:it|that|the (?:change|changes|update|edit))|(?:go ahead|proceed)(?:\s+with\s+(?:it|that|the (?:change|changes|proposal|action|batch)))?)(?:[, ]+please)?[.!\s]*$/i

// Framing that means the user is DISCUSSING permission rather than granting it
// now — "I already said you had my permission", "why are you asking again?".
// This is what keeps a complaint from authorizing its own pending mutation.
const RETROSPECTIVE_FRAMING = /\b(?:already|should\s+have|should['’]ve|told\s+you|again|why)\b/i

const NEGATION = /\b(?:no|nope|nah|not|don['’]?t|do\s+not|never|cancel|stop|wait|hold\s+off|nevermind|never\s+mind|skip|forget)\b/i

// Shared hard filter: a question, a negation, or retrospective framing never
// authorizes anything, in the fast English path or the semantic fallback
// below. Applying this before any model call keeps the model narrowly scoped
// to "is this a genuine yes" — it never has to independently discover these
// guardrails, and a fast deterministic "no"/"already told you" never needs a
// network round trip to be correctly rejected.
export function failsMutationApprovalGuards(text: string): boolean {
  if (!text.trim()) return true
  if (/[?？]/.test(text)) return true
  if (/(?<![A-Za-z0-9])[a-z0-9](?:\s*-\s*[a-z0-9])+(?![A-Za-z0-9])/i.test(text)) return true
  // A qualified approval cannot authorize the unchanged proposal.
  if (/\b(?:but|except|unless|instead|first|before|after|if|provided|actually|rather|and|change|rename|replace|spell|spelled|spelling|add|remove|only)\b/i.test(text.replace(/\bthe changes?\b/gi, ''))) return true
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
