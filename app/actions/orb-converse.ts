'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createStreamableValue } from 'ai/rsc'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAuditEvent } from '@/lib/audit'
import { ORB_TOOLS, ORB_TOOL_LABELS, ORB_INTEGRITY_RULES } from '@/lib/orb-contract'

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export type OrbResponse = {
  speech: string
  thought?: string // A discrete "work step" completed by the Orb
  refresh?: boolean
  mutatedProductId?: string
  mutationType?: 'create' | 'update' | 'delete' | 'project_create'
  results?: Array<{ id: string; code: string; title: string; status: string; priority_value: number | null }>
  queryLabel?: string
  clientAction?: { action: string; target?: string }
  error?: string
  isStreaming?: boolean
  suggestedKnowledge?: { id: string; productId: string; title: string; suggestion: { title: string; content: string } }
  knowledgeResults?: Array<{ title: string; content: string; code?: string }>
  newProject?: { id: string; name: string; code: string; description: string | null; created_by: string }
}

export type OrbRequest = {
  input: string
  productId: string | null
  scopeToProduct?: boolean
  history?: Array<{ role: 'user' | 'assistant'; text: string }>
  dryRun?: boolean
  roleOverride?: string | null
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

// ──────────────────────────────────────────────────────────────────────────
// Tool Context & Helpers
// ──────────────────────────────────────────────────────────────────────────

async function buildContext(supabase: any, currentProductId: string | null, scopeToProduct: boolean = true) {
  const [
    { data: products }, 
    { data: todos }, 
    { data: statuses }, 
    { data: priorities }, 
    { data: knowledge },
    { data: userAuth }
  ] = await Promise.all([
    supabase.from('projects').select('id, name, code, description').order('sort_order'),
    supabase.from('todos').select('id, todo_number, title, description, status, priority_value, product_id, closed_at, resolution_notes').is('deleted_at', null),
    supabase.from('statuses').select('*').order('sort_order'),
    supabase.from('priorities').select('*').order('value'),
    supabase.from('knowledge_repo').select('*, projects(code)').order('created_at', { ascending: false }),
    supabase.auth.getUser()
  ])

  let currentUser = null
  if (userAuth?.user) {
    const { data: userRecord } = await supabase.from('users').select('id, email, roles(name)').eq('id', userAuth.user.id).single()
    currentUser = userRecord
  }

  const productList  = (products   ?? [])
  const todoList     = (todos      ?? [])
  const statusList   = (statuses   ?? [])
  const priorityList = (priorities ?? [])
  const knowledgeList = (knowledge   ?? [])
  const current = productList.find((p: any) => p.id === currentProductId)

  const byProduct = productList.map((p: any) => {
    const header = `${p.code ?? p.name}${p.description ? ` (${p.description})` : ''}`
    if (scopeToProduct && p.id !== currentProductId) {
      return `${header}: (not in scope)`
    }
    const productTodos = todoList
      .filter((t: any) => t.product_id === p.id && !statusList.find((s: any) => s.name === t.status)?.is_closed)
      .map((t: any) => `  ${p.code ?? p.name}-${t.todo_number} [P${t.priority_value ?? '-'}] [${t.status}] ${t.title}`)
      .join('\n')
    return `${header}:\n${productTodos || '  (none open)'}`
  }).join('\n\n')

  return { productList, todoList, statusList, priorityList, knowledgeList, current, currentUser, contextString: byProduct }
}

export async function orbConverse(req: OrbRequest) {
  const stream = createStreamableValue<OrbResponse>()

  ;(async () => {
    try {
      const supabase = await createClient()
      const ctx = await buildContext(supabase, req.productId, req.scopeToProduct ?? true)
      const statusNames = ctx.statusList.map((s: any) => s.name).join(', ')
      const priorityInfo = ctx.priorityList.map((p: any) => `${p.value}:${p.label}`).join(', ')

      const isProd = process.env.NODE_ENV === 'production'
      const realRole = ctx.currentUser?.roles?.name || ''
      const simulatingRole = !isProd && req.roleOverride
      const userRole = simulatingRole ? req.roleOverride! : realRole
      const canWrite = ['super admin', 'admin'].includes(userRole.toLowerCase())
      const enforceGate = isProd || simulatingRole

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
          system: `You are the voice of the orb — the conversational layer of Orb.
VOICE: Brief, direct. Plain text only. NO markdown.
${enforceGate && !canWrite ? '\nENVIRONMENT: You are in the PRODUCTION environment. Task modifications (create, update, delete) are available to admins only. If the user asks you to modify a task, tell them: "Task management is only available to admins. You can view and query your backlog."' : ''}
${ctx.currentUser ? `\nUSER CONTEXT: You are talking to ${ctx.currentUser.email} (Role: ${userRole || 'Unknown'}).` : ''}

${ORB_INTEGRITY_RULES}

VALID VALUES: Statuses: ${statusNames} | Priorities: ${priorityInfo}
SCOPE: ${req.scopeToProduct ? `Scoped to ${ctx.current?.code ?? ctx.current?.name}. Only discuss or query this project's todos unless the user explicitly asks about another project or says "all". IMPORTANT: When creating a todo, ALWAYS pass product_code="${ctx.current?.code}" explicitly — never omit it.` : 'All projects visible.'}
BACKLOG:
${ctx.contextString}

KNOWLEDGE BASE (Recent):
${ctx.knowledgeList.slice(0, 5).map((k: any) => `- [${k.projects?.code}] ${k.title}: ${k.content.slice(0, 100)}...`).join('\n')}
(Note: Use the 'search_knowledge' tool to query the full repository if the answer isn't here.)`,
          messages,
          tools: ORB_TOOLS,
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
             let label = ORB_TOOL_LABELS[chunk.content_block.name] || 'Thinking...'
             if (enforceGate && !canWrite && ['create_todo', 'update_todo', 'delete_todo', 'create_project'].includes(chunk.content_block.name)) {
                 label = 'Operation not allowed'
             }
             stream.update({ speech: accumulatedSpeech, thought: label, isStreaming: true })
             toolCalls.push({ id: chunk.content_block.id, name: chunk.content_block.name, input: '' })
          } else if (chunk.type === 'content_block_delta' && chunk.delta.type === 'input_json_delta') {
             toolCalls[toolCalls.length - 1].input += chunk.delta.partial_json
          }
        }

        const assistantContent: any[] = []
        if (currentTurnSpeech) assistantContent.push({ type: 'text', text: currentTurnSpeech })
        for (const tc of toolCalls) {
          let parsed: any; try { parsed = JSON.parse(tc.input || '{}') } catch { parsed = {} }
          assistantContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: parsed })
        }
        messages.push({ role: 'assistant', content: assistantContent })

        if (toolCalls.length === 0) {
          stream.done({ speech: accumulatedSpeech, isStreaming: false })
          return
        }

        const toolOutputs: any[] = []
        for (const tc of toolCalls) {
          let input: any
          try { input = JSON.parse(tc.input || '{}') } catch { input = {} }
          let output: any

          if (enforceGate && !canWrite && ['create_todo', 'update_todo', 'delete_todo', 'create_project'].includes(tc.name)) {
            output = { error: 'Task management is available to admins only. Tell the user they can view and query their backlog.' }
            stream.update({ speech: accumulatedSpeech, thought: 'Operation not allowed' })
          } else if (tc.name === 'create_todo') {
            if (!input.product_code && req.scopeToProduct) {
              console.warn('[orbConverse] create_todo called without product_code while scoped to', ctx.current?.code, '— falling back to scoped project')
            }
            const product = input.product_code
              ? ctx.productList.find((p: any) => p.code?.toUpperCase() === String(input.product_code).toUpperCase())
              : ctx.productList.find((p: any) => p.id === req.productId)
            if (!product) output = { error: 'product not found' }
            else {
              const { data: openStatus } = await supabase
                .from('statuses').select('name').eq('is_open', true).limit(1).single()
              const { data, error } = await supabase.from('todos').insert({
                product_id: product.id,
                title: input.title,
                description: input.description ?? null,
                status: openStatus?.name ?? 'open',
                priority_value: input.priority_value ?? null,
              }).select('id, todo_number').single()
              if (error) output = { error: error.message }
              else {
                output = { ok: true, code: `${product.code}-${data.todo_number}` }
                stream.update({ speech: accumulatedSpeech, thought: `Created ${product.code}-${data.todo_number}`, refresh: true, mutatedProductId: product.id, mutationType: 'create' })
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

            if (input.codes && Array.isArray(input.codes) && input.codes.length > 0) {
              const parsedCodes = input.codes.map((c: string) => {
                const [pc, numStr] = String(c).toUpperCase().split('-')
                return { productCode: pc, todoNum: parseInt(numStr || '0') }
              })
              results = results.filter((t: any) => {
                const p = ctx.productList.find((pp: any) => pp.id === t.product_id)
                return parsedCodes.some((c: any) => p?.code?.toUpperCase() === c.productCode && t.todo_number === c.todoNum)
              })
            } else if (input.code) {
              const [productCode, todoNumStr] = String(input.code).toUpperCase().split('-')
              const todoNum = parseInt(todoNumStr || '0')
              results = results.filter((t: any) => {
                const p = ctx.productList.find((pp: any) => pp.id === t.product_id)
                return p?.code?.toUpperCase() === productCode && t.todo_number === todoNum
              })
            } else {
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
              if (input.text_match) {
                const q = String(input.text_match).toLowerCase()
                results = results.filter((t: any) => t.title?.toLowerCase().includes(q))
              }
              if (input.priority_max) {
                results = results.filter((t: any) => t.priority_value != null && t.priority_value <= input.priority_max)
              }
              results.sort((a: any, b: any) => (a.priority_value ?? 99) - (b.priority_value ?? 99))
            }

            const limit = input.max_results ?? 10
            const returned = results.slice(0, limit).map((t: any) => {
              const p = ctx.productList.find((pp: any) => pp.id === t.product_id)
              const out: any = { id: t.id, code: `${p?.code ?? p?.name}-${t.todo_number}`, title: t.title, status: t.status, priority_value: t.priority_value }
              if (t.description) out.description = t.description
              if (t.resolution_notes) out.resolution_notes = t.resolution_notes
              return out
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
              const closingStatus = !!(input.new_status &&
                ctx.statusList.find((s: any) => s.name === input.new_status)?.is_closed
              )

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
                stream.update({ speech: accumulatedSpeech, thought: `Updated ${input.code}`, refresh: true, mutatedProductId: todo.product_id, mutationType: 'update' })
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
                stream.update({ speech: accumulatedSpeech, thought: `Deleted ${input.code}`, refresh: true, mutatedProductId: todo.product_id, mutationType: 'delete' })
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
          } else if (tc.name === 'add_knowledge') {
            const admin = createAdminClient()
            let pId = ctx.current?.id ?? null
            if (input.product_code) {
                const p = ctx.productList.find((pp: any) => pp.code?.toUpperCase() === String(input.product_code).toUpperCase())
                if (p) pId = p.id
            }
            if (!pId) {
                output = { error: 'Could not determine project to save knowledge to.' }
            } else {
                const { error } = await admin.from('knowledge_repo').insert({
                    product_id: pId,
                    title: input.title,
                    content: input.content,
                    tags: input.tags || []
                })
                if (error) output = { error: error.message }
                else {
                    output = { ok: true }
                    stream.update({ speech: accumulatedSpeech, thought: 'Saved to knowledge repository' })
                }
            }
          } else if (tc.name === 'query_audit_trail') {
            const admin = createAdminClient()
            let query = admin.from('audit_log').select('*').order('created_at', { ascending: false })

            if (input.code) {
              const [pc, numStr] = String(input.code).toUpperCase().split('-')
              const num = parseInt(numStr || '0')
              const p = ctx.productList.find((pp: any) => pp.code?.toUpperCase() === pc)
              if (p) {
                const todo = ctx.todoList.find((t: any) => t.product_id === p.id && t.todo_number === num)
                if (todo) query = query.eq('record_id', todo.id)
                else {
                  const { data: found } = await admin.from('todos').select('id').eq('todo_number', num).eq('product_id', p.id).maybeSingle()
                  if (found) query = query.eq('record_id', found.id)
                  else { output = { error: `Task ${input.code} not found` }; toolOutputs.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify(output) }); continue }
                }
              }
            }
            if (input.table_name) query = query.eq('table_name', input.table_name)
            if (input.action) query = query.eq('action', input.action)
            if (input.since) query = query.gte('created_at', input.since)
            const limit = Math.min(input.max_results ?? 10, 50)
            query = query.limit(limit)

            const { data: events, error: auditError } = await query
            if (auditError) output = { error: auditError.message }
            else {
              const formatted = (events ?? []).map((e: any) => ({
                action: e.action,
                table: e.table_name,
                record_id: e.record_id,
                before: e.before,
                after: e.after,
                at: e.created_at,
              }))
              output = { count: formatted.length, events: formatted }
              stream.update({ speech: accumulatedSpeech, thought: `Found ${formatted.length} audit events` })
            }
          } else if (tc.name === 'create_project') {
            const admin = createAdminClient()
            const code = String(input.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
            if (!code) {
              output = { error: 'Project code is required' }
            } else {
              const { data: conflict } = await admin.from('projects').select('id').ilike('code', code).maybeSingle()
              if (conflict) {
                output = { error: `Code "${code}" is already in use` }
              } else {
                const { data: { user } } = await supabase.auth.getUser()
                const { data: project, error: createErr } = await admin.from('projects').insert({
                  name: input.name,
                  code,
                  description: input.description ?? null,
                  created_by: user!.id,
                }).select('id, name, code, description, created_by').single()
                if (createErr) output = { error: createErr.message }
                else {
                  output = { ok: true, code: project.code, name: project.name }
                  stream.update({ speech: accumulatedSpeech, thought: `Created project ${project.code}`, refresh: true, mutationType: 'project_create', newProject: project })
                }
              }
            }
          } else if (tc.name === 'create_ticket') {
            const admin = createAdminClient()
            const { error } = await admin.from('tickets').insert({
              source: 'orb-auto',
              type: input.type,
              summary: input.summary,
              detail: input.detail ? { detail: input.detail } : {},
              conversation_snippet: req.input,
            })
            if (error) output = { error: error.message }
            else {
              output = { ok: true }
              stream.update({ speech: accumulatedSpeech, thought: 'Noted' })
            }
          }
          if (output?.error) {
            stream.update({ speech: accumulatedSpeech, thought: `Error: ${output.error}` })
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
