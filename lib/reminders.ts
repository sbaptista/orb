import { createServiceClient } from './supabase/service'
import { Resend } from 'resend'
import { FROM_EMAIL } from './email'
import { dueAtToInstant } from './due-time'

type DBTodo = {
  id: string
  todo_number: number | null
  title: string
  description: string | null
  status: string
  due_at: string
  product_id: string
  projects: {
    id: string
    name: string
    code: string | null
    created_by: string
  } | null
}

// ORB-360: the zone conversion that used to live here as getUTCFromLocalTime
// was promoted to lib/due-time.ts (dueAtToInstant) as the shared single source
// of truth for all due-date math.

function formatLocalDateString(dueAtStr: string, timeZone: string): string {
  return dueAtToInstant(dueAtStr, timeZone).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  })
}

export async function processReminders(): Promise<{ notifiedCount: number; message: string }> {
  const supabase = createServiceClient()
  
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured, skipping reminders process')
    return { notifiedCount: 0, message: 'Resend API key not configured.' }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  // 1. Fetch all open/active statuses
  const { data: statuses } = await supabase
    .from('statuses')
    .select('name, is_open')

  const openStatusNames = statuses?.filter(s => s.is_open).map(s => s.name) ?? ['open', 'in progress']

  // 2. Fetch todos that are active, have a due date, and haven't been reminded
  const { data: todosData, error: todosError } = await supabase
    .from('todos')
    .select(`
      id,
      todo_number,
      title,
      description,
      status,
      due_at,
      product_id,
      projects (
        id,
        name,
        code,
        created_by
      )
    `)
    .is('deleted_at', null)
    .is('reminded_at', null)
    .not('due_at', 'is', null)
    .in('status', openStatusNames)

  if (todosError) {
    console.error('Failed to fetch todos for reminders:', todosError)
    throw new Error(todosError.message)
  }

  const todos = (todosData ?? []) as unknown as DBTodo[]
  if (todos.length === 0) {
    return { notifiedCount: 0, message: 'No pending due todos found.' }
  }

  // 3. Extract unique creator IDs and fetch their profiles
  const creatorIds = Array.from(new Set(todos.map(t => t.projects?.created_by).filter(Boolean))) as string[]
  if (creatorIds.length === 0) {
    return { notifiedCount: 0, message: 'No users found for projects.' }
  }

  const { data: usersData } = await supabase
    .from('users')
    .select('id, email, timezone, first_name, urgency_threshold_hours')
    .in('id', creatorIds)

  const userMap = new Map(usersData?.map(u => [u.id, u]) ?? [])
  const now = new Date()
  let notifiedCount = 0

  // 4. Evaluate each todo for reminder threshold
  for (const todo of todos) {
    const creatorId = todo.projects?.created_by
    if (!creatorId) continue

    const user = userMap.get(creatorId)
    if (!user || !user.email) continue

    const userTz = user.timezone || 'America/Los_Angeles'
    const dueUTC = dueAtToInstant(todo.due_at, userTz)

    // Calculate when the warning/trigger window opens based on urgency_threshold_hours
    const thresholdHours = user.urgency_threshold_hours || 0
    const warningMs = thresholdHours * 60 * 60 * 1000
    const triggerTime = new Date(dueUTC.getTime() - warningMs)

    // Send email if the current time is at or past the trigger threshold
    if (now >= triggerTime) {
      const projectCode = todo.projects?.code ?? 'TODO'
      const formattedDate = formatLocalDateString(todo.due_at, userTz)

      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: user.email,
          subject: `Orb Reminder: ${projectCode}-${todo.todo_number ?? todo.id.slice(0, 4)} is due`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
              <h2 style="color: #333; margin-bottom: 20px;">Task Due Reminder</h2>
              <p>Hi ${user.first_name || 'there'},</p>
              <p>This is a reminder that your task is now due:</p>
              <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #5a3090; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #111;">${projectCode}-${todo.todo_number ?? ''}: ${todo.title}</h3>
                ${todo.description ? `<p style="color: #666; font-size: 14px;">${todo.description}</p>` : ''}
                <p style="margin-bottom: 0; font-size: 14px;"><strong>Due Date:</strong> ${formattedDate}</p>
              </div>
              <p style="color: #888; font-size: 12px; margin-top: 30px;">— The Orb</p>
            </div>
          `
        })

        // Update reminded_at to prevent resending
        await supabase
          .from('todos')
          .update({ reminded_at: new Date().toISOString() })
          .eq('id', todo.id)

        notifiedCount++
      } catch (err) {
        console.error(`Failed to send reminder email for todo ${todo.id}:`, err)
      }
    }
  }

  return { notifiedCount, message: `Dispatched ${notifiedCount} reminders.` }
}
