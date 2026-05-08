import { createAdminClient } from './supabase/admin'

export async function logAuditEvent(params: {
  action: string,
  table_name?: string,
  record_id?: string,
  before?: any,
  after?: any
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
        created_at: new Date().toISOString()
      })
    
    if (error) {
      console.error('[logAuditEvent] DB Error:', error)
    }
  } catch (err) {
    console.error('[logAuditEvent] Exception:', err)
  }
}
