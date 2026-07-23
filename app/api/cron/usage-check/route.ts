import { NextRequest, NextResponse } from 'next/server'
import { checkAllUsageThresholds } from '@/lib/orb-model/usage-monitor'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const result = await checkAllUsageThresholds()
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'An unknown error occurred' }, { status: 500 })
  }
}
