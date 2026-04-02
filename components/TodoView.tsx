'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import TodoPanel from './TodoPanel'
import TodoForm from './TodoForm'
import ProductConfigPanel from './ProductConfigPanel'

export type Status = 'open' | 'in_progress' | 'on_hold' | 'done'

export type Todo = {
  id: string
  product_id: string
  group_id: string | null
  category_id: string | null
  priority_value: number | null
  title: string
  description: string | null
  resolution_notes: string | null
  status: Status
  urls: string[]
  sort_order: number
  created_at: string
  closed_at: string | null
  groups: { name: string } | null
  categories: { name: string } | null
}

export type Group = { id: string; name: string; product_id: string }
export type Category = { id: string; name: string; product_id: string }
export type Product = { id: string; name: string; color: string | null; icon: string | null }
export type Priority = { value: number; label: string }

const STATUS_BORDER: Record<Status, string> = {
  open: 'bg-amber-500',
  in_progress: 'bg-blue-500',
  on_hold: 'bg-slate-400',
  done: 'bg-green-500',
}

export default function TodoView({ productId }: { productId: string }) {
  const isAll = productId === 'all'
  const supabase = useMemo(() => createClient(), [])

  const [todos, setTodos] = useState<Todo[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [loading, setLoading] = useState(true)

  const [filterStatus, setFilterStatus] = useState('all')
  const [filterGroup, setFilterGroup] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')

  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)
  const [showNewTodo, setShowNewTodo] = useState(false)
  const [showProductConfig, setShowProductConfig] = useState(false)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      let todoQuery = supabase
        .from('todos')
        .select('*, groups(name), categories(name)')
        .order('sort_order')

      if (!isAll) todoQuery = todoQuery.eq('product_id', productId)

      let groupQuery = supabase.from('groups').select('id, name, product_id').order('sort_order')
      if (!isAll) groupQuery = groupQuery.eq('product_id', productId)

      let catQuery = supabase.from('categories').select('id, name, product_id').order('sort_order')
      if (!isAll) catQuery = catQuery.eq('product_id', productId)

      const [todosRes, groupsRes, catsRes, productsRes, prioritiesRes] = await Promise.all([
        todoQuery,
        groupQuery,
        catQuery,
        supabase.from('products').select('id, name, color, icon').order('sort_order'),
        supabase.from('priorities').select('value, label').order('value'),
      ])

      setTodos((todosRes.data as Todo[]) ?? [])
      setGroups(groupsRes.data ?? [])
      setCategories(catsRes.data ?? [])
      setProducts(productsRes.data ?? [])
      setPriorities(prioritiesRes.data ?? [])
      setLoading(false)
    }

    fetchData()
  }, [productId, isAll, supabase])

  async function handleToggleDone(e: React.MouseEvent, todo: Todo) {
    e.stopPropagation()
    const newStatus: Status = todo.status === 'done' ? 'open' : 'done'
    const { data } = await supabase
      .from('todos')
      .update({
        status: newStatus,
        closed_at: newStatus === 'done' ? new Date().toISOString() : null,
      })
      .eq('id', todo.id)
      .select('*, groups(name), categories(name)')
      .single()

    if (data) {
      const updated = data as Todo
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)))
      if (selectedTodo?.id === todo.id) setSelectedTodo(updated)
    }
  }

  const priorityMap = useMemo(
    () => new Map(priorities.map((p) => [p.value, p.label])),
    [priorities]
  )

  const filtered = todos.filter((t) => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    if (filterGroup !== 'all' && t.group_id !== filterGroup) return false
    if (filterCategory !== 'all' && t.category_id !== filterCategory) return false
    if (filterPriority === 'p1' && t.priority_value !== 1) return false
    if (filterPriority === 'none' && t.priority_value != null) return false
    return true
  })

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors">
          ← Products
        </Link>
        {!isAll && (() => {
          const currentProduct = products.find(p => p.id === productId)
          return currentProduct ? (
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-zinc-800">{currentProduct.name}</span>
              <button
                onClick={() => setShowProductConfig(true)}
                className="text-zinc-400 hover:text-zinc-700 transition-colors"
                aria-label="Product settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>
            </div>
          ) : null
        })()}
        <button
          onClick={() => setShowNewTodo(true)}
          className="text-sm bg-zinc-900 text-white px-3 py-1.5 rounded hover:bg-zinc-700 transition-colors"
        >
          New Todo
        </button>
      </div>

      {/* Filter bar */}
      <div className="border-b border-zinc-200 bg-white px-6 py-2.5 flex items-center gap-3 flex-wrap">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border border-zinc-200 rounded px-2 py-1.5 bg-white"
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="on_hold">On Hold</option>
          <option value="done">Done</option>
        </select>

        <select
          value={filterGroup}
          onChange={(e) => setFilterGroup(e.target.value)}
          className="text-sm border border-zinc-200 rounded px-2 py-1.5 bg-white"
        >
          <option value="all">All groups</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="text-sm border border-zinc-200 rounded px-2 py-1.5 bg-white"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="text-sm border border-zinc-200 rounded px-2 py-1.5 bg-white"
        >
          <option value="all">All priorities</option>
          <option value="p1">P1 only</option>
          <option value="none">No priority</option>
        </select>

        <span className="ml-auto text-xs text-zinc-400">
          {filtered.length} todo{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Todo list */}
      <div className="max-w-5xl mx-auto px-6 py-4">
        {loading ? (
          <p className="text-sm text-zinc-400 py-12 text-center">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-zinc-400 py-12 text-center">No todos found.</p>
        ) : (
          <div className="divide-y divide-zinc-100 bg-white rounded-lg border border-zinc-200 overflow-hidden">
            {filtered.map((todo) => (
              <div
                key={todo.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 cursor-pointer"
                onClick={() => setSelectedTodo(todo)}
              >
                {/* Status color bar */}
                <div className={`w-1 self-stretch rounded-full shrink-0 ${STATUS_BORDER[todo.status]}`} />

                {/* Done checkbox */}
                <input
                  type="checkbox"
                  checked={todo.status === 'done'}
                  onChange={() => {}}
                  onClick={(e) => handleToggleDone(e, todo)}
                  className="shrink-0 h-4 w-4 accent-zinc-700 cursor-pointer"
                />

                {/* Title and meta */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${todo.status === 'done' ? 'line-through text-zinc-400' : 'text-zinc-800'}`}>
                    {todo.title}
                  </p>
                  {(todo.groups?.name || todo.categories?.name) && (
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {[todo.groups?.name, todo.categories?.name].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>

                {/* Priority badge */}
                {todo.priority_value != null && priorityMap.has(todo.priority_value) && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 shrink-0 font-medium whitespace-nowrap">
                    {priorityMap.get(todo.priority_value)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedTodo && (
        <TodoPanel
          todo={selectedTodo}
          groups={groups}
          categories={categories}
          products={products}
          priorities={priorities}
          isAll={isAll}
          onClose={() => setSelectedTodo(null)}
          onSave={(updated) => {
            setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
            setSelectedTodo(updated)
          }}
          onDelete={(id) => {
            setTodos((prev) => prev.filter((t) => t.id !== id))
            setSelectedTodo(null)
          }}
        />
      )}

      {showNewTodo && (
        <TodoForm
          productId={isAll ? undefined : productId}
          products={products}
          groups={groups}
          categories={categories}
          priorities={priorities}
          onClose={() => setShowNewTodo(false)}
          onCreate={(todo) => {
            setTodos((prev) => [...prev, todo])
            setShowNewTodo(false)
          }}
        />
      )}

      {showProductConfig && !isAll && (() => {
        const currentProduct = products.find(p => p.id === productId)
        return currentProduct ? (
          <ProductConfigPanel
            productId={productId}
            productName={currentProduct.name}
            productIcon={currentProduct.icon}
            onClose={() => setShowProductConfig(false)}
          />
        ) : null
      })()}
    </div>
  )
}
