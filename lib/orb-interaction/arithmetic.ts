export class ArithmeticError extends Error {}

type Token = { type: 'number'; value: number } | { type: 'operator'; value: string }

function tokenize(expression: string): Token[] {
  if (!expression.trim() || expression.length > 500) throw new ArithmeticError('Expression is empty or too long.')
  const tokens: Token[] = []
  let index = 0
  while (index < expression.length) {
    const rest = expression.slice(index)
    const whitespace = rest.match(/^\s+/)
    if (whitespace) { index += whitespace[0].length; continue }
    const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)/)
    if (number) {
      tokens.push({ type: 'number', value: Number(number[0]) })
      index += number[0].length
      continue
    }
    const operator = rest[0]
    if ('+-*/()%'.includes(operator)) {
      tokens.push({ type: 'operator', value: operator })
      index += 1
      continue
    }
    throw new ArithmeticError(`Unsupported character at position ${index + 1}.`)
  }
  return tokens
}

export function calculateArithmetic(expression: string): number {
  const tokens = tokenize(expression)
  let position = 0
  const peek = (value?: string) => {
    const token = tokens[position]
    return token?.type === 'operator' && (value === undefined || token.value === value)
  }
  const consume = (value: string) => {
    if (!peek(value)) throw new ArithmeticError(`Expected “${value}”.`)
    position += 1
  }
  const primary = (): number => {
    if (peek('+') || peek('-')) {
      const sign = (tokens[position++] as { value: string }).value
      return sign === '-' ? -primary() : primary()
    }
    if (peek('(')) {
      consume('(')
      const value = sum()
      consume(')')
      return value
    }
    const token = tokens[position++]
    if (!token || token.type !== 'number') throw new ArithmeticError('Expected a number.')
    return token.value
  }
  const product = (): number => {
    let value = primary()
    while (peek('*') || peek('/') || peek('%')) {
      const operator = (tokens[position++] as { value: string }).value
      if (operator === '%') { value /= 100; continue }
      const right = primary()
      if (operator === '/' && right === 0) throw new ArithmeticError('Division by zero.')
      value = operator === '*' ? value * right : value / right
    }
    return value
  }
  const sum = (): number => {
    let value = product()
    while (peek('+') || peek('-')) {
      const operator = (tokens[position++] as { value: string }).value
      const right = product()
      value = operator === '+' ? value + right : value - right
    }
    return value
  }
  const result = sum()
  if (position !== tokens.length) throw new ArithmeticError('Unexpected trailing input.')
  if (!Number.isFinite(result)) throw new ArithmeticError('Result is not finite.')
  return Object.is(result, -0) ? 0 : result
}

const AGGREGATE_FIELDS: Record<string, string> = {
  total: 'total_count',
  open: 'open_count',
  'in progress': 'in_progress_count',
  active: 'active_count',
  deferred: 'deferred_count',
  'on hold': 'on_hold_count',
  parked: 'parked_count',
  closed: 'closed_count',
}

function numberValue(raw: string) {
  return Number(raw.replaceAll(',', ''))
}

type TodoAggregateFact = {
  status?: unknown
  project?: { code?: unknown; name?: unknown } | null
}

/** Deterministic per-project status summaries derived from a complete tool result. */
export function summarizeTodoFacts(rows: readonly TodoAggregateFact[]) {
  const grouped = new Map<string, {
    project: string
    total_count: number
    open_count: number
    in_progress_count: number
    active_count: number
    deferred_count: number
    on_hold_count: number
    parked_count: number
    closed_count: number
  }>()
  for (const row of rows) {
    const project = String(row.project?.code ?? row.project?.name ?? '').trim()
    if (!project) continue
    let summary = grouped.get(project)
    if (!summary) {
      summary = { project, total_count: 0, open_count: 0, in_progress_count: 0, active_count: 0, deferred_count: 0, on_hold_count: 0, parked_count: 0, closed_count: 0 }
      grouped.set(project, summary)
    }
    const status = String(row.status ?? '').toLocaleLowerCase()
    summary.total_count += 1
    if (status === 'open') summary.open_count += 1
    if (status === 'in progress') summary.in_progress_count += 1
    if (status === 'open' || status === 'in progress') summary.active_count += 1
    if (status === 'deferred') summary.deferred_count += 1
    if (status === 'on hold') summary.on_hold_count += 1
    if (status === 'deferred' || status === 'on hold') summary.parked_count += 1
    if (status === 'closed') summary.closed_count += 1
  }
  return [...grouped.values()]
}

export function aggregateSummariesContext(summaries: ReturnType<typeof summarizeTodoFacts>) {
  return summaries.map(summary => `SUMMARY: project=${summary.project}; total_count=${summary.total_count}; open_count=${summary.open_count}; in_progress_count=${summary.in_progress_count}; active_count=${summary.active_count}; deferred_count=${summary.deferred_count}; on_hold_count=${summary.on_hold_count}; parked_count=${summary.parked_count}; closed_count=${summary.closed_count}`).join('\n')
}

/**
 * Find aggregate claims that have neither a matching authoritative SUMMARY
 * field nor a deterministic calculator result. This is format-independent for
 * ordinary prose and Markdown tables; it validates the number/meaning pair,
 * not one particular table layout.
 */
export function unsupportedAggregateClaims(
  speech: string,
  context: string,
  calculatedResults: ReadonlySet<number>,
) {
  const authoritative = new Map<string, Set<number>>()
  for (const field of Object.values(AGGREGATE_FIELDS)) authoritative.set(field, new Set())
  for (const match of context.matchAll(/\b(total_count|open_count|in_progress_count|active_count|deferred_count|on_hold_count|parked_count|closed_count)=([\d,.]+)/g)) {
    authoritative.get(match[1])?.add(numberValue(match[2]))
  }

  const claims: Array<{ label: string; value: number }> = []
  const labels = 'in progress|on hold|total|open|active|deferred|parked|closed'
  for (const match of speech.matchAll(new RegExp(`\\b([\\d,]+(?:\\.\\d+)?)\\*{0,2}\\s+(?:total\\s+)?(${labels})\\b`, 'gi'))) {
    claims.push({ label: match[2].toLowerCase(), value: numberValue(match[1]) })
  }
  for (const match of speech.matchAll(new RegExp(`\\|\\s*\\*{0,2}(${labels})\\*{0,2}\\s*\\|\\s*\\*{0,2}([\\d,]+(?:\\.\\d+)?)\\*{0,2}\\s*\\|`, 'gi'))) {
    claims.push({ label: match[1].toLowerCase(), value: numberValue(match[2]) })
  }
  for (const match of speech.matchAll(/\b([\d,]+(?:\.\d+)?)\s*(?:%|percent\b)/gi)) {
    claims.push({ label: 'percentage', value: numberValue(match[1]) })
  }
  const derivedLabels = 'average|mean|ratio|difference|sum|product|subtotal'
  for (const match of speech.matchAll(new RegExp(`\\b([\\d,]+(?:\\.\\d+)?)\\s+(?:is\\s+the\\s+)?(${derivedLabels})\\b`, 'gi'))) {
    claims.push({ label: match[2].toLowerCase(), value: numberValue(match[1]) })
  }
  for (const match of speech.matchAll(new RegExp(`\\b(${derivedLabels})(?:\\s+is|\\s*[:=])?\\s*\\*{0,2}([\\d,]+(?:\\.\\d+)?)`, 'gi'))) {
    claims.push({ label: match[1].toLowerCase(), value: numberValue(match[2]) })
  }

  return claims.filter(claim => {
    if (calculatedResults.has(claim.value)) return false
    if (claim.label === 'percentage' || /^(average|mean|ratio|difference|sum|product|subtotal)$/.test(claim.label)) return true
    const field = AGGREGATE_FIELDS[claim.label]
    return !field || !authoritative.get(field)?.has(claim.value)
  })
}
