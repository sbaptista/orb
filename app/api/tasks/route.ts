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

export async function GET(request: NextRequest) {
  const authError = checkAuth(request)
  if (authError) return authError

  const productCode = request.nextUrl.searchParams.get('product')
  if (!productCode) {
    return NextResponse.json({ error: 'Missing product query parameter' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const targetUserId = await resolveTargetUserId(request, supabase)

  const { data: product, error: productError } = await supabase
    .from('projects')
    .select('id')
    .ilike('code', productCode)
    .eq('created_by', targetUserId)
    .single()

  if (productError || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const { data: todos, error } = await supabase
    .from('todos')
    .select('id, todo_number, title, description, status, priority_value, resolution_notes, urls, created_at, updated_at, closed_at, due_at, due_timezone, reminder_lead_value, reminder_lead_unit')
    .eq('product_id', product.id)
    .is('deleted_at', null)
    .order('todo_number', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(todos)
}

export async function POST(request: NextRequest) {
  const authError = checkAuth(request)
  if (authError) return authError

  const body = await request.json()
  const { product_code, title, description, priority_value, due_at, due_timezone, reminder_lead_value, reminder_lead_unit } = body

  if (!product_code || !title) {
    return NextResponse.json({ error: 'Missing required fields: product_code, title' }, { status: 400 })
  }
  const reminderError = validateReminderLead(reminder_lead_value, reminder_lead_unit)
  if (reminderError) return NextResponse.json({ error: reminderError }, { status: 400 })

  const supabase = createServiceClient()
  const targetUserId = await resolveTargetUserId(request, supabase)

  const { data: product, error: productError } = await supabase
    .from('projects')
    .select('id')
    .ilike('code', product_code)
    .eq('created_by', targetUserId)
    .single()

  if (productError || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const { data: openStatus } = await supabase
    .from('statuses').select('name').eq('is_open', true).limit(1).single()

  // ORB-361: a dated todo carries its own zone. This is a genuinely headless
  // path (external agents), so a missing zone falls back to the project
  // owner's stored users.timezone. A naive due_at string is interpreted as a
  // wall-clock reading in that zone and stored as a true instant.
  let dueAtInstant: string | null = null
  let dueZone: string | null = null
  if (due_at) {
    dueZone = due_timezone || null
    if (!dueZone) {
      const { data: owner } = await supabase.from('users').select('timezone').eq('id', targetUserId).maybeSingle()
      dueZone = owner?.timezone || 'America/Los_Angeles'
    }
    dueAtInstant = dueAtToInstant(due_at, dueZone!).toISOString()
  }

  const { data: todo, error } = await supabase
    .from('todos')
    .insert({
      product_id: product.id,
      title,
      description: description ?? null,
      priority_value: priority_value ?? null,
      status: openStatus?.name ?? 'open',
      due_at: dueAtInstant,
      due_timezone: dueZone,
      reminder_lead_value: due_at != null && reminder_lead_value != null ? reminder_lead_value : null,
      reminder_lead_unit: due_at != null && reminder_lead_value != null ? reminder_lead_unit : null,
      sort_order: 0,
      group_id: null,
      category_id: null,
      resolution_notes: null,
      urls: [],
      closed_at: null,
      deleted_at: null,
    })
    .select('id, todo_number, title, description, status, priority_value, resolution_notes, urls, created_at, updated_at, closed_at, due_at, due_timezone, reminder_lead_value, reminder_lead_unit')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAuditEvent({ action: 'todo_create', table_name: 'todos', record_id: todo.id, after: { title: todo.title, status: todo.status, product_code }, actor: 'rest-api', user_id: targetUserId })

  return NextResponse.json(todo, { status: 201 })
}
