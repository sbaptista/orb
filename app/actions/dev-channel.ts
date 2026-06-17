'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/service'
import { ORB_TOOLS, ORB_TOOL_LABELS } from '@/lib/orb-contract'
import { ORB_PRINCIPLES, buildVoicePrompt, ORB_QUERY_ROUTING, ORB_SCOPE_RULES, buildUrgencyRules } from '@/lib/orb-prompt'
import { visibleProjectsQuery } from '@/lib/projects'
import { isActive, STATUS_VOCABULARY } from '@/lib/status-groups'
import { DB_SCHEMA, ALLOWED_TABLES, SOFT_DELETE_TABLES, ALLOWED_OPS, COLUMN_NAME_RE } from '@/lib/db-schema'
import { fuzzyMatch } from '@/lib/fuzzy-search'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

const READ_ONLY_TOOL_NAMES = new Set([
  'query_todos', 'search_knowledge', 'query_db',
  'query_audit_trail', 'query_capabilities',
])

const ORB_TOOLS_READ_ONLY = ORB_TOOLS.filter(t => READ_ONLY_TOOL_NAMES.has(t.name))

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

type DevMessage = {
  id: string
  direction: string
  sender_label: string
  content: string
  product_id: string | null
  session_summary: string | null
  status: string
  orb_response: string | null
  metadata: Record<string, any>
  created_at: string
}

// ──────────────────────────────────────────────────────────────────────────
// Fetch pending messages for the UI
// ──────────────────────────────────────────────────────────────────────────

export async function fetchPendingDevMessages(): Promise<DevMessage[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('dev_channel')
    .select('*')
    .eq('direction', 'dev_to_orb')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(10)

  if (error) {
    console.error('[dev-channel] fetchPending failed:', error)
    return []
  }
  return (data ?? []) as DevMessage[]
}

// ──────────────────────────────────────────────────────────────────────────
// Purge processed/delivered messages older than 7 days (pending kept forever)
// ──────────────────────────────────────────────────────────────────────────

export async function purgeOldDevMessages(): Promise<number> {
  const supabase = createServiceClient()
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { data, error } = await supabase
    .from('dev_channel')
    .delete()
    .in('status', ['delivered', 'processed'])
    .lt('created_at', cutoff)
    .select('id')

  if (error) {
    console.error('[dev-channel] purge failed:', error)
    return 0
  }
  const count = data?.length ?? 0
  if (count > 0) console.log(`[dev-channel] purged ${count} old messages`)
  return count
}

// ──────────────────────────────────────────────────────────────────────────
// Mark a message as delivered (shown in UI)
// ──────────────────────────────────────────────────────────────────────────

export async function markDevMessageDelivered(id: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('dev_channel')
    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('id', id)
}

// ──────────────────────────────────────────────────────────────────────────
// Process a dev message — run through Orb with read-only tools
// ──────────────────────────────────────────────────────────────────────────

export async function processDevMessage(id: string): Promise<string | null> {
  const supabase = createServiceClient()

  const { data: msg, error: fetchErr } = await supabase
    .from('dev_channel')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !msg) {
    console.error('[dev-channel] processDevMessage: message not found', id)
    return null
  }

  const message = msg as DevMessage

  const { data: products } = await visibleProjectsQuery(supabase, 'id, name, code, description, created_by')
  const productList = products ?? []

  const { data: todos } = await supabase
    .from('todos')
    .select('id, todo_number, title, description, status, priority_value, product_id, created_at, updated_at, closed_at, due_at, urls')
    .is('deleted_at', null)

  const todoList = todos ?? []

  const { data: statuses } = await supabase.from('statuses').select('*').order('sort_order')
  const statusList = statuses ?? []
  const { data: priorities } = await supabase.from('priorities').select('*').order('value')
  const priorityList = priorities ?? []
  const { data: knowledge } = await supabase.from('knowledge_repo').select('*, projects(code, name)').order('created_at', { ascending: false }).limit(10)
  const knowledgeList = knowledge ?? []

  const statusNames = statusList.map((s: any) => `${s.name}${s.is_closed ? ' (closed)' : s.is_open ? ' (default)' : ''}`).join(', ')
  const priorityInfo = priorityList.map((p: any) => `${p.value}:${p.label}${p.is_urgent ? ' (URGENT)' : ''}`).join(', ')

  function todoCode(t: any): string {
    const p = productList.find((pp: any) => pp.id === t.product_id)
    return `${p?.code ?? '???'}-${t.todo_number}`
  }

  const currentProject = message.product_id
    ? productList.find((p: any) => p.id === message.product_id)
    : null

  const byProduct = productList.map((p: any) => {
    const pTodos = todoList.filter((t: any) => t.product_id === p.id && !statusList.find((s: any) => s.name === t.status)?.is_closed)
    const lines = pTodos.filter((t: any) => isActive(t.status)).map((t: any) => `  ${todoCode(t)} [P${t.priority_value ?? '-'}] [${t.status}] ${t.title}`).join('\n')
    return `${p.code ?? p.name}:\n${lines || '  (none active)'}`
  }).join('\n\n')

  const sessionContext = message.session_summary
    ? `\n\nSESSION CONTEXT (from the developer tool):\n${message.session_summary}`
    : ''

  const systemPrompt = [
    `You are the voice of the orb — the conversational layer of Orb.`,
    buildVoicePrompt('natural'),
    `CURRENT DATE: ${new Date().toISOString().split('T')[0]}`,
    ORB_PRINCIPLES,
    `VALID VALUES: Statuses: ${statusNames} | Priorities: ${priorityInfo}`,
    STATUS_VOCABULARY,
    buildUrgencyRules(0),
    `BACKLOG:\n${byProduct}`,
    `KNOWLEDGE BASE (Recent):\n${knowledgeList.slice(0, 5).map((k: any) => `- [${k.projects?.code}] ${k.title}: ${k.content.slice(0, 100)}...`).join('\n')}`,
    ORB_QUERY_ROUTING,
    `DATABASE SCHEMA (for query_db):\n${DB_SCHEMA}`,
    ORB_SCOPE_RULES,
    `\nDEVELOPER CHANNEL — RESTRICTED MODE`,
    `This message is from an external developer AI tool: "${message.sender_label}".`,
    `They are building features for this product. You may use read-only tools (query_todos, search_knowledge, query_db, query_audit_trail, query_capabilities) to answer their questions.`,
    `You MUST NOT suggest or attempt any mutations (creating, updating, or deleting todos, projects, or knowledge entries). If asked, explain that Stan must approve mutations through the Orb UI.`,
    `Be helpful, concise, and factual. The developer tool will relay your response to Stan.`,
    currentProject ? `SCOPE: Scoped to "${currentProject.name}" (${currentProject.code}).` : 'SCOPE: All projects visible.',
    sessionContext,
  ].filter(Boolean).join('\n\n')

  const messages: any[] = [{ role: 'user', content: message.content }]
  let turnCount = 0
  const MAX_TURNS = 3
  let finalSpeech = ''

  while (turnCount < MAX_TURNS) {
    turnCount++

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      system: systemPrompt,
      messages,
      tools: ORB_TOOLS_READ_ONLY,
    })

    let speech = ''
    const toolCalls: any[] = []

    for (const block of response.content) {
      if (block.type === 'text') speech += block.text
      else if (block.type === 'tool_use') toolCalls.push(block)
    }

    finalSpeech += speech

    const assistantContent: any[] = []
    if (speech) assistantContent.push({ type: 'text', text: speech })
    for (const tc of toolCalls) {
      assistantContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input })
    }
    messages.push({ role: 'assistant', content: assistantContent })

    if (toolCalls.length === 0) break

    const toolOutputs: any[] = []
    for (const tc of toolCalls) {
      const input = tc.input as any
      let output: any

      if (tc.name === 'query_todos') {
        let results = todoList.slice()
        if (input.code) {
          const [pc, numStr] = String(input.code).toUpperCase().split('-')
          const num = parseInt(numStr || '0')
          results = results.filter((t: any) => {
            const p = productList.find((pp: any) => pp.id === t.product_id)
            return p?.code?.toUpperCase() === pc && t.todo_number === num
          })
        } else {
          if (input.status_group === 'active') results = results.filter((t: any) => isActive(t.status))
          if (input.product_code) {
            const p = productList.find((pp: any) => pp.code?.toUpperCase() === String(input.product_code).toUpperCase())
            if (p) results = results.filter((t: any) => t.product_id === p.id)
          }
          if (input.text_match) {
            const q = String(input.text_match).toLowerCase()
            results = results.filter((t: any) => t.title?.toLowerCase().includes(q))
          }
          results.sort((a: any, b: any) => (a.priority_value ?? 99) - (b.priority_value ?? 99))
        }
        const limit = input.max_results ?? 50
        const returned = results.slice(0, limit).map((t: any) => ({
          code: todoCode(t), title: t.title, status: t.status, priority_value: t.priority_value,
          ...(t.description ? { description: t.description } : {}),
          ...(t.due_at ? { due_at: t.due_at } : {}),
        }))
        output = { count: results.length, returned }

      } else if (tc.name === 'search_knowledge') {
        let results = knowledgeList.slice()
        if (input.product_code) {
          const p = productList.find((pp: any) => pp.code?.toUpperCase() === String(input.product_code).toUpperCase())
          if (p) results = results.filter((k: any) => k.product_id === p.id)
        }
        if (input.query) {
          const q = String(input.query)
          results = results.filter((k: any) => fuzzyMatch(q, `${k.title} ${k.content}`))
        }
        output = { count: results.length, returned: results.slice(0, 10).map((k: any) => ({ title: k.title, content: k.content, code: k.projects?.code })) }

      } else if (tc.name === 'query_audit_trail') {
        let query = supabase.from('audit_log').select('*').order('created_at', { ascending: false })
        if (input.code) {
          const [pc, numStr] = String(input.code).toUpperCase().split('-')
          const num = parseInt(numStr || '0')
          const p = productList.find((pp: any) => pp.code?.toUpperCase() === pc)
          if (p) {
            const todo = todoList.find((t: any) => t.product_id === p.id && t.todo_number === num)
            if (todo) query = query.eq('record_id', todo.id)
          }
        }
        if (input.since) query = query.gte('created_at', input.since)
        const limit = Math.min(input.max_results ?? 10, 50)
        const { data: events } = await query.limit(limit)
        output = { count: (events ?? []).length, events: (events ?? []).map((e: any) => ({ action: e.action, table: e.table_name, before: e.before, after: e.after, at: e.created_at })) }

      } else if (tc.name === 'query_db') {
        const table = String(input.table || '')
        if (!ALLOWED_TABLES.has(table)) {
          output = { error: `Table "${table}" not queryable. Allowed: ${[...ALLOWED_TABLES].join(', ')}` }
        } else {
          const selectStr = input.select || '*'
          const limit = Math.min(Math.max(input.limit ?? 50, 1), 200)
          let dbQuery = supabase.from(table).select(selectStr)
          if (Array.isArray(input.filters)) {
            for (const f of input.filters) {
              const col = String(f.column || '')
              const op = String(f.op || '')
              if (!COLUMN_NAME_RE.test(col) || !ALLOWED_OPS.has(op)) continue
              switch (op) {
                case 'eq': dbQuery = dbQuery.eq(col, f.value); break
                case 'neq': dbQuery = dbQuery.neq(col, f.value); break
                case 'gt': dbQuery = dbQuery.gt(col, f.value); break
                case 'gte': dbQuery = dbQuery.gte(col, f.value); break
                case 'lt': dbQuery = dbQuery.lt(col, f.value); break
                case 'lte': dbQuery = dbQuery.lte(col, f.value); break
                case 'ilike': dbQuery = dbQuery.ilike(col, f.value); break
                case 'is': dbQuery = dbQuery.is(col, f.value); break
              }
            }
          }
          if (SOFT_DELETE_TABLES.has(table)) dbQuery = dbQuery.is('deleted_at', null)
          if (input.order) {
            const desc = String(input.order).startsWith('-')
            const orderCol = desc ? String(input.order).slice(1) : String(input.order)
            if (COLUMN_NAME_RE.test(orderCol)) dbQuery = dbQuery.order(orderCol, { ascending: !desc })
          }
          const { data: rows, error: qErr } = await dbQuery.limit(limit)
          if (qErr) output = { error: qErr.message }
          else output = { count: (rows ?? []).length, rows: rows ?? [] }
        }

      } else if (tc.name === 'query_capabilities') {
        const { getCapabilities } = await import('@/lib/orb-prompt')
        output = getCapabilities(input.section || 'all')

      } else {
        output = { error: `Tool "${tc.name}" is not available in developer channel mode.` }
      }

      toolOutputs.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify(output) })
    }
    messages.push({ role: 'user', content: toolOutputs })
  }

  // Save response and mark processed
  await supabase
    .from('dev_channel')
    .update({
      orb_response: finalSpeech,
      status: 'processed',
      processed_at: new Date().toISOString(),
    })
    .eq('id', id)

  // Log to knowledge repo
  if (finalSpeech) {
    const truncatedQ = message.content.length > 80 ? message.content.slice(0, 77) + '...' : message.content
    await supabase.from('knowledge_repo').insert({
      product_id: message.product_id,
      title: `Dev Channel: ${truncatedQ}`,
      content: `**${message.sender_label}:** ${message.content}\n\n**Orb:** ${finalSpeech}`,
      tags: ['dev-channel', 'auto-logged'],
    })
  }

  return finalSpeech
}
