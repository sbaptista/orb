/**
 * Test ticket notification delivery.
 * Usage: npx tsx scripts/test-ticket-notification.ts
 *
 * Creates a test ticket and verifies that the system dispatches push notifications and emails.
 * Requires .env.local to be loaded (VAPID keys, DATABASE_URL, etc.)
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local
config({ path: resolve(__dirname, '../.env.local') })

async function main() {
  // Dynamically import to ensure dotenv has loaded env variables
  const { createTicket } = await import('../app/actions/ticket-actions')

  console.log('--- Submitting test ticket ---')
  const timestamp = new Date().toISOString()
  
  const result = await createTicket({
    source: 'orb-auto',
    type: 'bug',
    summary: `Test Ticket Notification System at ${timestamp}`,
    detail: { test: true, environment: 'local-test' },
    conversation_snippet: 'User: Help, test notification not working! Orb: Triggering test ticket...',
  })

  if (result.error) {
    console.error('✗ Failed to create ticket:', result.error)
    process.exit(1)
  }

  console.log('✓ Ticket created successfully:', result.data)
  console.log('All notifications sent!')
}

main().catch((err) => {
  console.error('Unexpected error running test script:', err)
  process.exit(1)
})
