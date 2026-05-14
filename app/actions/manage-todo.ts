'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { assertAdmin } from '@/lib/auth'

export async function createTodo(data: {
  title: string
  status?: string
  priority_value?: number | null
  product_id: string
}) {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { error: e.message }
  }

  const admin = createAdminClient()
  const { data: todo, error } = await admin
    .from('todos')
    .insert({
      title: data.title,
      status: data.status ?? 'open',
      priority_value: data.priority_value ?? null,
      product_id: data.product_id,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { todo }
}

export async function updateTodo(id: string, data: {
  title?: string
  status?: string
  priority_value?: number | null
}) {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { error: e.message }
  }

  const admin = createAdminClient()
  const { data: todo, error } = await admin
    .from('todos')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }
  return { todo }
}

export async function deleteTodo(id: string) {
  try {
    await assertAdmin()
  } catch (e: any) {
    return { error: e.message }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('todos').delete().eq('id', id)
  if (error) return { error: error.message }
  return { success: true }
}
