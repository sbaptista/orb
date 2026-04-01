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
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold">Products</h1>
        <Link
          href="/settings"
          className="text-zinc-400 hover:text-zinc-700 transition-colors"
          aria-label="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </Link>
      </div>
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
