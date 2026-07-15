// Shared, server-enforced mutation authorization grammar.
// The model may interpret the requested action, but it cannot authorize its
// own proposal. Both serial and Realtime paths evaluate the user's actual
// current utterance through these predicates.

export function isBareMutationAffirmation(input: string): boolean {
  return /^(?:(?:yes|yep|yeah|yup|sure|okay|ok|affirmative|absolutely|definitely|approved|approve|confirmed|confirm|go ahead|do it|go|please do|please|proceed|sounds good|correct|that['’]?s right|that is right)[,.!\s]*)+$/i.test(input.trim())
}

export function isBareMutationDecline(input: string): boolean {
  return /^(?:(?:no|nope|nah|cancel|stop|don['’]?t|do not|never mind|nevermind|leave it|skip it|forget it)[,.!\s]*)+$/i.test(input.trim())
}

// An approval act aimed at the pending change, phrased as a sentence rather
// than a bare token: "I approve", "I confirm the change", "yes, apply the
// change to close ORB-338". Requiring only bare tokens rejected every natural
// explicit approval and left users unable to authorize anything at all.
const MUTATION_APPROVAL_ACT = /\b(?:approve|approved|confirm|confirmed|authoriz(?:e|ed)|authoris(?:e|ed))\b|\b(?:apply|execute|make|do)\s+(?:the\s+|that\s+|this\s+)?(?:change|changes|update|edit|it|that)\b|\b(?:go ahead|proceed)\b/i

// Framing that means the user is DISCUSSING permission rather than granting it
// now — "I already said you had my permission", "why are you asking again?".
// This is what keeps a complaint from authorizing its own pending mutation.
const RETROSPECTIVE_FRAMING = /\b(?:already|should\s+have|should['’]ve|told\s+you|again|why)\b/i

const NEGATION = /\b(?:no|nope|nah|not|don['’]?t|do\s+not|never|cancel|stop|wait|hold\s+off|nevermind|never\s+mind|skip|forget)\b/i

export function isExplicitMutationApproval(input: string): boolean {
  const text = input.trim()
  if (!text) return false
  // A question asks for information; it never authorizes.
  if (text.includes('?')) return false
  if (NEGATION.test(text)) return false
  if (RETROSPECTIVE_FRAMING.test(text)) return false
  return MUTATION_APPROVAL_ACT.test(text)
}

// The single authorization predicate for a pending mutation: a bare
// affirmation, or an unambiguous explicit approval of the proposed change.
export function authorizesPendingMutation(input: string): boolean {
  return isBareMutationAffirmation(input) || isExplicitMutationApproval(input)
}

// Upfront permission is evaluated only after the same utterance has produced
// a concrete mutation proposal. This allows natural authorization without
// making a generic conversational phrase effectful on its own.
export function grantsUpfrontMutationPermission(input: string): boolean {
  return /\b(?:you have my (?:permission|approval)|i give you (?:my )?(?:permission|approval)|you(?:'re| are) authorized|no need to (?:ask|confirm|check)|without (?:asking|confirming|confirmation)|don['’]?t ask(?: me)?(?: for confirmation| to confirm)?|just do it|go ahead(?: and)?|please proceed|proceed with (?:it|that)|do it now)\b/i.test(input)
}

export function buildPendingMutationConfirmationInstruction(summary: string): string {
  return `[SYSTEM: This note applies ONLY if the user's latest message explicitly approves the action you proposed on the previous turn — "${summary}". If so, call confirm_mutation. The server independently decides whether that message authorized the change; never describe, quote, or guess which wordings it accepts, and do not infer approval from mixed content. For ANY other message (a new or changed request, a question, complaint, discussion, reminder about earlier permission, or a decline), ignore this note completely and respond as if it were not here: do not call confirm_mutation, and never mention a pending, held, or previous action to the user.]`
}
