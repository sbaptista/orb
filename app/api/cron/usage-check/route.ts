import { NextRequest, NextResponse } from 'next/server'
import { checkAllUsageThresholds } from '@/lib/orb-model/usage-monitor'

export async function GET(request: NextRequest) {
  // Fails CLOSED: an unset CRON_SECRET returns 401 rather than skipping the
  // check. The previous form (`if (CRON_SECRET && ...)`) silently served this
  // endpoint to anyone whenever the variable was missing — which it was in
  // production on 2026-08-05, despite the plan doc recording it as set. A
  // missing secret must break the cron loudly, never open the endpoint quietly.
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('Authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const result = await checkAllUsageThresholds()
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'An unknown error occurred' }, { status: 500 })
  }
}
