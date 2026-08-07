import { NextRequest, NextResponse } from 'next/server'
import { processReminders } from '@/lib/reminders'

export async function GET(request: NextRequest) {
  // Fails CLOSED — see the matching note in ../usage-check/route.ts. This is
  // the sharper of the two endpoints: unauthenticated access here sends push
  // notifications and email to real users.
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('Authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const result = await processReminders()
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'An unknown error occurred' }, { status: 500 })
  }
}
