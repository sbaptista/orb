'use server'

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { canRoleInspectRepository } from '@/lib/repository-access'
import { ORB_TOOLS, ORB_TOOL_LABELS } from '@/lib/orb-contract'
import { ORB_PRINCIPLES, ORB_RESOLUTION_LAWS, ORB_FOUNDATIONAL_DEFINITIONS, ORB_NO_SESSION_RECORD_NOTE, ORB_ATTRIBUTION, ORB_MUTATION_VERIFICATION, ORB_QUERY_ROUTING, ORB_SCOPE_RULES, ORB_SESSION_ADAPTATION, ORB_PREFERENCE_DISCOVERY, ORB_COMMITMENT_INTEGRITY, ORB_SELF_DIAGNOSTICS, ORB_PROJECT_HEALTH_SUMMARY, ORB_NEXT_STEP_READ, buildVoicePrompt, buildVoiceConversationPrompt, buildFeedbackTonePrompt, buildProactiveTonePrompt, buildCoachingPrompt, buildUrgencyRules, buildOrbScopePrompt, buildPreferencesPrompt, buildAdaptationsPrompt, buildObservationsPrompt, buildMutationApprovalPrompt, buildMemoryPrompt, ORB_MEMORY_BEHAVIOR, ORB_STRATEGIC_REASONING, ORB_ADAPTATION_BEHAVIOR, ORB_ADAPTATION_TOOL, ORB_PREFERENCE_TOOLS, ORB_MEMORY_TOOLS, ORB_CAPABILITIES_TOOL, ORB_DEV_CHANNEL_TOOL, ORB_DEV_CHANNEL_PROMPT, VALID_PREFERENCE_KEYS } from '@/lib/orb-prompt'
import { STATUS_VOCABULARY } from '@/lib/status-groups'
import { DB_SCHEMA } from '@/lib/db-schema'
import { CHANGELOG } from '@/lib/changelog'
import { ANTHROPIC_HAIKU_REFERENCE_MODEL, normalizeAnthropicUsage } from '@/lib/orb-model/anthropic'
import { recordOrbModelRequest } from '@/lib/orb-model/record'
import { completeGeminiEvaluation, GEMINI_STRATEGIC_EVAL_MODEL } from '@/lib/orb-model/gemini'
import { ORB_EVAL_DEFAULT_PROVIDER } from '@/lib/orb-model/eval-defaults'
import { completeMistralEvaluation, MISTRAL_STRATEGIC_EVAL_MODEL } from '@/lib/orb-model/mistral'
import { STRATEGIC_CONTEXT_PACKETS } from '@/lib/orb-model/strategic-eval-packets'
import { buildStrategicContextPacket, renderStrategicEvaluationPrompt } from '@/lib/orb-model/strategic-context'
import type { OrbModelUsage } from '@/lib/orb-model/types'
import { routeOrbRequest } from '@/lib/orb-model/routing'
import { budgetBlockMessage, type OrbBudgetCheck } from '@/lib/orb-model/budget'
import { extractCitedCodes, isFalseCompletionClaim, EFFECTFUL_TOOL_NAMES } from '@/lib/orb-model/false-claim-guard'
import { buildOrbContext, buildTicketStatusRoutingHint, buildVoiceProjectStateSummary, isBroadProjectStateQuestion, pendingTodoUndercount, resolveActionSetReference, todoCode, type OrbActionSetReference } from '@/lib/orb-model/context'
import { sanitizeUserFacingSpeech } from '@/lib/orb-model/speech-sanitizer'
import { authorizesPendingMutation, buildPendingMutationConfirmationInstruction } from '@/lib/orb-model/mutation-authorization'

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

// Structural mutation guard — shared with orb-converse.ts via
// lib/orb-model/false-claim-guard.ts (see that file for why: the two copies
// used to be independent and had drifted, which is how a real bug —
// client_action/switch_project claimed without a backing tool call — shipped
// undetected).

type EvalActionSet = OrbActionSetReference

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
  const { input, productCode, history, pendingSummary, pendingTodoOperations, actionSets, backlogOverride, mutationApproval, voiceMode, ttsProvider, ttsModel, ttsVoiceId, provider, model, userEmail, evaluationMode, contextPacketId, autoRoute, budgetOverride, evaluationCaseId } = body as {
    input: string
    productCode?: string
    history?: Array<{ role: 'user' | 'assistant'; text: string }>
    pendingSummary?: string
    pendingTodoOperations?: Array<{ tool: string; params: Record<string, unknown> }>
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
  const evalUserRole = (evalUser as any).roles?.name ?? 'Admin'
  const auth = {
    user: { id: evalUserId, email: evalUser.email ?? '', name: evalUserName || null },
    role: evalUserRole,
    roleId: evalUser.role_id,
    // Derived from evalUser.role_id, same as lib/auth.ts's ADMIN_ROLE_IDS = [1, 3] — not
    // hardcoded, since the query above already restricts eval users to role_id 1/3.
    isAdmin: evalUser.role_id === 1 || evalUser.role_id === 3,
    canInspectRepository: canRoleInspectRepository(evalUserRole),
    supabase: admin,
    admin,
  }

  const ctx = await buildOrbContext(admin, auth)
  const productList = ctx.productList
  const todoList = ctx.todoList
  const statusList = ctx.statusList
  const priorityList = ctx.priorityList
  const knowledgeList = ctx.knowledgeList
  const preferenceList = ctx.preferenceList
  const behaviorRuleList = ctx.behaviorRuleList
  // Force mutation_approval to allow by default in evaluation to test tool calls directly.
  // Individual cases can opt into ask-mode to exercise the server-side approval gate.
  const evalApprovalMode = mutationApproval ?? 'allow'
  const approvalPref = preferenceList.find(p => p.key === 'mutation_approval')
  if (approvalPref) {
    approvalPref.value = evalApprovalMode
  } else {
    preferenceList.push({ key: 'mutation_approval', value: evalApprovalMode })
  }

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

  // backlogOverride freezes the backlog the model sees, so project-routing cases are
  // deterministic instead of hostage to live DB state. The endpoint still executes nothing.
  const contextString = backlogOverride ?? ctx.contextString

  const statusNames = statusList.map((s: any) => `${s.name}${s.is_closed ? ' (closed)' : s.is_open ? ' (default)' : ''}`).join(', ')
  const priorityInfo = priorityList.map((p: any) => `${p.value}:${p.label}${p.is_urgent ? ' (URGENT)' : ''}`).join(', ')

  let uiCatalog = ''
  try {
    uiCatalog = fs.readFileSync(path.join(process.cwd(), 'docs/ui-catalog.md'), 'utf8')
  } catch { /* ignore */ }

  const projectHealthContext = backlogOverride ? '' : ctx.projectHealthContext
  const nextStepContext = backlogOverride ? '' : ctx.nextStepContext
  const ticketStatusRoutingHint = buildTicketStatusRoutingHint(input, history, true)

  // Build system prompt (same structure as orbConverse), split into a stable
  // block (byte-identical across every case in a run — the prompt-cache prefix)
  // and a dynamic block (per-case: scope, fixtures, voice config). Mirrors
  // production's stablePrompt/dynamicPrompt boundary in orb-converse.ts so the
  // eval harness exercises the same prompt shape it asserts against. The 40-case
  // suite runs well inside the cache's 5-minute TTL, so the stable block is
  // written once and read by every subsequent case.
  const stableSystemPrompt = [
    `You are the voice of the orb — the conversational layer of Orb.`,
    buildVoicePrompt('natural'),
    ORB_PRINCIPLES,
    ORB_RESOLUTION_LAWS,
    ORB_FOUNDATIONAL_DEFINITIONS,
    `VALID VALUES: Statuses: ${statusNames} | Priorities: ${priorityInfo}`,
    STATUS_VOCABULARY,
    `The BACKLOG below gives a SUMMARY line for each project and then separates ACTIVE from PARKED. When answering counts or project-health questions, copy the SUMMARY counts exactly; do not recalculate by counting visible lines. When the user asks "how many tasks" or "my tasks" without specifying, report the active_count. If parked_count is above zero, mention it separately. If you list tasks, make sure the number you claim matches the number of listed items, or say "including" instead of implying a complete list.`,
    buildUrgencyRules(24),
    ORB_QUERY_ROUTING,
    `REPOSITORY ACCESS: You may inspect the local working tree with query_repository source="local", or the current Vercel deployment with source="production".`,
    `DATABASE SCHEMA (for query_db):\n${DB_SCHEMA}`,
    uiCatalog ? `UI CATALOG & NAVIGATION:\n${uiCatalog}` : '',
    ORB_SCOPE_RULES,
    ORB_SESSION_ADAPTATION,
    ORB_SELF_DIAGNOSTICS,
    ORB_STRATEGIC_REASONING,
    ORB_NEXT_STEP_READ,
    ORB_PROJECT_HEALTH_SUMMARY,
    buildCoachingPrompt('natural'),
    ORB_PREFERENCE_DISCOVERY,
    ORB_COMMITMENT_INTEGRITY,
    ORB_ADAPTATION_BEHAVIOR,
    `INSIGHT TAGGING:
When you surface proactive observation, coaching, or strategic recommendation content, wrap only that sentence or short paragraph in one marker pair:
[INSIGHT:observation]...[/INSIGHT], [INSIGHT:coaching]...[/INSIGHT], or [INSIGHT:strategic]...[/INSIGHT].
Use observation for backlog facts worth noticing, coaching for work-rhythm guidance, and strategic for "what should I work on" recommendations. Do not wrap ordinary confirmations, errors, or direct answers with no proactive guidance.`,
    buildProactiveTonePrompt('natural'),
    ORB_ATTRIBUTION,
    ORB_MUTATION_VERIFICATION,
    buildFeedbackTonePrompt('natural'),
    ORB_DEV_CHANNEL_PROMPT,
  ].filter(Boolean).join('\n\n')

  const dynamicSystemPrompt = [
    `CURRENT DATE: ${new Date().toISOString().split('T')[0]}`,
    `USER CONTEXT: You are talking to ${auth.user.email} (Name: ${auth.user.name || 'Unknown'}, Role: ${auth.role}).`,
    buildOrbScopePrompt({
      currentProjectName: current.name,
      currentUserNameOrEmail: auth.user.name || auth.user.email,
    }),
    ticketStatusRoutingHint,
    voiceMode ? buildVoiceConversationPrompt({ ttsProvider, ttsModel, ttsVoiceId }) : '',
    `BACKLOG:\n${contextString}`,
    projectHealthContext,
    nextStepContext,
    `KNOWLEDGE BASE (Recent):\n${knowledgeList.slice(0, 5).map((k: any) => {
      const tags = (k.tags && k.tags.length > 0) ? ` [${k.tags.join(', ')}]` : ''
      return `- [${k.projects?.name ?? k.projects?.code ?? '?'}] ${k.title}${tags}: ${k.content.slice(0, 100)}...`
    }).join('\n')}`,
    `WHAT'S NEW:\n${CHANGELOG.slice(0, 3).map(r => `${r.version} (${r.date}):\n${r.changes.map(c => `  - ${c}`).join('\n')}`).join('\n\n')}`,
    buildMutationApprovalPrompt(preferenceList),
    behaviorRuleList.length > 0
      ? `BEHAVIORAL RULES (agreed with the user — always enforce):\n${behaviorRuleList.map((r: any) => `- **${r.title}:** ${r.content}`).join('\n')}`
      : '',
    buildPreferencesPrompt(preferenceList),
    buildAdaptationsPrompt(ctx.adaptationList),
    buildObservationsPrompt(ctx.observations, ctx.guidanceLevel),
    buildMemoryPrompt(ctx.memoryList, 'full'),
    ORB_MEMORY_BEHAVIOR,
  ].filter(Boolean).join('\n\n')

  const systemPrompt = `${stableSystemPrompt}\n\n${dynamicSystemPrompt}`

  const messages: any[] = [
    ...(history?.map(h => ({ role: h.role, content: h.text })) ?? []),
    { role: 'user', content: input },
  ]
  // Mirror production's record-state transparency note (orb-converse.ts).
  if ((history ?? []).length === 0) {
    messages.push({ role: 'user', content: ORB_NO_SESSION_RECORD_NOTE })
  }
  if (ticketStatusRoutingHint) {
    messages.push({ role: 'user', content: `[SYSTEM: This note applies to the user's latest message. ${ticketStatusRoutingHint}]` })
  }
  const disambiguationInstruction = inferProjectDisambiguationInstruction(history, input)
  if (disambiguationInstruction) messages.push({ role: 'user', content: disambiguationInstruction })

  // Mirror production's server-held pending-mutation injection (lib/orb-mutations.ts flow).
  if (pendingSummary) {
    messages.push({ role: 'user', content: buildPendingMutationConfirmationInstruction(pendingSummary) })
  }

  try {
    const routeRole = autoRoute
      ? routeOrbRequest(input, true, true)
      : 'operational'
    if (voiceMode && isBroadProjectStateQuestion(input)) {
      return NextResponse.json({
        speech: buildVoiceProjectStateSummary({ ...ctx, input }),
        toolCalls: [],
        stopReason: 'deterministic_voice_project_state',
        tokenUsage: { input_tokens: 0, output_tokens: 0 },
        routeRole,
      })
    }
    const undercount = pendingTodoUndercount(input, pendingTodoOperations)
    if (undercount) {
      const lines = pendingTodoOperations!.map(operation => `- create "${String(operation.params.title ?? 'untitled')}"`)
      return NextResponse.json({
        speech: `There are already ${undercount.actual} todos in the pending set, not ${undercount.claimed}:\n\n${lines.join('\n')}\n\nConfirm these ${undercount.actual}, or tell me which one to change.`,
        toolCalls: [],
        stopReason: 'deterministic_pending_todo_count_correction',
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
    const strategicContextPacket = contextPacket ? buildStrategicContextPacket(contextPacket) : null
    const frozenStrategicPrompt = strategicContextPacket
      ? renderStrategicEvaluationPrompt(strategicContextPacket)
      : null
    const evalSystemPrompt = isStrategicEvaluation
      ? frozenStrategicPrompt ?? `${systemPrompt}\n\nEVALUATION MODE: This is a strategic-quality comparison. The supplied BACKLOG, audit context, memories, and preferences are complete for this answer. Do not call tools. Analyze the supplied evidence directly, state uncertainty when warranted, and give your best strategic response.`
      : systemPrompt
    const confirmMutationAllowed = isStrategicEvaluation
      ? false
      : Boolean(pendingSummary) && (await authorizesPendingMutation(input))
    const tools = isStrategicEvaluation
      ? []
      : [
          ...ORB_TOOLS.filter(tool => tool.name !== 'confirm_mutation' || confirmMutationAllowed),
          ...ORB_PREFERENCE_TOOLS,
          ...ORB_MEMORY_TOOLS,
          ORB_CAPABILITIES_TOOL,
          ORB_DEV_CHANNEL_TOOL,
          ORB_ADAPTATION_TOOL,
        ] as any[]
    // Eval model choice is deliberately independent of production role routing:
    // routeRole still verifies operational vs strategic classification. The
    // routine default mirrors production's model (see lib/orb-model/eval-defaults);
    // each provider branch below falls back to its own model, never another's.
    const requestedProvider = provider ?? ORB_EVAL_DEFAULT_PROVIDER
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
        // Mirror production's cache split (orb-converse.ts): breakpoint after the
        // stable block so all cases in a run share one cached prefix. Strategic
        // evals replace the whole prompt (frozen packet / mode suffix), so they
        // keep the single-string form — rare and usually routed to Gemini anyway.
        system: isStrategicEvaluation
          ? evalSystemPrompt
          : [
              { type: 'text' as const, text: stableSystemPrompt, cache_control: { type: 'ephemeral' as const } },
              { type: 'text' as const, text: dynamicSystemPrompt },
            ],
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
    speech = sanitizeUserFacingSpeech(speech)

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
          contextPacketVersion: strategicContextPacket?.version ?? 'live-context-v1',
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
      `${(history ?? []).map(h => h.text).join(' ')} ${input} ${todoList.map((todo: any) => todoCode(todo, productList)).join(' ')} ${strategicContextPacket?.backlog ?? ''} ${contextString}`,
    )
    // Codes this response's own tool calls are working with count as
    // legitimate provenance too — a delete_todo call citing TEST-1 in its
    // params isn't a phantom code just because TEST-1 wasn't in history.
    const toolProducedCodes = new Set<string>()
    for (const tc of toolCalls) {
      for (const key of ['code', 'old_code', 'new_code'] as const) {
        const value = tc.params?.[key]
        if (typeof value === 'string') toolProducedCodes.add(value.toUpperCase())
      }
    }
    // Single-shot harness: this response's own tool calls are the whole
    // picture (no multi-turn hold/confirm here), so any effectful tool call
    // in THIS response is sufficient evidence something was actually acted on.
    const hasActed = toolCalls.some(tc => EFFECTFUL_TOOL_NAMES.has(tc.name))
    if (isFalseCompletionClaim(speech, toolProducedCodes, historyCodes, hasActed)) {
      return NextResponse.json({
        speech: 'I did not actually complete that — no tool call backed it up, so nothing happened.',
        toolCalls: [],
        stopReason: 'blocked_unverified_completion_claim',
        tokenUsage,
        modelUsage,
        routeRole,
        contextPacketVersion: strategicContextPacket?.version ?? null,
        contextPacketId: strategicContextPacket?.packetId ?? null,
      })
    }

    return NextResponse.json({
      speech,
      toolCalls,
      stopReason,
      tokenUsage,
      modelUsage,
      routeRole,
      contextPacketVersion: strategicContextPacket?.version ?? null,
      contextPacketId: strategicContextPacket?.packetId ?? null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
