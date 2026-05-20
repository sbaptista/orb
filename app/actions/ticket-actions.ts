'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendTicketNotificationEmail } from '@/lib/email'

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

    // Dispatch admin emails asynchronously
    try {
        const { data: admins, error: adminsError } = await admin
            .from('users')
            .select('email')
            .in('role_id', [1, 3])

        if (adminsError) {
            console.error('[createTicket] Failed to fetch admins for email notification:', adminsError)
        } else if (admins && admins.length > 0) {
            const adminEmails = admins.map(u => u.email).filter(Boolean) as string[]
            await Promise.all(
                adminEmails.map(email =>
                    sendTicketNotificationEmail({
                        to: email,
                        ticket: data,
                    }).catch(err => {
                        console.error(`[createTicket] Failed to send email to admin ${email}:`, err)
                    })
                )
            )
        }
    } catch (emailErr) {
        console.error('[createTicket] Unexpected error dispatching admin emails:', emailErr)
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
