'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function diagnoseAudit() {
  const supabase = createAdminClient()
  const result: any = {}

  // 1. Can we count rows?
  const { count, error: countError } = await supabase
    .from('audit_log')
    .select('*', { count: 'exact', head: true })
  result.rowCount = count
  result.countError = countError?.message ?? null

  // 2. Bad probe — null record_id (system-level event shape)
  const { data: badData, error: badError } = await supabase
    .from('audit_log')
    .insert({
      action: 'diagnostic_probe_null_record',
      table_name: 'system',
      record_id: null,
      after: { probe: 'null_record_id', ts: new Date().toISOString() }
    })
    .select()
    .single()
  result.badProbe = {
    error: badError?.message ?? null,
    code: badError?.code ?? null,
    inserted: !!badData
  }

  // 3. Good probe — valid record_id (typical mutation event shape)
  const { data: goodData, error: goodError } = await supabase
    .from('audit_log')
    .insert({
      action: 'diagnostic_probe_with_record',
      table_name: 'system',
      record_id: '00000000-0000-0000-0000-000000000001',
      after: { probe: 'with_record_id', ts: new Date().toISOString() }
    })
    .select()
    .single()
  result.goodProbe = {
    error: goodError?.message ?? null,
    code: goodError?.code ?? null,
    inserted: !!goodData,
    columns: goodData ? Object.keys(goodData) : null
  }

  // 4. Final row count
  const { count: finalCount } = await supabase
    .from('audit_log')
    .select('*', { count: 'exact', head: true })
  result.finalRowCount = finalCount

  return result
}
