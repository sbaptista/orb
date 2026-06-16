import { createAdminClient } from './supabase/admin'

export async function logAuditEvent(params: {
  action: string,
  table_name?: string,
  record_id?: string,
  before?: any,
  after?: any,
  actor?: string,
  user_id?: string,
  system_info?: { browser: string; os: string; os_version: string; viewport: string } | null,
}) {
  const supabase = createAdminClient()

  try {
    const { error } = await supabase
      .from('audit_log')
      .insert({
        action: params.action,
        table_name: params.table_name || 'system',
        record_id: params.record_id,
        before: params.before,
        after: params.after,
        actor: params.actor ?? null,
        user_id: params.user_id ?? null,
        system_info: params.system_info ?? null,
        created_at: new Date().toISOString()
      })
    
    if (error) {
      console.error('[logAuditEvent] DB Error:', error)
    }
  } catch (err) {
    console.error('[logAuditEvent] Exception:', err)
  }
}
