'use server'

import { requireAdmin } from '@/lib/auth'
import { snapshotUrgency, checkAndNotifyEscalation } from '@/lib/push'

export async function createTodo(data: {
  title: string
  status?: string
  priority_value?: number | null
  product_id: string
}) {
  let ctx
  try {
    ctx = await requireAdmin()
  } catch (e: any) {
    return { error: e.message }
  }

  const beforeUrgency = await snapshotUrgency(ctx.admin, ctx.user.id)

  let defaultStatus = data.status
  if (!defaultStatus) {
    const { data: openStatus } = await ctx.admin
      .from('statuses').select('name').eq('is_open', true).limit(1).single()
    defaultStatus = openStatus?.name ?? 'open'
  }
  const { data: todo, error } = await ctx.admin
    .from('todos')
    .insert({
      title: data.title,
      status: defaultStatus,
      priority_value: data.priority_value ?? null,
      product_id: data.product_id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Fire-and-forget: check if urgency escalated
  checkAndNotifyEscalation(ctx.user.id, beforeUrgency, ctx.admin)

  return { todo }
}

export async function updateTodo(id: string, data: {
  title?: string
  status?: string
  priority_value?: number | null
}) {
  let ctx
  try {
    ctx = await requireAdmin()
  } catch (e: any) {
    return { error: e.message }
  }

  const beforeUrgency = await snapshotUrgency(ctx.admin, ctx.user.id)

  const { data: todo, error } = await ctx.admin
    .from('todos')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }

  // Fire-and-forget: check if urgency escalated
  checkAndNotifyEscalation(ctx.user.id, beforeUrgency, ctx.admin)

  return { todo }
}

export async function deleteTodo(id: string) {
  let ctx
  try {
    ctx = await requireAdmin()
  } catch (e: any) {
    return { error: e.message }
  }

  const beforeUrgency = await snapshotUrgency(ctx.admin, ctx.user.id)

  const { error } = await ctx.admin.from('todos').delete().eq('id', id)
  if (error) return { error: error.message }

  // Fire-and-forget: check if urgency de-escalated won't push (only escalation),
  // but snapshot is needed in case delete shifts urgency up (e.g. removing a calm task
  // while urgent ones remain doesn't change, but pattern is consistent)
  checkAndNotifyEscalation(ctx.user.id, beforeUrgency, ctx.admin)

  return { success: true }
}
