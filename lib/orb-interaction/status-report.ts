/** Explicit aggregate/presentation requests must not be collapsed into a
 * short conversational project-state summary. */
export function isTodoStatusBreakdownRequest(input: string): boolean {
  const asksBreakdown = /\b(status\s+breakdown|breakdown\s+by\s+status|status\s+counts?|count\s+by\s+status|by\s+(?:todo\s+)?(?:status|type))\b/i.test(input)
  const statusTerms = new Set(
    [...input.matchAll(/\b(open|in progress|deferred|on hold|closed|total)\b/gi)]
      .map(match => match[1].toLowerCase()),
  )
  const asksStatusTable = /\btable\b/i.test(input)
    && /\b(todo(?:s|'s)?|to[ -]?dos?|tasks?|projects?|backlog)\b/i.test(input)
    && (/\b(?:counts?|breakdown|by\s+(?:status|type))\b/i.test(input) || statusTerms.size >= 2)
  return asksBreakdown || asksStatusTable
}

export function isBroadProjectStateQuestion(input: string): boolean {
  return !isTodoStatusBreakdownRequest(input)
    && /\b(state|status|status update|update|snapshot|summary|overview)\b/i.test(input)
    && /\b(projects|project|backlog|everything|all|orb|helm)\b/i.test(input)
}

export type TodoStatusReportRow = {
  project: string
  open: number
  inProgress: number
  deferred: number
  onHold: number
  closed: number
  total: number
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function mentionedProject(input: string, projects: any[]) {
  const normalizedInput = ` ${normalize(input)} `
  return [...projects]
    .sort((a: any, b: any) => String(b.name ?? '').length - String(a.name ?? '').length)
    .find((project: any) => {
      const code = normalize(String(project.code ?? ''))
      const name = normalize(String(project.name ?? ''))
      return (code && normalizedInput.includes(` ${code} `))
        || (name && normalizedInput.includes(` ${name} `))
    }) ?? null
}

function markdownStatusTable(rows: TodoStatusReportRow[]) {
  return [
    '| Project | Open | In Progress | Deferred | On Hold | Closed | Total |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map(row => `| ${row.project.replaceAll('|', '\\|')} | ${row.open} | ${row.inProgress} | ${row.deferred} | ${row.onHold} | ${row.closed} | ${row.total} |`),
  ].join('\n')
}

/** Deterministic complete status report. Counts come from authoritative rows;
 * the model never reconstructs or adds them. */
export function buildTodoStatusReport(ctx: {
  productList: any[]
  todoList: any[]
  current?: any
  currentUserId: string
  input: string
}): { speech: string; spokenText: string; rows: TodoStatusReportRow[] } {
  const mentioned = mentionedProject(ctx.input, ctx.productList)
  const asksAcrossProjects = /\b(all|each|every)\b[^.!?]{0,40}\bprojects?\b|\bprojects\b[^.!?]{0,20}\b(?:by\s+(?:status|type)|status\s+breakdown)\b/i.test(ctx.input)
  const asksMine = /\bmy\s+projects?\b/i.test(ctx.input)
  const projects = mentioned
    ? [mentioned]
    : asksAcrossProjects
      ? ctx.productList.filter((project: any) => !asksMine || project.created_by === ctx.currentUserId)
      : ctx.current?.id ? [ctx.current] : []
  const rows = projects.map((project: any) => {
    const todos = ctx.todoList.filter((todo: any) => todo.product_id === project.id)
    const count = (status: string) => todos.filter((todo: any) => String(todo.status ?? '').toLowerCase() === status).length
    return {
      project: String(project.name ?? project.code ?? 'Unknown'),
      open: count('open'),
      inProgress: count('in progress'),
      deferred: count('deferred'),
      onHold: count('on hold'),
      closed: count('closed'),
      total: todos.length,
    }
  })
  if (rows.length === 0) {
    return { speech: 'I could not identify which project to summarize.', spokenText: 'I could not identify which project to summarize.', rows }
  }
  const speech = markdownStatusTable(rows)
  const spokenText = rows.length === 1
    ? `${rows[0].project} has ${rows[0].total} total to-dos: ${rows[0].open} open, ${rows[0].inProgress} in progress, ${rows[0].deferred} deferred, ${rows[0].onHold} on hold, and ${rows[0].closed} closed. The breakdown is on screen.`
    : `I put the complete status breakdown for ${rows.length} projects on screen.`
  return { speech, spokenText, rows }
}
