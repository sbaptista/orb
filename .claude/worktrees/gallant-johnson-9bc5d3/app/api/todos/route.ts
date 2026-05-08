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

export async function GET(request: NextRequest) {
  const authError = checkAuth(request)
  if (authError) return authError

  const productCode = request.nextUrl.searchParams.get('product')
  if (!productCode) {
    return NextResponse.json({ error: 'Missing product query parameter' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: product, error: productError } = await supabase
    .from('projects')
    .select('id')
    .ilike('code', productCode)
    .single()

  if (productError || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const { data: todos, error } = await supabase
    .from('todos')
    .select('id, todo_number, title, description, status, priority_value, resolution_notes, urls, created_at, updated_at, closed_at')
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
  const { product_code, title, description, priority_value } = body

  if (!product_code || !title) {
    return NextResponse.json({ error: 'Missing required fields: product_code, title' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: product, error: productError } = await supabase
    .from('projects')
    .select('id')
    .ilike('code', product_code)
    .single()

  if (productError || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const { data: todo, error } = await supabase
    .from('todos')
    .insert({
      product_id: product.id,
      title,
      description: description ?? null,
      priority_value: priority_value ?? null,
      status: 'open',
      sort_order: 0,
      group_id: null,
      category_id: null,
      resolution_notes: null,
      urls: [],
      closed_at: null,
      deleted_at: null,
    })
    .select('id, todo_number, title, description, status, priority_value, resolution_notes, urls, created_at, updated_at, closed_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(todo, { status: 201 })
}
