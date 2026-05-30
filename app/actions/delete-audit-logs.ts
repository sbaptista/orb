'use server'

import { requireAdmin } from '@/lib/auth'

export async function deleteAuditLogs(ids: string[]) {
  const ctx = await requireAdmin()

  try {
    const { error } = await ctx.admin
      .from('audit_log')
      .delete()
      .in('id', ids)

    if (error) throw error
    return { ok: true }
  } catch (err: any) {
    console.error('[deleteAuditLogs] Error:', err)
    return { error: err.message }
  }
}
