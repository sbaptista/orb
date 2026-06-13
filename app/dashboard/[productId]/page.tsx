import { createClient } from '@/lib/supabase/server'
import { resolveUser } from '@/lib/resolve-user'
import { redirect } from 'next/navigation'
import TodoView from '@/components/TodoView'
import AppNav from '@/components/AppNav'

export default async function ProductPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) redirect('/auth/login')

  const result = await resolveUser(user.id, user.email)
  if (!result.ok) redirect(result.redirectTo)

  const isAdmin = result.user.role_id === 1 || result.user.role_id === 3
  const userInitial = (result.user.first_name || user.email || '?').charAt(0).toUpperCase()

  const { productId } = await params
  return (
    <>
      <AppNav userInitial={userInitial} />
      <TodoView productId={productId} isAdmin={isAdmin} />
    </>
  )
}
