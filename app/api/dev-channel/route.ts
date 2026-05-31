import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

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

export async function POST(request: NextRequest) {
  const authError = checkAuth(request)
  if (authError) return authError

  const body = await request.json()
  const { content, sender_label, product_code, session_summary, metadata } = body

  if (!content || !sender_label) {
    return NextResponse.json({ error: 'Missing required fields: content, sender_label' }, { status: 400 })
  }

  const supabase = createServiceClient()

  let productId: string | null = null
  if (product_code) {
    const targetUserId = await resolveTargetUserId(request, supabase)
    const { data: product } = await supabase
      .from('projects')
      .select('id')
      .ilike('code', product_code)
      .eq('created_by', targetUserId)
      .single()
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    productId = product.id
  }

  const { data, error } = await supabase
    .from('dev_channel')
    .insert({
      direction: 'dev_to_orb',
      sender_label,
      content,
      product_id: productId,
      session_summary: session_summary ?? null,
      metadata: metadata ?? {},
    })
    .select('id, status, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function GET(request: NextRequest) {
  const authError = checkAuth(request)
  if (authError) return authError

  const supabase = createServiceClient()
  const params = request.nextUrl.searchParams

  const status = params.get('status')
  const direction = params.get('direction') ?? 'dev_to_orb'
  const since = params.get('since')
  const limit = Math.min(parseInt(params.get('limit') ?? '20'), 100)

  let query = supabase
    .from('dev_channel')
    .select('id, direction, sender_label, content, product_id, session_summary, status, orb_response, metadata, created_at, delivered_at, processed_at')
    .eq('direction', direction)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)
  if (since) query = query.gte('created_at', since)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
