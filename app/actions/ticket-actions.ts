'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, getAuthContext } from '@/lib/auth'
import { sendTicketNotificationEmail } from '@/lib/email'
import { sendTicketStatusEmail } from '@/lib/email'
import { sendPushToUser } from '@/lib/push'
import { logAuditEvent } from '@/lib/audit'
import { headers } from 'next/headers'

export type TicketType = 'bug' | 'suggestion' | 'capability_gap' | 'workflow_friction'
export type TicketStatus = 'open' | 'in_progress' | 'closed' | 'dismissed'

export type Ticket = {
  id: string
  ticket_number: number
  type: TicketType
  source: 'orb-auto' | 'user-request' | 'admin'
  summary: string
  detail: Record<string, any>
  conversation_snippet: string | null
  reported_by: string | null
  status: TicketStatus
  dismiss_reason: string | null
  todo_id: string | null
  notified_in_progress: boolean
  notified_closed: boolean
  created_at: string
  updated_at: string
  closed_at: string | null
  // Joined
  reporter?: { first_name: string | null; last_name: string | null; email: string } | null
  linked_todo?: { todo_number: number | null; projects: { code: string | null } | null } | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function resolveOrigin(): Promise<string | undefined> {
  try {
    const headersList = await headers()
    const host = headersList.get('x-forwarded-host') || headersList.get('host')
    const protocol = headersList.get('x-forwarded-proto') || 'https'
    if (host) return `${protocol}://${host}`
  } catch {
    // Outside request context (scripts/cron)
  }
  return undefined
}

async function getAdmins(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin
    .from('users')
    .select('id, email')
    .in('role_id', [1, 3])
  if (error) console.error('[ticket-actions] Failed to fetch admins:', error)
  return data ?? []
}

// ── createTicket ─────────────────────────────────────────────────────────────
// Inserts into the tickets table (not todos). Notifies admins via push + email.

export async function createTicket({
  source,
  type,
  summary,
  detail,
  conversation_snippet,
  reportedBy,
}: {
  source: 'orb-auto' | 'user-request' | 'admin'
  type: TicketType
  summary: string
  detail?: any
  conversation_snippet?: string
  reportedBy?: string
}) {
  const admin = createAdminClient()

  // Get next ticket_number
  const { data: maxRow } = await admin
    .from('tickets')
    .select('ticket_number')
    .order('ticket_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextNum = (maxRow?.ticket_number ?? 0) + 1

  const { data: ticket, error } = await admin
    .from('tickets')
    .insert({
      ticket_number: nextNum,
      type,
      source,
      summary,
      detail: detail ?? {},
      conversation_snippet: conversation_snippet ?? null,
      reported_by: reportedBy ?? null,
      status: 'open',
    })
    .select('id, ticket_number')
    .single()

  if (error) {
    console.error('[createTicket] insert error:', error)
    return { error: error.message }
  }

  // Dispatch admin notifications (fire-and-forget)
  try {
    const origin = await resolveOrigin()
    const admins = await getAdmins(admin)

    if (admins.length > 0) {
      await Promise.all(
        admins.flatMap(adm => {
          const tasks: Promise<any>[] = []
          if (adm.email) {
            tasks.push(
              sendTicketNotificationEmail({
                to: adm.email,
                ticket: {
                  type,
                  source,
                  summary,
                  detail: detail ?? {},
                  conversation_snippet: conversation_snippet ?? null,
                },
                origin,
              }).catch(err =>
                console.error(`[createTicket] email failed for ${adm.email}:`, err),
              ),
            )
          }
          tasks.push(
            sendPushToUser(adm.id, {
              title: `New Feedback: ${type.replace(/_/g, ' ')}`,
              body: summary,
              url: `/settings/tickets`,
              tag: `ticket-${ticket.id}`,
            }).catch(err =>
              console.error(`[createTicket] push failed for ${adm.id}:`, err),
            ),
          )
          return tasks
        }),
      )
    }
  } catch (notifyErr) {
    console.error('[createTicket] Unexpected error dispatching notifications:', notifyErr)
  }

  return { ok: true, data: { id: ticket.id, code: `TICKETS-${ticket.ticket_number}` } }
}

// ── updateTicket ─────────────────────────────────────────────────────────────
// General-purpose ticket update (summary, type, detail, status, dismiss_reason).

export async function updateTicket(
  ticketId: string,
  fields: { summary?: string; type?: TicketType; status?: TicketStatus; dismiss_reason?: string | null },
): Promise<{ error?: string }> {
  const auth = await getAuthContext()
  if (!auth.isAdmin) return { error: 'admin only' }

  const patch: Record<string, any> = {}
  if (fields.summary !== undefined) patch.summary = fields.summary
  if (fields.type !== undefined) patch.type = fields.type
  if (fields.status !== undefined) {
    patch.status = fields.status
    if (fields.status === 'closed') patch.closed_at = new Date().toISOString()
  }
  if (fields.dismiss_reason !== undefined) patch.dismiss_reason = fields.dismiss_reason

  if (Object.keys(patch).length === 0) return { error: 'no fields to update' }

  const admin = createAdminClient()
  const { error } = await admin.from('tickets').update(patch).eq('id', ticketId)
  if (error) return { error: error.message }

  if (fields.status) {
    updateTicketStatus(ticketId, fields.status).catch(err =>
      console.error('[updateTicket] status notification failed:', err)
    )
  }

  return {}
}

// ── updateTicketStatus ────────────────────────────────────────────────────────
// Updates ticket status, fires push + email to reporter if status is progressing.
// Fire-and-forget safe — errors are logged, never thrown.

export async function updateTicketStatus(
  ticketId: string,
  newStatus: TicketStatus,
): Promise<void> {
  const admin = createAdminClient()

  // Fetch ticket + reporter info
  const { data: ticket, error: fetchErr } = await admin
    .from('tickets')
    .select('id, status, summary, ticket_number, notified_in_progress, notified_closed, reported_by, users!reported_by(first_name, email)')
    .eq('id', ticketId)
    .maybeSingle()

  if (fetchErr || !ticket) {
    console.error('[updateTicketStatus] fetch error:', fetchErr)
    return
  }

  const patch: Record<string, any> = { status: newStatus }
  if (newStatus === 'closed') patch.closed_at = new Date().toISOString()

  const { error: updateErr } = await admin
    .from('tickets')
    .update(patch)
    .eq('id', ticketId)

  if (updateErr) {
    console.error('[updateTicketStatus] update error:', updateErr)
    return
  }

  // Notify reporter
  try {
    const reporter = (ticket as any).users as { first_name: string | null; email: string } | null
    if (!reporter?.email) return

    const ticketCode = `TICKETS-${ticket.ticket_number}`

    if (newStatus === 'in_progress' && !ticket.notified_in_progress) {
      await Promise.allSettled([
        sendPushToUser(ticket.reported_by!, {
          title: 'We\'re working on your feedback',
          body: ticket.summary,
          url: '/',
          tag: `ticket-progress-${ticket.id}`,
        }),
        sendTicketStatusEmail({
          to: reporter.email,
          firstName: reporter.first_name ?? 'there',
          status: 'in_progress',
          summary: ticket.summary,
          ticketCode,
        }),
      ])
      await admin
        .from('tickets')
        .update({ notified_in_progress: true })
        .eq('id', ticketId)
    } else if (newStatus === 'closed' && !ticket.notified_closed) {
      await Promise.allSettled([
        sendPushToUser(ticket.reported_by!, {
          title: 'Your feedback has been addressed',
          body: ticket.summary,
          url: '/',
          tag: `ticket-closed-${ticket.id}`,
        }),
        sendTicketStatusEmail({
          to: reporter.email,
          firstName: reporter.first_name ?? 'there',
          status: 'closed',
          summary: ticket.summary,
          ticketCode,
        }),
      ])
      await admin
        .from('tickets')
        .update({ notified_closed: true })
        .eq('id', ticketId)
    }
  } catch (notifyErr) {
    console.error('[updateTicketStatus] Notification error:', notifyErr)
  }
}

// ── createTodoFromTicket ──────────────────────────────────────────────────────
// Admin action: creates a todo linked to a ticket.

export async function createTodoFromTicket(
  ticketId: string,
  todoData: { projectId: string; title: string },
) {
  const ctx = await requireAdmin()

  // Get next todo_number for the project
  const { data: maxRow } = await ctx.admin
    .from('todos')
    .select('todo_number')
    .eq('product_id', todoData.projectId)
    .order('todo_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextNum = (maxRow?.todo_number ?? 0) + 1

  const { data: todo, error: todoErr } = await ctx.admin
    .from('todos')
    .insert({
      product_id: todoData.projectId,
      todo_number: nextNum,
      title: todoData.title,
      status: 'open',
      ticket_id: ticketId,
    })
    .select('id, todo_number, product_id, projects!product_id(code)')
    .single()

  if (todoErr) {
    console.error('[createTodoFromTicket] insert error:', todoErr)
    return { error: todoErr.message }
  }

  // Link the ticket back to the todo
  const { error: linkErr } = await ctx.admin
    .from('tickets')
    .update({ todo_id: todo.id })
    .eq('id', ticketId)

  if (linkErr) {
    console.error('[createTodoFromTicket] link error:', linkErr)
    // Non-fatal — todo was created, just the back-link failed
  }

  const project = (todo as any).projects as { code: string | null } | null
  const todoRef = project?.code && todo.todo_number != null
    ? `${project.code}-${todo.todo_number}`
    : null

  return { ok: true, data: { id: todo.id, ref: todoRef } }
}

// ── getTickets ────────────────────────────────────────────────────────────────

export async function getTickets(filter?: { status?: TicketStatus }) {
  const ctx = await requireAdmin()

  let query = ctx.admin
    .from('tickets')
    .select(`
      id, ticket_number, type, source, summary, status, dismiss_reason,
      todo_id, notified_in_progress, notified_closed,
      created_at, closed_at,
      reported_by,
      users!reported_by ( first_name, last_name, email ),
      todos!todo_id ( todo_number, projects!product_id ( code ) )
    `)
    .order('created_at', { ascending: false })

  if (filter?.status) {
    query = query.eq('status', filter.status)
  }

  const { data, error } = await query

  if (error) {
    console.error('[getTickets] error:', error)
    return { error: error.message }
  }

  return { ok: true, data: data as unknown as Ticket[] }
}

// ── dismissTicket ─────────────────────────────────────────────────────────────

export async function dismissTicket(ticketId: string, reason?: string) {
  const ctx = await requireAdmin()

  // Fetch current state for audit log
  const { data: before } = await ctx.admin
    .from('tickets')
    .select('status, summary')
    .eq('id', ticketId)
    .maybeSingle()

  const { error } = await ctx.admin
    .from('tickets')
    .update({
      status: 'dismissed',
      dismiss_reason: reason ?? null,
    })
    .eq('id', ticketId)

  if (error) {
    console.error('[dismissTicket] error:', error)
    return { error: error.message }
  }

  // Audit log
  const authCtx = await getAuthContext()
  await logAuditEvent({
    action: 'ticket.dismissed',
    table_name: 'tickets',
    record_id: ticketId,
    before: { status: before?.status ?? 'unknown' },
    after: { status: 'dismissed', dismiss_reason: reason ?? null },
    actor: authCtx?.user?.email ?? 'admin',
    user_id: authCtx?.user?.id,
  })

  return { ok: true }
}
