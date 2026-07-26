import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logAuditEvent } from '@/lib/audit'
import { dueAtToInstant, validateReminderLead } from '@/lib/due-time'

const STAN_ID = '3c8f183a-1350-4ce2-9b60-7d51ccd55b60'

function checkAuth(request: NextRequest): NextResponse | null {
  if (process.env.ORB_API_ENABLED !== 'true') {
    return NextResponse.json({ error: 'API disabled' }, { status: 503 })
  }
  if (request.headers.get('Authorization') !== process.env.ORB_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

async function resolveTargetUserId(request: NextRequest, supabase: ReturnType<typeof createServiceClient>): Promise<string> {
  const userId = request.headers.get('X-User-Id')
  if (userId) return userId

  const email = request.headers.get('X-User-Email')
  if (email) {
    const { data } = await supabase.from('users').select('id').eq('email', email.trim().toLowerCase()).maybeSingle()
    if (data) return data.id
  }

  return STAN_ID
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = checkAuth(request)
  if (authError) return authError

  const { id } = await params
  const body = await request.json()
  const { title, description, status, priority_value, resolution_notes, urls, product_code, due_at, due_timezone, reminder_lead_value, reminder_lead_unit } = body

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (title !== undefined) updates.title = title
  if (description !== undefined) updates.description = description
  if (priority_value !== undefined) updates.priority_value = priority_value
  if (resolution_notes !== undefined) updates.resolution_notes = resolution_notes
  // ORB-361: due_at carries a zone. A naive string is a wall-clock reading in
  // the provided (or stored/fallback) zone; clearing due_at clears the zone
  // and reminder with it. Any due-time change re-arms the reminder.
  if (reminder_lead_value !== undefined || reminder_lead_unit !== undefined) {
    const reminderError = validateReminderLead(reminder_lead_value ?? null, reminder_lead_unit ?? null)
    if (reminderError) return NextResponse.json({ error: reminderError }, { status: 400 })
    updates.reminder_lead_value = reminder_lead_value ?? null
    updates.reminder_lead_unit = reminder_lead_unit ?? null
    updates.reminded_at = null
  }
  if (due_at === null) {
    updates.due_at = null
    updates.due_timezone = null
    updates.reminder_lead_value = null
    updates.reminder_lead_unit = null
    updates.reminded_at = null
  }
  if (urls !== undefined) {
    updates.urls = typeof urls === 'string'
      ? urls.split('\n').map((u: string) => u.trim()).filter(Boolean)
      : urls
  }

  if (status !== undefined) {
    updates.status = status
  }

  const supabase = createServiceClient()
  const targetUserId = await resolveTargetUserId(request, supabase)

  if (product_code !== undefined) {
    const { data: targetProject } = await supabase
      .from('projects')
      .select('id')
      .ilike('code', String(product_code))
      .eq('created_by', targetUserId)
      .maybeSingle()

    if (!targetProject) {
      return NextResponse.json({ error: `Project "${product_code}" not found` }, { status: 404 })
    }

    updates.product_id = targetProject.id
  }

  if (status !== undefined) {
    const { data: statusDef } = await supabase
      .from('statuses')
      .select('is_closed')
      .eq('name', status)
      .single()
    updates.closed_at = statusDef?.is_closed ? new Date().toISOString() : null
  }

  if (due_at !== undefined && due_at !== null) {
    let zone = due_timezone || null
    if (!zone) {
      const { data: existing } = await supabase.from('todos').select('due_timezone').eq('id', id).maybeSingle()
      zone = existing?.due_timezone || null
    }
    if (!zone) {
      const { data: owner } = await supabase.from('users').select('timezone').eq('id', targetUserId).maybeSingle()
      zone = owner?.timezone || 'America/Los_Angeles'
    }
    updates.due_at = dueAtToInstant(due_at, zone).toISOString()
    updates.due_timezone = zone
    updates.reminded_at = null
  } else if (due_timezone !== undefined && due_at === undefined) {
    // Zone changed on an existing due date: reinterpret nothing (the stored
    // instant is absolute); just record the new display/edit zone.
    updates.due_timezone = due_timezone
  }

  const { data: todo, error } = await supabase
    .from('todos')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, todo_number, title, description, status, priority_value, resolution_notes, urls, created_at, updated_at, closed_at, due_at, due_timezone, reminder_lead_value, reminder_lead_unit')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  await logAuditEvent({
    action: 'todo_update',
    table_name: 'todos',
    record_id: id,
    after: { ...updates, todo_number: todo.todo_number },
    actor: 'rest-api',
    user_id: targetUserId,
  })

  return NextResponse.json(todo)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = checkAuth(request)
  if (authError) return authError

  const { id } = await params
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('todos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const targetUserId = await resolveTargetUserId(request, supabase)
  await logAuditEvent({ action: 'todo_delete', table_name: 'todos', record_id: id, actor: 'rest-api', user_id: targetUserId })

  return NextResponse.json({ success: true })
}
