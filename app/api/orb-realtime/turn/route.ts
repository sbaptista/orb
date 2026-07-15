import { createHmac, timingSafeEqual } from 'node:crypto'
import { getAuthContext, type AuthContext } from '@/lib/auth'
import { getRealtimeVoiceAccess } from '@/lib/orb-realtime/access'
import { getNextStepPacket, getProjectDirectoryPacket, getTaskCountPacket, getTodoDetailsPacket, getTodoListPacket } from '@/lib/orb-realtime/fact-gateway'
import { fuzzyMatch, scoreTextMatch } from '@/lib/fuzzy-search'
import { authorizesPendingMutation, grantsUpfrontMutationPermission } from '@/lib/orb-model/mutation-authorization'
import { resolveProjectByReference } from '@/lib/projects'
import type { OrbRealtimeMutationReceipt, OrbRealtimeProposal } from '@/lib/orb-realtime/types'

export const runtime = 'nodejs'

const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1'

// Shared attribution rule (AGENTS.md working rule #9): every AI-authored
// resolution note / knowledge entry leads with `YYYY-MM-DD — Tool (Model)`.
function attribute(text: string) {
  const date = new Date().toISOString().slice(0, 10)
  return `${date} — Orb (${REALTIME_MODEL})\n\n${text.trim()}`
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
  const { data, error } = await auth.admin.rpc('confirm_realtime_todo_mutation', {
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
      proposalToken?: string
      referenceToken?: string
      newTitle?: string
      newStatus?: UpdateStatus
      newPriority?: number
      targetProjectName?: string
      resolutionNotes?: string
      knowledgeTitle?: string
      knowledgeContent?: string
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
    if (body.operation === 'propose_create_todo') {
      const title = body.title?.trim().slice(0, 240)
      if (!title) return Response.json({ error: 'A todo title is required.' }, { status: 400 })
      let projectQuery = auth.admin.from('projects').select('id, name, code, created_by').eq('is_dormant', false).is('deleted_at', null)
      if (body.projectId) projectQuery = projectQuery.eq('id', body.projectId)
      else projectQuery = projectQuery.eq('created_by', auth.user.id).order('sort_order').limit(1)
      const { data: project, error } = await projectQuery.maybeSingle()
      if (error || !project || (!auth.isAdmin && project.created_by !== auth.user.id)) {
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
          return Response.json({ error: 'Realtime closing is not available yet. Use the full todo workflow so resolution notes and knowledge are preserved.' }, { status: 400 })
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
