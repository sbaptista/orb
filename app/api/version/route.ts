import { NextResponse } from 'next/server'
import { VERSION } from '@/lib/version'

export async function GET() {
  return NextResponse.json(
    { version: VERSION },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  )
}
