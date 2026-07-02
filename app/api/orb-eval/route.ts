'use server'

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { ORB_TOOLS, ORB_TOOL_LABELS } from '@/lib/orb-contract'
import { ORB_PRINCIPLES, ORB_RESOLUTION_LAWS, ORB_NO_SESSION_RECORD_NOTE, ORB_ATTRIBUTION, ORB_MUTATION_VERIFICATION, ORB_QUERY_ROUTING, ORB_SCOPE_RULES, ORB_SESSION_ADAPTATION, ORB_PREFERENCE_DISCOVERY, ORB_SELF_DIAGNOSTICS, buildVoicePrompt, buildFeedbackTonePrompt, buildProactiveTonePrompt, buildCoachingPrompt, buildUrgencyRules, buildPreferencesPrompt, buildObservationsPrompt, buildMutationApprovalPrompt, buildMemoryPrompt, ORB_MEMORY_BEHAVIOR, ORB_STRATEGIC_REASONING, computeObservations, ORB_PREFERENCE_TOOLS, ORB_MEMORY_TOOLS, ORB_CAPABILITIES_TOOL, ORB_DEV_CHANNEL_TOOL, ORB_DEV_CHANNEL_PROMPT, VALID_PREFERENCE_KEYS } from '@/lib/orb-prompt'
import { visibleProjectsQuery } from '@/lib/projects'
import { isActive, isParked, STATUS_VOCABULARY } from '@/lib/status-groups'
import { DB_SCHEMA } from '@/lib/db-schema'
import { CHANGELOG } from '@/lib/changelog'
import { ANTHROPIC_HAIKU_REFERENCE_MODEL, normalizeAnthropicUsage } from '@/lib/orb-model/anthropic'
import { recordOrbModelRequest } from '@/lib/orb-model/record'
import { completeGeminiEvaluation, GEMINI_STRATEGIC_EVAL_MODEL } from '@/lib/orb-model/gemini'
import { completeMistralEvaluation, MISTRAL_STRATEGIC_EVAL_MODEL } from '@/lib/orb-model/mistral'
import { STRATEGIC_CONTEXT_PACKETS } from '@/lib/orb-model/strategic-eval-packets'
import type { OrbModelUsage } from '@/lib/orb-model/types'
import { routeOrbRequest } from '@/lib/orb-model/routing'
import { budgetBlockMessage, type OrbBudgetCheck } from '@/lib/orb-model/budget'

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

function isBroadProjectStateQuestion(input: string): boolean {
  return /\b(state|status|snapshot|summary|overview|how (are|is)|what'?s going on)\b/i.test(input)
    && /\b(projects|backlog|everything|all)\b/i.test(input)
}

type EvalActionSet = { kind: 'todo_set'; tool: string; ordinal: number; codes: string[]; summary: string; createdAt: string }

function resolveActionSetReference(input: string, actionSets: EvalActionSet[] | undefined): EvalActionSet | null {
  const sets = (actionSets ?? []).filter(set => set.kind === 'todo_set' && set.codes.length > 0)
  if (sets.length === 0 || !/\b(them|those|these|all of them|the ones|the tasks|the todos|the to dos|first|second|third|last|latest)\b/i.test(input)) return null
  const lower = input.toLowerCase()
  if (/\b(first|1st|initial)\b/.test(lower)) return sets[0] ?? null
  if (/\b(second|2nd)\b/.test(lower)) return sets[1] ?? null
  if (/\b(third|3rd)\b/.test(lower)) return sets[2] ?? null
  return sets[sets.length - 1] ?? null
}

function isDeleteRequest(input: string): boolean {
  return /\b(delete|remove|clear|trash|get rid of)\b/i.test(input)
}

function inferProjectDisambiguationInstruction(
  history: Array<{ role: 'user' | 'assistant'; text: string }> | undefined,
  input: string,
): string | null {
  const selection = input.trim()
  if (!selection || selection.length > 80) return null
  const prior = history ?? []
  const lastAssistant = [...prior].reverse().find(h => h.role === 'assistant')?.text ?? ''
  const lastUser = [...prior].reverse().find(h => h.role === 'user')?.text ?? ''
  const assistantAskedWhich = /\b(which|which one|do you mean)\b/i.test(lastAssistant)
    && /\b(code|project)\b/i.test(lastAssistant)
  const priorWasDeleteProject = /\b(delete|remove|drop)\b/i.test(lastUser)
    && /\bproject\b/i.test(lastUser)
  if (!assistantAskedWhich || !priorWasDeleteProject) return null
  const safeSelection = selection.replace(/"/g, '\\"')
  return `[SYSTEM: The user is answering your immediately prior disambiguation question for a delete_project request. Their selected project is "${safeSelection}". You MUST call delete_project now with {"name":"${safeSelection}"}. Do not produce only a proposal in speech; the server handles confirmation after the tool call.]`
}

// ── POST /api/orb-eval ───────────────────────────────────────────────────
// Non-streaming Orb call that returns speech + tool calls without executing them.
// For the eval framework only. Disabled in production.

export async function POST(request: NextRequest) {
  const authError = checkAuth(request)
  if (authError) return authError

  const body = await request.json()
  const { input, productCode, history, pendingSummary, actionSets, backlogOverride, mutationApproval, voiceMode, ttsProvider, ttsModel, ttsVoiceId, provider, model, userEmail, evaluationMode, contextPacketId, autoRoute, budgetOverride, evaluationCaseId } = body as {
    input: string
    productCode?: string
    history?: Array<{ role: 'user' | 'assistant'; text: string }>
    pendingSummary?: string
    actionSets?: EvalActionSet[]
    backlogOverride?: string
    mutationApproval?: 'ask' | 'allow'
    voiceMode?: boolean
    ttsProvider?: string
    ttsModel?: string | null
    ttsVoiceId?: string | null
    provider?: 'anthropic' | 'gemini' | 'mistral'
    model?: string
    userEmail?: string
    evaluationMode?: 'standard' | 'strategic'
    contextPacketId?: string
    autoRoute?: boolean
    budgetOverride?: 'monthly' | 'role'
    evaluationCaseId?: string
  }

  if (!input) {
    return NextResponse.json({ error: 'input is required' }, { status: 400 })
  }
  const contextPacket = contextPacketId ? STRATEGIC_CONTEXT_PACKETS[contextPacketId] : null
  if (contextPacketId && !contextPacket) {
    return NextResponse.json({ error: `Unknown strategic context packet: ${contextPacketId}` }, { status: 400 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
  const admin = createAdminClient()

  // Resolve the eval user (first admin found)
  let evalUserQuery = admin
    .from('users')
    .select('id, email, first_name, last_name, role_id, roles(name)')
    .in('role_id', [1, 3])
  if (userEmail) evalUserQuery = evalUserQuery.eq('email', userEmail)
  const { data: evalUser } = await evalUserQuery.limit(1).maybeSingle()

  if (!evalUser) {
    return NextResponse.json({ error: userEmail ? `No admin user found for ${userEmail}` : 'No admin user found for eval' }, { status: 500 })
  }

  const evalUserId = evalUser.id
  const evalUserName = evalUser ? [evalUser.first_name, evalUser.last_name].filter(Boolean).join(' ') : ''
  const auth = {
    user: { id: evalUserId, email: evalUser.email ?? '', name: evalUserName || null },
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

  function fixtureProjectFromContext(code: string, fixture?: string) {
    const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = fixture?.match(new RegExp(`(?:^|\\n)([^:\\n]+)\\s+\\[code:\\s*${escapedCode}\\]`, 'i'))
    return {
      id: `eval-fixture-${code.toUpperCase()}`,
      name: match?.[1]?.trim() || code,
      code,
      description: null,
      created_by: evalUserId,
      __evalFixture: true,
    }
  }

  // Resolve current project. backlogOverride cases are intentionally frozen
  // fixtures, so their selected project code may not exist in the live DB.
  const liveCurrent = productCode
    ? productList.find((p: any) => p.code?.toUpperCase() === productCode.toUpperCase())
    : productList[0]
  const hasFrozenEvalContext = Boolean(backlogOverride || actionSets?.length)
  const current = liveCurrent ?? (productCode && hasFrozenEvalContext
    ? fixtureProjectFromContext(productCode, backlogOverride)
    : null)

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
    const codeLabel = p.code ? ` [code: ${p.code}]` : ''
    const header = `${p.name}${codeLabel}${p.description ? ` (${p.description})` : ''}${ownerTag}`
    const projectTodos = todoList.filter((t: any) => t.product_id === p.id)
    const nonClosedTodos = projectTodos.filter((t: any) => !statusList.find((s: any) => s.name === t.status)?.is_closed)
    const activeTodos = nonClosedTodos.filter((t: any) => isActive(t.status))
    const parkedTodos = nonClosedTodos.filter((t: any) => isParked(t.status))
    const otherNonClosedTodos = nonClosedTodos.filter((t: any) => !isActive(t.status) && !isParked(t.status))
    const closedCount = projectTodos.length - nonClosedTodos.length
    const summary = `  SUMMARY: active_count=${activeTodos.length} (open + in progress); parked_count=${parkedTodos.length} (deferred + on hold); closed_count=${closedCount} (excluded)`
    const activeLine = activeTodos.map(todoLine).join('\n')
    const parkedLine = parkedTodos.map(todoLine).join('\n')
    const otherLine = otherNonClosedTodos.map(todoLine).join('\n')
    const sections = [summary]
    if (activeLine) sections.push(`  ACTIVE:\n${activeLine}`)
    if (parkedLine) sections.push(`  PARKED (on hold/deferred):\n${parkedLine}`)
    if (otherLine) sections.push(`  OTHER NON-CLOSED:\n${otherLine}`)
    return `${header}:\n${sections.join('\n')}`
  }).join('\n\n')

  const dormantSection = dormantList.length > 0
    ? `\n\nDORMANT:\n${dormantList.map((p: any) => `  ${p.name}${p.code ? ` [code: ${p.code}]` : ''}`).join(', ')}`
    : ''

  // backlogOverride freezes the backlog the model sees, so project-routing cases are
  // deterministic instead of hostage to live DB state. The endpoint still executes nothing.
  const contextString = backlogOverride ?? (byProduct + dormantSection)

  function buildVoiceProjectStateSummary(): string {
    type ProjectCount = { name: string; count: number }
    const activeTodos = todoList.filter((t: any) => isActive(t.status))
    const parkedTodos = todoList.filter((t: any) => isParked(t.status))
    const activeByProject = productList
      .map((p: any) => ({ name: p.name, count: activeTodos.filter((t: any) => t.product_id === p.id).length }))
      .filter((p: ProjectCount) => p.count > 0)
      .sort((a: ProjectCount, b: ProjectCount) => b.count - a.count)
    const parkedByProject = productList
      .map((p: any) => ({ name: p.name, count: parkedTodos.filter((t: any) => t.product_id === p.id).length }))
      .filter((p: ProjectCount) => p.count > 0)
      .sort((a: ProjectCount, b: ProjectCount) => b.count - a.count)
    const notable = activeByProject[0]
      ? `${activeByProject[0].name} has the most active work with ${activeByProject[0].count}.`
      : parkedByProject[0]
        ? `${parkedByProject[0].name} has the largest parked backlog with ${parkedByProject[0].count}.`
        : 'Nothing is active right now.'
    return `Across your projects, you have ${activeTodos.length} active tasks and ${parkedTodos.length} parked items. ${notable}`
  }

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
    `The BACKLOG below gives a SUMMARY line for each project and then separates ACTIVE from PARKED. When answering counts or project-health questions, copy the SUMMARY counts exactly; do not recalculate by counting visible lines. When the user asks "how many tasks" or "my tasks" without specifying, report the active_count. If parked_count is above zero, mention it separately. If you list tasks, make sure the number you claim matches the number of listed items, or say "including" instead of implying a complete list.`,
    buildUrgencyRules(24),
    `SCOPE:\n- You can see and discuss ALL projects in the backlog.\n- When creating or updating todos, default to the currently selected project "${current.name}" unless the user explicitly names a different project.\n- An unqualified request to create a task already has a project: the currently selected project. Do not ask which project; just create it there.\n- When calling tools that need a project identifier, look up the project code from the backlog (shown as [code: XXX] next to each project name) and pass that. The user speaks in names — you translate to codes for tool calls.\n- When speaking to the user, ALWAYS use project names, never codes.\n- SCOPE TRANSPARENCY (mandatory): Every response that mentions task counts, lists, or summaries MUST name the project(s) involved. Say "You have 3 open tasks in ${current.name}" or "Across all projects, you have 12 open tasks." NEVER give a count without naming the scope.\n- STRATEGIC GUIDANCE & RECOMMENDATIONS: When the user asks for strategic guidance, task recommendations, workload summaries, or next steps (e.g., "what should I do next?", "what should I work on?"), you MUST ONLY recommend or surface active tasks from projects owned by the current user (where the project owner listed in the backlog is the current user's name: "${auth.user.name || auth.user.email}"). Do NOT suggest or highlight tasks from projects owned by other users.`,
    uiCatalog ? `UI CATALOG & NAVIGATION:\n${uiCatalog}` : '',
    `BACKLOG:\n${contextString}`,
    `KNOWLEDGE BASE (Recent):\n${knowledgeList.slice(0, 5).map((k: any) => {
      const tags = (k.tags && k.tags.length > 0) ? ` [${k.tags.join(', ')}]` : ''
      return `- [${k.projects?.name ?? k.projects?.code ?? '?'}] ${k.title}${tags}: ${k.content.slice(0, 100)}...`
    }).join('\n')}`,
    voiceMode ? `VOICE CONVERSATION: You are currently in voice mode — the user is speaking to you and hearing your responses aloud.
CURRENT VOICE OUTPUT CONFIG:
- TTS provider: ${ttsProvider || 'unknown'}
- TTS model: ${ttsModel || 'not specified'}
- TTS voice ID/name: ${ttsVoiceId || 'not specified'}
Use this config when the user asks what voice provider, model, or voice is active. Do not infer the active voice provider from release notes, device voices, or the user's guess. If the provider is "unknown", say you do not have that setting in context.
VOICE RESPONSE RULES:
- Keep responses concise and conversational — clear sentences, not markdown lists or tables.
- Default to 1–3 spoken sentences. For lists, counts, summaries, task details, or analysis, give the useful headline and at most 2 key specifics, then stop. Do not add a follow-up offer unless the user asks what to do next. Do not read long inventories aloud by default.
- For broad project-state questions in voice mode, answer in one short plain-text paragraph, no markdown or bullets, under about 60 words. Give total active/parked counts and at most one notable project or risk. Do not list every project or every task.
- Avoid complex formatting (tables, bullet lists, code blocks). Speak in natural prose.
- Voice transcripts may be imperfect. If the user input is fragmentary, garbled, or hinges on a missing word, ask one concise clarification instead of filling in the blank from prior context.
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

  const messages: any[] = [
    ...(history?.map(h => ({ role: h.role, content: h.text })) ?? []),
    { role: 'user', content: input },
  ]
  // Mirror production's record-state transparency note (orb-converse.ts).
  if ((history ?? []).length === 0) {
    messages.push({ role: 'user', content: ORB_NO_SESSION_RECORD_NOTE })
  }
  const disambiguationInstruction = inferProjectDisambiguationInstruction(history, input)
  if (disambiguationInstruction) messages.push({ role: 'user', content: disambiguationInstruction })

  // Mirror production's server-held pending-mutation injection (lib/orb-mutations.ts flow).
  if (pendingSummary) {
    messages.push({ role: 'user', content: `[SYSTEM: This note applies ONLY if the user's latest message is a bare affirmation (e.g. "yes", "go", "go ahead", "do it", "yep", "confirm" — including stacked repeats like "confirm confirm", common in voice transcripts). If so, they are approving the action you proposed on the previous turn — "${pendingSummary}" — so call confirm_mutation. For ANY other message (a new or changed request, a question, or a decline), ignore this note completely and respond as if it were not here: do not call confirm_mutation, and never mention a pending, held, or previous action to the user.]` })
  }

  try {
    const routeRole = autoRoute
      ? routeOrbRequest(input, true, true)
      : 'operational'
    if (voiceMode && isBroadProjectStateQuestion(input)) {
      return NextResponse.json({
        speech: buildVoiceProjectStateSummary(),
        toolCalls: [],
        stopReason: 'deterministic_voice_project_state',
        tokenUsage: { input_tokens: 0, output_tokens: 0 },
        routeRole,
      })
    }
    const referencedSet = resolveActionSetReference(input, actionSets)
    if (referencedSet && isDeleteRequest(input)) {
      const prefixes = new Set(referencedSet.codes.map(code => code.split('-')[0]).filter(Boolean))
      const scope = prefixes.size === 1 ? ` from ${[...prefixes][0]}` : ''
      // Mirror production's capped target itemization (orb-converse.ts
      // listTodoOperationLines) — codes only; fixtures carry no titles.
      const CONFIRM_LIST_MAX = 10
      const lines = referencedSet.codes.slice(0, CONFIRM_LIST_MAX).map(code => `- delete ${code.toUpperCase()}`)
      if (referencedSet.codes.length > CONFIRM_LIST_MAX) {
        lines.push(`…and ${referencedSet.codes.length - CONFIRM_LIST_MAX} more (${referencedSet.codes.length} total)`)
      }
      return NextResponse.json({
        speech: `Confirm: delete ${referencedSet.codes.length} todos${scope}?\n\n${lines.join('\n')}`,
        toolCalls: [],
        stopReason: 'deterministic_action_set_reference',
        tokenUsage: { input_tokens: 0, output_tokens: 0 },
        routeRole,
      })
    }
    if (budgetOverride) {
      const budgetCheck: OrbBudgetCheck = {
        allowed: false,
        scope: budgetOverride === 'monthly' ? 'monthly' : routeRole,
        role: routeRole,
        spentUsd: 40,
        limitUsd: 40,
        totalSpentUsd: 40,
        totalLimitUsd: 40,
        totalSource: 'ledger',
      }
      return NextResponse.json({
        speech: budgetBlockMessage(budgetCheck),
        toolCalls: [],
        stopReason: 'budget_blocked',
        tokenUsage: { input_tokens: 0, output_tokens: 0 },
        routeRole,
      })
    }
    const isStrategicEvaluation = evaluationMode === 'strategic' || routeRole === 'strategic'
    const frozenStrategicPrompt = contextPacket ? [
      'You are the voice of the Orb - the conversational layer of Orb.',
      ORB_PRINCIPLES,
      ORB_RESOLUTION_LAWS,
      ORB_STRATEGIC_REASONING,
      buildCoachingPrompt('natural'),
      `EVALUATION MODE: This is a strategic-quality comparison. The supplied packet is complete and is the only dynamic evidence for this answer. Do not use or infer live backlog, knowledge, memory, preferences, or audit data. Do not call tools. State uncertainty when the packet lacks evidence.`,
      `CURRENT DATE: ${contextPacket.currentDate}. USER: ${contextPacket.userName}. CURRENT PROJECT: ${contextPacket.currentProject}.`,
      `BACKLOG:\n${contextPacket.backlog}`,
      `RELEVANT KNOWLEDGE:\n${contextPacket.knowledge}`,
      `PREFERENCES:\n${contextPacket.preferences}`,
      `OBSERVATIONS:\n${contextPacket.observations}`,
    ].join('\n\n') : null
    const evalSystemPrompt = isStrategicEvaluation
      ? frozenStrategicPrompt ?? `${systemPrompt}\n\nEVALUATION MODE: This is a strategic-quality comparison. The supplied BACKLOG, audit context, memories, and preferences are complete for this answer. Do not call tools. Analyze the supplied evidence directly, state uncertainty when warranted, and give your best strategic response.`
      : systemPrompt
    const tools = isStrategicEvaluation
      ? []
      : [...ORB_TOOLS, ...ORB_PREFERENCE_TOOLS, ...ORB_MEMORY_TOOLS, ORB_CAPABILITIES_TOOL, ORB_DEV_CHANNEL_TOOL] as any[]
    const requestedProvider = autoRoute
      ? provider ?? (routeRole === 'strategic' ? 'gemini' : 'anthropic')
      : provider ?? 'anthropic'
    let speech = ''
    let toolCalls: Array<{ name: string; params: Record<string, any> }> = []
    let tokenUsage: { input_tokens: number; output_tokens: number }
    let stopReason: string
    let modelUsage: OrbModelUsage

    if (requestedProvider === 'gemini') {
      const result = await completeGeminiEvaluation({
        model: model ?? GEMINI_STRATEGIC_EVAL_MODEL,
        source: 'eval',
        systemPrompt: evalSystemPrompt,
        messages,
        tools,
        forcedTool: null,
      })
      speech = result.speech
      toolCalls = result.toolCalls
      tokenUsage = result.tokenUsage
      stopReason = result.stopReason
      modelUsage = result.modelUsage
    } else if (requestedProvider === 'mistral') {
      const result = await completeMistralEvaluation({
        model: model ?? MISTRAL_STRATEGIC_EVAL_MODEL,
        systemPrompt: evalSystemPrompt,
        messages,
        tools,
        forcedTool: null,
        strategic: isStrategicEvaluation,
      })
      speech = result.speech
      toolCalls = result.toolCalls
      tokenUsage = result.tokenUsage
      stopReason = result.stopReason
      modelUsage = result.modelUsage
    } else if (requestedProvider === 'anthropic') {
      const requestStartedAt = Date.now()
      const response = await anthropic.messages.create({
        model: model ?? ANTHROPIC_HAIKU_REFERENCE_MODEL,
        max_tokens: 4096,
        system: evalSystemPrompt,
        messages,
        tools,
      })
      for (const block of response.content) {
        if (block.type === 'text') speech += block.text
        else if (block.type === 'tool_use') toolCalls.push({ name: block.name, params: block.input as Record<string, any> })
      }
      tokenUsage = {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      }
      stopReason = response.stop_reason ?? 'unknown'
      modelUsage = normalizeAnthropicUsage(response.usage, {
        model: model ?? ANTHROPIC_HAIKU_REFERENCE_MODEL,
        source: 'eval',
        latencyMs: Date.now() - requestStartedAt,
        clientToolCalls: toolCalls.length,
      })
    } else {
      return NextResponse.json({ error: `Unsupported eval provider: ${requestedProvider}` }, { status: 400 })
    }

    // Eval records are awaited so every comparison result has a durable usage row.
    if (evalUser?.id) {
      const metricAdmin = createAdminClient()
      const [metricsResult, requestResult] = await Promise.allSettled([
        metricAdmin.rpc('upsert_orb_metric', {
          p_user_id: evalUser.id,
          p_speech_chars: 0,
          p_voice_speech_chars: 0,
          p_input_chars: 0,
          p_tool_call_count: modelUsage.clientToolCalls,
          p_ambient_chars: 0,
          p_input_tokens: modelUsage.inputTokens,
          p_output_tokens: modelUsage.outputTokens,
          p_cache_creation_input_tokens: modelUsage.cacheWriteTokens ?? 0,
          p_cache_read_input_tokens: modelUsage.cachedInputTokens ?? 0,
          p_model: modelUsage.model,
        }),
        recordOrbModelRequest(metricAdmin, {
          userId: evalUser.id,
          usage: modelUsage,
          promptVersion: 'orb-system-v0.6.30',
          contextPacketVersion: contextPacket ? 'strategic-packets-v1' : 'live-context-v1',
          responseText: speech,
          routeRole,
          evaluationCaseId,
        }),
      ])
      if (metricsResult.status === 'fulfilled' && metricsResult.value.error) {
        console.error('[orbEval] Metric upsert failed:', metricsResult.value.error.message)
      }
      if (requestResult.status === 'rejected') {
        console.error('[orbEval] Request ledger insert failed:', requestResult.reason)
      }
    }

    const historyCodes = extractCitedCodes(
      `${(history ?? []).map(h => h.text).join(' ')} ${input} ${todoList.map(todoCode).join(' ')} ${contextPacket?.backlog ?? ''}`,
    )
    const toolProducedCodes = new Set<string>()
    if (isFalseMutationClaim(speech, false, toolProducedCodes, historyCodes)) {
      return NextResponse.json({
        speech: 'I did not actually complete that — no mutation tool ran, so nothing was written.',
        toolCalls: [],
        stopReason: 'blocked_no_tool_mutation_claim',
        tokenUsage,
        modelUsage,
        routeRole,
      })
    }

    return NextResponse.json({
      speech,
      toolCalls,
      stopReason,
      tokenUsage,
      modelUsage,
      routeRole,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
