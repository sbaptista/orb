import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TodoView from '@/components/TodoView'

export default async function ProductPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { productId } = await params
  return <TodoView productId={productId} />
}
