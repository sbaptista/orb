'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendTicketNotificationEmail } from '@/lib/email'
import { sendPushToUser } from '@/lib/push'
import { headers } from 'next/headers'

export type Ticket = {
    id: string
    source: 'orb-auto' | 'user-request' | 'admin'
    type: 'bug' | 'suggestion' | 'capability_gap' | 'workflow_friction'
    summary: string
    detail: any
    conversation_snippet: string | null
    status: 'open' | 'converted' | 'dismissed'
    converted_todo_id: string | null
    created_at: string
}

export async function createTicket({ source, type, summary, detail, conversation_snippet }: {
    source: Ticket['source']
    type: Ticket['type']
    summary: string
    detail?: any
    conversation_snippet?: string
}) {
    const admin = createAdminClient()
    const { data, error } = await admin.from('tickets').insert({
        source, type, summary,
        detail: detail ?? {},
        conversation_snippet: conversation_snippet ?? null,
    }).select().single()

    if (error) {
        console.error('createTicket error:', error)
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
                // Ignore if headers() throws outside request context (e.g. scripts/test-ticket-notification.ts)
            }

            await Promise.all(
                admins.flatMap(adm => {
                    const tasks: Promise<any>[] = []
                    if (adm.email) {
                        tasks.push(
                            sendTicketNotificationEmail({
                                to: adm.email,
                                ticket: data,
                                origin,
                            }).catch(err => {
                                console.error(`[createTicket] Failed to send email to admin ${adm.email}:`, err)
                            })
                        )
                    }
                    tasks.push(
                        sendPushToUser(adm.id, {
                            title: `New Ticket: ${ticketType}`,
                            body: summary,
                            url: '/settings/tickets',
                            tag: `ticket-${data.id}`,
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

    return { ok: true, data }
}

export async function getTickets(status?: string) {
    const admin = createAdminClient()
    let query = admin.from('tickets').select('*').order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) {
        console.error('getTickets error:', error)
        return { error: error.message, data: null }
    }
    return { data, error: null }
}

export async function convertTicketToTodo(ticketId: string, productId: string) {
    const admin = createAdminClient()

    const { data: ticket, error: fetchErr } = await admin
        .from('tickets').select('*').eq('id', ticketId).single()
    if (fetchErr || !ticket) return { error: fetchErr?.message ?? 'Ticket not found' }

    const detailStr = ticket.detail && Object.keys(ticket.detail).length > 0
        ? `\n\nDetails:\n${JSON.stringify(ticket.detail, null, 2)}` : ''
    const snippetStr = ticket.conversation_snippet
        ? `\n\nContext:\n${ticket.conversation_snippet}` : ''

    const { data: todo, error: insertErr } = await admin.from('todos').insert({
        product_id: productId,
        title: `[Ticket] ${ticket.summary}`,
        description: `Source: ${ticket.source} | Type: ${ticket.type}${snippetStr}${detailStr}`,
        status: 'open',
        priority_value: null,
    }).select('id').single()

    if (insertErr) return { error: insertErr.message }

    const { error: updateErr } = await admin.from('tickets').update({
        status: 'converted',
        converted_todo_id: todo.id,
    }).eq('id', ticketId)

    if (updateErr) return { error: updateErr.message }
    return { ok: true, todoId: todo.id }
}

export async function dismissTicket(ticketId: string) {
    const admin = createAdminClient()
    const { error } = await admin.from('tickets').update({ status: 'dismissed' }).eq('id', ticketId)
    if (error) {
        console.error('dismissTicket error:', error)
        return { error: error.message }
    }
    return { ok: true }
}

export async function deleteTicket(ticketId: string) {
    const admin = createAdminClient()
    const { error } = await admin.from('tickets').delete().eq('id', ticketId)
    if (error) {
        console.error('deleteTicket error:', error)
        return { error: error.message }
    }
    return { ok: true }
}

export async function deleteTickets(ticketIds: string[]) {
    const admin = createAdminClient()
    const { error } = await admin.from('tickets').delete().in('id', ticketIds)
    if (error) {
        console.error('deleteTickets error:', error)
        return { error: error.message }
    }
    return { ok: true }
}

export async function dismissTickets(ticketIds: string[]) {
    const admin = createAdminClient()
    const { error } = await admin.from('tickets').update({ status: 'dismissed' }).in('id', ticketIds)
    if (error) {
        console.error('dismissTickets error:', error)
        return { error: error.message }
    }
    return { ok: true }
}
