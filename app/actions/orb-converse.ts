'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createStreamableValue } from 'ai/rsc'
import { getAuthContext, type AuthContext } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'
import { ORB_TOOLS, ORB_TOOL_LABELS, ORB_INTEGRITY_RULES } from '@/lib/orb-contract'
// computeInsights suspended — code preserved in lib/insights.ts for future use
import { visibleProjectsQuery } from '@/lib/projects'
import { isActive, isParked } from '@/lib/status-groups'
import { computeUrgency, type Urgency } from '@/lib/orb-state'
import { checkAndNotifyEscalation, snapshotUrgency } from '@/lib/push'
import { createTicket } from '@/app/actions/ticket-actions'

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export type OrbResponse = {
  speech: string
  thought?: string // A discrete "work step" completed by the Orb
  refresh?: boolean
  mutatedProductId?: string
  mutationType?: 'create' | 'update' | 'delete' | 'project_create' | 'dormancy'
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

function todoCode(todo: any, productList: any[]): string {
  const p = productList.find((pp: any) => pp.id === todo.product_id)
  return `${p?.code ?? p?.name ?? '???'}-${todo.todo_number}`
}

async function buildContext(supabase: any, auth: AuthContext, currentProductId: string | null, scopeToProduct: boolean = true) {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const [
    { data: products },
    { data: dormantProducts },
    { data: todos },
    { data: statuses },
    { data: priorities },
    { data: knowledge },
    { data: recentAudit },
    { data: userProfile }
  ] = await Promise.all([
    visibleProjectsQuery(supabase, 'id, name, code, description, created_by'),
    auth.isAdmin ? supabase.from('projects').select('id, name, code').eq('is_dormant', true).order('sort_order') : Promise.resolve({ data: [] }),
    supabase.from('todos').select('id, todo_number, title, description, status, priority_value, product_id, created_at, updated_at, closed_at, resolution_notes, due_at').is('deleted_at', null),
    supabase.from('statuses').select('*').order('sort_order'),
    supabase.from('priorities').select('*').order('value'),
    supabase.from('knowledge_repo').select('*, projects(code)').order('created_at', { ascending: false }),
    supabase.from('audit_log').select('action, record_id, created_at, before, after').gte('created_at', fourteenDaysAgo).order('created_at', { ascending: false }).limit(200),
    supabase.from('users').select('urgency_threshold_hours, timezone').eq('id', auth.user.id).maybeSingle(),
  ])

  const currentUser = { id: auth.user.id, email: auth.user.email, roles: { name: auth.role } }

  const productList  = (products   ?? [])
  const dormantList  = (dormantProducts ?? [])
  const visibleProductIds = new Set(productList.map((p: any) => p.id))
  const todoList     = (todos      ?? []).filter((t: any) => visibleProductIds.has(t.product_id))
  const statusList   = (statuses   ?? [])
  const priorityList = (priorities ?? [])
  const knowledgeList = (knowledge   ?? [])
  const todoIds = new Set(todoList.map((t: any) => t.id))
  const auditList    = (recentAudit ?? []).filter((a: any) => todoIds.has(a.record_id))
  const current = productList.find((p: any) => p.id === currentProductId)

  const byProduct = productList.map((p: any) => {
    const header = `${p.code ?? p.name}${p.description ? ` (${p.description})` : ''}`
    if (scopeToProduct && p.id !== currentProductId) {
      return `${header}: (not in scope)`
    }
    const pTodos = todoList.filter((t: any) => t.product_id === p.id && !statusList.find((s: any) => s.name === t.status)?.is_closed)
    const activeLine = pTodos
      .filter((t: any) => isActive(t.status))
      .map((t: any) => `  ${todoCode(t, productList)} [P${t.priority_value ?? '-'}] [${t.status}] ${t.title}${t.due_at ? ` [Due: ${t.due_at.replace('T', ' ')}]` : ''}`)
      .join('\n')
    const parkedLine = pTodos
      .filter((t: any) => !isActive(t.status))
      .map((t: any) => `  ${todoCode(t, productList)} [P${t.priority_value ?? '-'}] [${t.status}] ${t.title}${t.due_at ? ` [Due: ${t.due_at.replace('T', ' ')}]` : ''}`)
      .join('\n')
    let body = ''
    if (activeLine) body += `  ACTIVE:\n${activeLine}`
    if (parkedLine) body += `${activeLine ? '\n' : ''}  PARKED (on hold/deferred):\n${parkedLine}`
    return `${header}:\n${body || '  (none active)'}`
  }).join('\n\n')

  const dormantSection = dormantList.length > 0
    ? `\n\nDORMANT (hidden from active views, no CRUD — use set_dormancy to wake):\n${dormantList.map((p: any) => `  ${p.code ?? p.name}`).join(', ')}`
    : ''

  return { productList, dormantList, todoList, statusList, priorityList, knowledgeList, auditList, current, currentUser, contextString: byProduct + dormantSection }
}



export async function orbConverse(req: OrbRequest) {
  const stream = createStreamableValue<OrbResponse>()

  ;(async () => {
    try {
      const auth = await getAuthContext()
      const supabase = auth.supabase
      const ctx = await buildContext(supabase, auth, req.productId, req.scopeToProduct ?? true)
      const beforeUrgency = await snapshotUrgency(supabase, auth.user.id)
      let hasMutated = false
      const statusNames = ctx.statusList.map((s: any) => s.name).join(', ')
      const priorityInfo = ctx.priorityList.map((p: any) => `${p.value}:${p.label}`).join(', ')

      const userRole = req.roleOverride || auth.role

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
${ctx.currentUser ? `\nUSER CONTEXT: You are talking to ${ctx.currentUser.email} (Role: ${userRole || 'Unknown'}).` : ''}

${ORB_INTEGRITY_RULES}

VALID VALUES: Statuses: ${statusNames} | Priorities: ${priorityInfo}
STATUS LANGUAGE: "active" = open + in progress ONLY. "parked" = deferred + on hold. Never count parked tasks as active. When reporting counts, active count excludes parked. The BACKLOG below separates ACTIVE from PARKED — use this split, not your own filtering. When the user asks "how many tasks" or "my tasks" without specifying, report the ACTIVE count. If parked tasks exist, mention them separately (e.g. "5 active, 3 parked"). "open" as a status means status=open specifically — if the user says "open tasks", query status=open.
SCOPE: ${req.scopeToProduct ? `Scoped to ${ctx.current?.code ?? ctx.current?.name}. Only discuss or query this project's todos unless the user explicitly asks about another project or says "all". IMPORTANT: When creating a todo, ALWAYS pass product_code="${ctx.current?.code}" explicitly — never omit it. When querying, ALWAYS pass product_code explicitly — the tool does NOT auto-scope. For cross-project insight follow-ups, omit product_code to search all projects.` : 'All projects visible.'}
BACKLOG (includes DORMANT section if any exist — answer dormant project questions from here, do not query):
${ctx.contextString}

KNOWLEDGE BASE (Recent):
${ctx.knowledgeList.slice(0, 5).map((k: any) => `- [${k.projects?.code}] ${k.title}: ${k.content.slice(0, 100)}...`).join('\n')}
(Note: Use the 'search_knowledge' tool to query the full repository if the answer isn't here.)

SCOPE TRANSPARENCY (mandatory):
- Every response that references task counts, priorities, or insight data MUST state what scope it covers. Never present numbers without scope.
- Cross-project: say "across all projects" or name the specific projects involved (e.g. "across ORB, HELM, and CAN26").
- Single-project: say "in ORB" or "in HELM" etc.
- If a number covers multiple projects but the conversation is scoped to one project, make the scope difference explicit.
- Examples: "6 urgent tasks across all projects" / "2 open in ORB" / "Across ORB and HELM, 18 opened this week."

AI ATTRIBUTION (mandatory):
- When closing a task (setting status to a closed state), the resolution_notes MUST start with "YYYY-MM-DD — Orb (Sonnet 4.6)" on its own line, followed by the actual notes. This identifies you as the actor.
- When writing to the knowledge repo via add_knowledge, the content MUST start with the same attribution line.
- Never omit the attribution. It is how the owner tracks which AI tool worked on what.

FEEDBACK TONE:
- Factual and brief. Acknowledge effort, not just outcomes.
- Skip praise for trivial actions.
- No exclamation marks, no "amazing!", no "crushing it!", no cheerleading.
- Examples of good feedback: "That clears the urgent queue for ORB." / "3 closed across all projects this week." / "ORB-86 was open 6 months. Good to see it resolved."`,
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
             const label = ORB_TOOL_LABELS[chunk.content_block.name] || 'Thinking...'
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
          if (hasMutated) {
            checkAndNotifyEscalation(auth.user.id, beforeUrgency, supabase)
              .catch(err => console.error('[orbConverse] Push check failed:', err))
          }
          stream.done({ speech: accumulatedSpeech, isStreaming: false })
          return
        }

        const toolOutputs: any[] = []
        for (const tc of toolCalls) {
          let input: any
          try { input = JSON.parse(tc.input || '{}') } catch { input = {} }
          let output: any

          if (tc.name === 'create_todo') {
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
                due_at: input.due_at ?? null,
              }).select('id, todo_number').single()
              if (error) output = { error: error.message }
              else {
                output = { ok: true, code: `${product.code}-${data.todo_number}` }
                stream.update({ speech: accumulatedSpeech, thought: `Created ${product.code}-${data.todo_number}`, refresh: true, mutatedProductId: product.id, mutationType: 'create' })
                hasMutated = true
                await logAuditEvent({
                  action: 'todo_create',
                  table_name: 'todos',
                  record_id: data.id,
                  after: { code: `${product.code}-${data.todo_number}`, title: input.title, priority_value: input.priority_value ?? null, due_at: input.due_at ?? null },
                  actor: 'orb',
                  user_id: auth.user.id,
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
              if (input.status_group === 'active') {
                results = results.filter((t: any) => isActive(t.status))
              } else if (input.status_group === 'parked') {
                results = results.filter((t: any) => isParked(t.status))
              } else if (input.status && input.status !== 'any') {
                results = results.filter((t: any) => t.status === input.status)
              } else {
                const closed = ctx.statusList.filter((s: any) => s.is_closed).map((s: any) => s.name)
                results = results.filter((t: any) => !closed.includes(t.status))
              }
              if (input.product_code) {
                const p = ctx.productList.find((pp: any) => pp.code?.toUpperCase() === String(input.product_code).toUpperCase())
                if (p) results = results.filter((t: any) => t.product_id === p.id)
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

            const limit = input.max_results ?? 100
            const returned = results.slice(0, limit).map((t: any) => {
              const out: any = { id: t.id, code: todoCode(t, ctx.productList), title: t.title, status: t.status, priority_value: t.priority_value }
              if (t.description) out.description = t.description
              if (t.resolution_notes) out.resolution_notes = t.resolution_notes
              if (t.due_at) out.due_at = t.due_at
              return out
            })
            output = { count: results.length, returned }
            const showInUI = input.show_results !== false
            stream.update({ speech: accumulatedSpeech, thought: `Found ${results.length} items`, ...(showInUI ? { results: returned, queryLabel: req.input } : {}) })
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
                due_at: input.due_at !== undefined ? input.due_at : todo.due_at,
              }).eq('id', todo.id).select('*').single()

              if (error) output = { error: error.message }
              else {
                output = { ok: true }
                stream.update({ speech: accumulatedSpeech, thought: `Updated ${input.code}`, refresh: true, mutatedProductId: todo.product_id, mutationType: 'update' })
                hasMutated = true
                await logAuditEvent({
                  action: closingStatus && !todo.closed_at ? 'todo_close' : 'todo_update',
                  table_name: 'todos',
                  record_id: todo.id,
                  before: { status: todo.status, priority_value: todo.priority_value, title: todo.title },
                  after: { status: data.status, priority_value: data.priority_value, title: data.title, code: input.code, due_at: data.due_at },
                  actor: 'orb',
                  user_id: auth.user.id,
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
              const { data: deleted, error } = await supabase.from('todos').delete().eq('id', todo.id).select().maybeSingle()
              if (error) output = { error: error.message }
              else if (!deleted) output = { error: 'delete failed — row was not removed' }
              else {
                output = { ok: true, code: input.code }
                stream.update({ speech: accumulatedSpeech, thought: `Deleted ${input.code}`, refresh: true, mutatedProductId: todo.product_id, mutationType: 'delete' })
                hasMutated = true
                await logAuditEvent({
                  action: 'todo_delete',
                  table_name: 'todos',
                  record_id: todo.id,
                  before: { code: input.code, title: todo.title, status: todo.status },
                  actor: 'orb',
                  user_id: auth.user.id,
                })
              }
            }
          } else if (tc.name === 'move_todo') {
            const productCode = input.code?.split('-')[0]
            const todoNum = parseInt(input.code?.split('-')[1] || '0')
            const targetCode = String(input.target_project_code).toUpperCase()

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

            if (!todo) {
              output = { error: 'todo not found' }
            } else {
              const sourceProject = ctx.productList.find((p: any) => p.id === todo.product_id)
              const { data: targetProject } = await supabase
                .from('projects')
                .select('id, code, name')
                .ilike('code', targetCode)
                .maybeSingle()

              if (!targetProject) {
                output = { error: `project "${targetCode}" not found` }
              } else if (targetProject.id === todo.product_id) {
                output = { error: 'task is already in that project' }
              } else {
                const { data: maxRow } = await supabase
                  .from('todos')
                  .select('todo_number')
                  .eq('product_id', targetProject.id)
                  .order('todo_number', { ascending: false })
                  .limit(1)
                  .maybeSingle()
                const nextNum = (maxRow?.todo_number ?? 0) + 1

                const { error } = await supabase
                  .from('todos')
                  .update({ product_id: targetProject.id, todo_number: nextNum })
                  .eq('id', todo.id)

                if (error) {
                  output = { error: error.message }
                } else {
                  const oldCode = `${sourceProject?.code ?? '???'}-${todo.todo_number}`
                  const newCode = `${targetProject.code}-${nextNum}`
                  output = { ok: true, old_code: oldCode, new_code: newCode }
                  stream.update({ speech: accumulatedSpeech, thought: `Moved ${oldCode} → ${newCode}`, refresh: true, mutatedProductId: sourceProject?.id, mutationType: 'update' })
                  hasMutated = true
                  await logAuditEvent({
                    action: 'todo_move',
                    table_name: 'todos',
                    record_id: todo.id,
                    before: { code: oldCode, product_code: sourceProject?.code },
                    after: { code: newCode, product_code: targetProject.code },
                    actor: 'orb',
                    user_id: auth.user.id,
                  })
                }
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
            let pId = ctx.current?.id ?? null
            if (input.product_code) {
                const p = ctx.productList.find((pp: any) => pp.code?.toUpperCase() === String(input.product_code).toUpperCase())
                if (p) pId = p.id
            }
            if (!pId) {
                output = { error: 'Could not determine project to save knowledge to.' }
            } else {
                const { error } = await auth.admin.from('knowledge_repo').insert({
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
            let query = auth.admin.from('audit_log').select('*').order('created_at', { ascending: false })

            if (input.code) {
              const [pc, numStr] = String(input.code).toUpperCase().split('-')
              const num = parseInt(numStr || '0')
              const p = ctx.productList.find((pp: any) => pp.code?.toUpperCase() === pc)
              if (p) {
                const todo = ctx.todoList.find((t: any) => t.product_id === p.id && t.todo_number === num)
                if (todo) query = query.eq('record_id', todo.id)
                else {
                  const { data: found } = await auth.admin.from('todos').select('id').eq('todo_number', num).eq('product_id', p.id).maybeSingle()
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
            const code = String(input.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
            if (!code) {
              output = { error: 'Project code is required' }
            } else {
              const { data: conflict } = await auth.admin.from('projects').select('id').ilike('code', code).maybeSingle()
              if (conflict) {
                output = { error: `Code "${code}" is already in use` }
              } else {
                const { data: project, error: createErr } = await auth.admin.from('projects').insert({
                  name: input.name,
                  code,
                  description: input.description ?? null,
                  created_by: auth.user.id,
                }).select('id, name, code, description, created_by').single()
                if (createErr) output = { error: createErr.message }
                else {
                  output = { ok: true, code: project.code, name: project.name }
                  // Push into live context so subsequent tool calls (e.g. create_todo)
                  // in the same turn can resolve the new project code (fixes ORB-136)
                  ctx.productList.push(project)
                  stream.update({ speech: accumulatedSpeech, thought: `Created project ${project.code}`, refresh: true, mutationType: 'project_create', newProject: project })
                }
              }
            }
          } else if (tc.name === 'update_project') {
            const code = String(input.project_code || '').toUpperCase()
            const { data: project } = await supabase.from('projects').select('id, code, name, description, created_by').ilike('code', code).maybeSingle()
            if (!project) {
              output = { error: `Project ${code} not found` }
            } else if (project.created_by !== auth.user.id && !auth.isAdmin) {
              output = { error: 'You can only update your own projects' }
            } else {
              const updates: any = {}
              if (input.new_name) updates.name = input.new_name
              if (input.new_description !== undefined) updates.description = input.new_description || null
              if (input.new_code) {
                const cleanCode = String(input.new_code).trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
                if (!cleanCode) { output = { error: 'Project code is required' }; toolOutputs.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify(output) }); continue }
                const { data: conflict } = await auth.admin.from('projects').select('id').ilike('code', cleanCode).neq('id', project.id).maybeSingle()
                if (conflict) { output = { error: `Code "${cleanCode}" is already in use` }; toolOutputs.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify(output) }); continue }
                updates.code = cleanCode
              }
              if (Object.keys(updates).length === 0) {
                output = { error: 'Nothing to update' }
              } else {
                const client = auth.isAdmin ? auth.admin : supabase
                const { data: updated, error: updateErr } = await client.from('projects').update(updates).eq('id', project.id).select('id, name, code, description, created_by').single()
                if (updateErr) output = { error: updateErr.message }
                else {
                  output = { ok: true, code: updated.code, name: updated.name }
                  stream.update({ speech: accumulatedSpeech, thought: `Updated project ${updated.code}`, refresh: true, mutationType: 'project_create' })
                }
              }
            }
          } else if (tc.name === 'delete_project') {
            if (!input.confirmed) {
              output = { error: 'Confirmation required. Ask the user to confirm before deleting.' }
            } else {
              const code = String(input.project_code || '').toUpperCase()
              const { data: project } = await supabase.from('projects').select('id, code, name, created_by').ilike('code', code).maybeSingle()
              if (!project) {
                output = { error: `Project ${code} not found` }
              } else if (project.created_by !== auth.user.id && !auth.isAdmin) {
                output = { error: 'You can only delete your own projects' }
              } else {
                const client = auth.isAdmin ? auth.admin : supabase
                const { error: delErr } = await client.from('projects').delete().eq('id', project.id)
                if (delErr) output = { error: delErr.message }
                else {
                  output = { ok: true, code: project.code }
                  stream.update({ speech: accumulatedSpeech, thought: `Deleted project ${project.code}`, refresh: true, mutationType: 'dormancy' })
                }
              }
            }
          } else if (tc.name === 'set_dormancy') {
            const code = String(input.project_code || '').toUpperCase()
            const { data: project } = await auth.admin.from('projects').select('id, code, name').ilike('code', code).maybeSingle()
            if (!project) {
              output = { error: `Project ${code} not found` }
            } else {
              const { error: dormErr } = await auth.admin.from('projects').update({ is_dormant: !!input.dormant }).eq('id', project.id)
              if (dormErr) output = { error: dormErr.message }
              else {
                const verb = input.dormant ? 'dormant' : 'awake'
                output = { ok: true, code: project.code, dormant: !!input.dormant }
                stream.update({ speech: accumulatedSpeech, thought: `${project.code} is now ${verb}`, refresh: true, mutationType: 'dormancy' })
              }
            }
          } else if (tc.name === 'create_ticket') {
            const res = await createTicket({
              source: 'orb-auto',
              type: input.type as any,
              summary: input.summary,
              detail: input.detail ? { detail: input.detail } : {},
              conversation_snippet: req.input,
            })
            if (res.error) output = { error: res.error }
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
      // Check if urgency escalated after mutations
      if (hasMutated) {
        checkAndNotifyEscalation(auth.user.id, beforeUrgency, supabase)
          .catch(err => console.error('[orbConverse] Push check failed:', err))
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

// ──────────────────────────────────────────────────────────────────────────
// Proactive greeting — fires once per session start
// ──────────────────────────────────────────────────────────────────────────

export async function orbGreeting(productId: string | null): Promise<string | null> {
  try {
    const auth = await getAuthContext()
    const ctx = await buildContext(auth.supabase, auth, productId, false)

    if (ctx.todoList.length === 0) return null

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 200,
      system: `You are the voice of the orb. Generate a brief, ambient opening observation (1-2 sentences) based on the backlog below. Plain text, no markdown. Factual tone — no cheerleading. Address the user directly ("you"). Do not greet them or say hello. SCOPE TRANSPARENCY: Every number you cite must state its scope — say "across all projects" or name the specific projects. Never present a count without saying where it comes from. Only state facts visible in the backlog — do not infer patterns or compute statistics.`,
      messages: [{
        role: 'user',
        content: `Backlog:\n${ctx.contextString}`,
      }],
    })

    const text = (response.content[0] as any)?.text?.trim()
    return text || null
  } catch (err) {
    console.error('[orbGreeting] Error:', err)
    return null
  }
}
