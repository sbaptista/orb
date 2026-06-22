'use server'

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { ORB_TOOLS, ORB_TOOL_LABELS } from '@/lib/orb-contract'
import { ORB_PRINCIPLES, ORB_RESOLUTION_LAWS, ORB_ATTRIBUTION, ORB_MUTATION_VERIFICATION, ORB_QUERY_ROUTING, ORB_SCOPE_RULES, ORB_SESSION_ADAPTATION, ORB_PREFERENCE_DISCOVERY, ORB_SELF_DIAGNOSTICS, buildVoicePrompt, buildFeedbackTonePrompt, buildProactiveTonePrompt, buildCoachingPrompt, buildUrgencyRules, buildPreferencesPrompt, buildObservationsPrompt, buildMutationApprovalPrompt, buildMemoryPrompt, ORB_MEMORY_BEHAVIOR, ORB_STRATEGIC_REASONING, computeObservations, ORB_PREFERENCE_TOOLS, ORB_MEMORY_TOOLS, ORB_CAPABILITIES_TOOL, ORB_DEV_CHANNEL_TOOL, ORB_DEV_CHANNEL_PROMPT, VALID_PREFERENCE_KEYS } from '@/lib/orb-prompt'
import { visibleProjectsQuery } from '@/lib/projects'
import { isActive, STATUS_VOCABULARY } from '@/lib/status-groups'
import { DB_SCHEMA } from '@/lib/db-schema'
import { CHANGELOG } from '@/lib/changelog'

// ── Auth ──────────────────────────────────────────────────────────────────

function checkAuth(request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Eval endpoint disabled in production' }, { status: 403 })
  }
  const secret = request.headers.get('Authorization')
  if (secret !== process.env.ORB_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

const APPROVAL_GATED_TOOLS = new Set([
  'create_todo', 'update_todo', 'delete_todo', 'move_todo',
  'create_project', 'update_project', 'delete_project', 'set_dormancy',
])

// Structural mutation guard — mirrors orb-converse.ts
function extractCitedCodes(speech: string): Set<string> {
  const matches = speech.match(/\b[A-Z][A-Z0-9]{1,15}-\d+\b/g)
  return new Set(matches ?? [])
}

function hasCompletionLanguage(speech: string): boolean {
  return /\b(done —|done\.|created as|i'?ve (created|added|filed|updated|changed|closed|completed|deleted|removed|moved|archived|deferred|saved)|successfully (created|added|updated|deleted|moved))\b/i.test(speech)
}

function isFalseMutationClaim(speech: string, hasMutated: boolean, toolProducedCodes: Set<string>, historyCodes: Set<string>): boolean {
  const cited = extractCitedCodes(speech)
  const hasPhantomCode = [...cited].some(code => !toolProducedCodes.has(code) && !historyCodes.has(code))
  if (hasPhantomCode) return true
  if (!hasMutated && hasCompletionLanguage(speech)) return true
  return false
}

function isAffirmativeApproval(input: string): boolean {
  return /^(yes|yep|yeah|ok|okay|sure|confirmed?|approved?|proceed|go ahead|do it|create it|create them|make it|make them)\b/i.test(input.trim())
}

function historyHasPendingMutationProposal(history?: Array<{ role: 'user' | 'assistant'; text: string }>): boolean {
  const recentAssistant = [...(history ?? [])].reverse().find(h => h.role === 'assistant')?.text ?? ''
  if (!recentAssistant) return false
  const asksApproval = /\b(go ahead\??|confirm|approve|proceed|want me to|should i|create (it|this|these|them)|make (it|this|these|them)|do it)\b/i.test(recentAssistant)
  const namesMutation = /\b(create|add|file|log|make|update|change|rename|close|complete|delete|remove|move|archive|defer|park|wake|sleep)\b/i.test(recentAssistant)
  return asksApproval && namesMutation
}

function pendingApprovalCode(history?: Array<{ role: 'user' | 'assistant'; text: string }>): string | null {
  const recentAssistant = [...(history ?? [])].reverse().find(h => h.role === 'assistant')?.text ?? ''
  return recentAssistant.match(/\b[A-Z][A-Z0-9]{1,15}-\d+\b/)?.[0] ?? null
}

function pendingApprovalTool(history?: Array<{ role: 'user' | 'assistant'; text: string }>): 'create_todo' | 'update_todo' | 'delete_todo' | 'move_todo' | null {
  const recentAssistant = [...(history ?? [])].reverse().find(h => h.role === 'assistant')?.text ?? ''
  if (/\bcreate (a |the )?(task|todo)\b/i.test(recentAssistant)) return 'create_todo'
  if (/\bupdate\b/i.test(recentAssistant)) return 'update_todo'
  if (/\bdelete\b/i.test(recentAssistant)) return 'delete_todo'
  if (/\bmove\b/i.test(recentAssistant)) return 'move_todo'
  return null
}

function mutationToolSummary(name: string, params: Record<string, any>): string {
  if (name === 'create_todo') return `create a task${params.title ? `: "${params.title}"` : ''}${params.product_code ? ` in ${params.product_code}` : ''}`
  if (name === 'update_todo') return `update ${params.code ?? 'the task'}`
  if (name === 'delete_todo') return `delete ${params.code ?? 'the task'}`
  if (name === 'move_todo') return `move ${params.code ?? 'the task'} to ${params.target_project_code ?? 'the target project'}`
  if (name === 'create_project') return `create a project${params.name ? `: "${params.name}"` : ''}`
  if (name === 'update_project') return `update ${params.project_code ?? 'the project'}`
  if (name === 'delete_project') return `delete ${params.project_code ?? 'the project'}`
  if (name === 'set_dormancy') return `${params.dormant ? 'put to sleep' : 'wake'} ${params.project_code ?? 'the project'}`
  return `run ${name}`
}

function buildApprovalPrompt(toolCalls: Array<{ name: string; params: Record<string, any> }>): string {
  const summaries = toolCalls.map(tc => mutationToolSummary(tc.name, tc.params))
  if (summaries.length === 1) return `I'll ${summaries[0]}. Go ahead?`
  return `I'll do ${summaries.length} changes:\n${summaries.map((s, i) => `${i + 1}. ${s}`).join('\n')}\nGo ahead?`
}

// ── POST /api/orb-eval ───────────────────────────────────────────────────
// Non-streaming Orb call that returns speech + tool calls without executing them.
// For the eval framework only. Disabled in production.

export async function POST(request: NextRequest) {
  const authError = checkAuth(request)
  if (authError) return authError

  const body = await request.json()
  const { input, productCode, history, mutationApproval, voiceMode } = body as {
    input: string
    productCode?: string
    history?: Array<{ role: 'user' | 'assistant'; text: string }>
    mutationApproval?: 'ask' | 'allow'
    voiceMode?: boolean
  }

  if (!input) {
    return NextResponse.json({ error: 'input is required' }, { status: 400 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
  const admin = createAdminClient()

  // Resolve the eval user (first admin found)
  const { data: evalUser } = await admin
    .from('users')
    .select('id, email, first_name, last_name, role_id, roles(name)')
    .in('role_id', [1, 3])
    .limit(1)
    .single()

  if (!evalUser) {
    return NextResponse.json({ error: 'No admin user found for eval' }, { status: 500 })
  }

  const evalUserName = evalUser ? [evalUser.first_name, evalUser.last_name].filter(Boolean).join(' ') : ''
  const auth = {
    user: { id: evalUser.id, email: evalUser.email ?? '', name: evalUserName || null },
    role: (evalUser as any).roles?.name ?? 'Admin',
    roleId: evalUser.role_id,
    isAdmin: true,
    canInspectRepository: true,
    supabase: admin,
    admin,
  }

  // Build context (same as orbConverse)
  const [
    { data: products },
    { data: dormantProducts },
    { data: todos },
    { data: statuses },
    { data: priorities },
    { data: knowledge },
    { data: orbPreferences },
    { data: behaviorRules },
    { data: allUsers },
  ] = await Promise.all([
    visibleProjectsQuery(admin, 'id, name, code, description, created_by'),
    admin.from('projects').select('id, name, code').eq('is_dormant', true).order('sort_order'),
    admin.from('todos').select('id, todo_number, title, description, status, priority_value, product_id, created_at, updated_at, closed_at, resolution_notes, due_at, urls, group_id, category_id, ticket_id, groups(name), categories(name), tickets!ticket_id(ticket_number)').is('deleted_at', null),
    admin.from('statuses').select('*').order('sort_order'),
    admin.from('priorities').select('*').order('value'),
    admin.from('knowledge_repo').select('*, projects(code, name)').order('created_at', { ascending: false }),
    admin.from('orb_preferences').select('key, value').eq('user_id', evalUser.id),
    admin.from('knowledge_repo').select('title, content').contains('tags', ['orb-behavior']).order('created_at', { ascending: false }).limit(20),
    admin.from('users').select('id, email, first_name, last_name').order('created_at'),
  ])

  const productList = products ?? []
  const userList = allUsers ?? []
  const userMap = new Map<string, string>()
  for (const u of userList) {
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ')
    userMap.set(u.id, name || u.email)
  }
  if (evalUserName) {
    userMap.set(evalUser.id, evalUserName)
  } else if (!userMap.has(evalUser.id)) {
    userMap.set(evalUser.id, evalUser.email ?? 'you')
  }
  const dormantList = dormantProducts ?? []
  const visibleProductIds = new Set(productList.map((p: any) => p.id))
  const todoList = (todos ?? []).filter((t: any) => visibleProductIds.has(t.product_id))
  const statusList = statuses ?? []
  const priorityList = priorities ?? []
  const knowledgeList = knowledge ?? []
  const preferenceList = (orbPreferences ?? []) as Array<{ key: string; value: string }>
  // Force mutation_approval to allow by default in evaluation to test tool calls directly.
  // Individual cases can opt into ask-mode to exercise the server-side approval gate.
  const evalApprovalMode = mutationApproval ?? 'allow'
  const approvalPref = preferenceList.find(p => p.key === 'mutation_approval')
  if (approvalPref) {
    approvalPref.value = evalApprovalMode
  } else {
    preferenceList.push({ key: 'mutation_approval', value: evalApprovalMode })
  }
  const behaviorRuleList = behaviorRules ?? []

  // Resolve current project
  const current = productCode
    ? productList.find((p: any) => p.code?.toUpperCase() === productCode.toUpperCase())
    : productList[0]

  if (!current) {
    return NextResponse.json({ error: `Product ${productCode} not found` }, { status: 404 })
  }

  // Build backlog context string
  function todoCode(todo: any): string {
    const p = productList.find((pp: any) => pp.id === todo.product_id)
    return `${p?.code ?? p?.name ?? '???'}-${todo.todo_number}`
  }

  function todoLine(t: any): string {
    const parts = [`  ${todoCode(t)} [P${t.priority_value ?? '-'}] [${t.status}] ${t.title}`]
    if (t.due_at) parts.push(`[Due: ${t.due_at.replace('T', ' ')}]`)
    if (t.groups?.name) parts.push(`[Group: ${t.groups.name}]`)
    if (t.categories?.name) parts.push(`[Cat: ${t.categories.name}]`)
    const ticketNum = t.tickets?.ticket_number
    if (ticketNum) parts.push(`[Linked: TICKETS-${ticketNum}]`)
    const urlList = Array.isArray(t.urls) ? t.urls : []
    if (urlList.length > 0) parts.push(`[${urlList.length} URL${urlList.length > 1 ? 's' : ''}]`)
    return parts.join(' ')
  }

  const byProduct = productList.map((p: any) => {
    const ownerName = userMap.get(p.created_by)
    const ownerTag = ownerName ? ` [Owner: ${ownerName}]` : ''
    const header = `${p.code ?? p.name}${p.description ? ` (${p.description})` : ''}${ownerTag}`
    const pTodos = todoList.filter((t: any) => t.product_id === p.id && !statusList.find((s: any) => s.name === t.status)?.is_closed)
    const activeLine = pTodos.filter((t: any) => isActive(t.status)).map(todoLine).join('\n')
    const parkedLine = pTodos.filter((t: any) => !isActive(t.status)).map(todoLine).join('\n')
    let body = ''
    if (activeLine) body += `  ACTIVE:\n${activeLine}`
    if (parkedLine) body += `${activeLine ? '\n' : ''}  PARKED (on hold/deferred):\n${parkedLine}`
    return `${header}:\n${body || '  (none active)'}`
  }).join('\n\n')

  const dormantSection = dormantList.length > 0
    ? `\n\nDORMANT:\n${dormantList.map((p: any) => `  ${p.code ?? p.name}`).join(', ')}`
    : ''

  const contextString = byProduct + dormantSection

  const statusNames = statusList.map((s: any) => `${s.name}${s.is_closed ? ' (closed)' : s.is_open ? ' (default)' : ''}`).join(', ')
  const priorityInfo = priorityList.map((p: any) => `${p.value}:${p.label}${p.is_urgent ? ' (URGENT)' : ''}`).join(', ')

  let uiCatalog = ''
  try {
    uiCatalog = fs.readFileSync(path.join(process.cwd(), 'docs/ui-catalog.md'), 'utf8')
  } catch { /* ignore */ }

  // Compute observations for proactive guidance
  const myProducts = productList.filter((p: any) => p.created_by === evalUser.id)
  const myProductIds = new Set(myProducts.map((p: any) => p.id))
  const myTodos = todoList.filter((t: any) => myProductIds.has(t.product_id))
  const observations = computeObservations(myTodos as any, myProducts as any)
  const guidanceLevel = preferenceList.find(p => p.key === 'guidance_level')?.value ?? 'standard'

  // Build system prompt (same structure as orbConverse)
  const systemPrompt = [
    `You are the voice of the orb — the conversational layer of Orb.`,
    buildVoicePrompt('natural'),
    `CURRENT DATE: ${new Date().toISOString().split('T')[0]}`,
    `USER CONTEXT: You are talking to ${auth.user.email} (Name: ${auth.user.name || 'Unknown'}, Role: ${auth.role}).`,
    ORB_PRINCIPLES,
    ORB_RESOLUTION_LAWS,
    `VALID VALUES: Statuses: ${statusNames} | Priorities: ${priorityInfo}`,
    STATUS_VOCABULARY,
    `The BACKLOG below separates ACTIVE from PARKED — use this split, not your own filtering.`,
    buildUrgencyRules(24),
    `SCOPE:\n- You can see and discuss ALL projects in the backlog.\n- When creating or updating todos, default to the currently selected project "${current.name}" (code: "${current.code}") unless the user explicitly names a different project.\n- An unqualified request to create a task already has a project: the currently selected project. Do not ask which project; propose the requested task there and request any required mutation approval.\n- When calling tools (create_todo, query_todos, etc.), ALWAYS pass the project code — never omit it.\n- When speaking to the user, refer to projects by display name.\n- SCOPE TRANSPARENCY (mandatory): Every response that mentions task counts, lists, or summaries MUST name the project(s) involved. Say "You have 3 open tasks in ${current.name}" or "Across all projects, you have 12 open tasks." NEVER give a count without naming the scope.\n- STRATEGIC GUIDANCE & RECOMMENDATIONS: When the user asks for strategic guidance, task recommendations, workload summaries, or next steps (e.g., "what should I do next?", "what should I work on?"), you MUST ONLY recommend or surface active tasks from projects owned by the current user (where the project owner listed in the backlog is the current user's name: "${auth.user.name || auth.user.email}"). Do NOT suggest or highlight tasks from projects owned by other users.`,
    uiCatalog ? `UI CATALOG & NAVIGATION:\n${uiCatalog}` : '',
    `BACKLOG:\n${contextString}`,
    `KNOWLEDGE BASE (Recent):\n${knowledgeList.slice(0, 5).map((k: any) => {
      const tags = (k.tags && k.tags.length > 0) ? ` [${k.tags.join(', ')}]` : ''
      return `- [${k.projects?.name || k.projects?.code}] ${k.title}${tags}: ${k.content.slice(0, 100)}...`
    }).join('\n')}`,
    voiceMode ? `VOICE CONVERSATION: You are currently in voice mode — the user is speaking to you and hearing your responses aloud.
VOICE RESPONSE RULES:
- Keep responses concise and conversational — clear sentences, not markdown lists or tables.
- Avoid complex formatting (tables, bullet lists, code blocks). Speak in natural prose.
When the user signals they want to end the voice conversation — "that's enough", "let's stop", "stop talking", "end voice mode", or similar — you MUST call client_action with action="exit_voice". You may say a brief closing remark first.` : '',
    ORB_QUERY_ROUTING,
    `REPOSITORY ACCESS: You may inspect the local working tree with query_repository source="local", or the current Vercel deployment with source="production".`,
    `DATABASE SCHEMA (for query_db):\n${DB_SCHEMA}`,
    ORB_SCOPE_RULES,
    `WHAT'S NEW:\n${CHANGELOG.slice(0, 3).map(r => `${r.version} (${r.date}):\n${r.changes.map(c => `  - ${c}`).join('\n')}`).join('\n\n')}`,
    buildMutationApprovalPrompt(preferenceList),
    behaviorRuleList.length > 0
      ? `BEHAVIORAL RULES:\n${behaviorRuleList.map((r: any) => `- **${r.title}:** ${r.content}`).join('\n')}`
      : '',
    ORB_SESSION_ADAPTATION,
    ORB_SELF_DIAGNOSTICS,
    ORB_STRATEGIC_REASONING,
    buildCoachingPrompt('natural'),
    ORB_PREFERENCE_DISCOVERY,
    buildPreferencesPrompt(preferenceList),
    `INSIGHT TAGGING:
When you surface proactive observation, coaching, or strategic recommendation content, wrap only that sentence or short paragraph in one marker pair:
[INSIGHT:observation]...[/INSIGHT], [INSIGHT:coaching]...[/INSIGHT], or [INSIGHT:strategic]...[/INSIGHT].
Use observation for backlog facts worth noticing, coaching for work-rhythm guidance, and strategic for "what should I work on" recommendations. Do not wrap ordinary confirmations, errors, or direct answers with no proactive guidance.`,
    buildProactiveTonePrompt('natural'),
    buildObservationsPrompt(observations, guidanceLevel),
    ORB_ATTRIBUTION,
    ORB_MUTATION_VERIFICATION,
    buildFeedbackTonePrompt('natural'),
    buildMemoryPrompt([], 'full'),
    ORB_MEMORY_BEHAVIOR,
    ORB_DEV_CHANNEL_PROMPT,
  ].filter(Boolean).join('\n\n')

  const approvalConfirmed = isAffirmativeApproval(input) && historyHasPendingMutationProposal(history)
  const approvedCode = pendingApprovalCode(history)
  const approvedTool = pendingApprovalTool(history)
  const messages: any[] = [
    ...(history?.map(h => ({ role: h.role, content: h.text })) ?? []),
    { role: 'user', content: input },
    ...(approvalConfirmed ? [{
      role: 'user',
      content: approvedTool
        ? `SYSTEM: The user has approved the immediately preceding mutation proposal. Call ${approvedTool} now${approvedCode ? ` for ${approvedCode}` : ''}. Do not query first or ask for approval again.`
        : 'SYSTEM: The user has approved the immediately preceding mutation proposal. Execute that requested mutation now. Do not perform a preliminary lookup or ask for approval again.',
    }] : []),
  ]

  try {
    // Non-streaming call — capture the full response
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools: [...ORB_TOOLS, ...ORB_PREFERENCE_TOOLS, ...ORB_MEMORY_TOOLS, ORB_CAPABILITIES_TOOL, ORB_DEV_CHANNEL_TOOL] as any,
      ...(approvalConfirmed && approvedTool ? { tool_choice: { type: 'tool' as const, name: approvedTool } } : {}),
    })

    // Record metrics (fire-and-forget)
    if (evalUser?.id) {
      const metricAdmin = createAdminClient()
      metricAdmin.rpc('upsert_orb_metric', {
        p_user_id: evalUser.id,
        p_speech_chars: 0,
        p_voice_speech_chars: 0,
        p_input_chars: 0,
        p_tool_call_count: 0,
        p_ambient_chars: 0,
        p_input_tokens: response.usage?.input_tokens ?? 0,
        p_output_tokens: response.usage?.output_tokens ?? 0,
        p_cache_creation_input_tokens: (response.usage as any)?.cache_creation_input_tokens ?? 0,
        p_cache_read_input_tokens: (response.usage as any)?.cache_read_input_tokens ?? 0,
        p_model: 'claude-haiku-4-5',
      }).then(({ error }) => {
        if (error) console.error('[orbEval] Metric upsert failed:', error.message)
      })
    }

    // Extract speech and tool calls
    let speech = ''
    const toolCalls: Array<{ name: string; params: Record<string, any> }> = []

    for (const block of response.content) {
      if (block.type === 'text') {
        speech += block.text
      } else if (block.type === 'tool_use') {
        toolCalls.push({ name: block.name, params: block.input as Record<string, any> })
      }
    }

    const gatedToolCalls = toolCalls.filter(tc => APPROVAL_GATED_TOOLS.has(tc.name))
    if (
      evalApprovalMode !== 'allow'
      && gatedToolCalls.length > 0
      && !(isAffirmativeApproval(input) && historyHasPendingMutationProposal(history))
    ) {
      return NextResponse.json({
        speech: buildApprovalPrompt(gatedToolCalls),
        toolCalls: [],
        stopReason: 'approval_gate',
        tokenUsage: response.usage,
      })
    }

    const historyCodes = extractCitedCodes(`${(history ?? []).map(h => h.text).join(' ')} ${input}`)
    const toolProducedCodes = new Set<string>()
    if (isFalseMutationClaim(speech, false, toolProducedCodes, historyCodes)) {
      return NextResponse.json({
        speech: 'I did not actually complete that — no mutation tool ran, so nothing was written.',
        toolCalls: [],
        stopReason: 'blocked_no_tool_mutation_claim',
        tokenUsage: response.usage,
      })
    }

    return NextResponse.json({
      speech,
      toolCalls,
      stopReason: response.stop_reason,
      tokenUsage: response.usage,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
