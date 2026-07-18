import { createHmac, timingSafeEqual } from 'node:crypto'
import { logAuditEvent } from '@/lib/audit'
import { getAuthContext, type AuthContext } from '@/lib/auth'
import { createTicket } from '@/app/actions/ticket-actions'
import { sendAdaptationEmail } from '@/lib/email'
import { ALLOWED_OPS, ALLOWED_TABLES, COLUMN_NAME_RE, SOFT_DELETE_TABLES } from '@/lib/db-schema'
import { getRealtimeVoiceAccess } from '@/lib/orb-realtime/access'
import { getNextStepPacket, getProjectDirectoryPacket, getTaskCountPacket, getTodoDetailsPacket, getTodoListPacket } from '@/lib/orb-realtime/fact-gateway'
import { fuzzyMatch, scoreTextMatch } from '@/lib/fuzzy-search'
import { authorizesPendingMutation, grantsUpfrontMutationPermission } from '@/lib/orb-model/mutation-authorization'
import { resolveKnowledgeReference } from '@/lib/orb-mutations'
import { getCapabilities, VALID_PREFERENCE_KEYS } from '@/lib/orb-prompt'
import { generateUniqueCode } from '@/lib/project-codes'
import { resolveProjectByReference } from '@/lib/projects'
import { queryRepository, type RepositoryOperation, type RepositorySource } from '@/lib/repository-reader'
import type { OrbRealtimeMutationReceipt, OrbRealtimeProposal } from '@/lib/orb-realtime/types'

export const runtime = 'nodejs'

const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1'

// Shared attribution rule (AGENTS.md working rule #9): every AI-authored
// resolution note / knowledge entry leads with `YYYY-MM-DD — Tool (Model)`.
function attribute(text: string) {
  const date = new Date().toISOString().slice(0, 10)
  return `${date} — Orb (${REALTIME_MODEL})\n\n${text.trim()}`
}

function attributeKnowledgeUpdate(text: string) {
  const withoutPriorStamp = text.replace(
    /^(?:\[Updated:[^\]]+\]|\d{4}-\d{2}-\d{2} — [^\n]+)\n\n/,
    '',
  )
  return attribute(withoutPriorStamp)
}

type ProposalPayload = { type: 'proposal'; proposalId: string; userId: string; expiresAt: number }
type TodoReferencePayload = { type: 'todo_reference'; todoId: string; userId: string; expiresAt: number }
type SignedPayload = ProposalPayload | TodoReferencePayload
type UpdateStatus = 'open' | 'in progress' | 'deferred' | 'on hold'

const UPDATE_STATUSES: UpdateStatus[] = ['open', 'in progress', 'deferred', 'on hold']

class RealtimeInputError extends Error {}

type ResolvedTodo = {
  id: string
  todo_number: number
  title: string
  status: string
  priority_value: number | null
  updated_at: string
  product_id: string
  projects: { id: string; name: string; code: string; created_by: string }
}

type ResolvedProject = {
  id: string
  name: string
  code: string
  description: string | null
  created_by: string
  updated_at: string
  is_dormant: boolean
}

async function accessibleProjectRows(auth: AuthContext): Promise<ResolvedProject[]> {
  let query = auth.admin
    .from('projects')
    .select('id, name, code, description, created_by, updated_at, is_dormant')
    .is('deleted_at', null)
  if (!auth.isAdmin) query = query.eq('created_by', auth.user.id)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as ResolvedProject[]
}

async function accessibleTodoRows(
  auth: AuthContext,
  options: { projectName?: string; currentProjectId?: string },
): Promise<ResolvedTodo[]> {
  let projectId: string | undefined
  if (options.projectName?.trim()) {
    let projectsQuery = auth.admin.from('projects').select('id, name, code, created_by').eq('is_dormant', false).is('deleted_at', null)
    if (!auth.isAdmin) projectsQuery = projectsQuery.eq('created_by', auth.user.id)
    const { data: projects, error } = await projectsQuery
    if (error) throw error
    const project = resolveProjectByReference(projects ?? [], options.projectName)
    if (!project) throw new RealtimeInputError(`Could not resolve one accessible project named “${options.projectName}”.`)
    projectId = project.id
  } else if (options.currentProjectId) {
    projectId = options.currentProjectId
  }

  let query = auth.admin
    .from('todos')
    .select('id, todo_number, title, status, priority_value, updated_at, product_id, projects!inner(id, name, code, created_by, is_dormant, deleted_at)')
    .is('deleted_at', null)
    .eq('projects.is_dormant', false)
    .is('projects.deleted_at', null)
  if (!auth.isAdmin) query = query.eq('projects.created_by', auth.user.id)
  if (projectId) query = query.eq('product_id', projectId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(row => ({
    ...row,
    projects: row.projects as unknown as ResolvedTodo['projects'],
  })) as ResolvedTodo[]
}

async function resolveTodoReference(
  auth: AuthContext,
  options: { reference: string; projectName?: string; currentProjectId?: string },
): Promise<ResolvedTodo> {
  const reference = options.reference.trim()
  if (!reference) throw new RealtimeInputError('Name the todo you want to change.')
  const codeLike = /^(.+)-(\d+)$/.test(reference.toUpperCase())
  const rows = await accessibleTodoRows(auth, {
    projectName: options.projectName,
    currentProjectId: codeLike ? undefined : options.currentProjectId,
  })
  const normalized = reference.toLowerCase().replace(/\s+/g, ' ')
  const exact = rows.filter(row => {
    const code = `${row.projects.code}-${row.todo_number}`.toLowerCase()
    return code === normalized || row.title.trim().toLowerCase().replace(/\s+/g, ' ') === normalized
  })
  const candidates = exact.length > 0 ? exact : rows.filter(row => fuzzyMatch(reference, row.title))
  if (candidates.length === 1) return candidates[0]
  if (candidates.length > 1) {
    const ranked = candidates
      .map(row => ({ row, score: scoreTextMatch(reference, row.title, '') }))
      .sort((a, b) => b.score - a.score)
    if (ranked[0].score > 0 && ranked[0].score > ranked[1].score) return ranked[0].row
    const names = ranked.slice(0, 5).map(({ row }) => `${row.projects.code}-${row.todo_number}, “${row.title}”, in ${row.projects.name}`).join('; ')
    throw new RealtimeInputError(`That todo reference is ambiguous: ${names}.`)
  }
  throw new RealtimeInputError(`Could not find one accessible todo matching “${reference}”.`)
}

async function confirmProposal(auth: AuthContext, proposalId: string) {
  const { data, error } = await auth.admin.rpc('confirm_realtime_mutation', {
    p_proposal_id: proposalId,
    p_user_id: auth.user.id,
  })
  if (error) throw error
  const result = data as { receipt: OrbRealtimeMutationReceipt; replayed: boolean } | null
  if (!result?.receipt) throw new Error('The database did not return a mutation receipt.')
  return result
}

function signingKey() {
  const key = process.env.ORB_REALTIME_PROPOSAL_SECRET || process.env.ORB_API_SECRET || process.env.OPENAI_API_KEY
  if (!key) throw new Error('Realtime proposal signing is not configured')
  return key
}

function signPayload(payload: SignedPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', signingKey()).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

function readPayload(token: string): SignedPayload {
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) throw new Error('Invalid proposal')
  const expected = createHmac('sha256', signingKey()).update(encoded).digest()
  const actual = Buffer.from(signature, 'base64url')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Invalid proposal')
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as SignedPayload
  if (payload.type !== 'proposal' && payload.type !== 'todo_reference') throw new Error('Invalid signed token')
  if (payload.expiresAt < Date.now()) throw new Error('Proposal expired')
  return payload
}

function readProposal(token: string) {
  const payload = readPayload(token)
  if (payload.type !== 'proposal') throw new Error('Invalid proposal')
  return payload
}

function readTodoReference(token: string) {
  const payload = readPayload(token)
  if (payload.type !== 'todo_reference') throw new Error('Invalid todo reference')
  return payload
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthContext()
    if (!getRealtimeVoiceAccess(auth.user.email).enabled) return Response.json({ error: 'Not found' }, { status: 404 })
    const body = await request.json() as {
      operation?: string
      projectId?: string
      projectScope?: 'named_project' | 'all_owned'
      projectName?: string
      statusScope?: 'open' | 'active' | 'parked' | 'all'
      code?: string
      todoReference?: string
      currentProjectId?: string
      textMatch?: string
      maxResults?: number
      title?: string
      name?: string
      description?: string
      proposalToken?: string
      referenceToken?: string
      newTitle?: string
      newStatus?: UpdateStatus
      newPriority?: number
      targetProjectName?: string
      newName?: string
      newDescription?: string
      resolutionNotes?: string
      knowledgeTitle?: string
      knowledgeContent?: string
      tags?: string[]
      query?: string
      ticketCode?: string
      ticketStatus?: string
      ticketScope?: 'active' | 'all'
      ticketType?: string
      search?: string
      tableName?: string
      action?: string
      since?: string
      repositoryOperation?: RepositoryOperation
      repositorySource?: RepositorySource
      path?: string
      startLine?: number
      endLine?: number
      clientAction?: 'switch_project' | 'open_settings' | 'open_help' | 'set_voice' | 'exit_voice'
      target?: string
      preferenceKey?: string
      preferenceValue?: string
      memoryTrack?: 'autonomous' | 'offered'
      memoryCategory?: 'pattern' | 'rhythm' | 'preference' | 'emotional' | 'milestone'
      content?: string
      context?: string
      adaptationTitle?: string
      adaptationRule?: string
      adaptationRationale?: string
      adaptationCategory?: 'communication' | 'observation' | 'coaching' | 'workflow'
      ticketSummary?: string
      ticketDetail?: string
      developerTarget?: string
      includeDormant?: boolean
      dbTable?: string
      dbSelect?: string
      dbFilters?: Array<{ column?: string; op?: string; value?: unknown }>
      dbOrder?: string
      userUtterance?: string
    }
    const startedAt = performance.now()

    if (body.operation === 'task_count') {
      const packet = await getTaskCountPacket(auth, {
        projectScope: body.projectScope,
        projectName: body.projectName,
        statusScope: body.statusScope,
      })
      return Response.json({ packet, gatewayMs: Math.round(performance.now() - startedAt) })
    }
    if (body.operation === 'project_directory') {
      const packet = await getProjectDirectoryPacket(auth)
      return Response.json({ packet, gatewayMs: Math.round(performance.now() - startedAt) })
    }
    if (body.operation === 'query_projects') {
      let query = auth.admin
        .from('projects')
        .select('id, name, description, created_by, is_dormant, sort_order, updated_at, users!created_by(first_name, last_name, email)')
        .is('deleted_at', null)
        .order('sort_order')
      if (!auth.isAdmin) query = query.eq('created_by', auth.user.id)
      if (!body.includeDormant) query = query.eq('is_dormant', false)
      const { data, error } = await query
      if (error) throw error
      let projects = data ?? []
      if (body.name?.trim()) {
        const resolved = resolveProjectByReference(projects, body.name)
        projects = resolved ? [resolved] : []
      }
      projects = projects.slice(0, Math.min(Math.max(body.maxResults ?? 50, 1), 100))
      const readableProjects = projects.map(project => {
        const ownerRecord = project.users as unknown as {
          first_name: string | null
          last_name: string | null
          email: string | null
        } | null
        const owner = [
          ownerRecord?.first_name,
          ownerRecord?.last_name,
        ].filter(Boolean).join(' ') || ownerRecord?.email || 'Unknown'
        return {
          id: project.id,
          name: project.name,
          description: project.description,
          owner,
          is_dormant: project.is_dormant,
          sort_order: project.sort_order,
          updated_at: project.updated_at,
        }
      })
      const projectFacts = readableProjects.map(project => {
        const facts = [
          `owner: ${project.owner}`,
          project.is_dormant ? 'dormant' : 'active',
        ]
        if (project.description) facts.push(`description: ${project.description}`)
        return `${project.name} (${facts.join('; ')})`
      })
      const packet = {
        kind: 'project_query',
        observedAt: new Date().toISOString(),
        source: 'database',
        statuses: [],
        count: readableProjects.length,
        projects: readableProjects,
        spokenText: readableProjects.length === 0
          ? 'I found no matching accessible projects.'
          : `I found ${readableProjects.length} ${readableProjects.length === 1 ? 'project' : 'projects'}: ${projectFacts.join(', ')}.`,
      }
      return Response.json({ packet, gatewayMs: Math.round(performance.now() - startedAt) })
    }
    if (body.operation === 'query_db') {
      const table = body.dbTable?.trim()
      if (!table || !ALLOWED_TABLES.has(table)) {
        return Response.json({ error: `Queryable tables are: ${[...ALLOWED_TABLES].join(', ')}.` }, { status: 400 })
      }
      const columns = (body.dbSelect || '*').split(',').map(column => column.trim()).filter(Boolean)
      if (columns.some(column => column !== '*' && !COLUMN_NAME_RE.test(column))) {
        return Response.json({ error: 'Database selects accept only plain allowlisted column names.' }, { status: 400 })
      }
      const client = auth.isAdmin ? auth.admin : auth.supabase
      let query = client.from(table).select(columns.join(','))
      let filtersDeletedAt = false
      for (const filter of body.dbFilters ?? []) {
        const column = filter.column?.trim() ?? ''
        const op = filter.op?.trim() ?? ''
        if (!COLUMN_NAME_RE.test(column) || !ALLOWED_OPS.has(op)) {
          return Response.json({ error: 'A database filter used an unsupported column or operator.' }, { status: 400 })
        }
        if (column === 'deleted_at') filtersDeletedAt = true
        switch (op) {
          case 'eq': query = query.eq(column, filter.value); break
          case 'neq': query = query.neq(column, filter.value); break
          case 'gt': query = query.gt(column, filter.value); break
          case 'gte': query = query.gte(column, filter.value); break
          case 'lt': query = query.lt(column, filter.value); break
          case 'lte': query = query.lte(column, filter.value); break
          case 'like': query = query.like(column, filter.value as string); break
          case 'ilike': query = query.ilike(column, filter.value as string); break
          case 'is': query = query.is(column, filter.value as null); break
          case 'not.is': query = query.not(column, 'is', filter.value); break
          case 'in': query = query.in(column, Array.isArray(filter.value) ? filter.value : [filter.value]); break
          case 'contains': query = query.contains(column, filter.value as string | readonly unknown[] | Record<string, unknown>); break
          case 'overlaps': query = query.overlaps(column, filter.value as never); break
        }
      }
      if (SOFT_DELETE_TABLES.has(table) && !filtersDeletedAt) query = query.is('deleted_at', null)
      if (body.dbOrder?.trim()) {
        const descending = body.dbOrder.startsWith('-')
        const column = descending ? body.dbOrder.slice(1) : body.dbOrder
        if (!COLUMN_NAME_RE.test(column)) {
          return Response.json({ error: 'Database order must name one plain column.' }, { status: 400 })
        }
        query = query.order(column, { ascending: !descending })
      }
      query = query.limit(Math.min(Math.max(body.maxResults ?? 50, 1), 200))
      const { data, error } = await query
      if (error) throw error
      const rows = (data ?? []).map(rawRow => {
        const row = rawRow as unknown as Record<string, unknown>
        return table === 'tickets' && row.ticket_number != null
          ? { ...row, code: `TICKETS-${row.ticket_number}` }
          : row
      })
      const packet = {
        kind: 'database_query',
        observedAt: new Date().toISOString(),
        source: 'database',
        statuses: [],
        count: rows.length,
        table,
        rows,
        spokenText: `The bounded ${table} query returned ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}.`,
      }
      return Response.json({ packet, gatewayMs: Math.round(performance.now() - startedAt) })
    }
    if (body.operation === 'todo_details') {
      const reference = body.todoReference ?? body.code
      if (!reference) return Response.json({ error: 'A todo name or code is required.' }, { status: 400 })
      const todo = await resolveTodoReference(auth, {
        reference,
        projectName: body.projectName,
        currentProjectId: body.currentProjectId,
      })
      const packet = await getTodoDetailsPacket(auth, { todoId: todo.id })
      if (!packet.task) throw new Error('The database did not return the todo reference.')
      const referenceToken = signPayload({
        type: 'todo_reference', todoId: packet.task.id, userId: auth.user.id, expiresAt: Date.now() + 2 * 60_000,
      })
      return Response.json({ packet, referenceToken, gatewayMs: Math.round(performance.now() - startedAt) })
    }
    if (body.operation === 'todo_list') {
      const packet = await getTodoListPacket(auth, {
        projectScope: body.projectScope,
        projectName: body.projectName,
        statusScope: body.statusScope,
        textMatch: body.textMatch,
        maxResults: body.maxResults,
      })
      return Response.json({ packet, gatewayMs: Math.round(performance.now() - startedAt) })
    }
    if (body.operation === 'next_step') {
      const packet = await getNextStepPacket(auth)
      return Response.json({ packet, gatewayMs: Math.round(performance.now() - startedAt) })
    }
    if (body.operation === 'search_knowledge') {
      const queryText = body.query?.trim()
      const titleReference = body.knowledgeTitle?.trim()
      if (queryText && titleReference) {
        return Response.json({ error: 'Use a topic query or a title reference, not both.' }, { status: 400 })
      }
      let entries: Array<{
        id: string
        title: string
        content: string
        tags: string[] | null
        updated_at: string | null
        product_id: string | null
        projects: { name: string; code: string } | null
      }> = []
      if (titleReference) {
        const resolution = await resolveKnowledgeReference(auth.admin, titleReference)
        if (resolution.status === 'not_found') {
          throw new RealtimeInputError(`Could not find a knowledge entry matching “${titleReference}”.`)
        }
        if (resolution.status === 'ambiguous') {
          throw new RealtimeInputError(`That knowledge title is ambiguous: ${resolution.candidates.slice(0, 5).map(item => `“${item.title}”`).join('; ')}.`)
        }
        const { data, error } = await auth.admin
          .from('knowledge_repo')
          .select('id, title, content, tags, updated_at, product_id, projects(name, code)')
          .eq('id', resolution.id)
          .single()
        if (error) throw error
        entries = [data as unknown as typeof entries[number]]
      } else {
        let projectId: string | undefined
        if (body.projectName?.trim()) {
          const { data: projects, error } = await auth.admin
            .from('projects')
            .select('id, name, code')
            .is('deleted_at', null)
          if (error) throw error
          const project = resolveProjectByReference(projects ?? [], body.projectName)
          if (!project) throw new RealtimeInputError(`Could not resolve one project named “${body.projectName}”.`)
          projectId = project.id
        }
        let knowledgeQuery = auth.admin
          .from('knowledge_repo')
          .select('id, title, content, tags, updated_at, product_id, projects(name, code)')
          .order('created_at', { ascending: false })
        if (projectId) knowledgeQuery = knowledgeQuery.eq('product_id', projectId)
        const { data, error } = await knowledgeQuery
        if (error) throw error
        const ranked = queryText
          ? (data ?? [])
              .map(entry => ({ entry, score: scoreTextMatch(queryText, entry.title, entry.content) }))
              .filter(item => item.score > 0)
              .sort((a, b) => b.score - a.score)
              .map(item => item.entry)
          : data ?? []
        entries = ranked.slice(0, Math.min(Math.max(body.maxResults ?? 5, 1), 10)) as unknown as typeof entries
      }
      const knowledgeEntries = entries.map(entry => ({
        id: entry.id,
        title: entry.title,
        content: entry.content,
        tags: entry.tags ?? [],
        project: entry.projects?.name ?? null,
        projectCode: entry.projects?.code ?? null,
        updatedAt: entry.updated_at,
      }))
      const packet = {
        kind: 'knowledge_search' as const,
        observedAt: new Date().toISOString(),
        source: 'database' as const,
        statuses: [],
        count: knowledgeEntries.length,
        knowledgeEntries,
        spokenText: knowledgeEntries.length === 0
          ? 'I found no matching knowledge entries.'
          : `I found ${knowledgeEntries.length} knowledge ${knowledgeEntries.length === 1 ? 'entry' : 'entries'}: ${knowledgeEntries.map(entry => `“${entry.title}”`).join(', ')}.`,
      }
      return Response.json({ packet, gatewayMs: Math.round(performance.now() - startedAt) })
    }
    if (body.operation === 'query_tickets') {
      if (!auth.isAdmin) {
        return Response.json({ error: 'Ticket inspection is admin-only.' }, { status: 403 })
      }
      const rawCode = body.ticketCode?.trim()
      let ticketNumber: number | undefined
      if (rawCode) {
        ticketNumber = Number.parseInt(rawCode.replace(/^TICKETS-/i, ''), 10)
        if (!Number.isInteger(ticketNumber)) {
          return Response.json({ error: `Could not parse ticket code “${rawCode}”.` }, { status: 400 })
        }
      }
      let query = auth.admin
        .from('tickets')
        .select('id, ticket_number, type, source, summary, status, dismiss_reason, resolution_notes, detail, conversation_snippet, created_at, closed_at, reported_by, users!reported_by(first_name, last_name), todos!todo_id(todo_number, projects!product_id(code))')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (ticketNumber !== undefined) query = query.eq('ticket_number', ticketNumber)
      else {
        if (body.ticketStatus) query = query.eq('status', body.ticketStatus)
        if ((body.ticketScope ?? 'active') === 'active') query = query.not('status', 'in', '("closed","dismissed")')
        if (body.search?.trim()) query = query.or(`summary.ilike.*${body.search.trim()}*,type.ilike.*${body.search.trim()}*`)
        query = query.limit(Math.min(Math.max(body.maxResults ?? 20, 1), 50))
      }
      const { data, error } = await query
      if (error) throw error
      const filtered = body.ticketType && ticketNumber === undefined
        ? (data ?? []).filter(ticket => ticket.type === body.ticketType)
        : data ?? []
      const tickets = filtered.map(ticket => {
        const reporter = ticket.users as unknown as { first_name: string | null; last_name: string | null } | null
        const linkedTodo = ticket.todos as unknown as { todo_number: number | null; projects: { code: string | null } | null } | null
        const compact: Record<string, unknown> = {
          code: `TICKETS-${ticket.ticket_number}`,
          type: ticket.type,
          status: ticket.status,
          summary: ticket.summary,
        }
        const reporterName = reporter ? [reporter.first_name, reporter.last_name].filter(Boolean).join(' ') : ''
        if (reporterName) compact.reporter = reporterName
        if (linkedTodo?.projects?.code && linkedTodo.todo_number != null) compact.linkedTodo = `${linkedTodo.projects.code}-${linkedTodo.todo_number}`
        if (ticketNumber !== undefined) {
          compact.source = ticket.source
          compact.detail = ticket.detail
          compact.conversationSnippet = ticket.conversation_snippet
          compact.dismissReason = ticket.dismiss_reason
          compact.resolutionNotes = ticket.resolution_notes
          compact.createdAt = ticket.created_at
          compact.closedAt = ticket.closed_at
        }
        return compact
      })
      const packet = {
        kind: 'ticket_query',
        observedAt: new Date().toISOString(),
        source: 'database',
        statuses: [],
        count: tickets.length,
        tickets,
        spokenText: tickets.length === 0
          ? 'I found no matching tickets.'
          : `I found ${tickets.length} ${tickets.length === 1 ? 'ticket' : 'tickets'}: ${tickets.map(ticket => `${ticket.code} (${ticket.status})`).join(', ')}.`,
      }
      return Response.json({ packet, gatewayMs: Math.round(performance.now() - startedAt) })
    }
    if (body.operation === 'query_audit') {
      let recordId: string | undefined
      if (body.code?.trim()) {
        const todo = await resolveTodoReference(auth, { reference: body.code })
        recordId = todo.id
      }
      let query = auth.admin
        .from('audit_log')
        .select('action, table_name, record_id, before, after, actor, user_id, created_at')
        .order('created_at', { ascending: false })
      if (recordId) query = query.eq('record_id', recordId)
      if (body.tableName) query = query.eq('table_name', body.tableName)
      if (body.action) query = query.eq('action', body.action)
      if (body.since) query = query.gte('created_at', body.since)
      query = query.limit(Math.min(Math.max(body.maxResults ?? 10, 1), 50))
      const { data, error } = await query
      if (error) throw error
      const events = data ?? []
      const packet = {
        kind: 'audit_query',
        observedAt: new Date().toISOString(),
        source: 'database',
        statuses: [],
        count: events.length,
        events,
        spokenText: events.length === 0
          ? 'I found no matching audit events.'
          : `I found ${events.length} audit ${events.length === 1 ? 'event' : 'events'}; the newest is ${events[0].action} on ${events[0].table_name} at ${events[0].created_at}.`,
      }
      return Response.json({ packet, gatewayMs: Math.round(performance.now() - startedAt) })
    }
    if (body.operation === 'query_repository') {
      if (!body.repositoryOperation) {
        return Response.json({ error: 'A repository operation is required.' }, { status: 400 })
      }
      const repositoryResult = await queryRepository({
        operation: body.repositoryOperation,
        source: body.repositorySource,
        path: body.path,
        query: body.query,
        start_line: body.startLine,
        end_line: body.endLine,
        max_results: body.maxResults,
      }, {
        userId: auth.user.id,
        canInspectRepository: auth.canInspectRepository,
      })
      const count = 'matches' in repositoryResult
        ? repositoryResult.matches.length
        : 'files' in repositoryResult
          ? repositoryResult.files.length
          : 1
      const packet = {
        kind: 'repository_query',
        observedAt: new Date().toISOString(),
        source: 'repository',
        statuses: [],
        count,
        repositoryResult,
        spokenText: body.repositoryOperation === 'read'
          ? `Read ${repositoryResult.path}, lines ${repositoryResult.start_line} through ${repositoryResult.end_line}.`
          : `Repository ${body.repositoryOperation} returned ${count} ${count === 1 ? 'result' : 'results'}.`,
      }
      return Response.json({ packet, gatewayMs: Math.round(performance.now() - startedAt) })
    }
    if (body.operation === 'client_action') {
      if (!body.clientAction) return Response.json({ error: 'A client action is required.' }, { status: 400 })
      let target = body.target?.trim()
      if (body.clientAction === 'switch_project') {
        if (!target) return Response.json({ error: 'Name the project to switch to.' }, { status: 400 })
        const project = resolveProjectByReference(await accessibleProjectRows(auth), target)
        if (!project) throw new RealtimeInputError(`Could not resolve one accessible project named “${target}”.`)
        target = project.name
      }
      if (body.clientAction === 'set_voice' && !target) {
        return Response.json({ error: 'Name the voice to use.' }, { status: 400 })
      }
      const clientAction = { action: body.clientAction, ...(target ? { target } : {}) }
      const spokenText = body.clientAction === 'switch_project'
        ? `Switched to ${target}.`
        : body.clientAction === 'open_settings'
          ? 'Opening Settings.'
          : body.clientAction === 'open_help'
            ? 'Opening Help.'
            : body.clientAction === 'set_voice'
              ? `Saved ${target} as the voice for the next voice session.`
              : 'Ending voice mode.'
      return Response.json({ clientAction, spokenText, gatewayMs: Math.round(performance.now() - startedAt) })
    }
    if (body.operation === 'set_project_dormancy') {
      const reference = body.name?.trim()
      if (!reference) return Response.json({ error: 'Name the project to change.' }, { status: 400 })
      const project = resolveProjectByReference(await accessibleProjectRows(auth), reference)
      if (!project) throw new RealtimeInputError(`Could not resolve one accessible project named “${reference}”.`)
      const dormant = body.preferenceValue === 'dormant'
      if (project.is_dormant === dormant) {
        return Response.json({
          mutated: false,
          spokenText: dormant ? `${project.name} is already asleep.` : `${project.name} is already awake.`,
          gatewayMs: Math.round(performance.now() - startedAt),
        })
      }
      const { data: updated, error } = await auth.admin
        .from('projects')
        .update({ is_dormant: dormant })
        .eq('id', project.id)
        .select('id, name, code, is_dormant')
        .single()
      if (error) throw error
      await logAuditEvent({
        action: 'project_dormancy',
        table_name: 'projects',
        record_id: project.id,
        before: { is_dormant: project.is_dormant },
        after: { is_dormant: dormant },
        actor: 'orb',
        user_id: auth.user.id,
      })
      return Response.json({
        mutated: true,
        project: updated,
        spokenText: dormant ? `Put ${updated.name} to sleep.` : `Woke ${updated.name}.`,
        gatewayMs: Math.round(performance.now() - startedAt),
      })
    }
    if (body.operation === 'get_preferences') {
      const { data, error } = await auth.admin
        .from('orb_preferences')
        .select('key, value, updated_at')
        .eq('user_id', auth.user.id)
        .order('key')
      if (error) throw error
      const packet = {
        kind: 'preferences',
        observedAt: new Date().toISOString(),
        source: 'database',
        statuses: [],
        count: data?.length ?? 0,
        preferences: data ?? [],
        available: VALID_PREFERENCE_KEYS,
        spokenText: data?.length
          ? `You have ${data.length} saved Orb ${data.length === 1 ? 'preference' : 'preferences'}.`
          : 'You have no custom Orb preferences; defaults are active.',
      }
      return Response.json({ packet, gatewayMs: Math.round(performance.now() - startedAt) })
    }
    if (body.operation === 'set_preference') {
      const key = body.preferenceKey?.trim()
      const value = body.preferenceValue?.trim()
      const definition = key ? VALID_PREFERENCE_KEYS[key] : undefined
      if (!key || !definition) return Response.json({ error: 'That preference key is not supported.' }, { status: 400 })
      if (!value || !definition.values.includes(value)) {
        return Response.json({ error: `Valid values for ${key} are: ${definition.values.join(', ')}.` }, { status: 400 })
      }
      const { error } = await auth.admin.from('orb_preferences').upsert({
        user_id: auth.user.id,
        key,
        value,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,key' })
      if (error) throw error
      return Response.json({
        mutated: true,
        spokenText: `Saved the Orb preference ${key} as ${value}.`,
        gatewayMs: Math.round(performance.now() - startedAt),
      })
    }
    if (body.operation === 'recall_memories') {
      const { data: preference } = await auth.admin
        .from('orb_preferences')
        .select('value')
        .eq('user_id', auth.user.id)
        .eq('key', 'memory_level')
        .maybeSingle()
      if (preference?.value === 'off') {
        return Response.json({
          packet: {
            kind: 'memory_recall',
            observedAt: new Date().toISOString(),
            source: 'database',
            statuses: [],
            count: 0,
            memories: [],
            spokenText: 'Memory is disabled in your Orb preferences.',
          },
          gatewayMs: Math.round(performance.now() - startedAt),
        })
      }
      let query = auth.admin
        .from('orb_memory')
        .select('id, track, category, content, confidence, created_at')
        .eq('user_id', auth.user.id)
        .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })
        .limit(Math.min(Math.max(body.maxResults ?? 10, 1), 30))
      if (body.memoryCategory) query = query.eq('category', body.memoryCategory)
      if (body.query?.trim()) query = query.ilike('content', `%${body.query.trim()}%`)
      const { data, error } = await query
      if (error) throw error
      const packet = {
        kind: 'memory_recall',
        observedAt: new Date().toISOString(),
        source: 'database',
        statuses: [],
        count: data?.length ?? 0,
        memories: data ?? [],
        spokenText: data?.length
          ? `I found ${data.length} matching ${data.length === 1 ? 'memory' : 'memories'}.`
          : 'I found no matching memories.',
      }
      return Response.json({ packet, gatewayMs: Math.round(performance.now() - startedAt) })
    }
    if (body.operation === 'save_memory') {
      const { data: preference } = await auth.admin
        .from('orb_preferences')
        .select('value')
        .eq('user_id', auth.user.id)
        .eq('key', 'memory_level')
        .maybeSingle()
      const memoryLevel = preference?.value ?? 'full'
      if (memoryLevel === 'off') return Response.json({ error: 'Memory is disabled.' }, { status: 400 })
      if (!body.memoryTrack || !body.memoryCategory || !body.content?.trim()) {
        return Response.json({ error: 'Memory track, category, and content are required.' }, { status: 400 })
      }
      const expiresAt = memoryLevel === 'session'
        ? new Date(new Date().setUTCHours(23, 59, 59, 999)).toISOString()
        : null
      const { data, error } = await auth.admin.from('orb_memory').insert({
        user_id: auth.user.id,
        track: body.memoryTrack,
        category: body.memoryCategory,
        content: body.content.trim().slice(0, 4000),
        context: body.context?.trim().slice(0, 4000) || null,
        expires_at: expiresAt,
      }).select('id').single()
      if (error) throw error
      return Response.json({
        mutated: true,
        memoryId: data.id,
        spokenText: 'Saved that memory.',
        gatewayMs: Math.round(performance.now() - startedAt),
      })
    }
    if (body.operation === 'propose_adaptation') {
      const allowed = new Set(['communication', 'observation', 'coaching', 'workflow'])
      if (!body.adaptationTitle?.trim() || !body.adaptationRule?.trim() || !body.adaptationRationale?.trim()
        || !body.adaptationCategory || !allowed.has(body.adaptationCategory) || !auth.user.email) {
        return Response.json({ error: 'A valid adaptation title, rule, rationale, category, and user email are required.' }, { status: 400 })
      }
      const { data: adaptation, error } = await auth.admin.from('orb_adaptations').insert({
        user_id: auth.user.id,
        title: body.adaptationTitle.trim().slice(0, 240),
        rule: body.adaptationRule.trim().slice(0, 4000),
        rationale: body.adaptationRationale.trim().slice(0, 4000),
        category: body.adaptationCategory,
        status: 'proposed',
      }).select('id, title, rule, rationale, category, status').single()
      if (error) throw error
      const emailResult = await sendAdaptationEmail({
        to: auth.user.email,
        adaptation,
        origin: new URL(request.url).origin,
      })
      if (emailResult.error) {
        await auth.admin.from('orb_adaptations').delete().eq('id', adaptation.id)
        throw new Error(emailResult.error)
      }
      await logAuditEvent({
        action: 'adaptation_proposed',
        table_name: 'orb_adaptations',
        record_id: adaptation.id,
        after: adaptation,
        actor: 'orb',
        user_id: auth.user.id,
      })
      return Response.json({
        mutated: true,
        adaptationId: adaptation.id,
        spokenText: `Proposed the adaptation “${adaptation.title}” and sent it for your approval.`,
        gatewayMs: Math.round(performance.now() - startedAt),
      })
    }
    if (body.operation === 'create_ticket') {
      const type = body.ticketType as 'bug' | 'suggestion' | 'capability_gap' | 'workflow_friction' | undefined
      if (!type || !body.ticketSummary?.trim()) {
        return Response.json({ error: 'Ticket type and summary are required.' }, { status: 400 })
      }
      const result = await createTicket({
        source: 'user-request',
        type,
        summary: body.ticketSummary.trim().slice(0, 500),
        detail: body.ticketDetail?.trim().slice(0, 4000) || undefined,
        conversation_snippet: body.userUtterance?.slice(0, 4000),
        reportedBy: auth.user.id,
      })
      if (result.error) throw new Error(result.error)
      return Response.json({
        mutated: true,
        ticketCode: result.data?.code,
        spokenText: `Noted ${result.data?.code}.`,
        gatewayMs: Math.round(performance.now() - startedAt),
      })
    }
    if (body.operation === 'query_capabilities') {
      const capabilities = getCapabilities(body.query || 'all', auth.canInspectRepository)
      return Response.json({
        packet: {
          kind: 'capabilities',
          observedAt: new Date().toISOString(),
          source: 'contract',
          statuses: [],
          count: Object.keys(capabilities).length,
          capabilities,
          spokenText: 'Loaded the current Orb capability contract.',
        },
        gatewayMs: Math.round(performance.now() - startedAt),
      })
    }
    if (body.operation === 'send_to_developer') {
      if (!body.content?.trim()) return Response.json({ error: 'A developer message is required.' }, { status: 400 })
      const target = body.developerTarget?.trim() || 'Developer Tool'
      const { error } = await auth.admin.from('dev_channel').insert({
        direction: 'orb_to_dev',
        sender_label: `Orb (${REALTIME_MODEL})`,
        content: body.content.trim().slice(0, 8000),
        product_id: body.currentProjectId,
        metadata: { target_tool: target },
      })
      if (error) throw error
      return Response.json({
        mutated: true,
        spokenText: `Sent that message to ${target}.`,
        gatewayMs: Math.round(performance.now() - startedAt),
      })
    }
    if (body.operation === 'propose_create_todo') {
      const title = body.title?.trim().slice(0, 240)
      if (!title) return Response.json({ error: 'A todo title is required.' }, { status: 400 })
      let projectQuery = auth.admin.from('projects').select('id, name, code, created_by').eq('is_dormant', false).is('deleted_at', null)
      if (!auth.isAdmin) projectQuery = projectQuery.eq('created_by', auth.user.id)
      let project: { id: string; name: string; code: string; created_by: string } | null = null
      let projectError: { message: string } | null = null
      if (body.projectName?.trim()) {
        const result = await projectQuery
        projectError = result.error
        project = resolveProjectByReference(result.data ?? [], body.projectName)
      } else if (body.projectId) {
        const result = await projectQuery.eq('id', body.projectId).maybeSingle()
        projectError = result.error
        project = result.data
      }
      if (projectError || !project || (!auth.isAdmin && project.created_by !== auth.user.id)) {
        return Response.json({ error: 'Choose a project you can edit before creating the todo.' }, { status: 400 })
      }
      const payload: ProposalPayload = {
        type: 'proposal', proposalId: crypto.randomUUID(), userId: auth.user.id, expiresAt: Date.now() + 5 * 60_000,
      }
      const { error: proposalError } = await auth.admin.from('orb_realtime_proposals').insert({
        id: payload.proposalId,
        user_id: auth.user.id,
        project_id: project.id,
        kind: 'create_todo',
        title,
        expires_at: new Date(payload.expiresAt).toISOString(),
      })
      if (proposalError) throw proposalError
      if (grantsUpfrontMutationPermission(body.userUtterance ?? '')) {
        const result = await confirmProposal(auth, payload.proposalId)
        return Response.json({ ...result, preAuthorized: true, gatewayMs: Math.round(performance.now() - startedAt) })
      }
      const proposal: OrbRealtimeProposal = {
        kind: 'create_todo', proposalToken: signPayload(payload), title,
        project: { id: project.id, name: project.name, code: project.code },
        spokenText: `Confirm: create “${title}” in ${project.name}?`,
      }
      return Response.json({ proposal, gatewayMs: Math.round(performance.now() - startedAt) })
    }
    if (body.operation === 'propose_create_project' || body.operation === 'propose_update_project' || body.operation === 'propose_delete_project') {
      const proposalId = crypto.randomUUID()
      const expiresAt = Date.now() + 5 * 60_000
      let kind: OrbRealtimeProposal['kind']
      let project: ResolvedProject | null = null
      let title: string
      let spokenText: string
      let changes: OrbRealtimeProposal['changes']
      const params: Record<string, unknown> = {}

      if (body.operation === 'propose_create_project') {
        title = body.name?.trim().slice(0, 240) ?? ''
        if (!title) return Response.json({ error: 'A project name is required.' }, { status: 400 })
        const existing = (await accessibleProjectRows(auth)).filter(
          item => item.created_by === auth.user.id && item.name.trim().toLowerCase() === title.toLowerCase(),
        )
        if (existing.length > 0) {
          return Response.json({ error: `A project named “${title}” already exists.` }, { status: 400 })
        }
        const candidateCode = await generateUniqueCode(auth.admin, title, auth.user.id)
        const description = body.description?.trim().slice(0, 4000) || null
        params.candidate_code = candidateCode
        params.description = description
        kind = 'create_project'
        project = {
          id: '',
          name: title,
          code: candidateCode,
          description,
          created_by: auth.user.id,
          updated_at: '',
          is_dormant: false,
        }
        spokenText = `Confirm: create the project “${title}”?`
      } else {
        const reference = body.name?.trim()
        if (!reference) return Response.json({ error: 'Name the project you want to change.' }, { status: 400 })
        const projects = await accessibleProjectRows(auth)
        project = resolveProjectByReference(projects, reference)
        if (!project) {
          return Response.json({ error: `Could not resolve one accessible project named “${reference}”.` }, { status: 400 })
        }
        title = project.name
        params.expected_updated_at = project.updated_at
        params.expected_name = project.name
        params.expected_code = project.code
        params.expected_description = project.description
        if (body.operation === 'propose_update_project') {
          const newName = body.newName?.trim().slice(0, 240)
          if (body.newName !== undefined && !newName) {
            return Response.json({ error: 'The new project name cannot be empty.' }, { status: 400 })
          }
          const newDescription = body.newDescription !== undefined
            ? body.newDescription.trim().slice(0, 4000) || null
            : undefined
          changes = {
            ...(body.newName !== undefined ? { name: newName } : {}),
            ...(body.newDescription !== undefined ? { description: newDescription } : {}),
          }
          if (Object.keys(changes).length === 0) {
            return Response.json({ error: 'Describe at least one project change.' }, { status: 400 })
          }
          if (changes.name !== undefined) params.new_name = changes.name
          if (body.newDescription !== undefined) params.new_description = changes.description
          const changeText = [
            changes.name !== undefined ? `rename it to “${changes.name}”` : '',
            body.newDescription !== undefined ? 'update its description' : '',
          ].filter(Boolean).join(' and ')
          kind = 'update_project'
          spokenText = `Confirm: ${changeText} for the project “${project.name}”?`
        } else {
          kind = 'delete_project'
          spokenText = `Confirm: permanently delete the project “${project.name}” and all of its todos? This cannot be undone.`
        }
      }

      if (!project) throw new Error('The project proposal lost its resolved project.')
      const proposalProject = project
      const { error: proposalError } = await auth.admin.from('orb_realtime_proposals').insert({
        id: proposalId,
        user_id: auth.user.id,
        project_id: proposalProject.id || null,
        kind,
        title,
        params,
        expires_at: new Date(expiresAt).toISOString(),
      })
      if (proposalError) throw proposalError
      if (grantsUpfrontMutationPermission(body.userUtterance ?? '')) {
        const result = await confirmProposal(auth, proposalId)
        return Response.json({ ...result, preAuthorized: true, gatewayMs: Math.round(performance.now() - startedAt) })
      }
      const proposal: OrbRealtimeProposal = {
        kind,
        proposalToken: signPayload({ type: 'proposal', proposalId, userId: auth.user.id, expiresAt }),
        project: { id: proposalProject.id, name: proposalProject.name, code: proposalProject.code },
        title,
        ...(changes ? { changes } : {}),
        spokenText,
      }
      return Response.json({ proposal, gatewayMs: Math.round(performance.now() - startedAt) })
    }
    if (body.operation === 'propose_add_knowledge' || body.operation === 'propose_update_knowledge') {
      const proposalId = crypto.randomUUID()
      const expiresAt = Date.now() + 5 * 60_000
      let kind: OrbRealtimeProposal['kind']
      let project: { id: string; name: string; code: string }
      let title: string
      let spokenText: string
      let changes: OrbRealtimeProposal['changes']
      const params: Record<string, unknown> = {}

      if (body.operation === 'propose_add_knowledge') {
        title = body.knowledgeTitle?.trim().slice(0, 240) ?? ''
        const content = body.knowledgeContent?.trim().slice(0, 12_000) ?? ''
        if (!title || !content) {
          return Response.json({ error: 'A knowledge title and content are required.' }, { status: 400 })
        }
        let projectQuery = auth.admin
          .from('projects')
          .select('id, name, code, created_by')
          .is('deleted_at', null)
        if (!auth.isAdmin) projectQuery = projectQuery.eq('created_by', auth.user.id)
        if (body.projectName?.trim()) {
          const { data: projects, error } = await projectQuery
          if (error) throw error
          const resolved = resolveProjectByReference(projects ?? [], body.projectName)
          if (!resolved) throw new RealtimeInputError(`Could not resolve one accessible project named “${body.projectName}”.`)
          project = resolved
        } else if (body.currentProjectId) {
          const { data: current, error } = await projectQuery.eq('id', body.currentProjectId).maybeSingle()
          if (error || !current) throw new RealtimeInputError('Choose a project before saving knowledge.')
          project = current
        } else {
          throw new RealtimeInputError('Choose a project before saving knowledge.')
        }
        params.content = attribute(content)
        params.tags = Array.from(new Set((body.tags ?? [])
          .map(tag => tag.trim().slice(0, 64))
          .filter(Boolean)))
          .slice(0, 20)
        kind = 'add_knowledge'
        spokenText = `Confirm: save the knowledge entry “${title}” in ${project.name}?`
      } else {
        const reference = body.knowledgeTitle?.trim()
        if (!reference) return Response.json({ error: 'Name the knowledge entry you want to update.' }, { status: 400 })
        const resolution = await resolveKnowledgeReference(auth.admin, reference)
        if (resolution.status === 'not_found') throw new RealtimeInputError(`Could not find a knowledge entry matching “${reference}”.`)
        if (resolution.status === 'ambiguous') {
          throw new RealtimeInputError(`That knowledge title is ambiguous: ${resolution.candidates.slice(0, 5).map(item => `“${item.title}”`).join('; ')}.`)
        }
        const { data: entry, error } = await auth.admin
          .from('knowledge_repo')
          .select('id, title, content, tags, updated_at, product_id, projects(name, code)')
          .eq('id', resolution.id)
          .single()
        if (error) throw error
        const newTitle = body.newTitle?.trim().slice(0, 240)
        if (body.newTitle !== undefined && !newTitle) {
          return Response.json({ error: 'The new knowledge title cannot be empty.' }, { status: 400 })
        }
        if (body.knowledgeContent === undefined && body.newTitle === undefined) {
          return Response.json({ error: 'Describe at least one knowledge change.' }, { status: 400 })
        }
        title = entry.title
        project = {
          id: entry.product_id ?? '',
          name: (entry.projects as unknown as { name: string; code: string } | null)?.name ?? 'Cross-project knowledge',
          code: (entry.projects as unknown as { name: string; code: string } | null)?.code ?? '',
        }
        params.knowledge_id = entry.id
        params.expected_updated_at = entry.updated_at
        params.expected_title = entry.title
        params.expected_content = entry.content
        params.expected_product_id = entry.product_id
        params.expected_tags = entry.tags ?? []
        if (body.newTitle !== undefined) params.new_title = newTitle
        params.new_content = attributeKnowledgeUpdate(
          body.knowledgeContent?.trim().slice(0, 12_000) || entry.content,
        )
        changes = {
          ...(body.newTitle !== undefined ? { title: newTitle } : {}),
        }
        kind = 'update_knowledge'
        spokenText = `Confirm: update the knowledge entry “${entry.title}”?`
      }

      const { error: proposalError } = await auth.admin.from('orb_realtime_proposals').insert({
        id: proposalId,
        user_id: auth.user.id,
        project_id: project.id || null,
        kind,
        title,
        params,
        expires_at: new Date(expiresAt).toISOString(),
      })
      if (proposalError) throw proposalError
      if (grantsUpfrontMutationPermission(body.userUtterance ?? '')) {
        const result = await confirmProposal(auth, proposalId)
        return Response.json({ ...result, preAuthorized: true, gatewayMs: Math.round(performance.now() - startedAt) })
      }
      const proposal: OrbRealtimeProposal = {
        kind,
        proposalToken: signPayload({ type: 'proposal', proposalId, userId: auth.user.id, expiresAt }),
        project,
        title,
        ...(changes ? { changes } : {}),
        spokenText,
      }
      return Response.json({ proposal, gatewayMs: Math.round(performance.now() - startedAt) })
    }
    if (body.operation === 'propose_update_todo' || body.operation === 'propose_delete_todo' || body.operation === 'propose_move_todo' || body.operation === 'propose_close_todo') {
      let todo: ResolvedTodo
      if (body.referenceToken) {
        const reference = readTodoReference(body.referenceToken)
        if (reference.userId !== auth.user.id) return Response.json({ error: 'Todo reference belongs to another user.' }, { status: 403 })
        const rows = await accessibleTodoRows(auth, {})
        const referenced = rows.find(row => row.id === reference.todoId)
        if (!referenced) return Response.json({ error: 'The referenced todo is no longer available.' }, { status: 409 })
        todo = referenced
      } else {
        if (!body.todoReference) return Response.json({ error: 'Name the todo you want to change.' }, { status: 400 })
        todo = await resolveTodoReference(auth, {
          reference: body.todoReference,
          projectName: body.projectName,
          currentProjectId: body.currentProjectId,
        })
      }
      const project = todo.projects
      const code = `${project.code}-${todo.todo_number}`
      const proposalId = crypto.randomUUID()
      const expiresAt = Date.now() + 5 * 60_000
      const params: Record<string, unknown> = {
        expected_updated_at: todo.updated_at,
        expected_title: todo.title,
        expected_status: todo.status,
        expected_priority: todo.priority_value,
        expected_product_id: todo.product_id,
        expected_todo_number: todo.todo_number,
      }
      let kind: OrbRealtimeProposal['kind']
      let spokenText: string
      let destinationProject: { id: string; name: string; code: string } | undefined
      let changes: OrbRealtimeProposal['changes']
      let resolutionNotes: string | undefined

      if (body.operation === 'propose_update_todo') {
        const newTitle = body.newTitle?.trim().slice(0, 240)
        if (body.newTitle !== undefined && !newTitle) return Response.json({ error: 'The new title cannot be empty.' }, { status: 400 })
        if (body.newStatus !== undefined && !UPDATE_STATUSES.includes(body.newStatus)) {
          return Response.json({ error: 'Use the dedicated close workflow so resolution notes and knowledge are preserved.' }, { status: 400 })
        }
        if (body.newPriority !== undefined && (!Number.isInteger(body.newPriority) || body.newPriority < 1 || body.newPriority > 4)) {
          return Response.json({ error: 'Priority must be an integer from 1 through 4.' }, { status: 400 })
        }
        changes = {
          ...(body.newTitle !== undefined ? { title: newTitle } : {}),
          ...(body.newStatus !== undefined ? { status: body.newStatus } : {}),
          ...(body.newPriority !== undefined ? { priority: body.newPriority } : {}),
        }
        if (Object.keys(changes).length === 0) return Response.json({ error: 'Describe at least one change.' }, { status: 400 })
        if (changes.title !== undefined) params.new_title = changes.title
        if (changes.status !== undefined) params.new_status = changes.status
        if (changes.priority !== undefined) params.new_priority = changes.priority
        const changeText = [
          changes.title !== undefined ? `title to “${changes.title}”` : '',
          changes.status !== undefined ? `status to ${changes.status}` : '',
          changes.priority !== undefined ? `priority to ${changes.priority}` : '',
        ].filter(Boolean).join(', ')
        kind = 'update_todo'
        spokenText = `Confirm: update ${code}, “${todo.title}”: ${changeText}?`
      } else if (body.operation === 'propose_delete_todo') {
        kind = 'delete_todo'
        spokenText = `Confirm: delete ${code}, “${todo.title}”, from ${project.name}?`
      } else if (body.operation === 'propose_close_todo') {
        if (todo.status === 'closed') return Response.json({ error: `${code} is already closed.` }, { status: 400 })
        const notes = body.resolutionNotes?.trim()
        if (!notes) return Response.json({ error: 'Closing requires resolution notes describing what was done.' }, { status: 400 })
        // Attribution + length caps are applied here; the RPC persists the final
        // strings verbatim and stays model-agnostic.
        params.resolution_notes = attribute(notes.slice(0, 4000))
        const knowledgeTitle = body.knowledgeTitle?.trim().slice(0, 200)
        if (knowledgeTitle) params.knowledge_title = knowledgeTitle
        const knowledgeContent = body.knowledgeContent?.trim().slice(0, 8000)
        params.knowledge_content = attribute(knowledgeContent || notes.slice(0, 4000))
        resolutionNotes = params.resolution_notes as string
        kind = 'close_todo'
        spokenText = `Confirm: close ${code}, “${todo.title}”, in ${project.name}? I'll save your resolution notes and a knowledge entry.`
      } else {
        const targetName = body.targetProjectName?.trim()
        if (!targetName) return Response.json({ error: 'A destination project name is required.' }, { status: 400 })
        let projectsQuery = auth.admin.from('projects').select('id, name, code, created_by').eq('is_dormant', false).is('deleted_at', null)
        if (!auth.isAdmin) projectsQuery = projectsQuery.eq('created_by', auth.user.id)
        const { data: projects, error: projectsError } = await projectsQuery
        if (projectsError) throw projectsError
        const destination = resolveProjectByReference(projects ?? [], targetName)
        if (!destination) return Response.json({ error: `Could not resolve one accessible project named “${targetName}”.` }, { status: 400 })
        if (destination.id === project.id) return Response.json({ error: `${code} is already in ${project.name}.` }, { status: 400 })
        destinationProject = { id: destination.id, name: destination.name, code: destination.code }
        kind = 'move_todo'
        spokenText = `Confirm: move ${code}, “${todo.title}”, from ${project.name} to ${destination.name}? Its code will change.`
      }

      const { error: proposalError } = await auth.admin.from('orb_realtime_proposals').insert({
        id: proposalId,
        user_id: auth.user.id,
        project_id: project.id,
        kind,
        title: todo.title,
        params,
        target_todo_id: todo.id,
        destination_project_id: destinationProject?.id ?? null,
        expires_at: new Date(expiresAt).toISOString(),
      })
      if (proposalError) throw proposalError
      if (grantsUpfrontMutationPermission(body.userUtterance ?? '')) {
        const result = await confirmProposal(auth, proposalId)
        return Response.json({ ...result, preAuthorized: true, gatewayMs: Math.round(performance.now() - startedAt) })
      }
      const proposal: OrbRealtimeProposal = {
        kind,
        proposalToken: signPayload({ type: 'proposal', proposalId, userId: auth.user.id, expiresAt }),
        project: { id: project.id, name: project.name, code: project.code },
        title: todo.title,
        code,
        ...(destinationProject ? { destinationProject } : {}),
        ...(changes ? { changes } : {}),
        ...(resolutionNotes ? { resolutionNotes } : {}),
        spokenText,
      }
      return Response.json({ proposal, gatewayMs: Math.round(performance.now() - startedAt) })
    }
    if (body.operation === 'confirm_todo_mutation' || body.operation === 'confirm_create_todo') {
      if (!body.proposalToken) return Response.json({ error: 'Missing proposal.' }, { status: 400 })
      if (!authorizesPendingMutation(body.userUtterance ?? '')) {
        return Response.json({ error: 'That response did not explicitly approve the pending change.' }, { status: 409 })
      }
      const payload = readProposal(body.proposalToken)
      if (payload.userId !== auth.user.id) return Response.json({ error: 'Proposal belongs to another user.' }, { status: 403 })
      const result = await confirmProposal(auth, payload.proposalId)
      return Response.json({ ...result, gatewayMs: Math.round(performance.now() - startedAt) })
    }
    return Response.json({ error: 'Unsupported operation.' }, { status: 400 })
  } catch (error) {
    console.error('[orb-realtime] turn failed:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Realtime turn failed.' },
      { status: error instanceof RealtimeInputError ? 400 : 500 },
    )
  }
}
