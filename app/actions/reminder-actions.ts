'use server'

import { getAuthContext } from '@/lib/auth'
import { processReminders } from '@/lib/reminders'

export async function checkReminders() {
  try {
    // 1. Verify user is authenticated
    await getAuthContext()
    
    // 2. Trigger the shared reminder processing logic
    const result = await processReminders()
    return result
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('not authenticated') || msg.includes('session') || msg.includes('JWT')) {
      return { error: 'Not authenticated' }
    }
    console.error('Failed to run checkReminders action:', error)
    return { error: msg }
  }
}
