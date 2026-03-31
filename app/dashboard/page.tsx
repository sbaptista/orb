import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

type Product = {
  id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: products } = await supabase
    .from('products')
    .select('id, name, description, color, icon')
    .order('sort_order')

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-xl font-semibold mb-8">Products</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Link
          href="/dashboard/all"
          className="flex flex-col gap-1 p-5 rounded-lg border border-zinc-200 bg-white hover:border-zinc-400 transition-colors"
        >
          <span className="text-2xl">📋</span>
          <span className="font-medium text-sm mt-1">All</span>
          <span className="text-xs text-zinc-500">View all todos</span>
        </Link>
        {(products ?? []).map((p: Product) => (
          <Link
            key={p.id}
            href={`/dashboard/${p.id}`}
            className="flex flex-col gap-1 p-5 rounded-lg border border-zinc-200 bg-white hover:border-zinc-400 transition-colors"
          >
            <span className="text-2xl">{p.icon ?? '📦'}</span>
            <span className="font-medium text-sm mt-1">{p.name}</span>
            {p.description && (
              <span className="text-xs text-zinc-500 line-clamp-2">{p.description}</span>
            )}
          </Link>
        ))}
      </div>
    </main>
  )
}
