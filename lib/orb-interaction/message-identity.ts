export type IdentifiedMessage = { id: string }

/**
 * Replace a local transcript message with its latest representation while
 * enforcing the durable event id as the one client identity for that row.
 */
export function reconcileMessageIdentity<T extends IdentifiedMessage>(
  messages: T[],
  localId: string,
  update: (message: T) => T,
): T[] {
  const localIndex = messages.findIndex(message => message.id === localId)
  if (localIndex < 0) return messages

  const replacement = update(messages[localIndex])
  return messages.flatMap((message, index) => {
    if (index === localIndex) return [replacement]
    if (message.id === replacement.id) return []
    return [message]
  })
}

/** Keep the last authoritative copy of each durable transcript event. */
export function uniqueMessagesById<T extends IdentifiedMessage>(messages: T[]): T[] {
  const lastIndexById = new Map<string, number>()
  messages.forEach((message, index) => lastIndexById.set(message.id, index))
  return messages.filter((message, index) => lastIndexById.get(message.id) === index)
}
