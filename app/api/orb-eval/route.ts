'use server'

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { ORB_TOOLS, ORB_TOOL_LABELS } from '@/lib/orb-contract'
import { ORB_PRINCIPLES, ORB_RESOLUTION_LAWS, ORB_VOICE, ORB_ATTRIBUTION, ORB_FEEDBACK_TONE, ORB_QUERY_ROUTING, ORB_SCOPE_RULES, ORB_SESSION_ADAPTATION, ORB_PREFERENCE_DISCOVERY, ORB_PROACTIVE_TONE, ORB_SELF_DIAGNOSTICS, buildUrgencyRules, buildPreferencesPrompt, buildObservationsPrompt, buildMutationApprovalPrompt, computeObservations, ORB_PREFERENCE_TOOLS, ORB_CAPABILITIES_TOOL, ORB_DEV_CHANNEL_TOOL, ORB_DEV_CHANNEL_PROMPT, VALID_PREFERENCE_KEYS } from '@/lib/orb-prompt'
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

// ── POST /api/orb-eval ───────────────────────────────────────────────────
// Non-streaming Orb call that returns speech + tool calls without executing them.
// For the eval framework only. Disabled in production.

export async function POST(request: NextRequest) {
  const authError = checkAuth(request)
  if (authError) return authError

  const body = await request.json()
  const { input, productCode, history } = body as {
    input: string
    productCode?: string
    history?: Array<{ role: 'user' | 'assistant'; text: string }>
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
    admin.from('todos').select('id, todo_number, title, description, status, priority_value, product_id, created_at, updated_at, closed_at, resolution_notes, due_at, urls, group_id, category_id, groups(name), categories(name)').is('deleted_at', null),
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
  // Force mutation_approval to 'allow' in evaluation to test tool calls directly
  const approvalPref = preferenceList.find(p => p.key === 'mutation_approval')
  if (approvalPref) {
    approvalPref.value = 'allow'
  } else {
    preferenceList.push({ key: 'mutation_approval', value: 'allow' })
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
    ORB_VOICE,
    `CURRENT DATE: ${new Date().toISOString().split('T')[0]}`,
    `USER CONTEXT: You are talking to ${auth.user.email} (Name: ${auth.user.name || 'Unknown'}, Role: ${auth.role}).`,
    ORB_PRINCIPLES,
    ORB_RESOLUTION_LAWS,
    `VALID VALUES: Statuses: ${statusNames} | Priorities: ${priorityInfo}`,
    STATUS_VOCABULARY,
    `The BACKLOG below separates ACTIVE from PARKED — use this split, not your own filtering.`,
    buildUrgencyRules(24),
    `SCOPE:\n- You can see and discuss ALL projects in the backlog.\n- When creating or updating todos, default to the currently selected project "${current.name}" (code: "${current.code}") unless the user explicitly names a different project.\n- When calling tools (create_todo, query_todos, etc.), ALWAYS pass the project code — never omit it.\n- When speaking to the user, refer to projects by display name.\n- SCOPE TRANSPARENCY (mandatory): Every response that mentions task counts, lists, or summaries MUST name the project(s) involved. Say "You have 3 open tasks in ${current.name}" or "Across all projects, you have 12 open tasks." NEVER give a count without naming the scope.\n- STRATEGIC GUIDANCE & RECOMMENDATIONS: When the user asks for strategic guidance, task recommendations, workload summaries, or next steps (e.g., "what should I do next?", "what should I work on?"), you MUST ONLY recommend or surface active tasks from projects owned by the current user (where the project owner listed in the backlog is the current user's name: "${auth.user.name || auth.user.email}"). Do NOT suggest or highlight tasks from projects owned by other users.`,
    uiCatalog ? `UI CATALOG & NAVIGATION:\n${uiCatalog}` : '',
    `BACKLOG:\n${contextString}`,
    `KNOWLEDGE BASE (Recent):\n${knowledgeList.slice(0, 5).map((k: any) => {
      const tags = (k.tags && k.tags.length > 0) ? ` [${k.tags.join(', ')}]` : ''
      return `- [${k.projects?.name || k.projects?.code}] ${k.title}${tags}: ${k.content.slice(0, 100)}...`
    }).join('\n')}`,
    ORB_QUERY_ROUTING,
    `DATABASE SCHEMA (for query_db):\n${DB_SCHEMA}`,
    ORB_SCOPE_RULES,
    `WHAT'S NEW:\n${CHANGELOG.slice(0, 3).map(r => `${r.version} (${r.date}):\n${r.changes.map(c => `  - ${c}`).join('\n')}`).join('\n\n')}`,
    buildMutationApprovalPrompt(preferenceList),
    behaviorRuleList.length > 0
      ? `BEHAVIORAL RULES:\n${behaviorRuleList.map((r: any) => `- **${r.title}:** ${r.content}`).join('\n')}`
      : '',
    ORB_SESSION_ADAPTATION,
    ORB_SELF_DIAGNOSTICS,
    ORB_PREFERENCE_DISCOVERY,
    buildPreferencesPrompt(preferenceList),
    ORB_PROACTIVE_TONE,
    buildObservationsPrompt(observations, guidanceLevel),
    ORB_ATTRIBUTION,
    ORB_FEEDBACK_TONE,
    ORB_DEV_CHANNEL_PROMPT,
  ].filter(Boolean).join('\n\n')

  const messages: any[] = [
    ...(history?.map(h => ({ role: h.role, content: h.text })) ?? []),
    { role: 'user', content: input },
  ]

  try {
    // Non-streaming call — capture the full response
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools: [...ORB_TOOLS, ...ORB_PREFERENCE_TOOLS, ORB_CAPABILITIES_TOOL, ORB_DEV_CHANNEL_TOOL] as any,
    })

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
