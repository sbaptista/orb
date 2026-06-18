import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { signAdaptationAction } from '@/lib/email'
import { logAuditEvent } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const id = searchParams.get('id')
  const action = searchParams.get('action')
  const sig = searchParams.get('sig')

  if (!id || !action || !sig) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
  }

  if (action !== 'activate' && action !== 'reject') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const expectedSig = signAdaptationAction(id, action)
  if (sig !== expectedSig) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  const supabase = createAdminClient()

  const { data: adaptation, error: fetchErr } = await supabase
    .from('orb_adaptations')
    .select('id, title, status, user_id')
    .eq('id', id)
    .single()

  if (fetchErr || !adaptation) {
    return NextResponse.json({ error: 'Adaptation not found' }, { status: 404 })
  }

  if (adaptation.status !== 'proposed') {
    const label = action === 'activate' ? 'activated' : 'rejected'
    return new NextResponse(
      htmlResponse(`Already ${adaptation.status}`, `This adaptation has already been ${adaptation.status}. No further action needed.`),
      { status: 200, headers: { 'Content-Type': 'text/html' } },
    )
  }

  const newStatus = action === 'activate' ? 'active' : 'rejected'
  const now = new Date().toISOString()
  const updateFields: Record<string, string> = { status: newStatus }
  if (action === 'activate') updateFields.activated_at = now
  else updateFields.rejected_at = now

  const { error: updateErr } = await supabase
    .from('orb_adaptations')
    .update(updateFields)
    .eq('id', id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  await logAuditEvent({
    action: `adaptation_${newStatus}`,
    table_name: 'orb_adaptations',
    record_id: id,
    before: { status: 'proposed' },
    after: { status: newStatus },
    actor: 'user',
    user_id: adaptation.user_id,
  })

  const title = action === 'activate' ? 'Adaptation Activated' : 'Adaptation Rejected'
  const message = action === 'activate'
    ? `"${adaptation.title}" is now active. The Orb will follow this rule in future conversations.`
    : `"${adaptation.title}" has been rejected. The Orb will not use this rule.`

  return new NextResponse(
    htmlResponse(title, message),
    { status: 200, headers: { 'Content-Type': 'text/html' } },
  )
}

function htmlResponse(title: string, message: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 60px auto; padding: 32px 24px; text-align: center; color: #2d3748;">
  <h2 style="margin-bottom: 12px;">${title}</h2>
  <p style="color: #4a5568; line-height: 1.6;">${message}</p>
  <p style="margin-top: 32px; font-size: 13px; color: #a0aec0;">You can close this tab.</p>
</body>
</html>`
}
