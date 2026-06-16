'use server'

import { logAuditEvent } from '@/lib/audit'
import { getAuthContext } from '@/lib/auth'

export async function logAudit(params: {
  action: string
  table_name?: string
  record_id?: string
  before?: any
  after?: any
  actor?: string
  user_id?: string
  system_info?: { browser: string; os: string; os_version: string; viewport: string } | null
}) {
  let userId = params.user_id
  if (!userId) {
    try {
      const auth = await getAuthContext()
      userId = auth.user.id
    } catch {}
  }
  await logAuditEvent({ ...params, actor: params.actor ?? 'web-ui', user_id: userId })
}
