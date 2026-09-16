import type { AuthContext } from '@/lib/auth'
import { selectTodoByReference, describeTodoCandidates } from '@/lib/orb-operations/todo-reference'
import { dueAtToInstant, validateReminderLead } from '@/lib/due-time'
import { persistOrbMutationProposal, type OrbMutationKind } from '@/lib/orb-operations/proposals'
import type { PreparedOrbMutationCommand } from '@/lib/orb-operations/command-batches'
import { ORB_TODO_FULL_SELECT, shapeOrbTodoFact, type OrbTodoRow } from '@/lib/orb-operations/todo-facts'

export type SerialTodoOperation = {
  tool: string
  params: Record<string, any>
  toolUseId?: string
}

export type SerialTodoPreparationOptions = {
  currentProjectId: string | null
  requestZone: string
  summary: string
  projects?: AccessibleProjectRow[]
}

type TodoRow = OrbTodoRow

function expectedTodo(todo: TodoRow) {
  return {
    code: `${todo.projects.code}-${todo.todo_number}`,
    expected_updated_at: todo.updated_at,
    expected_title: todo.title,
    expected_status: todo.status,
    expected_priority: todo.priority_value,
    expected_product_id: todo.product_id,
    expected_todo_number: todo.todo_number,
  }
}

function dueFields(input: Record<string, any>, todo: TodoRow | null, requestZone: string) {
  const dueProvided = input.due_at !== undefined
  const rawDue = dueProvided ? input.due_at : (todo?.due_at ?? null)
  if (!rawDue) {
    return {
      due_at: null,
      due_timezone: null,
      due_city: null,
      reminder_lead_value: null,
      reminder_lead_unit: null,
    }
  }
  const zone = input.due_timezone || (dueProvided ? requestZone : (todo?.due_timezone || requestZone))
  const dueAtIso = dueProvided ? dueAtToInstant(String(rawDue), zone).toISOString() : rawDue
  const value = input.reminder_lead_value !== undefined
    ? input.reminder_lead_value
    : (todo?.reminder_lead_value ?? null)
  const unit = input.reminder_lead_unit !== undefined
    ? input.reminder_lead_unit
    : (todo?.reminder_lead_unit ?? null)
  const pairValid = validateReminderLead(value, unit) === null && value != null
  return {
    due_at: dueAtIso,
    due_timezone: zone,
    due_city: input.due_city ?? (input.due_timezone ? null : (todo?.due_city ?? null)),
    reminder_lead_value: pairValid ? value : null,
    reminder_lead_unit: pairValid ? unit : null,
  }
}

type AccessibleProjectRow = { id: string; name: string; code: string; created_by: string }

function accessibleProjectsQuery(auth: AuthContext) {
  let query = auth.admin
    .from('projects')
    .select('id, name, code, created_by')
    .eq('is_dormant', false)
    .is('deleted_at', null)
  if (!auth.isAdmin) query = query.eq('created_by', auth.user.id)
  return query
}

function projectFromPreparedRows(
  projects: AccessibleProjectRow[],
  options: { code?: string; id?: string | null },
) {
  if (options.code) {
    const code = options.code.toUpperCase()
    return projects.find(project => project.code.toUpperCase() === code) ?? null
  }
  if (options.id) return projects.find(project => project.id === options.id) ?? null
  return null
}

function shapeTodoRow(data: any): TodoRow {
  return {
    ...data,
    urls: Array.isArray(data.urls) ? data.urls as string[] : [],
    projects: data.projects as unknown as TodoRow['projects'],
  } as TodoRow
}

/** Every todo this user may act on. Same visibility rules as the code lookup. */
function accessibleTodosQuery(auth: AuthContext) {
  let query = auth.admin
    .from('todos')
    .select(ORB_TODO_FULL_SELECT, { count: 'exact' })
    .is('deleted_at', null)
    .is('projects.deleted_at', null)
    .eq('projects.is_dormant', false)
  if (!auth.isAdmin) query = query.eq('projects.created_by', auth.user.id)
  return query
}

export function serialTodoFact(todo: TodoRow, owner?: string) {
  return shapeOrbTodoFact(todo, owner)
}

/**
 * ORB-339: how many candidates a title reference may be ranked against.
 *
 * Ranking needs candidates, so resolving a title reads the accessible set —
 * previously unbounded, which is fine at a few hundred todos and a full table
 * read at fifty thousand. A plain .limit() would be worse than unbounded: cap
 * at N and the todo you meant sits at N+1, and the resolver does not fail — it
 * ranks the N it happens to have and confidently returns the wrong one. That
 * is the silent wrong-mutation this whole ticket exists to prevent,
 * reintroduced as a performance tweak.
 *
 * So the cap is paired with an exact count. If more rows exist than were
 * fetched, resolution REFUSES rather than guessing from a partial set. The
 * limit is deliberately far above any plausible backlog, so the refusal is a
 * safety net that should never fire, not a routine path.
 */
const TITLE_RESOLUTION_CANDIDATE_LIMIT = 2000

function accessibleTodoFromPreparedRows(rows: TodoRow[], reference: string): TodoRow | null {
  const trimmed = reference.trim()
  if (!trimmed) return null
  const match = /^(.+)-(\d+)$/.exec(trimmed.toUpperCase())
  if (match) {
    return rows.find(row =>
      row.todo_number === Number(match[2]) && row.projects.code.toUpperCase() === match[1]
    ) ?? null
  }
  const result = selectTodoByReference(trimmed, rows)
  if (result.kind === 'resolved') return result.row
  if (result.kind === 'ambiguous') {
    throw new Error(`That task reference is ambiguous — say which one: ${describeTodoCandidates(result.candidates)}.`)
  }
  return null
}

function serialUpdateParams(
  input: Record<string, any>,
  todo: TodoRow,
  requestZone: string,
) {
  const params: Record<string, unknown> = expectedTodo(todo)
  if (input.new_title !== undefined) params.new_title = String(input.new_title).trim()
  if (input.new_status !== undefined) params.new_status = input.new_status
  if (input.new_priority !== undefined) params.new_priority = input.new_priority
  if (input.description !== undefined) params.new_description = input.description
  if (input.resolution_notes !== undefined) params.resolution_notes = input.resolution_notes
  if (input.urls !== undefined) params.urls = input.urls
  if (input.dismiss_reminder_nudge === true) params.dismiss_reminder_nudge = true
  if (
    input.due_at !== undefined
    || input.due_timezone !== undefined
    || input.reminder_lead_value !== undefined
    || input.reminder_lead_unit !== undefined
  ) {
    Object.assign(params, dueFields(input, todo, requestZone))
  }
  // The existing transactional core recognizes title/status/priority as its
  // update discriminator. A no-op title keeps extra-only serial changes
  // (description, URLs, reminders) inside that same transaction; the
  // transport-neutral dispatcher applies the extra fields before returning.
  if (!('new_title' in params) && !('new_status' in params) && !('new_priority' in params)) {
    params.new_title = todo.title
  }
  return params
}

export async function prepareSerialTodoOperations(
  auth: AuthContext,
  operations: SerialTodoOperation[],
  options: SerialTodoPreparationOptions,
): Promise<Array<PreparedOrbMutationCommand & { batchParams: Record<string, unknown> }>> {
  if (operations.length === 0) throw new Error('No todo operations were proposed.')
  if (operations.length > 20) throw new Error('Todo batches are limited to 20 operations.')

  const needsTodos = operations.some(operation => operation.tool !== 'create_todo')
  const needsProjects = operations.some(operation =>
    operation.tool === 'create_todo' || operation.tool === 'move_todo'
  )
  const [todoResult, projectResult] = await Promise.all([
    needsTodos
      ? accessibleTodosQuery(auth).limit(TITLE_RESOLUTION_CANDIDATE_LIMIT)
      : Promise.resolve({ data: [], error: null, count: 0 }),
    needsProjects && !options.projects
      ? accessibleProjectsQuery(auth)
      : Promise.resolve({ data: options.projects ?? [], error: null }),
  ])
  if (todoResult.error) throw todoResult.error
  if (projectResult.error) throw projectResult.error
  const todos = (todoResult.data ?? []).map(shapeTodoRow)
  if (needsTodos && typeof todoResult.count === 'number' && todoResult.count > todos.length) {
    throw new Error(
      `There are too many tasks (${todoResult.count}) to prepare this batch safely. Use exact task codes.`,
    )
  }
  const projects = (projectResult.data ?? []) as AccessibleProjectRow[]

  const resolved: Array<{
    kind: Exclude<OrbMutationKind, 'batch_todo_action' | 'create_project' | 'update_project' | 'delete_project' | 'add_knowledge' | 'update_knowledge'>
    title: string
    projectId: string
    targetTodoId?: string
    destinationProjectId?: string
    params: Record<string, unknown>
    batchParams: Record<string, unknown>
  }> = []

  for (const operation of operations) {
    const input = operation.params ?? {}
    if (operation.tool === 'create_todo') {
      const project = projectFromPreparedRows(projects, {
        code: input.product_code ? String(input.product_code).toUpperCase() : undefined,
        id: input.product_code ? undefined : options.currentProjectId,
      })
      if (!project) throw new Error('Choose a project you can edit before creating the todo.')
      const title = String(input.title ?? '').trim().slice(0, 240)
      if (!title) throw new Error('A todo title is required.')
      const extras = {
        product_code: project.code,
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.priority_value !== undefined ? { priority_value: input.priority_value } : {}),
        ...dueFields(input, null, options.requestZone),
      }
      resolved.push({
        kind: 'create_todo',
        title,
        projectId: project.id,
        params: extras,
        batchParams: { action: 'create', title, project_id: project.id, ...extras },
      })
      continue
    }

    // ORB-339: title_match is a first-class reference now, not a hint the
    // model has to convert into a code itself.
    const todo = accessibleTodoFromPreparedRows(todos, String(input.code ?? input.title_match ?? ''))
    if (!todo) throw new Error(`Todo ${input.code ?? ''} was not found or is not editable.`)
    const base = expectedTodo(todo)

    if (operation.tool === 'delete_todo') {
      resolved.push({
        kind: 'delete_todo',
        title: todo.title,
        projectId: todo.product_id,
        targetTodoId: todo.id,
        params: base,
        batchParams: { action: 'delete', todo_id: todo.id, ...base },
      })
      continue
    }

    if (operation.tool === 'move_todo') {
      const destination = projectFromPreparedRows(projects, {
        code: String(input.target_project_code ?? '').toUpperCase(),
      })
      if (!destination) throw new Error(`Project ${input.target_project_code ?? ''} was not found or is not editable.`)
      if (destination.id === todo.product_id) throw new Error(`${input.code} is already in ${destination.name}.`)
      resolved.push({
        kind: 'move_todo',
        title: todo.title,
        projectId: todo.product_id,
        targetTodoId: todo.id,
        destinationProjectId: destination.id,
        params: base,
        batchParams: {
          action: 'move',
          todo_id: todo.id,
          destination_project_id: destination.id,
          target_project_code: destination.code,
          ...base,
        },
      })
      continue
    }

    if (operation.tool !== 'update_todo') throw new Error(`Unsupported todo operation: ${operation.tool}`)
    const params = serialUpdateParams(input, todo, options.requestZone)
    if (input.new_status === 'closed') {
      const notes = String(input.resolution_notes ?? '').trim()
      if (!notes) throw new Error(`Closing ${input.code} requires resolution notes.`)
      const attributedNotes = `${new Date().toISOString().slice(0, 10)} — Orb (Claude Haiku 4.5)\n\n${notes}`
      params.resolution_notes = attributedNotes
      params.knowledge_content = attributedNotes
      resolved.push({
        kind: 'close_todo',
        title: todo.title,
        projectId: todo.product_id,
        targetTodoId: todo.id,
        params,
        batchParams: {},
      })
    } else {
      resolved.push({
        kind: 'update_todo',
        title: todo.title,
        projectId: todo.product_id,
        targetTodoId: todo.id,
        params,
        batchParams: { action: 'update', todo_id: todo.id, ...params },
      })
    }
  }

  return resolved.map((item, index) => ({
    ...item,
    toolUseId: operations[index]?.toolUseId ?? `todo-command-${index}`,
    summary: operations.length === 1 ? options.summary : `${item.kind.replace(/_/g, ' ')} “${item.title}”`,
  }))
}

export async function proposeSerialTodoOperations(
  auth: AuthContext,
  operations: SerialTodoOperation[],
  options: SerialTodoPreparationOptions,
) {
  const resolved = await prepareSerialTodoOperations(auth, operations, options)

  if (resolved.length > 1) {
    if (resolved.some(item => item.kind === 'close_todo')) {
      throw new Error('Close todos one at a time so each resolution and knowledge entry is preserved.')
    }
    const projectId = resolved.every(item => item.projectId === resolved[0].projectId)
      ? resolved[0].projectId
      : null
    return persistOrbMutationProposal(auth, {
      kind: 'batch_todo_action',
      title: `Batch: ${resolved.length} todo operations`,
      projectId,
      params: { operations: resolved.map(item => item.batchParams) },
      channel: 'serial',
      summary: options.summary,
    })
  }

  const item = resolved[0]
  return persistOrbMutationProposal(auth, {
    kind: item.kind,
    title: item.title,
    projectId: item.projectId,
    targetTodoId: item.targetTodoId,
    destinationProjectId: item.destinationProjectId,
    params: item.params,
    channel: 'serial',
    summary: options.summary,
  })
}
