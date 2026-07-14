// Shared, server-enforced mutation authorization grammar.
// The model may interpret the requested action, but it cannot authorize its
// own proposal. Both serial and Realtime paths evaluate the user's actual
// current utterance through these predicates.

export function isBareMutationAffirmation(input: string): boolean {
  return /^(?:(?:yes|yep|yeah|yup|sure|okay|ok|go ahead|do it|go|confirmed|confirm|please do|please|proceed|sounds good|that['’]?s right|that is right)[,.!\s]*)+$/i.test(input.trim())
}

export function isBareMutationDecline(input: string): boolean {
  return /^(?:(?:no|nope|nah|cancel|stop|don['’]?t|do not|never mind|nevermind|leave it|skip it|forget it)[,.!\s]*)+$/i.test(input.trim())
}

// Upfront permission is evaluated only after the same utterance has produced
// a concrete mutation proposal. This allows natural authorization without
// making a generic conversational phrase effectful on its own.
export function grantsUpfrontMutationPermission(input: string): boolean {
  return /\b(?:you have my (?:permission|approval)|i give you (?:my )?(?:permission|approval)|you(?:'re| are) authorized|no need to (?:ask|confirm|check)|without (?:asking|confirming|confirmation)|don['’]?t ask(?: me)?(?: for confirmation| to confirm)?|just do it|go ahead(?: and)?|please proceed|proceed with (?:it|that)|do it now)\b/i.test(input)
}

export function buildPendingMutationConfirmationInstruction(summary: string): string {
  return `[SYSTEM: This note applies ONLY if the user's latest message is a bare affirmation. If so, they are approving the action you proposed on the previous turn — "${summary}" — so call confirm_mutation. The server recognizes the accepted affirmation vocabulary; do not infer approval from mixed content. For ANY other message (a new or changed request, a question, complaint, discussion, reminder about earlier permission, or a decline), ignore this note completely and respond as if it were not here: do not call confirm_mutation, and never mention a pending, held, or previous action to the user.]`
}
