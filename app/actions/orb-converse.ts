'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

// ──────────────────────────────────────────────────────────────────────────
// Types — what the orb returns to the UI
// ──────────────────────────────────────────────────────────────────────────

export type OrbResponse = {
  speech: string
  // when an action mutates the DB, UI should refetch todos for the affected product
  refresh?: boolean
  mutatedProductId?: string
  // optional structured result for query intents (renderable as fragment view)
  results?: Array<{ id: string; code: string; title: string; status: string; priority_value: number | null }>
  queryLabel?: string
  // for debugging — only populated when dryRun=true
  debug?: {
    toolCalls: Array<{ name: string; input: unknown }>
    rawText?: string
  }
  error?: string
}

export type OrbRequest = {
  input: string
  productId: string  // currently-selected product
  scopeToProduct?: boolean  // when true, queries default to current product
  history?: Array<{ role: 'user' | 'assistant'; text: string }>
  dryRun?: boolean
}

// ──────────────────────────────────────────────────────────────────────────
// Rate limiter — per-process, per-user. Sufficient for personal use.
// ──────────────────────────────────────────────────────────────────────────

const RATE_LIMIT_MAX = 10        // calls
const RATE_LIMIT_WINDOW = 60_000 // per 60s
const rateLimits = new Map<string, number[]>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const calls = (rateLimits.get(userId) ?? []).filter(t => now - t < RATE_LIMIT_WINDOW)
  if (calls.length >= RATE_LIMIT_MAX) return false
  calls.push(now)
  rateLimits.set(userId, calls)
  return true
}

// ──────────────────────────────────────────────────────────────────────────
// Tool definitions — what Claude can do
// ──────────────────────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_todo',
    description: 'Create a new todo. Use this when the user wants to add, remember, or capture something to do. If product is not specified, default to the currently-selected product.',
    input_schema: {
      type: 'object',
      properties: {
        product_code: { type: 'string', description: 'Product code (e.g. TODOS, HELM). Defaults to current product if omitted.' },
        title: { type: 'string', description: 'Short, action-oriented title.' },
        description: { type: 'string', description: 'Optional longer detail.' },
        priority_value: { type: 'integer', description: '1=urgent, 2=high, 3=medium, 4=low. Omit if not specified.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'query_todos',
    description: 'Find todos matching criteria. Use for "show me", "what\'s open", "what\'s urgent", etc.',
    input_schema: {
      type: 'object',
      properties: {
        product_code: { type: 'string', description: "Restrict to a product. If omitted, defaults to the user's current scope (which may be a specific product or all products)." },
        status: { type: 'string', enum: ['open', 'done', 'any'], description: 'Default: open' },
        priority_max: { type: 'integer', description: 'Only items where priority_value <= this. e.g. 1 for urgent only, 2 for urgent+high.' },
        text_match: { type: 'string', description: 'Free-text match against title/description.' },
        max_results: { type: 'integer', description: 'Default: 20. Only lower this when the user explicitly wants a short summary.' },
      },
    },
  },
  {
    name: 'update_todo',
    description: 'Update an existing todo. Identify it by code (e.g. TODOS-23) when the user gives one, otherwise by title_match.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Todo code like TODOS-23.' },
        title_match: { type: 'string', description: 'Fuzzy title match if no code given.' },
        new_status: { type: 'string', enum: ['open', 'in_progress', 'on_hold', 'done'] },
        new_priority: { type: 'integer', description: '1-4' },
        new_title: { type: 'string' },
        description: { type: 'string', description: 'Longer detail about the todo.' },
        resolution_notes: { type: 'string', description: 'What was done to resolve this. Populate when marking done.' },
        group_name: { type: 'string', description: 'Group name, resolved within the todo\'s product.' },
        category_name: { type: 'string', description: 'Category name, resolved within the todo\'s product.' },
        urls: { type: 'array', items: { type: 'string' }, description: 'Reference URLs.' },
      },
    },
  },
]

// ──────────────────────────────────────────────────────────────────────────
// Backlog context — serialized into system prompt for Claude to reason over
// ──────────────────────────────────────────────────────────────────────────

type Product  = { id: string; name: string; code: string | null }
type TodoRow  = {
  id: string
  todo_number: number
  title: string
  status: string
  priority_value: number | null
  product_id: string
}
type GroupRow    = { id: string; name: string; product_id: string }
type CategoryRow = { id: string; name: string; product_id: string }

async function buildContext(supabase: Awaited<ReturnType<typeof createClient>>, currentProductId: string) {
  const [{ data: products }, { data: todos }, { data: groups }, { data: categories }] = await Promise.all([
    supabase.from('projects').select('id, name, code').order('sort_order'),
    supabase.from('todos').select('id, todo_number, title, status, priority_value, product_id').is('deleted_at', null),
    supabase.from('groups').select('id, name, product_id'),
    supabase.from('categories').select('id, name, product_id'),
  ])

  const productList  = (products   ?? []) as Product[]
  const todoList     = (todos      ?? []) as TodoRow[]
  const groupList    = (groups     ?? []) as GroupRow[]
  const categoryList = (categories ?? []) as CategoryRow[]
  const current = productList.find(p => p.id === currentProductId)

  const byProduct = productList.map(p => {
    const productTodos = todoList
      .filter(t => t.product_id === p.id && t.status !== 'done')
      .map(t => `  ${p.code ?? p.name}-${t.todo_number} [P${t.priority_value ?? '-'}] ${t.title}`)
      .join('\n')
    return `${p.code ?? p.name}:\n${productTodos || '  (none open)'}`
  }).join('\n\n')

  return { productList, todoList, groupList, categoryList, current, contextString: byProduct }
}

// ──────────────────────────────────────────────────────────────────────────
// System prompt
// ──────────────────────────────────────────────────────────────────────────

function systemPrompt(contextString: string, currentCode: string | null, scopeToProduct: boolean): Anthropic.TextBlockParam[] {
  return [
    {
      type: 'text',
      text: `You are the voice of the orb — the conversational layer of TODOS, a personal todo tracker. The user types short natural-language input. You decide whether to create, query, update, or just explain.

VOICE
- Brief, direct, sentence case.
- One short sentence by default. Two when needed. Never paragraphs.
- Never narrate what you're about to do — just do it (call the tool) and acknowledge briefly.
- If you don't know, say so plainly. Don't fabricate.

WHEN TO CALL TOOLS
- create_todo: user wants to add or capture something
- query_todos: user wants to see, list, find, or know what's open
- update_todo: user wants to change status (mark done), priority, or title of an existing item
- No tool needed: explanations, meta questions ("what does this mean?"), or clarifications

DEFAULTS
- If product not specified, use currently-selected product: ${currentCode ?? '(none)'}
- For queries without explicit product: ${scopeToProduct ? `restrict to current product (${currentCode ?? 'none'})` : 'search across all products'}
- For queries, "urgent" = priority_value 1; "important" = 1-2.

KEYBOARD NAVIGATION (answer without a tool if asked)
- Tab: move between interactive elements
- Enter or Space: activate the focused element
- Left/Right arrow keys: switch products on the orb screen
- ?: open the help page
- Escape: close any open panel or overlay
The app is fully keyboard-accessible and screen-reader-friendly.

ACK FORMATS
- After create_todo: "Added — CODE-N" (the system will give you the new code)
- After update_todo (mark done): "Marked CODE-N done"
- After query_todos: a one-line summary, e.g. "3 urgent open: TODOS-22, HELM-18, HELM-31"

CURRENT BACKLOG (open items)
${contextString}`,
      cache_control: { type: 'ephemeral' },
    },
  ]
}

// ──────────────────────────────────────────────────────────────────────────
// Tool execution
// ──────────────────────────────────────────────────────────────────────────

type ToolContext = {
  supabase: Awaited<ReturnType<typeof createClient>>
  products: Product[]
  todos: TodoRow[]
  groups: GroupRow[]
  categories: CategoryRow[]
  currentProductId: string
  scopeToProduct: boolean
}

async function executeTool(name: string, input: any, ctx: ToolContext): Promise<string> {
  if (name === 'create_todo') {
    const product = input.product_code
      ? ctx.products.find(p => p.code?.toUpperCase() === String(input.product_code).toUpperCase())
      : ctx.products.find(p => p.id === ctx.currentProductId)
    if (!product) return JSON.stringify({ error: 'product not found' })

    const { data, error } = await ctx.supabase
      .from('todos')
      .insert({
        product_id: product.id,
        title: input.title,
        description: input.description ?? null,
        status: 'open',
        priority_value: input.priority_value ?? null,
        sort_order: 0,
        urls: [],
      })
      .select('todo_number')
      .single()

    if (error) return JSON.stringify({ error: error.message })
    return JSON.stringify({ ok: true, code: `${product.code ?? product.name}-${data.todo_number}`, product_id: product.id })
  }

  if (name === 'query_todos') {
    let results = ctx.todos.slice()
    if (input.status && input.status !== 'any') results = results.filter(t => t.status === input.status)
    else results = results.filter(t => t.status !== 'done') // default: open
    if (input.product_code) {
      const p = ctx.products.find(pp => pp.code?.toUpperCase() === String(input.product_code).toUpperCase())
      if (p) results = results.filter(t => t.product_id === p.id)
    } else if (ctx.scopeToProduct) {
      results = results.filter(t => t.product_id === ctx.currentProductId)
    }
    if (typeof input.priority_max === 'number') {
      results = results.filter(t => t.priority_value !== null && t.priority_value <= input.priority_max)
    }
    if (input.text_match) {
      const q = String(input.text_match).toLowerCase()
      results = results.filter(t => t.title.toLowerCase().includes(q))
    }
    results.sort((a, b) => (a.priority_value ?? 99) - (b.priority_value ?? 99))
    const max = input.max_results ?? 20
    const formatted = results.slice(0, max).map(t => {
      const p = ctx.products.find(pp => pp.id === t.product_id)
      return { id: t.id, code: `${p?.code ?? p?.name}-${t.todo_number}`, title: t.title, status: t.status, priority_value: t.priority_value }
    })
    return JSON.stringify({ count: results.length, returned: formatted })
  }

  if (name === 'update_todo') {
    let target: TodoRow | undefined
    if (input.code) {
      const m = String(input.code).match(/^([A-Z0-9]+)-(\d+)$/i)
      if (m) {
        const [, code, num] = m
        const p = ctx.products.find(pp => pp.code?.toUpperCase() === code.toUpperCase())
        if (p) target = ctx.todos.find(t => t.product_id === p.id && t.todo_number === Number(num))
      }
    } else if (input.title_match) {
      const q = String(input.title_match).toLowerCase()
      target = ctx.todos.find(t => t.title.toLowerCase().includes(q))
    }
    if (!target) return JSON.stringify({ error: 'todo not found' })

    const update: Record<string, unknown> = {}
    if (input.new_status) {
      update.status = input.new_status
      if (input.new_status === 'done') update.closed_at = new Date().toISOString()
      else update.closed_at = null
    }
    if (input.new_priority !== undefined) update.priority_value = input.new_priority
    if (input.new_title)        update.title            = input.new_title
    if (input.description      !== undefined) update.description      = input.description || null
    if (input.resolution_notes !== undefined) update.resolution_notes = input.resolution_notes || null
    if (Array.isArray(input.urls)) update.urls = input.urls

    if (input.group_name) {
      const g = ctx.groups.find(
        gr => gr.product_id === target.product_id &&
              gr.name.toLowerCase() === String(input.group_name).toLowerCase()
      )
      update.group_id = g?.id ?? null
    }
    if (input.category_name) {
      const c = ctx.categories.find(
        ca => ca.product_id === target.product_id &&
              ca.name.toLowerCase() === String(input.category_name).toLowerCase()
      )
      update.category_id = c?.id ?? null
    }

    const { error } = await ctx.supabase.from('todos').update(update).eq('id', target.id)
    if (error) return JSON.stringify({ error: error.message })

    const p = ctx.products.find(pp => pp.id === target.product_id)
    return JSON.stringify({ ok: true, code: `${p?.code ?? p?.name}-${target.todo_number}`, product_id: target.product_id })
  }

  return JSON.stringify({ error: `unknown tool: ${name}` })
}

// ──────────────────────────────────────────────────────────────────────────
// Main entry point
// ──────────────────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-5-20250929'

export async function orbConverse(req: OrbRequest): Promise<OrbResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { speech: 'Conversational mode is not configured yet.', error: 'missing_api_key' }
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { speech: 'Sign in first.', error: 'unauthenticated' }

    if (!checkRateLimit(user.id)) {
      return { speech: 'Slow down a moment — too many requests.', error: 'rate_limited' }
    }

    const ctx = await buildContext(supabase, req.productId)
    const sys = systemPrompt(ctx.contextString, ctx.current?.code ?? ctx.current?.name ?? null, req.scopeToProduct ?? true)

    if (req.dryRun) {
      return {
        speech: `[dry run] Would send: "${req.input}" with ${ctx.todoList.length} todos as context.`,
        debug: { toolCalls: [], rawText: '(dry run — no API call)' },
      }
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const messages: Anthropic.MessageParam[] = [
      ...(req.history?.map(h => ({ role: h.role, content: h.text })) ?? []),
      { role: 'user', content: req.input },
    ]

    let response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: sys,
      tools: TOOLS,
      messages,
    })

    const debugToolCalls: Array<{ name: string; input: unknown }> = []
    let refresh = false
    let mutatedProductId: string | undefined
    let queryResults: OrbResponse['results']
    let queryLabel: string | undefined

    for (let turn = 0; turn < 3; turn++) {
      if (response.stop_reason !== 'tool_use') break

      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
      if (toolUseBlocks.length === 0) break

      messages.push({ role: 'assistant', content: response.content })

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of toolUseBlocks) {
        debugToolCalls.push({ name: block.name, input: block.input })
        const result = await executeTool(block.name, block.input, {
          supabase,
          products: ctx.productList,
          todos: ctx.todoList,
          groups: ctx.groupList,
          categories: ctx.categoryList,
          currentProductId: req.productId,
          scopeToProduct: req.scopeToProduct ?? true,
        })
        if (block.name === 'create_todo' || block.name === 'update_todo') {
          refresh = true
          try {
            const parsed = JSON.parse(result)
            if (parsed.product_id) mutatedProductId = parsed.product_id
          } catch {}
        }
        if (block.name === 'query_todos') {
          try {
            queryResults = JSON.parse(result).returned
            queryLabel = req.input
          } catch {}
        }
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
      }

      messages.push({ role: 'user', content: toolResults })

      response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: sys,
        tools: TOOLS,
        messages,
      })
    }

    const speechBlock = response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined
    const speech = speechBlock?.text.trim() ?? '...'

    return { speech, refresh, mutatedProductId, results: queryResults, queryLabel }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    console.error('[orbConverse]', msg)
    return { speech: 'Hmm, something went sideways. Try again?', error: msg }
  }
}
