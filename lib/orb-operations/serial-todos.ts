import type { AuthContext } from '@/lib/auth'
import { selectTodoByReference, describeTodoCandidates } from '@/lib/orb-operations/todo-reference'
import { dueAtToInstant, validateReminderLead } from '@/lib/due-time'
import { persistOrbMutationProposal, type OrbMutationKind } from '@/lib/orb-operations/proposals'

export type SerialTodoOperation = {
  tool: string
  params: Record<string, any>
}

type TodoRow = {
  id: string
  todo_number: number
  title: string
  description: string | null
  resolution_notes: string | null
  status: string
  priority_value: number | null
  urls: string[]
  updated_at: string
  product_id: string
  due_at: string | null
  due_timezone: string | null
  due_city: string | null
  reminder_lead_value: number | null
  reminder_lead_unit: string | null
  reminder_nudge_dismissed_at: string | null
  projects: { id: string; name: string; code: string; created_by: string }
}

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

async function accessibleProject(
  auth: AuthContext,
  options: { code?: string; id?: string | null },
) {
  let query = auth.admin
    .from('projects')
    .select('id, name, code, created_by')
    .eq('is_dormant', false)
    .is('deleted_at', null)
  if (!auth.isAdmin) query = query.eq('created_by', auth.user.id)
  if (options.code) query = query.ilike('code', options.code)
  else if (options.id) query = query.eq('id', options.id)
  else return null
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data
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
    .select('id, todo_number, title, description, resolution_notes, status, priority_value, urls, updated_at, product_id, due_at, due_timezone, due_city, reminder_lead_value, reminder_lead_unit, reminder_nudge_dismissed_at, projects!inner(id, name, code, created_by, deleted_at, is_dormant)')
    .is('deleted_at', null)
    .is('projects.deleted_at', null)
    .eq('projects.is_dormant', false)
  if (!auth.isAdmin) query = query.eq('projects.created_by', auth.user.id)
  return query
}

/**
 * ORB-339 — resolve a todo reference server-side, by code OR by title.
 *
 * Previously code-only: a non-code reference returned null, so the serial
 * model had to pick the code itself from the backlog and got it wrong on
 * near-exact titles. Title resolution now runs through the SAME policy
 * Realtime uses (lib/orb-operations/todo-reference.ts), so both channels
 * agree on what a task name means and both fail closed on ambiguity.
 *
 * Throws on ambiguity rather than guessing — the caller turns that into a
 * tool result the model reads back to the user.
 */
async function accessibleTodo(auth: AuthContext, reference: string): Promise<TodoRow | null> {
  const trimmed = reference.trim()
  if (!trimmed) return null

  const match = /^(.+)-(\d+)$/.exec(trimmed.toUpperCase())
  if (match) {
    const { data, error } = await accessibleTodosQuery(auth)
      .eq('todo_number', Number(match[2]))
      .ilike('projects.code', match[1])
      .maybeSingle()
    if (error) throw error
    return data ? shapeTodoRow(data) : null
  }

  const { data, error } = await accessibleTodosQuery(auth)
  if (error) throw error
  const rows = (data ?? []).map(shapeTodoRow)
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

export async function proposeSerialTodoOperations(
  auth: AuthContext,
  operations: SerialTodoOperation[],
  options: { currentProjectId: string | null; requestZone: string; summary: string },
) {
  if (operations.length === 0) throw new Error('No todo operations were proposed.')
  if (operations.length > 20) throw new Error('Todo batches are limited to 20 operations.')

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
      const project = await accessibleProject(auth, {
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
    const todo = await accessibleTodo(auth, String(input.code ?? input.title_match ?? ''))
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
      const destination = await accessibleProject(auth, {
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
