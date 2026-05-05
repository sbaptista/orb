'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createStreamableValue } from 'ai/rsc'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'

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
  suggestedKnowledge?: { id: string; productId: string; title: string; suggestion: { title: string; content: string } }
  knowledgeResults?: Array<{ title: string; content: string; code?: string }>
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
  const [{ data: products }, { data: todos }, { data: groups }, { data: categories }, { data: statuses }, { data: priorities }, { data: knowledge }] = await Promise.all([
    supabase.from('projects').select('id, name, code').order('sort_order'),
    supabase.from('todos').select('id, todo_number, title, status, priority_value, product_id, closed_at').is('deleted_at', null),
    supabase.from('groups').select('id, name, product_id'),
    supabase.from('categories').select('id, name, product_id'),
    supabase.from('statuses').select('*').order('sort_order'),
    supabase.from('priorities').select('*').order('value'),
    supabase.from('knowledge_repo').select('*, projects(code)').order('created_at', { ascending: false }),
  ])

  const productList  = (products   ?? [])
  const todoList     = (todos      ?? [])
  const groupList    = (groups     ?? [])
  const categoryList = (categories ?? [])
  const statusList   = (statuses   ?? [])
  const priorityList = (priorities ?? [])
  const knowledgeList = (knowledge   ?? [])
  const current = productList.find((p: any) => p.id === currentProductId)

  const byProduct = productList.map((p: any) => {
    const productTodos = todoList
      .filter((t: any) => t.product_id === p.id && !statusList.find((s: any) => s.name === t.status)?.is_closed)
      .map((t: any) => `  ${p.code ?? p.name}-${t.todo_number} [P${t.priority_value ?? '-'}] ${t.title}`)
      .join('\n')
    return `${p.code ?? p.name}:\n${productTodos || '  (none open)'}`
  }).join('\n\n')

  return { productList, todoList, groupList, categoryList, statusList, priorityList, knowledgeList, current, contextString: byProduct }
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
    name: 'delete_todo',
    description: 'Permanently delete a todo. Hard delete — irreversible. Only use when the user clearly asks to delete or remove a task.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Task code, e.g. "TODOS-44".' },
      },
      required: ['code'],
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
  {
    name: 'search_knowledge',
    description: 'Search the Knowledge Repository for lessons, decisions, and distilled insights.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        product_code: { type: 'string' },
      },
      required: ['query'],
    },
  },
]

const TOOL_LABELS: Record<string, string> = {
    create_todo: 'Creating task...',
    query_todos: 'Searching backlog...',
    update_todo: 'Updating task...',
    delete_todo: 'Deleting task...',
    client_action: 'Navigating...',
    search_knowledge: 'Searching knowledge repository...',
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
${ctx.contextString}

KNOWLEDGE BASE (Recent):
${ctx.knowledgeList.slice(0, 5).map((k: any) => `- [${k.projects?.code}] ${k.title}: ${k.content.slice(0, 100)}...`).join('\n')}
(Note: Use the 'search_knowledge' tool to query the full repository if the answer isn't here.)`,
          messages,
          tools: TOOLS,
          stream: true,
        })

        let currentTurnSpeech = ''
        const baseSpeech = accumulatedSpeech
        let toolCalls: any[] = []

        for await (const chunk of response) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            currentTurnSpeech += chunk.delta.text
            accumulatedSpeech = baseSpeech + currentTurnSpeech 
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
              }).select('id, todo_number').single()
              if (error) output = { error: error.message }
              else {
                output = { ok: true, code: `${product.code}-${data.todo_number}` }
                stream.update({ speech: accumulatedSpeech, thought: `Created ${product.code}-${data.todo_number}`, refresh: true, mutatedProductId: product.id })
                await logAuditEvent({
                  action: 'todo_create',
                  table_name: 'todos',
                  record_id: data.id,
                  after: { code: `${product.code}-${data.todo_number}`, title: input.title, priority_value: input.priority_value ?? null }
                })
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
          } else if (tc.name === 'update_todo') {
            const productCode = input.code?.split('-')[0]
            const todoNum = parseInt(input.code?.split('-')[1] || '0')
            let todo = ctx.todoList.find((t: any) => {
              const p = ctx.productList.find((pp: any) => pp.id === t.product_id)
              return p?.code === productCode && t.todo_number === todoNum
            })

            if (!todo) {
                const { data: found } = await supabase
                    .from('todos')
                    .select('*, projects!inner(code)')
                    .eq('todo_number', todoNum)
                    .ilike('projects.code', productCode)
                    .maybeSingle()
                if (found) todo = found
            }

            if (!todo) output = { error: 'todo not found' }
            else {
              // True when the new status should close the task: use is_closed flag with 'done' as fallback
              const closingStatus = !!(input.new_status && (
                ctx.statusList.find((s: any) => s.name === input.new_status)?.is_closed ||
                input.new_status === 'done'
              ))

              const { data, error } = await supabase.from('todos').update({
                title: input.new_title ?? todo.title,
                status: input.new_status ?? todo.status,
                priority_value: input.new_priority !== undefined ? input.new_priority : todo.priority_value,
                description: input.description ?? todo.description,
                resolution_notes: input.resolution_notes ?? todo.resolution_notes,
                closed_at: closingStatus ? new Date().toISOString() : todo.closed_at,
              }).eq('id', todo.id).select('*').single()

              if (error) output = { error: error.message }
              else {
                output = { ok: true }
                stream.update({ speech: accumulatedSpeech, thought: `Updated ${input.code}`, refresh: true, mutatedProductId: todo.product_id })
                await logAuditEvent({
                  action: closingStatus && !todo.closed_at ? 'todo_close' : 'todo_update',
                  table_name: 'todos',
                  record_id: todo.id,
                  before: { status: todo.status, priority_value: todo.priority_value, title: todo.title },
                  after: { status: data.status, priority_value: data.priority_value, title: data.title, code: input.code }
                })

                // Only distill when task is being closed for the first time
                const isClosing = closingStatus && !todo.closed_at
                if (isClosing) {
                    const notesLen = (data.resolution_notes || '').length
                    stream.update({ speech: accumulatedSpeech, thought: `Distilling insights (${notesLen} chars of notes)...` })

                    const distillation = await anthropic.messages.create({
                        model: 'claude-sonnet-4-5-20250929',
                        max_tokens: 500,
                        system: "Extract the 'Gold' (the key technical decision or lesson learned) from the task. Return a RAW JSON object with 'title' and 'content'. DO NOT use markdown or code blocks.",
                        messages: [{ role: 'user', content: `Task: ${data.title}\nDescription: ${data.description}\nResolution: ${data.resolution_notes}` }]
                    })
                    try {
                        let text = (distillation.content[0] as any).text
                        const firstBrace = text.indexOf('{')
                        const lastBrace = text.lastIndexOf('}')
                        if (firstBrace !== -1 && lastBrace !== -1) {
                            const jsonStr = text.substring(firstBrace, lastBrace + 1)
                            const result = JSON.parse(jsonStr)

                            if (!result.skip) {
                                output = { ...output, distillation: { success: true, title: result.title } }
                                stream.update({
                                    speech: accumulatedSpeech,
                                    thought: 'Insight ready to review',
                                    suggestedKnowledge: {
                                        id: todo.id,
                                        productId: todo.product_id,
                                        title: todo.title,
                                        suggestion: result
                                    }
                                })
                            } else {
                                output = { ...output, distillation: { success: false, reason: 'no_gold_found' } }
                                stream.update({ speech: accumulatedSpeech, thought: 'No new insights to distill' })
                            }
                        }
                    } catch (e) {
                        console.error('Distillation failed', e)
                        output = { ...output, distillation: { success: false, error: String(e) } }
                    }
                }
              }
            }
          } else if (tc.name === 'delete_todo') {
            const productCode = input.code?.split('-')[0]
            const todoNum = parseInt(input.code?.split('-')[1] || '0')
            let todo = ctx.todoList.find((t: any) => {
              const p = ctx.productList.find((pp: any) => pp.id === t.product_id)
              return p?.code === productCode && t.todo_number === todoNum
            })

            if (!todo) {
                const { data: found } = await supabase
                    .from('todos')
                    .select('*, projects!inner(code)')
                    .eq('todo_number', todoNum)
                    .ilike('projects.code', productCode)
                    .maybeSingle()
                if (found) todo = found
            }

            if (!todo) output = { error: 'todo not found' }
            else {
              const { error } = await supabase.from('todos').delete().eq('id', todo.id)
              if (error) output = { error: error.message }
              else {
                output = { ok: true, code: input.code }
                stream.update({ speech: accumulatedSpeech, thought: `Deleted ${input.code}`, refresh: true, mutatedProductId: todo.product_id })
                await logAuditEvent({
                  action: 'todo_delete',
                  table_name: 'todos',
                  record_id: todo.id,
                  before: { code: input.code, title: todo.title, status: todo.status }
                })
              }
            }
          } else if (tc.name === 'client_action') {
            const label = input.action === 'switch_project' ? `Switched to ${input.target}` : 'Navigating...'
            stream.update({ speech: accumulatedSpeech, thought: label, clientAction: { action: input.action, target: input.target } })
            output = { ok: true }
          } else if (tc.name === 'search_knowledge') {
            let results = ctx.knowledgeList.slice()
            if (input.product_code) {
                const p = ctx.productList.find((pp: any) => pp.code?.toUpperCase() === String(input.product_code).toUpperCase())
                if (p) results = results.filter((k: any) => k.product_id === p.id)
            }
            if (input.query) {
                const q = String(input.query).toLowerCase()
                results = results.filter((k: any) => k.title.toLowerCase().includes(q) || k.content.toLowerCase().includes(q))
            }
            const returned = results.slice(0, 10).map((k: any) => ({ title: k.title, content: k.content, code: k.projects?.code }))
            output = { count: results.length, returned }
            stream.update({ speech: accumulatedSpeech, thought: `Found ${results.length} insights`, knowledgeResults: returned })
          }
          toolOutputs.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify(output) })
        }
        messages.push({ role: 'user', content: toolOutputs })

        // Slight artificial delay between turns to make thoughts readable
        await new Promise(r => setTimeout(r, 600))
      }
      // Reached MAX_TURNS without a no-tool-call response — close the stream
      // so the client's for-await loop doesn't hang.
      stream.done({ speech: accumulatedSpeech, isStreaming: false })
    } catch (err) {
      console.error('[orbConverse] Error:', err)
      stream.done({ speech: 'System error.', error: String(err) })
    }
  })()

  return stream.value
}
