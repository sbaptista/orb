'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendTicketNotificationEmail } from '@/lib/email'
import { sendPushToUser } from '@/lib/push'
import { headers } from 'next/headers'

// The Tickets project receives all auto-generated feedback (bugs, suggestions,
// capability gaps, workflow friction). Orb will eventually have CRU access
// (no delete) to this project's todos.
const TICKETS_PROJECT_CODE = 'TICKETS'

export type TicketType = 'bug' | 'suggestion' | 'capability_gap' | 'workflow_friction'

export async function createTicket({ source, type, summary, detail, conversation_snippet }: {
    source: 'orb-auto' | 'user-request' | 'admin'
    type: TicketType
    summary: string
    detail?: any
    conversation_snippet?: string
}) {
    const admin = createAdminClient()

    // Resolve the Tickets project
    const { data: project } = await admin
        .from('projects')
        .select('id')
        .eq('code', TICKETS_PROJECT_CODE)
        .maybeSingle()

    if (!project) {
        console.error('[createTicket] Tickets project not found')
        return { error: 'Tickets project not found' }
    }

    // Build description from ticket metadata
    const typeLabel = type.replace(/_/g, ' ')
    const parts = [`Source: ${source} | Type: ${typeLabel}`]
    if (conversation_snippet) parts.push(`\nContext:\n${conversation_snippet}`)
    if (detail && Object.keys(detail).length > 0) {
        parts.push(`\nDetails:\n${JSON.stringify(detail, null, 2)}`)
    }

    // Get next todo_number
    const { data: maxRow } = await admin
        .from('todos')
        .select('todo_number')
        .eq('product_id', project.id)
        .order('todo_number', { ascending: false })
        .limit(1)
        .maybeSingle()
    const nextNum = (maxRow?.todo_number ?? 0) + 1

    const { data: todo, error } = await admin.from('todos').insert({
        product_id: project.id,
        todo_number: nextNum,
        title: `[${typeLabel}] ${summary}`,
        description: parts.join('\n'),
        status: 'open',
        priority_value: null,
    }).select('id, todo_number').single()

    if (error) {
        console.error('[createTicket] insert error:', error)
        return { error: error.message }
    }

    // Dispatch admin notifications (emails & push alerts) asynchronously
    try {
        const { data: admins, error: adminsError } = await admin
            .from('users')
            .select('id, email')
            .in('role_id', [1, 3])

        if (adminsError) {
            console.error('[createTicket] Failed to fetch admins for notifications:', adminsError)
        } else if (admins && admins.length > 0) {
            const ticketType = type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())

            // Resolve request origin dynamically (e.g. localhost, staging) from headers
            let origin: string | undefined
            try {
                const headersList = await headers()
                const host = headersList.get('x-forwarded-host') || headersList.get('host')
                const protocol = headersList.get('x-forwarded-proto') || 'https'
                if (host) {
                    origin = `${protocol}://${host}`
                }
            } catch {
                // Ignore if headers() throws outside request context
            }

            await Promise.all(
                admins.flatMap(adm => {
                    const tasks: Promise<any>[] = []
                    if (adm.email) {
                        tasks.push(
                            sendTicketNotificationEmail({
                                to: adm.email,
                                ticket: { type, source, summary, detail: detail ?? {}, conversation_snippet: conversation_snippet ?? null },
                                origin,
                            }).catch(err => {
                                console.error(`[createTicket] Failed to send email to admin ${adm.email}:`, err)
                            })
                        )
                    }
                    tasks.push(
                        sendPushToUser(adm.id, {
                            title: `New Feedback: ${ticketType}`,
                            body: summary,
                            url: `/dashboard/${project.id}`,
                            tag: `ticket-${todo.id}`,
                        }).catch(err => {
                            console.error(`[createTicket] Failed to send push alert to admin ${adm.id}:`, err)
                        })
                    )
                    return tasks
                })
            )
        }
    } catch (notifyErr) {
        console.error('[createTicket] Unexpected error dispatching admin notifications:', notifyErr)
    }

    return { ok: true, data: { id: todo.id, code: `TICKETS-${todo.todo_number}` } }
}
