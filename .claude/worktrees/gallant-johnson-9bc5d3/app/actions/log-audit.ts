'use server'

import { logAuditEvent } from '@/lib/audit'

export async function logAudit(params: {
  action: string
  table_name?: string
  record_id?: string
  before?: any
  after?: any
}) {
  await logAuditEvent(params)
}
