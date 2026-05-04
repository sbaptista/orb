'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createStreamableValue } from 'ai/rsc'
import { createClient } from '@/lib/supabase/server'

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export type OrbResponse = {
  speech: string
  thought?: string // A discrete "work step" completed by the Orb
  refresh?: boolean
  mutatedProductId?: string
  results?: Array<{ id: string; code: string; title: string; status: string; priority_value: number | null }>
  queryLabel?: string
  clientAction?: { action: string; target?: string }
  error?: string
  isStreaming?: boolean
}

export type OrbRequest = {
  input: string
  productId: string
  scopeToProduct?: boolean
  history?: Array<{ role: 'user' | 'assistant'; text: string }>
  dryRun?: boolean
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

// ──────────────────────────────────────────────────────────────────────────
// Tool Context & Helpers
// ──────────────────────────────────────────────────────────────────────────

async function buildContext(supabase: any, currentProductId: string) {
  const [{ data: products }, { data: todos }, { data: groups }, { data: categories }, { data: statuses }, { data: priorities }] = await Promise.all([
    supabase.from('projects').select('id, name, code').order('sort_order'),
    supabase.from('todos').select('id, todo_number, title, status, priority_value, product_id').is('deleted_at', null),
    supabase.from('groups').select('id, name, product_id'),
    supabase.from('categories').select('id, name, product_id'),
    supabase.from('statuses').select('*').order('sort_order'),
    supabase.from('priorities').select('*').order('value'),
  ])

  const productList  = (products   ?? [])
  const todoList     = (todos      ?? [])
  const groupList    = (groups     ?? [])
  const categoryList = (categories ?? [])
  const statusList   = (statuses   ?? [])
  const priorityList = (priorities ?? [])
  const current = productList.find((p: any) => p.id === currentProductId)

  const byProduct = productList.map((p: any) => {
    const productTodos = todoList
      .filter((t: any) => t.product_id === p.id && !statusList.find((s: any) => s.name === t.status)?.is_closed)
      .map((t: any) => `  ${p.code ?? p.name}-${t.todo_number} [P${t.priority_value ?? '-'}] ${t.title}`)
      .join('\n')
    return `${p.code ?? p.name}:\n${productTodos || '  (none open)'}`
  }).join('\n\n')

  return { productList, todoList, groupList, categoryList, statusList, priorityList, current, contextString: byProduct }
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_todo',
    description: 'Create a new todo.',
    input_schema: {
      type: 'object',
      properties: {
        product_code: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        priority_value: { type: 'integer' },
      },
      required: ['title'],
    },
  },
  {
    name: 'query_todos',
    description: 'Find todos matching criteria.',
    input_schema: {
      type: 'object',
      properties: {
        product_code: { type: 'string' },
        status: { type: 'string' },
        priority_max: { type: 'integer' },
        text_match: { type: 'string' },
        max_results: { type: 'integer' },
      },
    },
  },
  {
    name: 'update_todo',
    description: 'Update an existing todo.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        title_match: { type: 'string' },
        new_status: { type: 'string' },
        new_priority: { type: 'integer' },
        new_title: { type: 'string' },
        description: { type: 'string' },
        resolution_notes: { type: 'string' },
        group_name: { type: 'string' },
        category_name: { type: 'string' },
        urls: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'client_action',
    description: "Navigate or switch UI state.",
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['switch_project', 'open_settings', 'open_help'] },
        target: { type: 'string' },
      },
      required: ['action'],
    },
  },
]

const TOOL_LABELS: Record<string, string> = {
    create_todo: 'Creating task...',
    query_todos: 'Searching backlog...',
    update_todo: 'Updating task...',
    client_action: 'Navigating...',
}

export async function orbConverse(req: OrbRequest) {
  const stream = createStreamableValue<OrbResponse>()

  ;(async () => {
    try {
      const supabase = await createClient()
      const ctx = await buildContext(supabase, req.productId)
      const statusNames = ctx.statusList.map((s: any) => s.name).join(', ')
      const priorityInfo = ctx.priorityList.map((p: any) => `${p.value}:${p.label}`).join(', ')

      let messages: any[] = [
        ...(req.history?.map(h => ({ role: h.role, content: h.text })) ?? []),
        { role: 'user', content: req.input }
      ]

      let turnCount = 0
      const MAX_TURNS = 5
      let accumulatedSpeech = ''

      // Heartbeat to open the pipe
      stream.update({ speech: '', isStreaming: true })

      while (turnCount < MAX_TURNS) {
        turnCount++
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 1024,
          system: `You are the voice of the orb — the conversational layer of TODOS.
VOICE: Brief, direct. Plain text only. NO markdown.
VALID VALUES: Statuses: ${statusNames} | Priorities: ${priorityInfo}
BACKLOG:
${ctx.contextString}`,
          messages,
          tools: TOOLS,
          stream: true,
        })

        let currentTurnSpeech = ''
        let toolCalls: any[] = []

        for await (const chunk of response) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            currentTurnSpeech += chunk.delta.text
            accumulatedSpeech = currentTurnSpeech 
            stream.update({ speech: accumulatedSpeech, isStreaming: true })
          } else if (chunk.type === 'content_block_start' && chunk.content_block.type === 'tool_use') {
             const label = TOOL_LABELS[chunk.content_block.name] || 'Thinking...'
             stream.update({ speech: accumulatedSpeech, thought: label, isStreaming: true })
             toolCalls.push({ id: chunk.content_block.id, name: chunk.content_block.name, input: '' })
          } else if (chunk.type === 'content_block_delta' && chunk.delta.type === 'input_json_delta') {
             toolCalls[toolCalls.length - 1].input += chunk.delta.partial_json
          }
        }

        const assistantContent: any[] = []
        if (currentTurnSpeech) assistantContent.push({ type: 'text', text: currentTurnSpeech })
        for (const tc of toolCalls) {
          assistantContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: JSON.parse(tc.input) })
        }
        messages.push({ role: 'assistant', content: assistantContent })

        if (toolCalls.length === 0) {
          stream.done({ speech: accumulatedSpeech, isStreaming: false })
          return
        }

        const toolOutputs: any[] = []
        for (const tc of toolCalls) {
          const input = JSON.parse(tc.input)
          let output: any

          if (tc.name === 'create_todo') {
            const product = input.product_code
              ? ctx.productList.find((p: any) => p.code?.toUpperCase() === String(input.product_code).toUpperCase())
              : ctx.productList.find((p: any) => p.id === req.productId)
            if (!product) output = { error: 'product not found' }
            else {
              const { data, error } = await supabase.from('todos').insert({
                product_id: product.id,
                title: input.title,
                status: 'open',
                priority_value: input.priority_value ?? null,
              }).select('todo_number').single()
              if (error) output = { error: error.message }
              else {
                output = { ok: true, code: `${product.code}-${data.todo_number}` }
                stream.update({ speech: accumulatedSpeech, thought: `Created ${product.code}-${data.todo_number}`, refresh: true, mutatedProductId: product.id })
              }
            }
          } else if (tc.name === 'query_todos') {
            let results = ctx.todoList.slice()
            if (input.status && input.status !== 'any') {
              results = results.filter((t: any) => t.status === input.status)
            } else {
              const closed = ctx.statusList.filter((s: any) => s.is_closed).map((s: any) => s.name)
              results = results.filter((t: any) => !closed.includes(t.status))
            }
            if (input.product_code) {
              const p = ctx.productList.find((pp: any) => pp.code?.toUpperCase() === String(input.product_code).toUpperCase())
              if (p) results = results.filter((t: any) => t.product_id === p.id)
            } else if (req.scopeToProduct) {
              results = results.filter((t: any) => t.product_id === req.productId)
            }
            results.sort((a: any, b: any) => (a.priority_value ?? 99) - (b.priority_value ?? 99))
            const returned = results.slice(0, 10).map((t: any) => {
              const p = ctx.productList.find((pp: any) => pp.id === t.product_id)
              return { id: t.id, code: `${p?.code ?? p?.name}-${t.todo_number}`, title: t.title, status: t.status, priority_value: t.priority_value }
            })
            output = { count: results.length, returned }
            stream.update({ speech: accumulatedSpeech, thought: `Found ${results.length} items`, results: returned, queryLabel: req.input })
          } else if (tc.name === 'client_action') {
            const label = input.action === 'switch_project' ? `Switched to ${input.target}` : 'Navigating...'
            stream.update({ speech: accumulatedSpeech, thought: label, clientAction: { action: input.action, target: input.target } })
            output = { ok: true }
          }
          toolOutputs.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify(output) })
        }
        messages.push({ role: 'user', content: toolOutputs })
        
        // Slight artificial delay between turns to make thoughts readable
        await new Promise(r => setTimeout(r, 600))
      }
    } catch (err) {
      console.error('[orbConverse] Error:', err)
      stream.done({ speech: 'System error.', error: String(err) })
    }
  })()

  return stream.value
}
