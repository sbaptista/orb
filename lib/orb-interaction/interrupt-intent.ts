/**
 * The interrupt contract shared by text and voice.
 *
 * A microphone hears things nobody meant as input: wind, a cough, a siren,
 * someone talking in the kitchen. Treating that sound as a cancellation
 * discarded approved changes (2026-09-16). So interruption has two kinds:
 *
 * - Pause speech — raised by sound alone (Silero / provider VAD). It stops or
 *   defers Orb's audio and writes nothing durable. If the sound turns out not
 *   to be trusted speech, the unfinished reply is spoken again.
 * - Cancel a turn — raised only by something the user clearly meant: the Stop
 *   button, a bare stop word, or a new request. Only this is durable.
 *
 * Of the durable reasons, only `stop` can block a confirmed commit that has not
 * yet run (enforced in confirm_orb_command_batch / confirm_orb_mutation by
 * scripts/migrations/20260916_orb_intentional_interrupts.sql). A replacement
 * lets an approved commit finish; leaving voice cancels nothing.
 */
export type OrbInterruptReason = 'stop' | 'replacement' | 'merge' | 'exit_voice'

/** Durable reasons that end an in-flight turn's uncommitted work and presentation. */
export const TURN_CANCELLING_INTERRUPT_REASONS: readonly OrbInterruptReason[] = ['stop', 'replacement', 'merge']

export function isOrbInterruptReason(value: unknown): value is OrbInterruptReason {
  return value === 'stop' || value === 'replacement' || value === 'merge' || value === 'exit_voice'
}

/**
 * A pause mid-sentence splits one request into fragments ("Now create test 9."
 * … "Stop."), and each fragment used to stop the one before, leaving a trail of
 * "Stopped." replies (2026-09-16). When the earlier turn has not shown any
 * reply yet, the new input continues it instead: the earlier turn is recorded
 * as `merge` (hidden from visible and model history) and the combined text is
 * submitted as one turn. Shared by text and voice.
 */
export function mergedTurnText(previousText: string, nextText: string): string {
  const previous = previousText.trim()
  const next = nextText.trim()
  if (!previous) return next
  if (!next) return previous

  const previousWords = previous.split(/\s+/)
  const nextWords = next.split(/\s+/)
  const comparable = (word: string) => word.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  const previousComparable = previousWords.map(comparable)
  const nextComparable = nextWords.map(comparable)
  const maxOverlap = Math.min(previousWords.length, nextWords.length)
  for (let length = maxOverlap; length > 0; length -= 1) {
    const previousSuffix = previousComparable.slice(-length)
    const nextPrefix = nextComparable.slice(0, length)
    if (previousSuffix.every((word, index) => word && word === nextPrefix[index])) {
      return [...previousWords, ...nextWords.slice(length)].join(' ')
    }
  }
  return `${previous} ${next}`
}

/** Reply to a bare stop word when nothing is running and nothing is pending. */
export const BARE_STOP_ACKNOWLEDGEMENT = 'Okay.'

/**
 * A bare, unmistakable request to stop — typed or spoken — with nothing else
 * in it. "Stop, and add milk" is a new request (a replacement), not a stop.
 */
export function isBareStopCommand(input: string): boolean {
  return /^(?:(?:stop|cancel|wait|hold on|hold off|never ?mind|no|nope|quiet|be quiet|shush|enough|that['’]s enough|stop talking)[,.!\s]*)+$/i
    .test(input.trim())
}

/**
 * A bare halt ("stop", "cancel", "wait") as opposed to a bare "no". With
 * nothing running and nothing pending, "no" is usually an answer to Orb's last
 * question ("Did you mean test8?") and still goes to the model; a halt does not.
 */
export function isBareHaltCommand(input: string): boolean {
  return isBareStopCommand(input) && !/^(?:(?:no|nope)[,.!\s]*)+$/i.test(input.trim())
}
