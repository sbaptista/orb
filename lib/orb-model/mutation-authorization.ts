import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_HAIKU_REFERENCE_MODEL } from './anthropic'

// Shared, server-enforced mutation authorization grammar.
// The model may interpret the requested action, but it cannot authorize its
// own proposal. Both serial and Realtime paths evaluate the user's actual
// current utterance through these predicates.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

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

// Shared hard filter: a question, a negation, or retrospective framing never
// authorizes anything, in the fast English path or the semantic fallback
// below. Applying this before any model call keeps the model narrowly scoped
// to "is this a genuine yes" — it never has to independently discover these
// guardrails, and a fast deterministic "no"/"already told you" never needs a
// network round trip to be correctly rejected.
function failsMutationApprovalGuards(text: string): boolean {
  if (!text) return true
  if (text.includes('?')) return true
  if (NEGATION.test(text)) return true
  if (RETROSPECTIVE_FRAMING.test(text)) return true
  return false
}

export function isExplicitMutationApproval(input: string): boolean {
  const text = input.trim()
  if (failsMutationApprovalGuards(text)) return false
  return MUTATION_APPROVAL_ACT.test(text)
}

// Multilingual fallback for the fast English path above. Only reached when
// isBareMutationAffirmation/isExplicitMutationApproval already found no
// match, so this never adds latency to an ordinary English confirmation.
// Fails closed (not authorized) on any error, timeout, or unclear result —
// this is an authorization boundary, not a best-effort classifier.
async function isSemanticMutationApproval(input: string): Promise<boolean> {
  const text = input.trim()
  if (failsMutationApprovalGuards(text)) return false
  try {
    const response = await anthropic.messages.create({
      model: ANTHROPIC_HAIKU_REFERENCE_MODEL,
      max_tokens: 5,
      temperature: 0,
      system: 'You are a strict binary classifier. The user was just asked to confirm a pending change; their exact response follows. Decide ONLY whether their response is an explicit, affirmative approval to proceed right now — in any language. Answer with exactly one word: YES or NO. Answer YES only for a clear, unambiguous "yes, proceed" in any language (e.g. "confirmed", "はい", "确认", "sí", "oui", "ja"). Answer NO for anything else, including a question, a decline, or discussion of a PAST approval or complaint rather than granting one now.',
      messages: [{ role: 'user', content: text.slice(0, 500) }],
    })
    const answer = response.content[0]?.type === 'text' ? response.content[0].text.trim().toUpperCase() : ''
    return answer.startsWith('YES')
  } catch (error) {
    console.error('[mutationAuthorization] semantic approval check failed:', error)
    return false
  }
}

// The single authorization predicate for a pending mutation: a bare
// affirmation, an unambiguous explicit approval of the proposed change (fast
// English path), or — only if neither matched — the same judgment made
// semantically so a genuine approval in any language is recognized.
export async function authorizesPendingMutation(input: string): Promise<boolean> {
  if (isBareMutationAffirmation(input) || isExplicitMutationApproval(input)) return true
  return isSemanticMutationApproval(input)
}

// Upfront permission is evaluated only after the same utterance has produced
// a concrete mutation proposal. This allows natural authorization without
// making a generic conversational phrase effectful on its own.
export function grantsUpfrontMutationPermission(input: string): boolean {
  return /\b(?:you have my (?:permission|approval)|i give you (?:my )?(?:permission|approval)|you(?:'re| are) authorized|no need to (?:ask|confirm|check)|without (?:asking|confirming|confirmation)|don['’]?t ask(?: me)?(?: for confirmation| to confirm)?|just do it|go ahead(?: and)?|please proceed|proceed with (?:it|that)|do it now)\b/i.test(input)
}

export function buildPendingMutationConfirmationInstruction(summary: string): string {
  return `[SYSTEM: This note applies ONLY if the user's latest message approves the action you proposed on the previous turn — "${summary}". Approval can be a short word or phrase in ANY language, not only English (e.g. "confirmed", "確認", "はい", "sí", "oui") — do not require it to read as a full English sentence, and do not treat an unfamiliar-looking or single-word reply as too ambiguous to act on. If the latest message could reasonably be read as such an approval, call confirm_mutation; the server, not you, makes the final determination and will reject it if it isn't one — never withhold the call because a plausible approval seemed uncertain to you. Never describe, quote, or guess which exact wordings the server accepts, and do not infer approval from mixed content. For ANY other message (a new or changed request, a question, complaint, discussion, reminder about earlier permission, or a decline), ignore this note completely and respond as if it were not here: do not call confirm_mutation, and never mention a pending, held, or previous action to the user.]`
}
