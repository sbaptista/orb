import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

function checkAuth(request: NextRequest): NextResponse | null {
  if (process.env.TODOS_API_ENABLED !== 'true') {
    return NextResponse.json({ error: 'API disabled' }, { status: 503 })
  }
  if (request.headers.get('Authorization') !== process.env.TODOS_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = checkAuth(request)
  if (authError) return authError

  const { id } = await params
  const body = await request.json()
  const { title, description, status, priority_value, resolution_notes, urls, group_id, category_id, group_name, category_name } = body

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (title !== undefined) updates.title = title
  if (description !== undefined) updates.description = description
  if (priority_value !== undefined) updates.priority_value = priority_value
  if (resolution_notes !== undefined) updates.resolution_notes = resolution_notes
  if (urls !== undefined) {
    updates.urls = typeof urls === 'string'
      ? urls.split('\n').map((u: string) => u.trim()).filter(Boolean)
      : urls
  }
  if (group_id !== undefined) updates.group_id = group_id
  if (category_id !== undefined) updates.category_id = category_id

  if (status !== undefined) {
    updates.status = status
    if (status === 'done') {
      updates.closed_at = new Date().toISOString()
    } else {
      updates.closed_at = null
    }
  }

  const supabase = createServiceClient()

  // Name-based lookups — resolve group_name / category_name to IDs within the todo's product
  if (group_name !== undefined || category_name !== undefined) {
    const { data: existing } = await supabase
      .from('todos')
      .select('product_id')
      .eq('id', id)
      .single()

    if (existing) {
      if (group_name !== undefined) {
        const { data: group } = await supabase
          .from('groups')
          .select('id')
          .eq('product_id', existing.product_id)
          .ilike('name', group_name)
          .single()
        updates.group_id = group?.id ?? null
      }
      if (category_name !== undefined) {
        const { data: category } = await supabase
          .from('categories')
          .select('id')
          .eq('product_id', existing.product_id)
          .ilike('name', category_name)
          .single()
        updates.category_id = category?.id ?? null
      }
    }
  }

  const { data: todo, error } = await supabase
    .from('todos')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, todo_number, title, description, status, priority_value, resolution_notes, urls, group_id, category_id, created_at, updated_at, closed_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

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

  return NextResponse.json({ success: true })
}
