type DisplayRow = Record<string, unknown>

export type OrbQueryDisplayPacket = {
  kind?: string
  count?: number
  offset?: number
  tasks?: DisplayRow[]
  users?: DisplayRow[]
  invitations?: DisplayRow[]
}

function cell(value: unknown) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function markdownTable(headers: string[], rows: unknown[][]) {
  const heading = `| ${headers.join(' | ')} |`
  const divider = `| ${headers.map(() => '---').join(' | ')} |`
  return [heading, divider, ...rows.map(row => `| ${row.map(cell).join(' | ')} |`)].join('\n')
}

function fullName(row: DisplayRow) {
  return [row.first_name, row.last_name].filter(Boolean).join(' ')
}

function dateOnly(value: unknown) {
  return typeof value === 'string' ? value.slice(0, 10) : value
}

/**
 * Converts trusted structured query packets into the Markdown already rendered
 * by OrbConversation. Text and Realtime therefore use the same conversation
 * display surface; Realtime does not maintain a parallel table component.
 */
export function renderOrbQueryPacketMarkdown(packet: OrbQueryDisplayPacket | null | undefined) {
  if (!packet) return null

  if (packet.kind === 'todo_list' && packet.tasks?.length) {
    const table = markdownTable(
      ['Code', 'Title', 'Status'],
      packet.tasks.map(task => [task.code, task.title, task.status]),
    )
    const shown = packet.tasks.length
    const total = typeof packet.count === 'number' ? packet.count : shown
    const from = (typeof packet.offset === 'number' ? packet.offset : 0) + 1
    const to = from + shown - 1
    const note = total > shown
      ? `\n\n_${from}–${to} of ${total}${to < total ? '. Say "show the next page" for more.' : '. Last page.'}_`
      : ''
    return table + note
  }

  if (packet.kind === 'users_query' && packet.users?.length) {
    return markdownTable(
      ['Email', 'Name', 'Role', 'Onboarded', 'Release Stage'],
      packet.users.map(user => [
        user.email,
        fullName(user),
        user.role,
        dateOnly(user.onboarded_at),
        user.release_stage,
      ]),
    )
  }

  if (packet.kind === 'invitations_query' && packet.invitations?.length) {
    return markdownTable(
      ['Email', 'Name', 'Role', 'Status', 'Sent'],
      packet.invitations.map(invitation => [
        invitation.email,
        fullName(invitation),
        invitation.role,
        invitation.status,
        dateOnly(invitation.invited_at),
      ]),
    )
  }

  return null
}
