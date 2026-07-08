import { visibleProjectsQuery } from '@/lib/projects'
import { computeObservations } from '@/lib/orb-prompt'
import { isActive, isParked } from '@/lib/status-groups'
import { buildProjectHealthPacket, renderProjectHealthPacket } from '@/lib/orb-model/project-health'
import { buildNextStepPacket, renderNextStepPacket } from '@/lib/orb-model/next-step'

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

export type OrbContext = Awaited<ReturnType<typeof buildOrbContext>>

export function todoCode(todo: any, productList: any[]): string {
  const p = productList.find((pp: any) => pp.id === todo.product_id)
  return `${p?.code ?? p?.name ?? '???'}-${todo.todo_number}`
}

function normalizeProjectText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function findMentionedProject(input: string | undefined, productList: any[]): any | null {
  if (!input) return null
  const normalizedInput = ` ${normalizeProjectText(input)} `
  const projects = [...productList].sort((a: any, b: any) =>
    String(b.name ?? '').length - String(a.name ?? '').length
  )
  return projects.find((p: any) => {
    const code = normalizeProjectText(String(p.code ?? ''))
    const name = normalizeProjectText(String(p.name ?? ''))
    return (code && normalizedInput.includes(` ${code} `)) || (name && normalizedInput.includes(` ${name} `))
  }) ?? null
}

export function isBroadProjectStateQuestion(input: string): boolean {
  return /\b(state|status|status update|update|snapshot|summary|overview)\b/i.test(input)
    && /\b(projects|project|backlog|everything|all|orb|helm)\b/i.test(input)
}

export function isRecentTodoReference(input: string): boolean {
  return /\b(them|those|these|all of them|the ones|the tasks|the todos|the to dos)\b/i.test(input)
}

export function buildTicketStatusRoutingHint(
  input: string,
  history: Array<{ text?: string | null }> | undefined,
  canUseQueryTickets: boolean,
): string {
  const lower = input.toLowerCase()
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

export function buildVoiceProjectStateSummary(ctx: {
  productList: any[]
  todoList: any[]
  current?: any
  input?: string
}): string {
  type ProjectCount = { name: string; count: number }
  const visibleProjectIds = new Set(ctx.productList.map((p: any) => p.id))
  const activeTodos = ctx.todoList.filter((t: any) => visibleProjectIds.has(t.product_id) && isActive(t.status))
  const parkedTodos = ctx.todoList.filter((t: any) => visibleProjectIds.has(t.product_id) && isParked(t.status))
  const targetProject = findMentionedProject(ctx.input, ctx.productList) ?? ctx.current
  if (targetProject?.id) {
    const projectActive = activeTodos.filter((t: any) => t.product_id === targetProject.id)
    const projectParked = parkedTodos.filter((t: any) => t.product_id === targetProject.id)
    const inProgress = projectActive
      .filter((t: any) => /in[-_\s]?progress/i.test(String(t.status ?? '')))
      .slice(0, 2)
      .map((t: any) => todoCode(t, ctx.productList))
    const progressText = inProgress.length ? ` In progress: ${inProgress.join(' and ')}.` : ''
    return `${targetProject.name} has ${projectActive.length} active tasks and ${projectParked.length} parked items.${progressText} Nothing looks urgent from the current backlog.`
  }
  const activeByProject = ctx.productList
    .map((p: any) => ({ name: p.name, count: activeTodos.filter((t: any) => t.product_id === p.id).length }))
    .filter((p: ProjectCount) => p.count > 0)
    .sort((a: ProjectCount, b: ProjectCount) => b.count - a.count)
  const parkedByProject = ctx.productList
    .map((p: any) => ({ name: p.name, count: parkedTodos.filter((t: any) => t.product_id === p.id).length }))
    .filter((p: ProjectCount) => p.count > 0)
    .sort((a: ProjectCount, b: ProjectCount) => b.count - a.count)
  const notable = activeByProject[0]
    ? `${activeByProject[0].name} has the most active work with ${activeByProject[0].count}.`
    : parkedByProject[0]
      ? `${parkedByProject[0].name} has the largest parked backlog with ${parkedByProject[0].count}.`
      : 'Nothing is active right now.'
  return `Across your projects, you have ${activeTodos.length} active tasks and ${parkedTodos.length} parked items. ${notable}`
}

export async function buildOrbContext(
  supabase: any,
  auth: OrbContextAuth,
  options: { currentProductId?: string | null } = {},
) {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const [
    { data: products },
    { data: dormantProducts },
    { data: todos },
    { data: statuses },
    { data: priorities },
    { data: knowledge },
    { data: recentAudit },
    { data: userProfile },
    { data: categories },
    { data: groups },
    { data: roles },
    { data: platforms },
    { data: frictionLogs, count: frictionTotalCount },
    { data: invitations },
    { data: allUsers },
    { data: orbPreferences },
    { data: recentTickets },
    { data: behaviorRules },
    { data: orbMemories },
    { data: orbAdaptations },
  ] = await Promise.all([
    visibleProjectsQuery(supabase, 'id, name, code, description, created_by'),
    auth.isAdmin ? supabase.from('projects').select('id, name, code, created_by').eq('is_dormant', true).order('sort_order') : Promise.resolve({ data: [] }),
    supabase.from('todos').select('id, todo_number, title, description, status, priority_value, product_id, created_at, updated_at, closed_at, resolution_notes, due_at, urls, group_id, category_id, ticket_id, groups(name), categories(name), tickets!ticket_id(ticket_number)').is('deleted_at', null),
    supabase.from('statuses').select('*').order('sort_order'),
    supabase.from('priorities').select('*').order('value'),
    supabase.from('knowledge_repo').select('*, projects(code, name)').order('created_at', { ascending: false }).limit(25),
    supabase.from('audit_log').select('action, record_id, created_at, before, after, actor', { count: 'exact' }).gte('created_at', fourteenDaysAgo).order('created_at', { ascending: false }).limit(200),
    supabase.from('users').select('urgency_threshold_hours, timezone, first_name, last_name').eq('id', auth.user.id).maybeSingle(),
    supabase.from('categories').select('id, name, product_id').is('deleted_at', null).order('sort_order'),
    supabase.from('groups').select('id, name, product_id').is('deleted_at', null).order('sort_order'),
    supabase.from('roles').select('id, name').order('id'),
    supabase.from('platforms').select('id, name').order('id'),
    auth.isAdmin
      ? auth.admin.from('orb_friction').select('id, category, summary, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(20)
      : Promise.resolve({ data: [], count: 0 }),
    auth.isAdmin
      ? auth.admin.from('invitations').select('id, email, first_name, last_name, status, release_stage, invited_at, responded_at, decline_reason, role_id').order('invited_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    auth.isAdmin
      ? auth.admin.from('users').select('id, email, first_name, last_name, role_id, onboarded_at, release_stage').order('created_at')
      : Promise.resolve({ data: [] }),
    supabase.from('orb_preferences').select('key, value').eq('user_id', auth.user.id),
    auth.isAdmin
      ? auth.admin.from('tickets').select('id, ticket_number, type, summary, status, dismiss_reason, created_at, closed_at, detail').order('created_at', { ascending: false }).limit(10)
      : Promise.resolve({ data: [] }),
    supabase.from('knowledge_repo').select('title, content').contains('tags', ['orb-behavior']).order('created_at', { ascending: false }).limit(20),
    supabase.from('orb_memory').select('track, category, content, confidence, created_at').eq('user_id', auth.user.id).or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`).order('created_at', { ascending: false }).limit(30),
    supabase.from('orb_adaptations').select('id, title, rule, category, activated_at').eq('user_id', auth.user.id).eq('status', 'active').order('activated_at', { ascending: false }).limit(20),
  ])

  const currentUserName = userProfile ? [userProfile.first_name, userProfile.last_name].filter(Boolean).join(' ') : ''
  const currentUser = { id: auth.user.id, email: auth.user.email, name: currentUserName || auth.user.name || null, roles: { name: auth.role } }

  const productList = (products ?? []).filter((p: any) => auth.isAdmin || p.created_by === auth.user.id)
  const dormantList = dormantProducts ?? []
  const visibleProductIds = new Set(productList.map((p: any) => p.id))
  const todoList = (todos ?? []).filter((t: any) => visibleProductIds.has(t.product_id))
  const statusList = statuses ?? []
  const priorityList = priorities ?? []
  const knowledgeList = knowledge ?? []
  const todoIds = new Set(todoList.map((t: any) => t.id))
  const auditList = (recentAudit ?? []).filter((a: any) => todoIds.has(a.record_id))
  const current = productList.find((p: any) => p.id === options.currentProductId)
  const userList = allUsers ?? []

  const userMap = new Map<string, string>()
  for (const u of userList) {
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ')
    userMap.set(u.id, name || u.email)
  }
  if (currentUser.name) {
    userMap.set(auth.user.id, currentUser.name)
  } else if (!userMap.has(auth.user.id)) {
    userMap.set(auth.user.id, auth.user.email ?? 'you')
  }

  function todoLine(t: any): string {
    const parts = [`  ${todoCode(t, productList)} [P${t.priority_value ?? '-'}] [${t.status}] ${t.title}`]
    if (t.due_at) parts.push(`[Due: ${t.due_at.replace('T', ' ')}]`)
    if (t.groups?.name) parts.push(`[Group: ${t.groups.name}]`)
    if (t.categories?.name) parts.push(`[Cat: ${t.categories.name}]`)
    const ticketNum = t.tickets?.ticket_number
    if (ticketNum) parts.push(`[Linked: TICKETS-${ticketNum}]`)
    const urlList = Array.isArray(t.urls) ? t.urls : []
    if (urlList.length > 0) parts.push(`[${urlList.length} URL${urlList.length > 1 ? 's' : ''}]`)
    return parts.join(' ')
  }

  const byProduct = productList.map((p: any) => {
    const ownerName = userMap.get(p.created_by)
    const ownerTag = ownerName ? ` [Owner: ${ownerName}]` : ''
    const codeLabel = p.code ? ` [code: ${p.code}]` : ''
    const header = `${p.name}${codeLabel}${p.description ? ` (${p.description})` : ''}${ownerTag}`
    const projectTodos = todoList.filter((t: any) => t.product_id === p.id)
    const nonClosedTodos = projectTodos.filter((t: any) => !statusList.find((s: any) => s.name === t.status)?.is_closed)
    const activeTodos = nonClosedTodos.filter((t: any) => isActive(t.status))
    const parkedTodos = nonClosedTodos.filter((t: any) => isParked(t.status))
    const otherNonClosedTodos = nonClosedTodos.filter((t: any) => !isActive(t.status) && !isParked(t.status))
    const closedCount = projectTodos.length - nonClosedTodos.length
    const summary = `  SUMMARY: active_count=${activeTodos.length} (open + in progress); parked_count=${parkedTodos.length} (deferred + on hold); closed_count=${closedCount} (excluded)`
    const activeLine = activeTodos.map(todoLine).join('\n')
    const parkedLine = parkedTodos.map(todoLine).join('\n')
    const otherLine = otherNonClosedTodos.map(todoLine).join('\n')
    const sections = [summary]
    if (activeLine) sections.push(`  ACTIVE:\n${activeLine}`)
    if (parkedLine) sections.push(`  PARKED (on hold/deferred):\n${parkedLine}`)
    if (otherLine) sections.push(`  OTHER NON-CLOSED:\n${otherLine}`)
    return `${header}:\n${sections.join('\n')}`
  }).join('\n\n')

  const dormantSection = dormantList.length > 0
    ? `\n\nDORMANT (hidden from active views, no CRUD — use set_dormancy to wake):\n${dormantList.map((p: any) => `  ${p.name}${p.code ? ` [code: ${p.code}]` : ''}`).join(', ')}`
    : ''

  const categoryList = categories ?? []
  const groupList = groups ?? []
  const roleList = roles ?? []
  const platformList = platforms ?? []
  const frictionList = frictionLogs ?? []
  const invitationList = invitations ?? []

  const categoriesSection = categoryList.length > 0
    ? `\n\nCATEGORIES:\n${categoryList.map((c: any) => {
        const proj = productList.find((p: any) => p.id === c.product_id)
        return `  ${c.name}${proj ? ` (${proj.name})` : ''}`
      }).join('\n')}`
    : ''

  const groupsSection = groupList.length > 0
    ? `\n\nGROUPS:\n${groupList.map((g: any) => {
        const proj = productList.find((p: any) => p.id === g.product_id)
        return `  ${g.name}${proj ? ` (${proj.name})` : ''}`
      }).join('\n')}`
    : ''

  const rolesSection = roleList.length > 0
    ? `\n\nROLES: ${roleList.map((r: any) => r.name).join(', ')}`
    : ''

  const platformsSection = platformList.length > 0
    ? `\n\nPLATFORMS: ${platformList.map((p: any) => p.name).join(', ')}`
    : ''

  const frictionTotal = frictionTotalCount ?? frictionList.length
  const frictionLabel = frictionList.length < frictionTotal
    ? `showing ${frictionList.length} of ${frictionTotal}`
    : `${frictionList.length} total`
  const frictionSection = auth.isAdmin && frictionList.length > 0
    ? `\n\nFRICTION LOGS (${frictionLabel}, admin view):\n${frictionList.map((f: any) => `  [${f.category}] ${f.summary} (${new Date(f.created_at).toLocaleDateString()})`).join('\n')}`
    : ''

  const invitationsSection = auth.isAdmin && invitationList.length > 0
    ? `\n\nINVITATIONS (admin view):\n${invitationList.map((i: any) => {
        const role = roleList.find((r: any) => r.id === i.role_id)
        const roleName = role ? `, role: ${role.name}` : ''
        const declined = i.decline_reason ? ` — reason: ${i.decline_reason}` : ''
        return `  ${i.email} (${[i.first_name, i.last_name].filter(Boolean).join(' ') || 'no name'}) — ${i.status}${roleName}${i.release_stage ? `, ${i.release_stage}` : ''}${declined}`
      }).join('\n')}`
    : ''

  const usersSection = auth.isAdmin && userList.length > 0
    ? `\n\nUSERS (admin view, ${userList.length} total):\n${userList.map((u: any) => {
        const role = roleList.find((r: any) => r.id === u.role_id)
        return `  ${u.email} (${[u.first_name, u.last_name].filter(Boolean).join(' ') || 'no name'}) — ${role?.name ?? 'unknown role'}${u.onboarded_at ? ', onboarded' : ', not onboarded'}${u.release_stage ? `, ${u.release_stage}` : ''}`
      }).join('\n')}`
    : ''

  const extraContext = categoriesSection + groupsSection + rolesSection + platformsSection + frictionSection + invitationsSection + usersSection

  const urgencyThresholdHours = userProfile?.urgency_threshold_hours ?? 0
  const preferenceList = (orbPreferences ?? []) as Array<{ key: string; value: string }>
  const guidanceLevel = preferenceList.find(p => p.key === 'guidance_level')?.value ?? 'gentle'
  const myProducts = productList.filter((p: any) => p.created_by === auth.user.id)
  const myProductIds = new Set(myProducts.map((p: any) => p.id))
  const myTodos = todoList.filter((t: any) => myProductIds.has(t.product_id))
  const observations = guidanceLevel !== 'quiet' ? computeObservations(myTodos, myProducts) : []
  const projectHealthPacket = buildProjectHealthPacket({
    projects: productList,
    dormantProjects: dormantList,
    todos: todoList,
    statuses: statusList,
    priorities: priorityList,
    auditEvents: auditList,
    userMap,
    currentUserId: auth.user.id,
  })
  const projectHealthContext = renderProjectHealthPacket(projectHealthPacket)
  const nextStepContext = renderNextStepPacket(buildNextStepPacket({
    projects: productList,
    todos: todoList,
    priorities: priorityList,
    auditEvents: auditList,
    projectHealth: projectHealthPacket,
    currentUserId: auth.user.id,
    currentUserName: currentUser.name,
  }))

  const ticketList = (recentTickets ?? []) as Array<{ id: string; ticket_number: number; type: string; summary: string; status: string; dismiss_reason: string | null; created_at: string; closed_at: string | null; detail: Record<string, any> }>
  const ticketsSection = ticketList.length > 0
    ? `\n\nRECENT TICKETS (filed by you or the Orb — ${ticketList.length} most recent):\n${ticketList.map(t => {
        const status = t.status.toUpperCase()
        const dismissed = t.dismiss_reason ? ` — dismissed: ${t.dismiss_reason}` : ''
        const detail = t.detail?.detail ? ` | Detail: ${String(t.detail.detail).slice(0, 80)}` : ''
        return `  TICKETS-${t.ticket_number} [${status}] (${t.type}) ${t.summary}${dismissed}${detail}`
      }).join('\n')}\nUse this to avoid filing duplicates and to reference resolved issues.`
    : ''

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
    urgencyThresholdHours,
    preferenceList,
    guidanceLevel,
    observations,
    projectHealthPacket,
    projectHealthContext,
    nextStepContext,
    behaviorRuleList,
    memoryList,
    adaptationList,
    contextString: byProduct + dormantSection + extraContext + ticketsSection,
  }
}
