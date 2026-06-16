'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { logAuditEvent } from '@/lib/audit'

export async function logFriction({ category, summary, detail, conversation_snippet, product_id }: {
    category: string,
    summary: string,
    detail?: any,
    conversation_snippet?: string,
    product_id?: string
}) {
    const admin = createAdminClient()
    const { data, error } = await admin.from('orb_friction').insert({
        category,
        summary,
        detail,
        conversation_snippet,
        product_id
    }).select('id').single()

    if (error) {
        console.error("logFriction error:", error)
        return { error: error.message }
    }
    await logAuditEvent({ action: 'friction_log', table_name: 'orb_friction', record_id: data?.id, after: { category, summary }, actor: 'orb' })
    return { ok: true }
}

export async function getFrictionLogs() {
    const admin = createAdminClient()
    const { data, error } = await admin.from('orb_friction').select('*').order('created_at', { ascending: false })
    if (error) {
        console.error("getFrictionLogs error:", error)
        return { error: error.message, data: null }
    }
    return { data, error: null }
}

export async function deleteFrictionLog(id: string) {
    const admin = createAdminClient()
    const { error } = await admin.from('orb_friction').delete().eq('id', id)
    if (error) {
        console.error("deleteFrictionLog error:", error)
        return { error: error.message }
    }
    await logAuditEvent({ action: 'friction_delete', table_name: 'orb_friction', record_id: id, actor: 'admin-ui' })
    return { ok: true }
}
