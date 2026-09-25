import { computeObservations } from '@/lib/orb-prompt'
import { isActive } from '@/lib/status-groups'
import { ORB_TODO_FIELD_SELECT, renderOrbTodoFactForPrompt, shapeOrbTodoFact } from '@/lib/orb-operations/todo-facts'

export type OrbContextAuth = {
  user: { id: string; email?: string | null; name?: string | null }
  role: string
  isAdmin: boolean
  admin: any
}

export type OrbActionSetReference = {
  kind: 'todo_set'
  tool: string
  ordinal: number
  codes: string[]
  summary: string
  createdAt: string
}

type PendingTodoOperation = { tool: string; params: Record<string, unknown> }

const COUNT_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
}

export function pendingTodoUndercount(
  input: string,
  operations: PendingTodoOperation[] | undefined,
): { claimed: number; actual: number } | null {
  if (!operations?.length || !operations.every(operation => operation.tool === 'create_todo')) return null
  if (!/\b(?:one more|another|add one|need one)\b/i.test(input)) return null
  const match = input.match(/\bonly\s+(?:have\s+)?(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)\b[^.!?]*\b(?:tasks?|todos?|to\s+dos?|to\s+do\s+is)\b/i)
  if (!match) return null
  const claimed = /^\d+$/.test(match[1]) ? Number(match[1]) : COUNT_WORDS[match[1].toLowerCase()]
  if (!Number.isFinite(claimed) || operations.length <= claimed) return null
  return { claimed, actual: operations.length }
}

export type OrbContext = Awaited<ReturnType<typeof buildOrbContext>>

export function todoCode(todo: any, productList: any[]): string {
  const p = productList.find((pp: any) => pp.id === todo.product_id)
  return `${p?.code ?? p?.name ?? '???'}-${todo.todo_number}`
}

export function isRecentTodoReference(input: string): boolean {
  return /\b(them|those|these|all of them|the ones|the tasks|the todos|the to dos)\b/i.test(input)
    || /\b(first|1st|second|2nd|third|3rd|last|latest|newest|initial|most recent)\b[^.!?]*\b(tasks|todos|to dos)\b/i.test(input)
}

export function buildTicketStatusRoutingHint(
  input: string,
  history: Array<{ text?: string | null }> | undefined,
  canUseQueryTickets: boolean,
): string {
  const asksStatus = /\b(open|closed|status|state|resolved|dismissed|active)\b/i.test(input)
  const explicitCodes = Array.from(input.matchAll(/\bTICKETS-(\d+)\b/gi), match => `TICKETS-${match[1]}`)
  const historyText = (history ?? []).map(h => h.text ?? '').join(' ')
  const ticketContext = /\bTICKETS-\d+\b|\bticket(s)?\b/i.test(historyText)
  const bareCodes = ticketContext && asksStatus
    ? Array.from(input.matchAll(/\b\d+\b/g), match => `TICKETS-${match[0]}`)
    : []
  const codes = Array.from(new Set([...explicitCodes, ...bareCodes]))
  const asksTicketStatus = codes.length > 0 && (asksStatus || /\bticket(s)?\b/i.test(input))
  if (!asksTicketStatus) return ''
  const tool = canUseQueryTickets ? 'query_tickets' : 'query_db table="tickets"'
  return `LIVE TICKET ROUTING: The latest user message asks for current ticket status for ${codes.join(', ')}. Do not answer from RECENT TICKETS or prior conversation text. Call ${tool} before answering; treat bare numbers in this follow-up as the listed TICKETS-N codes.`
}

export function resolveActionSetReference<T extends OrbActionSetReference>(
  input: string,
  actionSets: T[] | undefined,
): T | null {
  const sets = (actionSets ?? []).filter(set => set.kind === 'todo_set' && set.codes.length > 0)
  if (sets.length === 0 || !isRecentTodoReference(input)) return null
  const lower = input.toLowerCase()
  if (/\b(first|1st|initial)\b/.test(lower)) return sets[0] ?? null
  if (/\b(second|2nd)\b/.test(lower)) return sets[1] ?? null
  if (/\b(third|3rd)\b/.test(lower)) return sets[2] ?? null
  if (/\b(last|latest|most recent|newest|just created|all of them|them|those|these|the ones)\b/.test(lower)) return sets[sets.length - 1] ?? null
  return sets.length === 1 ? sets[0] : null
}

export async function buildOrbContext(
  supabase: any,
  auth: OrbContextAuth,
  options: { currentProductId?: string | null; onStage?: (name: string) => void } = {},
) {
  const traced = <T,>(name: string, request: PromiseLike<T> | T): Promise<T> =>
    Promise.resolve(request).then(
      result => {
        options.onStage?.(`context_${name}_loaded`)
        return result
      },
      error => {
        options.onStage?.(`context_${name}_failed`)
        throw error
      },
    )
  // Ordinary turns preload one deliberately small working set. Everything
  // outside it is loaded by the relevant read tool only when a request needs
  // it. The remaining calls are control-plane data (preferences, learned
  // behavior and priority definitions), not a second copy of the workspace.
  const currentTodosQuery = options.currentProductId
    ? supabase
        .from('todos')
        .select(`${ORB_TODO_FIELD_SELECT}, groups(name), categories(name), tickets!ticket_id(ticket_number)`)
        .eq('product_id', options.currentProductId)
        .in('status', ['open', 'in progress'])
        .is('deleted_at', null)
    : Promise.resolve({ data: [] })
  const [
    { data: products, error: productsError },
    { data: todos, error: todosError },
    { data: priorities, error: prioritiesError },
    { data: userProfile, error: userProfileError },
    { data: orbPreferences, error: preferencesError },
    { data: behaviorRules, error: behaviorRulesError },
    { data: orbMemories, error: memoriesError },
    { data: orbAdaptations, error: adaptationsError },
  ] = await Promise.all([
    traced('project_directory', supabase
      .from('projects')
      .select('id, name, code, created_by, users!created_by(first_name, last_name, email)')
      .eq('is_dormant', false)
      .is('deleted_at', null)
      .order('sort_order')),
    traced('current_project_active_todos', currentTodosQuery),
    traced('priorities', supabase.from('priorities').select('*').order('value')),
    traced('user_profile', supabase.from('users').select('timezone, first_name, last_name').eq('id', auth.user.id).maybeSingle()),
    traced('preferences', supabase.from('orb_preferences').select('key, value').eq('user_id', auth.user.id)),
    traced('behavior_rules', supabase.from('knowledge_repo').select('title, content').contains('tags', ['orb-behavior']).order('created_at', { ascending: false }).limit(20)),
    traced('memory', supabase.from('orb_memory').select('track, category, content, confidence, created_at').eq('user_id', auth.user.id).or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`).order('created_at', { ascending: false }).limit(30)),
    traced('adaptations', supabase.from('orb_adaptations').select('id, title, rule, category, activated_at').eq('user_id', auth.user.id).eq('status', 'active').order('activated_at', { ascending: false }).limit(20)),
  ])
  const contextError = productsError ?? todosError ?? prioritiesError ?? userProfileError
    ?? preferencesError ?? behaviorRulesError ?? memoriesError ?? adaptationsError
  if (contextError) throw new Error(contextError.message ?? String(contextError))

  const currentUserName = userProfile ? [userProfile.first_name, userProfile.last_name].filter(Boolean).join(' ') : ''
  const currentUser = { id: auth.user.id, email: auth.user.email, name: currentUserName || auth.user.name || null, roles: { name: auth.role } }
  const productList = products ?? []
  const dormantList: any[] = []
  const current = productList.find((p: any) => p.id === options.currentProductId)
  const todoList = current ? (todos ?? []).filter((t: any) => t.product_id === current.id && isActive(t.status)) : []
  const statusList = [
    { name: 'open', is_open: true, is_closed: false },
    { name: 'in progress', is_open: false, is_closed: false },
    { name: 'deferred', is_open: false, is_closed: false },
    { name: 'on hold', is_open: false, is_closed: false },
    { name: 'closed', is_open: false, is_closed: true },
  ]
  const priorityList = priorities ?? []
  const knowledgeList: any[] = []
  const auditList: any[] = []

  const userMap = new Map<string, string>()
  for (const project of productList) {
    const owner = Array.isArray(project.users) ? project.users[0] : project.users
    const ownerName = owner ? [owner.first_name, owner.last_name].filter(Boolean).join(' ') || owner.email : ''
    if (ownerName) userMap.set(project.created_by, ownerName)
  }
  if (currentUser.name) {
    userMap.set(auth.user.id, currentUser.name)
  } else if (!userMap.has(auth.user.id)) {
    userMap.set(auth.user.id, auth.user.email ?? 'you')
  }

  function todoLine(t: any): string {
    const project = productList.find((p: any) => p.id === t.product_id)
    return renderOrbTodoFactForPrompt(shapeOrbTodoFact({
      ...t,
      projects: project,
    }, project ? userMap.get(project.created_by) : undefined))
  }

  const projectDirectory = productList.map((p: any) => {
    const ownerName = userMap.get(p.created_by)
    return `- ${p.name}${p.code ? ` [code: ${p.code}]` : ''}${ownerName ? ` [Owner: ${ownerName}]` : ''}`
  }).join('\n') || '- No accessible active projects.'
  const currentTodos = todoList.map(todoLine).join('\n') || '  (none)'
  const currentSection = current
    ? `CURRENT PROJECT ACTIVE TODOS — complete for open + in progress only (${current.name}${current.code ? ` [code: ${current.code}]` : ''}):\n${currentTodos}`
    : 'CURRENT PROJECT ACTIVE TODOS: No current project is selected.'
  const contextString = `ACCESSIBLE ACTIVE PROJECT DIRECTORY — names, codes, and owners only:\n${projectDirectory}\n\n${currentSection}\n\nDATA BOUNDARY: Parked and closed todos, todos in other projects, dormant projects, descriptions, aggregate counts, audit history, tickets, knowledge, users, invitations, categories, and groups are intentionally not preloaded. Use the relevant read tool whenever the request needs one of those facts. Absence from this working context does not mean the record does not exist.`

  const userTimeZone = userProfile?.timezone || 'America/Los_Angeles'
  const preferenceList = (orbPreferences ?? []) as Array<{ key: string; value: string }>
  const guidanceLevel = preferenceList.find(p => p.key === 'guidance_level')?.value ?? 'gentle'
  const myProducts = current && current.created_by === auth.user.id ? [current] : []
  const myProductIds = new Set(myProducts.map((p: any) => p.id))
  const myTodos = todoList.filter((t: any) => myProductIds.has(t.product_id))
  const observationResult = guidanceLevel !== 'quiet'
    ? computeObservations(myTodos, myProducts)
    : { observations: [] as string[], nudgedTodoId: null }
  const observations = observationResult.observations
  // ORB-361 Phase 3.4: the todo whose no-reminder nudge was surfaced this turn.
  // Deliberately NOT stamped here — buildOrbContext also serves the eval route,
  // and an eval run must not write to the user's real todos. The production
  // conversation path stamps it; see orb-converse.ts.
  const nudgedTodoId = observationResult.nudgedTodoId
  const projectHealthPacket = { generatedAt: new Date().toISOString(), windowDays: 0, projects: [] }
  const projectHealthContext = ''
  const nextStepContext = ''

  const behaviorRuleList = (behaviorRules ?? []) as Array<{ title: string; content: string }>
  const memoryList = (orbMemories ?? []) as Array<{ track: string; category: string; content: string; confidence: number; created_at: string }>
  const adaptationList = (orbAdaptations ?? []) as Array<{ id: string; title: string; rule: string; category: string; activated_at: string }>

  return {
    productList,
    dormantList,
    todoList,
    statusList,
    priorityList,
    knowledgeList,
    auditList,
    current,
    currentUser,
    userMap,
    userTimeZone,
    preferenceList,
    guidanceLevel,
    observations,
    nudgedTodoId,
    projectHealthPacket,
    projectHealthContext,
    nextStepContext,
    behaviorRuleList,
    memoryList,
    adaptationList,
    contextString,
  }
}
