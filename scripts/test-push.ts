/**
 * Test push notification delivery.
 * Usage: npx tsx scripts/test-push.ts
 *
 * Sends a test push to all subscriptions for the first user found.
 * Requires .env.local to be loaded (VAPID keys, DATABASE_URL, etc.)
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local
config({ path: resolve(__dirname, '../.env.local') })

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY!

if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
  console.error('Missing VAPID keys in .env.local')
  process.exit(1)
}

webpush.setVapidDetails(
  'https://orb-eight-lake.vercel.app',
  VAPID_PUBLIC,
  VAPID_PRIVATE,
)

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('DB error:', error.message)
    process.exit(1)
  }

  if (!subs || subs.length === 0) {
    console.log('No push subscriptions found.')
    process.exit(0)
  }

  console.log(`Found ${subs.length} subscription(s). Sending test push...`)

  for (const sub of subs) {
    const subscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.keys_p256dh,
        auth: sub.keys_auth,
      },
    }

    try {
      const result = await webpush.sendNotification(
        subscription,
        JSON.stringify({
          title: 'Orb test',
          body: 'If you see this, push notifications work.',
          tag: 'orb-test',
          url: '/',
        }),
        { TTL: 60 }
      )
      console.log(`✓ Sent to ${sub.endpoint.slice(0, 60)}… — status ${result.statusCode}`)
    } catch (err: any) {
      console.error(`✗ Failed for ${sub.endpoint.slice(0, 60)}… — ${err.statusCode ?? err.message}`)
      if (err.body) console.error('  Body:', err.body)
    }
  }
}

main()
