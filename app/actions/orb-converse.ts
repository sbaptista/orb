'use server'

import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { createStreamableValue } from 'ai/rsc'
import { headers } from 'next/headers'
import { getAuthContext } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'
import { ORB_TOOLS, ORB_TOOL_LABELS } from '@/lib/orb-contract'
import { ORB_PRINCIPLES, ORB_RESOLUTION_LAWS, ORB_FOUNDATIONAL_DEFINITIONS, ORB_NO_SESSION_RECORD_NOTE, ORB_ATTRIBUTION, ORB_MUTATION_VERIFICATION, ORB_QUERY_ROUTING, ORB_SCOPE_RULES, ORB_SESSION_ADAPTATION, ORB_PREFERENCE_DISCOVERY, ORB_COMMITMENT_INTEGRITY, ORB_SELF_DIAGNOSTICS, ORB_PROJECT_HEALTH_SUMMARY, ORB_NEXT_STEP_READ, buildVoicePrompt, buildVoiceConversationPrompt, buildFeedbackTonePrompt, buildProactiveTonePrompt, buildCoachingPrompt, buildUrgencyRules, buildOrbScopePrompt, buildPreferencesPrompt, buildObservationsPrompt, buildMutationApprovalPrompt, buildMemoryPrompt, buildAdaptationsPrompt, ORB_MEMORY_BEHAVIOR, ORB_STRATEGIC_REASONING, ORB_ADAPTATION_BEHAVIOR, ORB_ADAPTATION_TOOL, ORB_PREFERENCE_TOOLS, ORB_MEMORY_TOOLS, ORB_CAPABILITIES_TOOL, ORB_DEV_CHANNEL_TOOL, ORB_DEV_CHANNEL_PROMPT, getCapabilities, VALID_PREFERENCE_KEYS } from '@/lib/orb-prompt'
// computeInsights suspended — code preserved in lib/insights.ts for future use
import { resolveProjectByReference } from '@/lib/projects'
import { isActive, isParked, STATUS_VOCABULARY } from '@/lib/status-groups'
import { computeUrgency, type Urgency } from '@/lib/orb-state'
import { checkAndNotifyEscalation, snapshotUrgency } from '@/lib/push'
import { createTicket, getTickets } from '@/app/actions/ticket-actions'
import { sendAdaptationEmail } from '@/lib/email'
import { createAdminClient } from '@/lib/supabase/admin'

import { VERSION } from '@/lib/version'
import { PROJECT_MUTATIONS, KNOWLEDGE_MUTATIONS, getPendingMutation, storePendingMutation, clearPendingMutation, proposeProjectMutation, proposeKnowledgeMutation, executePendingProjectMutation, executePendingKnowledgeMutation, resolveKnowledgeReference, type PendingMutationRow } from '@/lib/orb-mutations'
import { DB_SCHEMA, ALLOWED_TABLES, SOFT_DELETE_TABLES, ALLOWED_OPS, COLUMN_NAME_RE } from '@/lib/db-schema'
import { fuzzyMatch, scoreTextMatch } from '@/lib/fuzzy-search'
import { CHANGELOG } from '@/lib/changelog'
import { queryRepository } from '@/lib/repository-reader'
import { normalizeAnthropicUsage } from '@/lib/orb-model/anthropic'
import { completeGeminiEvaluation } from '@/lib/orb-model/gemini'
import { recordOrbModelRequest } from '@/lib/orb-model/record'
import { getRuntimeOrbAiPolicy } from '@/lib/orb-model/runtime-policy'
import { routeOrbRequest, type OrbRouteRole } from '@/lib/orb-model/routing'
import { checkOrbBudget, budgetBlockMessage } from '@/lib/orb-model/budget'
import { classifyProviderFailure, notifyOrbIncident } from '@/lib/orb-model/incidents'
import type { OrbModelProviderId } from '@/lib/orb-model/types'
import { extractCitedCodes, isFalseCompletionClaim } from '@/lib/orb-model/false-claim-guard'
import { buildOrbContext, buildTicketStatusRoutingHint, buildVoiceProjectStateSummary, isBroadProjectStateQuestion, pendingTodoUndercount, resolveActionSetReference, todoCode } from '@/lib/orb-model/context'
import { sanitizeUserFacingSpeech } from '@/lib/orb-model/speech-sanitizer'

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export type PendingMutationOperation = { tool: string; params: Record<string, any> }

export type PendingMutation =
  | { tool: string; params: Record<string, any> }
  | { kind: 'todo_action_transaction'; operations: PendingMutationOperation[]; summary: string }

export type ActionSet = {
  id: string
  kind: 'todo_set'
  tool: string
  ordinal: number
  codes: string[]
  summary: string
  createdAt: string
}

export type OrbResponse = {
  speech: string
  insight?: { type: 'observation' | 'coaching' | 'strategic'; summary: string }
  thought?: string // A discrete "work step" completed by the Orb
  refresh?: boolean
  mutatedProductId?: string
  mutationType?: 'create' | 'update' | 'delete' | 'project_create' | 'project_update' | 'project_delete' | 'dormancy' | 'knowledge_update'
  clientAction?: { action: string; target?: string }
  error?: string
  isServiceError?: boolean // True when the error is a service-level issue (billing, overloaded, network)
  isStreaming?: boolean
  suggestedKnowledge?: { id: string; productId: string; title: string; suggestion: { title: string; content: string } }
  knowledgeResults?: Array<{ title: string; content: string; code?: string }>
  newProject?: { id: string; name: string; code: string; description: string | null; created_by: string }
  pendingMutation?: PendingMutation
  actionSet?: ActionSet
}

type OrbInsight = NonNullable<OrbResponse['insight']>

// ── Structural mutation gate ──
// CRUD mutations are held until the user confirms. The server intercepts the
// tool call, feeds a "held" result to the AI (so it proposes the action),
// and returns a pendingMutation to the client. On the next turn, if the
// client sends back the same pendingMutation, the tool is allowed to execute.
// LEGACY (todos only). Project mutations use the server-held propose/confirm/execute
// flow in lib/orb-mutations.ts. Todos migrate to that flow in a follow-up pass.
const GATED_MUTATIONS = new Set([
  'create_todo', 'update_todo', 'delete_todo', 'move_todo',
])

// ── Structural mutation guard (false-claim detection) ──
// Instead of guessing intent from user input (fragile regex), we check what
// actually happened: did the model cite a task/project code that no tool
// produced, or claim completion language when nothing actually ran? See
// ORB-288 and lib/orb-model/false-claim-guard.ts for the design rationale —
// shared with the eval mirror so the two can't silently drift apart again
// (they had: eval had the completion-language check, production never did,
// which is exactly how a false switch_project claim shipped undetected).

function pendingTodoOperations(pending: PendingMutation | undefined): PendingMutationOperation[] {
  if (!pending) return []
  if ('kind' in pending && pending.kind === 'todo_action_transaction') return pending.operations
  if ('tool' in pending) return [{ tool: pending.tool, params: pending.params }]
  return []
}

// Voice transcripts often stack or repeat affirmations ("Confirm confirm",
// "yes go ahead", "okay do it"). Accept any input made up solely of
// affirmation phrases, in any combination — mixed content still falls
// through to the model.
function isBareAffirmation(input: string): boolean {
  return /^(?:(?:yes|yep|yeah|yup|sure|okay|ok|go ahead|do it|go|confirmed|confirm|please do|please|sounds good|that['’]?s right|that is right)[,.!\s]*)+$/i.test(input.trim())
}

function isBareDecline(input: string): boolean {
  return /^(?:(?:no|nope|nah|cancel|stop|don['’]?t|do not|never mind|nevermind|leave it|skip it|forget it)[,.!\s]*)+$/i.test(input.trim())
}

// The user granted permission up front, in the same message that asked for
// the action ("you have my permission", "no need to confirm"). Execute the
// held operations directly instead of asking them to confirm again.
function grantsUpfrontPermission(input: string): boolean {
  return /\b(?:you have my permission|i give you (?:my )?permission|you(?:'re| are) authorized|no need to (?:ask|confirm|check)|without (?:asking|confirming|confirmation)|don['’]?t ask(?: me)?(?: for confirmation| to confirm)?|just do it)\b/i.test(input)
}

function isPendingStatusQuestion(input: string): boolean {
  return /\?*\s*$/i.test(input.trim())
    && /\b(is it|did it|was it|are they|did they|has it|have they)\b/i.test(input)
    && /\b(set|done|created|updated|deleted|changed|moved|saved|finished|complete|completed)\b/i.test(input)
}

function todoActionNoun(tool: string): string {
  if (tool === 'create_todo') return 'create'
  if (tool === 'update_todo') return 'update'
  if (tool === 'delete_todo') return 'delete'
  if (tool === 'move_todo') return 'move'
  return tool
}

function joinNatural(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

function formatMutationSummaries(summaries: string[]): string {
  const parsed = summaries.map(s => s.match(/^(Created|Updated|Deleted|Moved)\s+(.+)$/))
  const firstVerb = parsed[0]?.[1]
  if (firstVerb && parsed.every(p => p?.[1] === firstVerb)) {
    if (summaries.length > 1) return `${firstVerb.toLowerCase()} ${summaries.length} todos`
    return `${firstVerb.toLowerCase()} ${joinNatural(parsed.map(p => p?.[2] ?? '').filter(Boolean))}`
  }
  return joinNatural(summaries)
}

function isDeleteRequest(input: string): boolean {
  return /\b(delete|remove|clear|trash|get rid of)\b/i.test(input)
}

function inferConfirmedDeleteOpsFromHistory(
  history: Array<{ role: 'user' | 'assistant'; text: string }> | undefined,
  input: string,
): PendingMutationOperation[] {
  if (!isBareAffirmation(input)) return []
  const lastAssistant = [...(history ?? [])].reverse().find(h => h.role === 'assistant')?.text ?? ''
  if (!/\b(confirm|go ahead)\b/i.test(lastAssistant)) return []
  if (!/\b(delete|deleting|remove|removing)\b/i.test(lastAssistant)) return []
  const codes = [...extractCitedCodes(lastAssistant)]
  if (codes.length === 0) return []
  return codes.map(code => ({ tool: 'delete_todo', params: { code } }))
}

function extractInsight(rawSpeech: string): { speech: string; insight?: OrbInsight } {
  const insightPattern = /\[INSIGHT:(observation|coaching|strategic)\]([\s\S]*?)\[\/INSIGHT\]/i
  const match = rawSpeech.match(insightPattern)
  if (!match) return { speech: sanitizeUserFacingSpeech(rawSpeech) }

  const type = match[1].toLowerCase() as OrbInsight['type']
  const summary = match[2].trim()
  const speech = rawSpeech.replace(insightPattern, summary).trim()
  const sanitizedSpeech = sanitizeUserFacingSpeech(speech)
  const sanitizedSummary = sanitizeUserFacingSpeech(summary)
  return sanitizedSummary ? { speech: sanitizedSpeech, insight: { type, summary: sanitizedSummary } } : { speech: sanitizedSpeech }
}

async function getRequestOrigin(): Promise<string | undefined> {
  try {
    const headersList = await headers()
    const host = headersList.get('x-forwarded-host') || headersList.get('host')
    const protocol = headersList.get('x-forwarded-proto') || 'https'
    return host ? `${protocol}://${host}` : undefined
  } catch {
    return undefined
  }
}

export type UIContext = {
  viewMode?: 'list' | 'checklist' | 'kanban'
  filterStatus?: string
  filterPriority?: string
  sortAsc?: boolean
  orbPaneVisible?: boolean
  listPaneVisible?: boolean
  isMobile?: boolean
  daysActive?: number
  voiceMode?: boolean
  availableVoices?: string[]
  currentVoice?: string
  ttsProvider?: string
  ttsModel?: string | null
  ttsVoiceId?: string | null
}

export type OrbRequest = {
  input: string
  productId: string | null
  // scopeToProduct removed — query scope is always global, mutations default to current project
  history?: Array<{ role: 'user' | 'assistant'; text: string }>
  dryRun?: boolean
  roleOverride?: string | null
  uiContext?: UIContext
  simulateError?: 'billing' | 'overloaded' | null
  systemInfo?: { browser: string; os: string; os_version: string; viewport: string } | null
  pendingMutation?: PendingMutation
  actionSets?: ActionSet[]
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

// ──────────────────────────────────────────────────────────────────────────
// Tool Context & Helpers
// ──────────────────────────────────────────────────────────────────────────

function buildSurveyPrompt(daysActive: number | undefined, prefs: Array<{ key: string; value: string }>): string {
  const completed = prefs.find(p => p.key === 'survey_completed')?.value === 'true'
  if (completed || !daysActive || daysActive < 7) return ''

  const stage = prefs.find(p => p.key === 'survey_stage')?.value ?? 'none'

  return `ALPHA USER SURVEY CHECK-IN RULES:
Since the user has been active for ${daysActive} days (>= 7 days) and hasn't completed the survey, you MUST administer the alpha check-in.
The survey consists of 3 questions. Check the current value of survey_stage to determine what to do:

- Current Stage: 'none' (or key not set)
  Action: In your initial response, proactively ask if the user has a moment to answer 3 quick questions about their experience with Orb.
  Example: "Welcome back! Since you've been using Orb for a week now, do you have a quick moment to answer 3 quick feedback questions to help us improve?"
  Save preference "survey_stage" to "offered" using set_preference immediately.

- Current Stage: 'offered'
  - If the user agrees (says "yes", "sure", etc.):
    Action: Present Question 1: "1. **The Ambient Orb:** Does the ambient Orb (its color shifts, pulse rates, and solar flares) actually help you stay aware of your workload without constantly checking lists, or do you ignore it?"
    Save preference "survey_stage" to "q1" using set_preference immediately.
  - If the user declines (says "no", "not now", etc.) or asks about something else:
    Action: Drop the check-in and do not ask again in this turn. Address their query normally.

- Current Stage: 'q1'
  Action: Capture their response to Question 1.
  1. Call tool create_ticket with:
     - type: "suggestion"
     - summary: "Alpha Feedback: Ambient Orb"
     - detail: "User feedback on Ambient Orb (after ${daysActive} days active): [user's raw response text]"
  2. Acknowledge briefly and present Question 2: "2. **Strategic Guidance:** Has the Orb's strategic support—such as asking 'What should I do next?' or receiving proactive summaries—provided genuine value in organizing your day compared to traditional todo lists?"
  3. Save preference "survey_stage" to "q2" using set_preference immediately.

- Current Stage: 'q2'
  Action: Capture their response to Question 2.
  1. Call tool create_ticket with:
     - type: "suggestion"
     - summary: "Alpha Feedback: Strategic Guidance"
     - detail: "User feedback on Strategic Guidance (after ${daysActive} days active): [user's raw response text]"
  2. Acknowledge briefly and present Question 3: "3. **Friction & Bugs:** Did you run into any major friction points or confusing behavior when talking to the Orb, switching between views (List, Checklist, Kanban), or navigating settings?"
  3. Save preference "survey_stage" to "q3" using set_preference immediately.

- Current Stage: 'q3'
  Action: Capture their response to Question 3.
  1. Call tool create_ticket with:
     - type: "suggestion"
     - summary: "Alpha Feedback: Friction & Bugs"
     - detail: "User feedback on Friction & Bugs (after ${daysActive} days active): [user's raw response text]"
  2. Thank the user warmly for their valuable time.
  3. Save preference "survey_completed" to "true" AND save preference "survey_stage" to "completed" using set_preference immediately.

IMPORTANT: Do not skip stages. Set the preference immediately when you present the question so that the stage updates. Focus on one question at a time. Be conversational and human.`
}

export async function orbConverse(req: OrbRequest) {
  const stream = createStreamableValue<OrbResponse>()

  ;(async () => {
    let accumulatedSpeech = ''
    let metricToolCalls = 0
    const metricInputChars = req.input?.length ?? 0
    const metricVoiceMode = !!req.uiContext?.voiceMode
    let metricUserId: string | null = null
    let metricInputTokens = 0
    let metricOutputTokens = 0
    let metricCacheCreationTokens = 0
    let metricCacheReadTokens = 0
    let metricModel = 'claude-haiku-4-5'
    let metricProvider: OrbModelProviderId = 'anthropic'
    let metricRouteRole: OrbRouteRole = 'operational'
    const requestStartedAt = Date.now()
    let requestRecorded = false
    let providerInvocationStarted = false

    function recordMetrics(speechChars: number) {
      if (!metricUserId) return
      const admin = createAdminClient()
      admin.rpc('upsert_orb_metric', {
        p_user_id: metricUserId,
        p_speech_chars: speechChars,
        p_voice_speech_chars: metricVoiceMode ? speechChars : 0,
        p_input_chars: metricInputChars,
        p_tool_call_count: metricToolCalls,
        p_ambient_chars: 0,
        p_input_tokens: metricInputTokens,
        p_output_tokens: metricOutputTokens,
        p_cache_creation_input_tokens: metricCacheCreationTokens,
        p_cache_read_input_tokens: metricCacheReadTokens,
        p_model: metricModel,
      }).then(({ error }) => {
        if (error) console.error('[orbConverse] Metric upsert failed:', error.message)
      })
    }

    function recordModelRequest(responseText: string) {
      if (!metricUserId || requestRecorded) return
      requestRecorded = true
      const usage = normalizeAnthropicUsage({
        input_tokens: metricInputTokens,
        output_tokens: metricOutputTokens,
        cache_creation_input_tokens: metricCacheCreationTokens,
        cache_read_input_tokens: metricCacheReadTokens,
      } as any, {
        model: metricModel,
        source: 'conversation',
        latencyMs: Date.now() - requestStartedAt,
        clientToolCalls: metricToolCalls,
      })
      recordOrbModelRequest(createAdminClient(), {
        userId: metricUserId,
        usage,
        routeRole: metricRouteRole,
        promptVersion: 'orb-system-v0.6.49',
        contextPacketVersion: 'live-context-v1',
        responseText,
      }).catch(error => console.error('[orbConverse] Model request ledger insert failed:', error))
    }

    try {
      const auth = await getAuthContext()
      metricUserId = auth.user.id

      // DEV-only error simulation — throws synthetic errors to test error UX
      if (process.env.NODE_ENV === 'development' && req.simulateError) {
        const syntheticErrors: Record<string, any> = {
          billing: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' },
          overloaded: { type: 'overloaded_error', message: 'Overloaded' },
        }
        const err = syntheticErrors[req.simulateError]
        if (err) {
          providerInvocationStarted = true
          throw Object.assign(new Error(err.message), { type: err.type })
        }
      }

      const supabase = auth.supabase
      const ctx = await buildOrbContext(supabase, auth, { currentProductId: req.productId })
      const aiPolicy = await getRuntimeOrbAiPolicy()

      let uiCatalog = ''
      try {
        const catalogPath = path.join(process.cwd(), 'docs/ui-catalog.md')
        uiCatalog = fs.readFileSync(catalogPath, 'utf8')
      } catch (err) {
        console.error('[orbConverse] Failed to read ui-catalog.md:', err)
      }
      const beforeUrgency = await snapshotUrgency(supabase, auth.user.id)
      let hasMutated = false
      // True once ANY tool call in this request actually took effect — a
      // superset of hasMutated (data mutations) that also includes
      // client_action successes. Used only to gate the false-completion-claim
      // check below; kept separate from hasMutated so navigation actions
      // don't spuriously trigger the urgency-escalation check, which is
      // specifically about data mutations. A held-but-not-executed
      // GATED_MUTATIONS call does NOT set this — being held isn't being done.
      let hasActed = false
      const statusNames = ctx.statusList.map((s: any) => `${s.name}${s.is_closed ? ' (closed)' : s.is_open ? ' (default)' : ''}`).join(', ')
      const priorityInfo = ctx.priorityList.map((p: any) => `${p.value}:${p.label}${p.is_urgent ? ' (URGENT)' : ''}`).join(', ')

      function describeTodoOperation(op: PendingMutationOperation): string {
        const input = op.params
        if (op.tool === 'create_todo') {
          const product = input.product_code
            ? ctx.productList.find((p: any) => p.code?.toUpperCase() === String(input.product_code).toUpperCase())
            : ctx.current
          const projectName = product?.name ?? input.product_code ?? ctx.current?.name ?? 'the current project'
          return `create "${input.title ?? 'Untitled'}" in ${projectName}`
        }
        if (op.tool === 'update_todo') {
          const changes: string[] = []
          if (input.new_title) changes.push(`title to "${input.new_title}"`)
          if (input.new_status) changes.push(`status to ${input.new_status}`)
          if (input.new_priority !== undefined) {
            const priority = ctx.priorityList.find((p: any) => p.value === input.new_priority)
            changes.push(`priority to ${priority?.label ?? input.new_priority}`)
          }
          if (input.description !== undefined) changes.push('description')
          if (input.due_at !== undefined) changes.push(input.due_at ? `due date to ${input.due_at}` : 'clear due date')
          return `update ${input.code}${changes.length ? ` (${changes.join(', ')})` : ''}`
        }
        if (op.tool === 'delete_todo') return `delete ${input.code}`
        if (op.tool === 'move_todo') return `move ${input.code} to ${input.target_project_code}`
        return `${todoActionNoun(op.tool)} a todo`
      }

      function summarizeTodoOperations(ops: PendingMutationOperation[]): string {
        if (ops.length === 1) return describeTodoOperation(ops[0])
        const grouped = new Map<string, PendingMutationOperation[]>()
        for (const op of ops) {
          grouped.set(op.tool, [...(grouped.get(op.tool) ?? []), op])
        }
        const projectCodes = new Set(ops.map(op => {
          if (op.tool === 'create_todo') return op.params.product_code ? String(op.params.product_code).toUpperCase() : ctx.current?.code
          if (op.params.code) return String(op.params.code).split('-')[0]?.toUpperCase()
          if (op.params.target_project_code) return String(op.params.target_project_code).toUpperCase()
          return null
        }).filter(Boolean))
        const projectCode = projectCodes.size === 1 ? [...projectCodes][0] : ''
        const projectScope = projectCode
          ? ctx.productList.find((project: any) => project.code?.toUpperCase() === projectCode)?.name ?? projectCode
          : ''
        if (grouped.size === 1 && grouped.has('create_todo')) {
          return `create ${ops.length} todos${projectScope ? ` in ${projectScope}` : ''}`
        }
        if (grouped.size === 1 && grouped.has('update_todo')) {
          return `update ${ops.length} todos${projectScope ? ` in ${projectScope}` : ''}`
        }
        if (grouped.size === 1 && grouped.has('delete_todo')) {
          return `delete ${ops.length} todos${projectScope ? ` from ${projectScope}` : ''}`
        }
        if (grouped.size === 1 && grouped.has('move_todo')) {
          return `move ${ops.length} todos${projectScope ? ` from ${projectScope}` : ''}`
        }
        return ops.map((op, i) => `${i + 1}. ${describeTodoOperation(op)}`).join('; ')
      }

      // Itemize the exact targets under a confirm message. The operator
      // contract: voice speaks the compact summary, the transcript carries
      // the audit detail. Large sets show a capped preview plus the total —
      // the user always sees what a "yes" will do, without a 1,000-line list.
      const CONFIRM_LIST_MAX = 10
      function listTodoOperationLines(ops: PendingMutationOperation[]): string {
        const lines = ops.slice(0, CONFIRM_LIST_MAX).map(op => {
          const p = op.params ?? {}
          if (op.tool === 'create_todo') {
            const projectCode = p.product_code ? String(p.product_code).toUpperCase() : ctx.current?.code
            const project = ctx.productList.find((candidate: any) => candidate.code?.toUpperCase() === projectCode)?.name ?? projectCode
            return `- create "${p.title ?? 'untitled'}"${project ? ` in ${project}` : ''}`
          }
          const code = p.code ? String(p.code).toUpperCase() : '?'
          const todo = ctx.todoList.find((t: any) => todoCode(t, ctx.productList).toUpperCase() === code)
          const title = todo?.title ? ` — ${todo.title}` : ''
          if (op.tool === 'delete_todo') return `- delete ${code}${title}`
          if (op.tool === 'move_todo') return `- move ${code}${title} to ${p.target_project_code ?? '?'}`
          return `- ${describeTodoOperation(op)}${title}`
        })
        if (ops.length > CONFIRM_LIST_MAX) {
          lines.push(`…and ${ops.length - CONFIRM_LIST_MAX} more (${ops.length} total)`)
        }
        return lines.join('\n')
      }

      async function executeTodoOperation(op: PendingMutationOperation): Promise<{
        ok: true
        summary: string
        code?: string
        old_code?: string
        new_code?: string
        mutatedProductId?: string
        mutationType: 'create' | 'update' | 'delete'
      } | { ok: false; summary: string; error: string }> {
        const input = op.params

        if (op.tool === 'create_todo') {
          if (!input.title) return { ok: false, summary: 'Create failed', error: 'title is required' }
          const product = input.product_code
            ? ctx.productList.find((p: any) => p.code?.toUpperCase() === String(input.product_code).toUpperCase())
            : ctx.productList.find((p: any) => p.id === req.productId)
          if (!product) return { ok: false, summary: 'Create failed', error: 'project not found' }
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
          if (error) return { ok: false, summary: `Create "${input.title}" failed`, error: error.message }
          const code = `${product.code}-${data.todo_number}`
          await logAuditEvent({
            action: 'todo_create',
            table_name: 'todos',
            record_id: data.id,
            after: { code, title: input.title, priority_value: input.priority_value ?? null, due_at: input.due_at ?? null },
            actor: 'orb',
            user_id: auth.user.id,
            system_info: req.systemInfo,
          })
          return { ok: true, summary: `Created ${code}`, code, mutatedProductId: product.id, mutationType: 'create' }
        }

        if (op.tool === 'update_todo') {
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
          if (!todo) return { ok: false, summary: `Update ${input.code} failed`, error: 'todo not found' }

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
          if (error) return { ok: false, summary: `Update ${input.code} failed`, error: error.message }
          await logAuditEvent({
            action: closingStatus && !todo.closed_at ? 'todo_close' : 'todo_update',
            table_name: 'todos',
            record_id: todo.id,
            before: { status: todo.status, priority_value: todo.priority_value, title: todo.title },
            after: { status: data.status, priority_value: data.priority_value, title: data.title, code: input.code, due_at: data.due_at },
            actor: 'orb',
            user_id: auth.user.id,
            system_info: req.systemInfo,
          })
          return { ok: true, summary: `Updated ${input.code}`, code: input.code, mutatedProductId: todo.product_id, mutationType: 'update' }
        }

        if (op.tool === 'delete_todo') {
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
          if (!todo) return { ok: false, summary: `Delete ${input.code} failed`, error: 'todo not found' }
          const { data: deleted, error } = await supabase.from('todos').delete().eq('id', todo.id).select().maybeSingle()
          if (error) return { ok: false, summary: `Delete ${input.code} failed`, error: error.message }
          if (!deleted) return { ok: false, summary: `Delete ${input.code} failed`, error: 'row was not removed' }
          await logAuditEvent({
            action: 'todo_delete',
            table_name: 'todos',
            record_id: todo.id,
            before: { code: input.code, title: todo.title, status: todo.status },
            actor: 'orb',
            user_id: auth.user.id,
            system_info: req.systemInfo,
          })
          return { ok: true, summary: `Deleted ${input.code}`, code: input.code, mutatedProductId: todo.product_id, mutationType: 'delete' }
        }

        if (op.tool === 'move_todo') {
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
          if (!todo) return { ok: false, summary: `Move ${input.code} failed`, error: 'todo not found' }
          const sourceProject = ctx.productList.find((p: any) => p.id === todo.product_id)
          const moveTargetQuery = supabase.from('projects').select('id, code, name').ilike('code', targetCode)
          if (!auth.isAdmin) moveTargetQuery.eq('created_by', auth.user.id)
          const { data: targetProject } = await moveTargetQuery.maybeSingle()
          if (!targetProject) return { ok: false, summary: `Move ${input.code} failed`, error: `project "${targetCode}" not found` }
          if (targetProject.id === todo.product_id) return { ok: false, summary: `Move ${input.code} failed`, error: 'task is already in that project' }
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
          if (error) return { ok: false, summary: `Move ${input.code} failed`, error: error.message }
          const oldCode = `${sourceProject?.code ?? '???'}-${todo.todo_number}`
          const newCode = `${targetProject.code}-${nextNum}`
          await logAuditEvent({
            action: 'todo_move',
            table_name: 'todos',
            record_id: todo.id,
            before: { code: oldCode, product_code: sourceProject?.code },
            after: { code: newCode, product_code: targetProject.code },
            actor: 'orb',
            user_id: auth.user.id,
            system_info: req.systemInfo,
          })
          return { ok: true, summary: `Moved ${oldCode} to ${newCode}`, old_code: oldCode, new_code: newCode, mutatedProductId: sourceProject?.id, mutationType: 'update' }
        }

        return { ok: false, summary: `${todoActionNoun(op.tool)} failed`, error: `Unsupported todo action: ${op.tool}` }
      }

      async function executeTodoOperationsAndFinish(ops: PendingMutationOperation[], opts?: { preAuthorized?: boolean }): Promise<void> {
        stream.update({ speech: '', thought: opts?.preAuthorized ? 'Going ahead...' : 'Confirming...', isStreaming: true })
        const results = []
        for (const op of ops) {
          const result = await executeTodoOperation(op)
          results.push(result)
          if (result.ok) {
            if (result.code) toolProducedCodes.add(result.code)
            if (result.old_code) toolProducedCodes.add(result.old_code)
            if (result.new_code) toolProducedCodes.add(result.new_code)
            hasMutated = true; hasActed = true
            stream.update({
              speech: '',
              thought: result.summary,
              refresh: true,
              mutatedProductId: result.mutatedProductId,
              mutationType: result.mutationType,
              isStreaming: true,
            })
          }
        }

        const successes = results.filter(r => r.ok)
        const failures = results.filter(r => !r.ok)
        const lastSuccess = successes[successes.length - 1]
        const successSummary = formatMutationSummaries(successes.map(r => r.summary))
        const successCodes = successes.flatMap(r => {
          if (!r.ok) return []
          return [r.code, r.old_code, r.new_code].filter(Boolean) as string[]
        })
        const firstTool = ops[0]?.tool ?? 'todo_action'
        const sameTool = ops.every(op => op.tool === firstTool)
        const actionSet: ActionSet | undefined = successCodes.length > 0
          ? {
              id: `todo_set_${Date.now()}`,
              kind: 'todo_set',
              tool: sameTool ? firstTool : 'mixed',
              ordinal: (req.actionSets?.length ?? 0) + 1,
              codes: successCodes,
              summary: successSummary,
              createdAt: new Date().toISOString(),
            }
          : undefined
        const speech = failures.length === 0
          ? opts?.preAuthorized
            ? `You'd given me the go-ahead, so it's done — ${successSummary}.`
            : `Done — ${successSummary}.`
          : successes.length > 0
            ? `Partially done — ${successSummary}. ${failures.map(r => `${r.summary}: ${r.error}`).join('; ')}.`
            : `I couldn't complete that — ${failures.map(r => `${r.summary}: ${r.error}`).join('; ')}.`

        if (hasMutated) {
          checkAndNotifyEscalation(auth.user.id, beforeUrgency, supabase)
            .catch(err => console.error('[orbConverse] Push check failed:', err))
        }
        recordModelRequest(speech)
        recordMetrics(speech.length)
        stream.done({
          speech,
          isStreaming: false,
          refresh: successes.length > 0,
          mutatedProductId: lastSuccess && lastSuccess.ok ? lastSuccess.mutatedProductId : undefined,
          mutationType: lastSuccess && lastSuccess.ok ? lastSuccess.mutationType : undefined,
          actionSet,
        })
      }

      const openness = ctx.preferenceList.find(p => p.key === 'openness')?.value ?? 'natural'
      const memoryLevel = ctx.preferenceList.find(p => p.key === 'memory_level')?.value ?? 'full'

      const userRole = req.roleOverride || auth.role
      const availableOrbTools = ORB_TOOLS.filter(tool =>
        (tool.name !== 'query_repository' || auth.canInspectRepository) &&
        (tool.name !== 'query_tickets' || auth.isAdmin)
      )
      const repositoryAccessPrompt = auth.canInspectRepository
        ? process.env.NODE_ENV === 'production'
          ? 'REPOSITORY ACCESS: You may inspect the source bundled with the current production deployment by using query_repository with source="production".'
          : 'REPOSITORY ACCESS: You may inspect both the current local working tree (source="local") and the current Vercel deployment (source="production"). Use the source the user asks about; default to local for implementation questions asked on localhost.'
        : 'REPOSITORY ACCESS: This user is not an Admin, Super Admin, or Developer. You cannot inspect source code for them.'
      const ticketToolAccessPrompt = auth.isAdmin
        ? ''
        : 'TICKET ACCESS: The CURRENT USER (not you — Orb has no admin/non-admin identity of its own, only the user does) is not an Admin, so query_tickets (the full admin tool, sees every ticket) is not available to them. But they CAN see tickets they filed themselves, including ones you filed on their behalf via create_ticket — use query_db with table="tickets" for this; RLS automatically scopes the results to their own reported_by rows, so no explicit filter is needed. When explaining this scoping, phrase it about THEM — "you\'re not an admin", "your account doesn\'t have admin access" — never "I am not an admin" or "I am non-admin"; you are never the one being permission-checked. Only refuse (and suggest checking with an admin) if they ask about tickets broadly across all users, or about another specific user\'s ticket.'
      const ticketStatusRoutingHint = buildTicketStatusRoutingHint(req.input, req.history, auth.isAdmin)

      if (req.uiContext?.voiceMode && isBroadProjectStateQuestion(req.input)) {
        const speech = buildVoiceProjectStateSummary({ ...ctx, input: req.input })
        recordModelRequest(speech)
        recordMetrics(speech.length)
        stream.done({ speech, isStreaming: false })
        return
      }

      const toolProducedCodes = new Set<string>()
      const historyCodes = extractCitedCodes(
        (req.history ?? []).map(h => h.text).join(' ') + ' ' + req.input
        + ' ' + ctx.todoList.map((t: any) => todoCode(t, ctx.productList)).join(' ')
        // ctx.contextString is the static BACKLOG/RECENT TICKETS block injected into
        // every system prompt — a code cited straight from it (e.g. a ticket code
        // answered without calling query_tickets, which is legitimate) is not a
        // phantom citation just because no tool produced it this turn.
        + ' ' + ctx.contextString
      )

      const pendingTodoOps = pendingTodoOperations(req.pendingMutation)
      if (pendingTodoOps.length > 0) {
        const pendingSummary = 'summary' in req.pendingMutation! && req.pendingMutation.summary
          ? req.pendingMutation.summary
          : summarizeTodoOperations(pendingTodoOps)

        if (isBareDecline(req.input)) {
          const speech = `Okay — I did not ${pendingSummary}.`
          recordModelRequest(speech)
          recordMetrics(speech.length)
          stream.done({ speech, isStreaming: false })
          return
        }

        if (isPendingStatusQuestion(req.input)) {
          const speech = `Not yet — I was waiting for your go-ahead to ${pendingSummary}. Want me to do it?`
          recordModelRequest(speech)
          recordMetrics(speech.length)
          stream.done({ speech, isStreaming: false, pendingMutation: req.pendingMutation })
          return
        }

        if (isBareAffirmation(req.input)) {
          await executeTodoOperationsAndFinish(pendingTodoOps)
          return
        }

        const undercount = pendingTodoUndercount(req.input, pendingTodoOps)
        if (undercount) {
          const speech = `There are already ${undercount.actual} todos in the pending set, not ${undercount.claimed}:\n\n${listTodoOperationLines(pendingTodoOps)}\n\nConfirm these ${undercount.actual}, or tell me which one to change.`
          recordModelRequest(speech)
          recordMetrics(speech.length)
          stream.done({ speech, isStreaming: false, pendingMutation: req.pendingMutation })
          return
        }
      }

      const confirmedDeleteOps = inferConfirmedDeleteOpsFromHistory(req.history, req.input)
      if (!req.pendingMutation && confirmedDeleteOps.length > 0) {
        await executeTodoOperationsAndFinish(confirmedDeleteOps)
        return
      }

      const referencedSet = resolveActionSetReference(req.input, req.actionSets)
      if (!req.pendingMutation && referencedSet && isDeleteRequest(req.input)) {
        const operations = referencedSet.codes.map(code => ({ tool: 'delete_todo', params: { code } }))
        const summary = summarizeTodoOperations(operations)
        const pending: PendingMutation = {
          kind: 'todo_action_transaction',
          operations,
          summary,
        }
        const speech = `Confirm: ${summary}?\n\n${listTodoOperationLines(operations)}`
        recordModelRequest(speech)
        recordMetrics(speech.length)
        stream.done({ speech, isStreaming: false, pendingMutation: pending })
        return
      }

      const messages: any[] = [
        ...(req.history?.map(h => ({ role: h.role, content: h.text })) ?? []),
        { role: 'user', content: req.input },
      ]

      // Record-state transparency: an empty history means the session record
      // was cleared (update, refresh) or never existed. Say so, keyed to the
      // state — not to any particular phrasing of "the ones you created".
      if ((req.history ?? []).length === 0) {
        messages.push({ role: 'user', content: ORB_NO_SESSION_RECORD_NOTE })
      }
      if (ticketStatusRoutingHint) {
        messages.push({ role: 'user', content: `[SYSTEM: This note applies to the user's latest message. ${ticketStatusRoutingHint}]` })
      }

      // Server-held pending PROJECT mutation (propose/confirm/execute). The client
      // echoes nothing — the server is the source of truth for what's awaiting confirmation.
      const pendingMutation: PendingMutationRow | null = await getPendingMutation(auth.admin, auth.user.id)
      if (pendingMutation) {
        // Consume on load: a pending is confirmable ONLY on the turn directly after it
        // was proposed. Clear it now (the in-memory copy still serves this turn's
        // confirm_mutation) so it can never linger and be confirmed on a later, unrelated
        // turn. If the user doesn't confirm this turn, it's already gone — fail-safe.
        await clearPendingMutation(auth.admin, auth.user.id)
        messages.push({ role: 'user', content: `[SYSTEM: This note applies ONLY if the user's latest message is a bare affirmation (e.g. "yes", "go", "go ahead", "do it", "yep", "confirm" — including stacked repeats like "confirm confirm", common in voice transcripts). If so, they are approving the action you proposed on the previous turn — "${pendingMutation.summary}" — so call confirm_mutation. For ANY other message (a new or changed request, a question, or a decline), ignore this note completely and respond as if it were not here: do not call confirm_mutation, and never mention a pending, held, or previous action to the user.]` })
      }

      const routeRole = routeOrbRequest(req.input, aiPolicy.routingEnabled, aiPolicy.strategicReadsEnabled)
      metricRouteRole = routeRole
      metricProvider = routeRole === 'strategic' ? aiPolicy.strategicProvider : aiPolicy.operationalProvider
      metricModel = routeRole === 'strategic' ? aiPolicy.strategicModel : aiPolicy.operationalModel
      const budgetCheck = await checkOrbBudget(auth.admin, aiPolicy, routeRole)
      if (!budgetCheck.allowed) {
        const speech = budgetBlockMessage(budgetCheck)
        const month = new Date().toISOString().slice(0, 7)
        notifyOrbIncident({
          summary: `Orb ${budgetCheck.scope} budget reached — ${month}`,
          provider: null,
          role: budgetCheck.scope === 'monthly' ? null : routeRole,
          reason: `${budgetCheck.scope === 'monthly' ? 'monthly' : routeRole} budget reached`,
          detail: {
            spent_usd: budgetCheck.spentUsd,
            limit_usd: budgetCheck.limitUsd,
            total_spent_usd: budgetCheck.totalSpentUsd,
            total_limit_usd: budgetCheck.totalLimitUsd,
            total_source: budgetCheck.totalSource,
          },
        }).catch(error => console.error('[orbConverse] Budget incident notification failed:', error))
        stream.done({ speech, isServiceError: true, isStreaming: false })
        return
      }

      let turnCount = 0
      const MAX_TURNS = 5
      let repairedNoToolMutationClaim = false
      const toolErrors: string[] = []
      const heldTodoOperations: PendingMutationOperation[] = []

      // Provenance: every task code the model has actually been shown — the
      // conversation, and (below, per turn) the system prompt and tool results.
      // Mutations may only target shown codes; this is the structural side of
      // the IDENTIFIER PROVENANCE law (codes fabricated by pattern are rejected
      // with a corrective instruction instead of reaching the database).
      const shownCodes = new Set<string>([
        ...extractCitedCodes((req.history ?? []).map(h => h.text).join(' ') + ' ' + req.input),
      ])

      // Heartbeat to open the pipe
      stream.update({ speech: '', isStreaming: true })

      while (turnCount < MAX_TURNS) {
        turnCount++
        // Split system prompt into stable (cacheable) and dynamic blocks
        const stablePrompt = [
          `You are the voice of the orb — the conversational layer of Orb.`,
          buildVoicePrompt(openness),
          ORB_PRINCIPLES,
          ORB_RESOLUTION_LAWS,
          ORB_FOUNDATIONAL_DEFINITIONS,
          `VALID VALUES: Statuses: ${statusNames} | Priorities: ${priorityInfo}`,
          STATUS_VOCABULARY,
          `The BACKLOG below gives a SUMMARY line for each project and then separates ACTIVE from PARKED. When answering counts or project-health questions, copy the SUMMARY counts exactly; do not recalculate by counting visible lines. When the user asks "how many tasks" or "my tasks" without specifying, report the active_count. If parked_count is above zero, mention it separately. If you list tasks, make sure the number you claim matches the number of listed items, or say "including" instead of implying a complete list.`,
          buildUrgencyRules(ctx.urgencyThresholdHours),
          ORB_QUERY_ROUTING,
          repositoryAccessPrompt,
          ticketToolAccessPrompt,
          `DATABASE SCHEMA (for query_db):\n${DB_SCHEMA}`,
          ORB_SCOPE_RULES,
          ORB_SESSION_ADAPTATION,
          ORB_SELF_DIAGNOSTICS,
          ORB_STRATEGIC_REASONING,
          ORB_NEXT_STEP_READ,
          ORB_PROJECT_HEALTH_SUMMARY,
          buildCoachingPrompt(openness),
          ORB_PREFERENCE_DISCOVERY,
          ORB_COMMITMENT_INTEGRITY,
          ORB_ADAPTATION_BEHAVIOR,
          `INSIGHT TAGGING:
When you surface proactive observation, coaching, or strategic recommendation content, wrap only that sentence or short paragraph in one marker pair:
[INSIGHT:observation]...[/INSIGHT], [INSIGHT:coaching]...[/INSIGHT], or [INSIGHT:strategic]...[/INSIGHT].
Use observation for backlog facts worth noticing, coaching for work-rhythm guidance, and strategic for "what should I work on" recommendations. Do not wrap ordinary confirmations, errors, or direct answers with no proactive guidance.`,
          buildProactiveTonePrompt(openness),
          ORB_ATTRIBUTION,
          ORB_MUTATION_VERIFICATION,
          buildFeedbackTonePrompt(openness),
          ORB_DEV_CHANNEL_PROMPT,
        ].filter(Boolean).join('\n\n')

        const dynamicPrompt = [
          `CURRENT DATE: ${new Date().toISOString().split('T')[0]}`,
          ctx.currentUser ? `USER CONTEXT: You are talking to ${ctx.currentUser.email} (Name: ${ctx.currentUser.name || 'Unknown'}, Role: ${userRole || 'Unknown'}).` : '',
          buildOrbScopePrompt({
            currentProjectName: ctx.current?.name,
            currentUserNameOrEmail: ctx.currentUser.name || ctx.currentUser.email,
          }),
          ticketStatusRoutingHint,
          req.uiContext ? `UI STATE: The user is viewing: ${req.uiContext.viewMode ?? 'list'} view | filter: ${req.uiContext.filterStatus ?? 'active'} | priority filter: ${req.uiContext.filterPriority ?? 'all'} | sort: ${req.uiContext.sortAsc ? 'oldest first' : 'newest first'} | orb pane: ${req.uiContext.orbPaneVisible ? 'visible' : 'hidden'} | list pane: ${req.uiContext.listPaneVisible ? 'visible' : 'hidden'} | device: ${req.uiContext.isMobile ? 'mobile' : 'desktop'}. Use this to understand what the user sees when they say "this view", "the list", "that column", etc.` : '',
          req.uiContext?.voiceMode ? buildVoiceConversationPrompt({
            ttsProvider: req.uiContext.ttsProvider,
            ttsModel: req.uiContext.ttsModel,
            ttsVoiceId: req.uiContext.ttsVoiceId,
            currentVoice: req.uiContext.currentVoice,
            availableVoices: req.uiContext.availableVoices,
          }) : '',
          uiCatalog ? `UI CATALOG & NAVIGATION (the layout structure, buttons, views, and settings of the app):\n${uiCatalog}` : '',
          `BACKLOG (includes DORMANT section if any exist — answer dormant project questions from here, do not query):\n${ctx.contextString}`,
          ctx.projectHealthContext,
          ctx.nextStepContext,
          `KNOWLEDGE BASE (Recent):\n${ctx.knowledgeList.slice(0, 5).map((k: any) => {
              const tags = (k.tags && k.tags.length > 0) ? ` [${k.tags.join(', ')}]` : ''
              let origin = ''
              if (k.origin_todo_id) {
                const srcTodo = ctx.todoList.find((t: any) => t.id === k.origin_todo_id)
                if (srcTodo) origin = ` [from: ${todoCode(srcTodo, ctx.productList)}]`
              }
              return `- [${k.projects?.name ?? k.projects?.code ?? '?'}] ${k.title}${tags}${origin}: ${k.content.slice(0, 100)}...`
            }).join('\n')}\n(Note: Use the 'search_knowledge' tool to query the full repository if the answer isn't here.)`,
          `WHAT'S NEW (recent releases — use when the user asks "what's new?", "what changed?", or "what version is this?"):\n${CHANGELOG.slice(0, 3).map(r => `${r.version} (${r.date}):\n${r.changes.map(c => `  - ${c}`).join('\n')}`).join('\n\n')}`,
          buildMutationApprovalPrompt(ctx.preferenceList),
          ctx.behaviorRuleList.length > 0
            ? `BEHAVIORAL RULES (agreed with the user — always enforce):\n${ctx.behaviorRuleList.map((r: any) => `- **${r.title}:** ${r.content}`).join('\n')}`
            : '',
          buildPreferencesPrompt(ctx.preferenceList),
          buildAdaptationsPrompt(ctx.adaptationList),
          buildSurveyPrompt(req.uiContext?.daysActive, ctx.preferenceList),
          buildObservationsPrompt(ctx.observations, ctx.guidanceLevel),
          memoryLevel !== 'off' ? buildMemoryPrompt(ctx.memoryList, memoryLevel) : '',
          memoryLevel !== 'off' ? ORB_MEMORY_BEHAVIOR : '',
          routeRole === 'strategic'
            ? `STRATEGIC READ MODE: The user explicitly asked for strategic guidance. You have no tools and cannot create, update, delete, or otherwise change anything. Base recommendations only on the supplied context, state uncertainty when evidence is incomplete, and wrap the core recommendation in [INSIGHT:strategic]...[/INSIGHT].`
            : '',
        ].filter(Boolean).join('\n\n')

        // Everything in the prompt (backlog, knowledge teasers, changelog) is
        // legitimately "shown" — register its codes for the provenance gate.
        for (const c of extractCitedCodes(stablePrompt + ' ' + dynamicPrompt)) shownCodes.add(c)

        if (turnCount === 1 && routeRole === 'strategic' && metricProvider === 'google') {
          stream.update({ speech: '', thought: 'Preparing strategic read...', isStreaming: true })

          providerInvocationStarted = true
          const strategicResult = await completeGeminiEvaluation({
            model: aiPolicy.strategicModel,
            source: 'strategic_review',
            systemPrompt: [
              stablePrompt,
              dynamicPrompt,
              `STRATEGIC READ MODE: The user explicitly asked for strategic guidance. You have no tools and cannot create, update, delete, or otherwise change anything. Base your recommendations only on the supplied context. State uncertainty when the evidence is incomplete. Give a clear recommendation and briefly explain the trade-off. Wrap the core recommendation in [INSIGHT:strategic]...[/INSIGHT].`,
            ].join('\n\n'),
            messages,
            tools: [],
          })

          if (strategicResult.toolCalls.length > 0) {
            throw new Error('Strategic adviser attempted a tool call despite a no-tools route.')
          }

          metricInputTokens = strategicResult.modelUsage.inputTokens
          metricOutputTokens = strategicResult.modelUsage.outputTokens
          metricCacheCreationTokens = strategicResult.modelUsage.cacheWriteTokens ?? 0
          metricCacheReadTokens = strategicResult.modelUsage.cachedInputTokens ?? 0
          const parsed = extractInsight(strategicResult.speech)
          const insight = parsed.insight ?? { type: 'strategic' as const, summary: parsed.speech }

          requestRecorded = true
          recordOrbModelRequest(createAdminClient(), {
            userId: auth.user.id,
            usage: strategicResult.modelUsage,
            routeRole: 'strategic',
            promptVersion: 'orb-system-v0.6.49',
            contextPacketVersion: 'live-context-v1',
            responseText: parsed.speech,
          }).catch(error => console.error('[orbConverse] Model request ledger insert failed:', error))
          recordMetrics(parsed.speech.length)
          stream.done({ speech: parsed.speech, insight, isStreaming: false })
          return
        }

        providerInvocationStarted = true
        const response = await anthropic.messages.create({
          model: metricModel,
          max_tokens: 4096,
          system: [
            { type: 'text' as const, text: stablePrompt, cache_control: { type: 'ephemeral' as const } },
            { type: 'text' as const, text: dynamicPrompt },
          ],
          messages,
          tools: routeRole === 'strategic'
            ? []
            // confirm_mutation is always offered (not filtered by pendingMutation): tools
            // render ahead of the system prompt in the prompt-cache prefix, so toggling
            // the tool set on every propose/confirm cycle voided the cache mid-conversation.
            // The server already rejects a confirm with nothing pending, and the eval
            // harness has always run with it unconditionally present.
            : [...availableOrbTools, ...ORB_PREFERENCE_TOOLS, ...(memoryLevel !== 'off' ? ORB_MEMORY_TOOLS : []), ORB_CAPABILITIES_TOOL, ORB_DEV_CHANNEL_TOOL, ORB_ADAPTATION_TOOL],
          stream: true,
        }, { timeout: 60_000 })

        let currentTurnSpeech = ''
        let currentInsight: OrbInsight | undefined
        // Separate this turn's speech from any prior turn's (e.g. proposal text before
        // a tool call, then narration after) so they don't run together: "now.Done".
        const baseSpeech = accumulatedSpeech && !/\s$/.test(accumulatedSpeech) ? accumulatedSpeech + ' ' : accumulatedSpeech
        const toolCalls: any[] = []

        for await (const chunk of response) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            currentTurnSpeech += chunk.delta.text
            const parsed = extractInsight(baseSpeech + currentTurnSpeech)
            accumulatedSpeech = parsed.speech
            currentInsight = parsed.insight
            stream.update({ speech: accumulatedSpeech, insight: currentInsight, isStreaming: true })
          } else if (chunk.type === 'content_block_start' && chunk.content_block.type === 'tool_use') {
             const label = ORB_TOOL_LABELS[chunk.content_block.name] || 'Thinking...'
             if (chunk.content_block.name !== 'client_action') {
               stream.update({ speech: accumulatedSpeech, thought: label, isStreaming: true })
             }
             toolCalls.push({ id: chunk.content_block.id, name: chunk.content_block.name, input: '' })
          } else if (chunk.type === 'content_block_delta' && chunk.delta.type === 'input_json_delta') {
             toolCalls[toolCalls.length - 1].input += chunk.delta.partial_json
          } else if (chunk.type === 'message_start' && chunk.message?.usage) {
            metricInputTokens += chunk.message.usage.input_tokens ?? 0
            metricCacheCreationTokens += (chunk.message.usage as any).cache_creation_input_tokens ?? 0
            metricCacheReadTokens += (chunk.message.usage as any).cache_read_input_tokens ?? 0
          } else if (chunk.type === 'message_delta' && (chunk as any).usage) {
            metricOutputTokens += (chunk as any).usage.output_tokens ?? 0
          }
        }

        metricToolCalls += toolCalls.length
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
          const parsed = extractInsight(accumulatedSpeech)
          if (isFalseCompletionClaim(parsed.speech, toolProducedCodes, historyCodes, hasActed)) {
            console.error('[orbConverse] Blocked unverified completion claim', {
              toolProducedCodes: [...toolProducedCodes],
              citedCodes: [...extractCitedCodes(parsed.speech)],
              hasActed,
              speech: parsed.speech.slice(0, 300),
            })
            if (!repairedNoToolMutationClaim && turnCount < MAX_TURNS) {
              repairedNoToolMutationClaim = true
              accumulatedSpeech = ''
              messages.push({
                role: 'user',
                content: 'SYSTEM CORRECTION: Your response claimed an outcome that no tool call in this request actually produced — either a task/project code no tool returned, or completion language ("Done", "I\'ve switched...", "X is now active") with no tool call behind it at all. If you intend to take an action, call the actual tool now and wait for its result before describing any outcome. Do not restate the same claim without calling the tool.',
              })
              stream.update({ speech: '', thought: 'Correcting...', isStreaming: true })
              continue
            }
            recordModelRequest(parsed.speech)
            recordMetrics(parsed.speech.length)
          }
          recordModelRequest(parsed.speech)
          recordMetrics(parsed.speech.length)
          const insight = routeRole === 'strategic'
            ? parsed.insight ?? { type: 'strategic' as const, summary: parsed.speech }
            : parsed.insight
          // If tool errors occurred but the AI didn't acknowledge them, surface to client
          const unacknowledgedError = toolErrors.length > 0
            && !/(fail|error|couldn't|could not|unable|problem|issue|went wrong)/i.test(parsed.speech)
            ? toolErrors.join('; ')
            : undefined
          stream.done({ speech: parsed.speech, insight, isStreaming: false, error: unacknowledgedError })
          return
        }

        // Mutation tools that change data — used to inject verification signals
        const MUTATION_TOOLS = new Set([
          'create_todo', 'update_todo', 'delete_todo', 'move_todo',
          'create_project', 'update_project', 'delete_project', 'set_dormancy',
          'create_ticket', 'add_knowledge', 'set_preference',
          'send_to_developer', 'propose_adaptation',
        ])

        const toolOutputs: any[] = []
        for (const tc of toolCalls) {
          let input: any
          let inputTruncated = false
          try { input = JSON.parse(tc.input || '{}') } catch (e) {
            console.error(`[orbConverse] Failed to parse tool input for ${tc.name}:`, tc.input, e)
            input = {}
            inputTruncated = true
          }
          let output: any

          if (inputTruncated) {
            output = { error: 'Your tool call was truncated (incomplete JSON). The parameters were too long for the response limit. Try again with a shorter description, or create the task first with just a title and update it separately.' }
          } else

          // ── Project / Knowledge mutation: PROPOSE (resolve + hold; never execute here) ──
          if (PROJECT_MUTATIONS.has(tc.name) || KNOWLEDGE_MUTATIONS.has(tc.name)) {
            const proposal = PROJECT_MUTATIONS.has(tc.name)
              ? await proposeProjectMutation(auth.admin, { userId: auth.user.id, isAdmin: auth.isAdmin }, tc.name, input)
              : await proposeKnowledgeMutation(auth.admin, tc.name, input)
            if (proposal.kind === 'error') {
              output = { error: proposal.message }
            } else if (proposal.kind === 'ambiguous') {
              const list = proposal.candidates.map(c => c.code ? `${c.name} (${c.code})` : c.name).join(', ')
              output = { needs_disambiguation: true, candidates: proposal.candidates, _instruction: `More than one project matches: ${list}. Ask the user which one they mean — refer to them by name. Do not act yet.` }
            } else {
              await storePendingMutation(auth.admin, auth.user.id, { tool: tc.name, target_id: proposal.target_id, params: proposal.params, summary: proposal.summary })
              const targetVerification = KNOWLEDGE_MUTATIONS.has(tc.name)
                ? ` You MUST include the exact resolved entry title in quotes in your confirmation, verbatim from "${proposal.summary}" — this is the only way the user can catch a wrong-entry resolution before it executes. Do not paraphrase or shorten the title.`
                : ''
              output = { proposed: true, _instruction: `Briefly tell the user you're about to ${proposal.summary}, and ask whether they want you to go ahead (e.g. "Want me to go ahead?"). You MUST end by asking for the go-ahead. Do NOT say it is already done — it has not run yet. Don't explain any internal mechanism or use the word "pending".${targetVerification}` }
            }
            // Discard any premature speech the model emitted before this propose call
            // (e.g. "Renaming X to Y now.") so only the clean proposal narration remains.
            accumulatedSpeech = ''
            stream.update({ speech: '', isStreaming: true })
            toolOutputs.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify(output) })
            continue
          } else

          // ── Project mutation: EXECUTE the exact stored intent ──
          if (tc.name === 'confirm_mutation') {
            // pendingMutation was consumed (cleared) on load; the in-memory copy is the
            // sole source of truth for this turn. Null means nothing was pending.
            const pend = pendingMutation
            if (!pend) {
              output = { error: 'There is nothing pending to confirm.' }
              toolOutputs.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify(output) })
              continue
            }
            const result = PROJECT_MUTATIONS.has(pend.tool)
              ? await executePendingProjectMutation(auth.admin, { userId: auth.user.id, isAdmin: auth.isAdmin }, pend)
              : await executePendingKnowledgeMutation(auth.admin, { userId: auth.user.id }, pend)
            if (!result.ok) {
              toolErrors.push(`confirm_mutation: ${result.error}`)
              output = { error: result.error, _instruction: `This failed: ${result.error}. Tell the user plainly. Do NOT claim success.` }
              toolOutputs.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify(output) })
              continue
            }
            hasMutated = true; hasActed = true
            if (result.code) toolProducedCodes.add(result.code)
            // Discard premature pre-confirm speech ("Renaming X now.") so the result reads cleanly.
            accumulatedSpeech = ''
            stream.update({ speech: '', thought: result.summary, refresh: true, mutationType: result.mutationType, ...(result.newProject ? { newProject: result.newProject } : {}) })
            // HYBRID confirm: voice → deterministic done (no extra model turn). Text → Orb narrates.
            if (req.uiContext?.voiceMode) {
              const doneSpeech = `${result.summary}.`
              checkAndNotifyEscalation(auth.user.id, beforeUrgency, supabase).catch(err => console.error('[orbConverse] Push check failed:', err))
              recordModelRequest(doneSpeech)
              recordMetrics(doneSpeech.length)
              stream.done({ speech: doneSpeech, isStreaming: false, refresh: true, mutationType: result.mutationType, ...(result.newProject ? { newProject: result.newProject } : {}) })
              return
            }
            output = { ok: true, summary: result.summary, _instruction: `Done: ${result.summary}. Tell the user in your own voice. Do not mention internal mechanics.` }
            toolOutputs.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify(output) })
            continue
          } else

          // ── Canonical pending action (todos) ──
          // Hold every todo mutation in this turn as one action transaction. The
          // next bare affirmation executes exactly these operations before another
          // model call; a status question gets a deterministic "not yet" answer.
          if (GATED_MUTATIONS.has(tc.name)) {
            // Provenance gate: a mutation may only target a code the model has
            // been shown (prompt, tool result, or user text this conversation).
            const targetCode = typeof input.code === 'string' ? input.code.toUpperCase().trim() : null
            // A TICKETS-N code is never a todo — it passes the provenance check below
            // (it genuinely was shown, just as a ticket) and then fails downstream with
            // an unhelpful "todo not found" that doesn't explain why. There is no
            // update/delete/move tool for tickets at all, for any user — reject here
            // with a clear reason instead of a doomed lookup.
            if (targetCode && /^TICKETS-\d+$/.test(targetCode)) {
              output = {
                error: `${targetCode} is a ticket, not a todo — there is no delete, update, or move tool for tickets, for any user including admins. Do not retry this with a todo tool; tell the user plainly that this isn't possible.`,
              }
              toolOutputs.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify(output) })
              continue
            }
            if (targetCode && !shownCodes.has(targetCode)) {
              output = {
                error: `Task code ${targetCode} has not appeared in this conversation — do not construct codes from memory or by sequence. Call query_todos to find the actual tasks, then retry using codes from the results.`,
              }
              toolOutputs.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify(output) })
              continue
            }
            heldTodoOperations.push({ tool: tc.name, params: input })
            output = {
              _held: true,
              _instruction: `This action has not been executed yet. The server will summarize the full pending action after collecting all requested operations. Do NOT claim the action was completed.`,
              params: input,
            }
            toolOutputs.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify(output) })
            continue
          } else

          // try/catch wraps every tool handler so a throw doesn't crash the stream
          try {

          if (tc.name === 'create_todo') {
            if (!input.title) { output = { error: 'title is required' } }
            else {
            if (!input.product_code) {
              console.warn('[orbConverse] create_todo called without product_code — falling back to current project', ctx.current?.code)
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
                hasMutated = true; hasActed = true
                await logAuditEvent({
                  action: 'todo_create',
                  table_name: 'todos',
                  record_id: data.id,
                  after: { code: `${product.code}-${data.todo_number}`, title: input.title, priority_value: input.priority_value ?? null, due_at: input.due_at ?? null },
                  actor: 'orb',
                  user_id: auth.user.id,
                  system_info: req.systemInfo,
                })
              }
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
              }
              // No else — when no status filter is specified, return all statuses
              if (input.product_code) {
                const p = ctx.productList.find((pp: any) => pp.code?.toUpperCase() === String(input.product_code).toUpperCase())
                if (p) results = results.filter((t: any) => t.product_id === p.id)
              }
              if (input.text_match) {
                const q = String(input.text_match).toLowerCase()
                results = results.filter((t: any) => t.title?.toLowerCase().includes(q))
              }
              if (input.category) {
                const cat = String(input.category).toLowerCase()
                results = results.filter((t: any) => t.categories?.name?.toLowerCase() === cat)
              }
              if (input.priority_max) {
                results = results.filter((t: any) => t.priority_value != null && t.priority_value <= input.priority_max)
              }
              results.sort((a: any, b: any) => (a.priority_value ?? 99) - (b.priority_value ?? 99))
            }

            const limit = input.max_results ?? 100
            const returned = results.slice(0, limit).map((t: any) => {
              const proj = ctx.productList.find((pp: any) => pp.id === t.product_id)
              const ownerName = proj ? ctx.userMap.get(proj.created_by) : undefined
              const out: any = { id: t.id, code: todoCode(t, ctx.productList), title: t.title, status: t.status, priority_value: t.priority_value }
              if (ownerName) out.owner = ownerName
              if (t.description) out.description = t.description
              if (t.resolution_notes) out.resolution_notes = t.resolution_notes
              if (t.due_at) out.due_at = t.due_at
              if (t.groups?.name) out.group = t.groups.name
              if (t.categories?.name) out.category = t.categories.name
              const urlList = Array.isArray(t.urls) ? t.urls.filter(Boolean) : []
              if (urlList.length > 0) out.urls = urlList
              return out
            })
            output = { count: results.length, returned }
            stream.update({ speech: accumulatedSpeech, thought: `Found ${results.length} items` })
          } else if (tc.name === 'query_projects') {
            // In-memory over the already-loaded context (like query_todos) —
            // zero extra DB reads. Visibility is inherited: productList is
            // ownership/admin-filtered at load, dormantList is admin-only.
            const ref = input.name ? String(input.name).trim() : ''
            const refUpper = ref.toUpperCase()
            const matchesRef = (p: any) =>
              !ref ||
              p.name.toUpperCase().includes(refUpper) ||
              (p.code ?? '').toUpperCase() === refUpper ||
              fuzzyMatch(ref, p.name)
            const results = ctx.productList.filter(matchesRef)
            const dormantMatches = input.include_dormant ? ctx.dormantList.filter(matchesRef) : []
            const limit = input.max_results ?? 50
            const returned: any[] = results.slice(0, limit).map((p: any) => {
              const ownerName = ctx.userMap.get(p.created_by)
              const projectTodos = ctx.todoList.filter((t: any) => t.product_id === p.id)
              const out: any = {
                name: p.name,
                code: p.code,
                active_tasks: projectTodos.filter((t: any) => isActive(t.status)).length,
                total_tasks: projectTodos.length,
              }
              if (p.description) out.description = p.description
              if (ownerName) out.owner = ownerName
              return out
            })
            for (const p of dormantMatches.slice(0, Math.max(0, limit - returned.length))) {
              const dormantOwner = ctx.userMap.get(p.created_by)
              const out: any = { name: p.name, code: p.code, dormant: true }
              if (dormantOwner) out.owner = dormantOwner
              returned.push(out)
            }
            output = { count: results.length + dormantMatches.length, returned }
            stream.update({ speech: accumulatedSpeech, thought: `Found ${results.length + dormantMatches.length} projects` })
          } else if (tc.name === 'query_tickets') {
            // Admin-only (also enforced by getTickets -> requireAdmin, and by
            // availableOrbTools filtering the tool out of non-admin requests
            // entirely). Reuses ticket-actions.ts's getTickets rather than a
            // second, parallel query — same lesson as ORB-306/307.
            if (!auth.isAdmin) {
              output = { error: 'query_tickets is admin-only.' }
            } else {
              const rawCode = input.code ? String(input.code).trim() : ''
              let ticketNumber: number | undefined
              if (rawCode) {
                const parsed = parseInt(rawCode.replace(/^TICKETS-/i, ''), 10)
                if (Number.isNaN(parsed)) {
                  output = { error: `Could not parse ticket code "${rawCode}" — expected a format like "TICKETS-42".` }
                } else {
                  ticketNumber = parsed
                }
              }

              if (output === undefined) {
                const singleLookup = ticketNumber !== undefined
                const res = await getTickets(singleLookup
                  ? { ticketNumber }
                  : {
                      status: input.status || undefined,
                      scope: input.scope || 'active',
                      search: input.search || undefined,
                      pageSize: input.max_results ?? 20,
                    })

                if (res.error) {
                  output = { error: res.error }
                } else {
                  let tickets = (res.data ?? []) as any[]
                  if (!singleLookup && input.type) {
                    tickets = tickets.filter(t => t.type === input.type)
                  }
                  if (singleLookup && tickets.length === 0) {
                    output = { error: `Ticket "TICKETS-${ticketNumber}" not found.` }
                  } else {
                    const toCompact = (t: any) => {
                      const reporter = t.users as { first_name: string | null; last_name: string | null } | null
                      const linkedTodo = t.todos as { todo_number: number | null; projects: { code: string | null } | null } | null
                      const out: any = {
                        code: `TICKETS-${t.ticket_number}`,
                        type: t.type,
                        status: t.status,
                        summary: t.summary,
                      }
                      const reporterName = reporter ? [reporter.first_name, reporter.last_name].filter(Boolean).join(' ') : ''
                      if (reporterName) out.reporter = reporterName
                      if (linkedTodo?.projects?.code && linkedTodo.todo_number != null) out.linked_todo = `${linkedTodo.projects.code}-${linkedTodo.todo_number}`
                      return out
                    }
                    const toFull = (t: any) => {
                      const out = toCompact(t)
                      if (t.source) out.source = t.source
                      if (t.conversation_snippet) out.conversation_snippet = t.conversation_snippet
                      if (t.detail && Object.keys(t.detail).length > 0) out.detail = t.detail
                      if (t.dismiss_reason) out.dismiss_reason = t.dismiss_reason
                      if (t.resolution_notes) out.resolution_notes = t.resolution_notes
                      out.created_at = t.created_at
                      if (t.closed_at) out.closed_at = t.closed_at
                      return out
                    }
                    const returned = tickets.map(singleLookup ? toFull : toCompact)
                    output = { count: returned.length, returned }
                    stream.update({ speech: accumulatedSpeech, thought: `Found ${returned.length} ticket${returned.length === 1 ? '' : 's'}` })
                  }
                }
              }
            }
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
                const ticketNum = todo.tickets?.ticket_number
                output = {
                  ok: true,
                  ...(ticketNum && closingStatus ? { linked_ticket: `TICKETS-${ticketNum}`, is_closing: true } : {})
                }
                stream.update({ speech: accumulatedSpeech, thought: `Updated ${input.code}`, refresh: true, mutatedProductId: todo.product_id, mutationType: 'update' })
                hasMutated = true; hasActed = true
                await logAuditEvent({
                  action: closingStatus && !todo.closed_at ? 'todo_close' : 'todo_update',
                  table_name: 'todos',
                  record_id: todo.id,
                  before: { status: todo.status, priority_value: todo.priority_value, title: todo.title },
                  after: { status: data.status, priority_value: data.priority_value, title: data.title, code: input.code, due_at: data.due_at },
                  actor: 'orb',
                  user_id: auth.user.id,
                  system_info: req.systemInfo,
                })



                // Only distill when task is being closed for the first time
                const isClosing = closingStatus && !todo.closed_at
                if (isClosing) {
                    const notesLen = (data.resolution_notes || '').length
                    stream.update({ speech: accumulatedSpeech, thought: `Distilling insights (${notesLen} chars of notes)...` })

                    const distillation = await anthropic.messages.create({
                        model: 'claude-haiku-4-5',
                        max_tokens: 500,
                        system: "Extract the 'Gold' (the key technical decision or lesson learned) from the task. Return a RAW JSON object with 'title' and 'content'. DO NOT use markdown or code blocks.",
                        messages: [{ role: 'user', content: `Task: ${data.title}\nDescription: ${data.description}\nResolution: ${data.resolution_notes}` }]
                    })
                    metricInputTokens += distillation.usage?.input_tokens ?? 0
                    metricOutputTokens += distillation.usage?.output_tokens ?? 0
                    metricCacheCreationTokens += (distillation.usage as any)?.cache_creation_input_tokens ?? 0
                    metricCacheReadTokens += (distillation.usage as any)?.cache_read_input_tokens ?? 0
                    try {
                        const text = (distillation.content[0] as any).text
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
                hasMutated = true; hasActed = true
                await logAuditEvent({
                  action: 'todo_delete',
                  table_name: 'todos',
                  record_id: todo.id,
                  before: { code: input.code, title: todo.title, status: todo.status },
                  actor: 'orb',
                  user_id: auth.user.id,
                  system_info: req.systemInfo,
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
              const moveTargetQuery = supabase
                .from('projects')
                .select('id, code, name')
                .ilike('code', targetCode)
              if (!auth.isAdmin) moveTargetQuery.eq('created_by', auth.user.id)
              const { data: targetProject } = await moveTargetQuery.maybeSingle()

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
                  hasMutated = true; hasActed = true
                  await logAuditEvent({
                    action: 'todo_move',
                    table_name: 'todos',
                    record_id: todo.id,
                    before: { code: oldCode, product_code: sourceProject?.code },
                    after: { code: newCode, product_code: targetProject.code },
                    actor: 'orb',
                    user_id: auth.user.id,
                    system_info: req.systemInfo,
                  })
                }
              }
            }
          } else if (tc.name === 'client_action') {
            if (input.action === 'switch_project' && input.target) {
              // Shared with the client (lib/projects.ts): exact name → exact
              // code → fuzzy/partial name. Was exact-match-only here, a
              // weaker duplicate of the client's resolver — a target the
              // client would have fuzzy-matched fine could fail server-side
              // first, and the model's target convention (name vs code) was
              // inconsistent with update_project/delete_project.
              const match = resolveProjectByReference(ctx.productList, String(input.target))
              if (!match) {
                output = { ok: false, error: `Project "${input.target}" not found or you don't have access to it.` }
              } else {
                hasActed = true
                accumulatedSpeech = ''
                // Pass back the resolved NAME, not code — client_action is
                // name-first like update_project/delete_project. The client
                // re-resolves defensively but should never need to fall back
                // to fuzzy-matching a code here.
                stream.update({ speech: accumulatedSpeech, thought: `Switched to ${match.name}`, clientAction: { action: input.action, target: match.name } })
                output = { ok: true }
              }
            } else {
              hasActed = true
              const label = input.action === 'check_update' ? 'Checking for updates…'
                : input.action === 'apply_update' ? 'Updating…'
                : 'Navigating...'
              stream.update({ speech: accumulatedSpeech, thought: label, clientAction: { action: input.action, target: input.target } })
              output = { ok: true }
            }
          } else if (tc.name === 'search_knowledge') {
            if (input.title) {
              // Precise single-entry read — the CRUD "read one" leg. Shares the exact
              // same leeway resolution as update_knowledge (resolveKnowledgeReference):
              // exact match, then a partial reference covering most of its own words.
              // Reusing it means a fix to one path (e.g. the wrong-target bug found in
              // ORB-302 live testing) automatically applies to the other.
              const res = await resolveKnowledgeReference(auth.admin, String(input.title))
              if (res.status === 'not_found') {
                output = { error: `I don't see a knowledge entry matching "${input.title}".` }
                stream.update({ speech: accumulatedSpeech, thought: 'No matching entry found' })
              } else if (res.status === 'ambiguous') {
                const list = res.candidates.map(c => c.title).join(', ')
                output = { needs_disambiguation: true, candidates: res.candidates, _instruction: `More than one entry matches: ${list}. Ask the user which one they mean — refer to them by title. Do not guess.` }
                stream.update({ speech: accumulatedSpeech, thought: `${res.candidates.length} entries match — ambiguous` })
              } else {
                // Fetch via admin, not ctx.knowledgeList (RLS-scoped) — resolveKnowledgeReference
                // already used the admin client to resolve this id, and ctx.knowledgeList can be
                // missing rows RLS hides (found live: cross-project entries with product_id IS
                // NULL were resolvable but then came back empty, because the RLS SELECT policy's
                // join can never match a null product_id — fixed at the RLS layer too, but this
                // path shouldn't depend on RLS visibility matching what admin already resolved).
                const { data: entry } = await auth.admin.from('knowledge_repo').select('title, content, projects(code)').eq('id', res.id).maybeSingle()
                const returned = [{ title: res.title, content: entry?.content ?? '', code: (entry as any)?.projects?.code }]
                output = { count: 1, returned }
                stream.update({ speech: accumulatedSpeech, thought: `Found "${res.title}"`, knowledgeResults: returned })
              }
            } else {
              let results = ctx.knowledgeList.slice()
              if (input.product_code) {
                  const p = ctx.productList.find((pp: any) => pp.code?.toUpperCase() === String(input.product_code).toUpperCase())
                  if (p) results = results.filter((k: any) => k.product_id === p.id)
              }
              if (input.query) {
                  const q = String(input.query)
                  // Score, don't just filter: with 200+ entries and short queries, "matches
                  // at all" isn't enough — rank so the best-matching entries survive the
                  // top-10 cap instead of being crowded out by loosely-matching newer ones.
                  results = results
                    .map((k: any) => ({ entry: k, score: scoreTextMatch(q, k.title, k.content) }))
                    .filter((x: any) => x.score > 0)
                    .sort((a: any, b: any) => b.score - a.score)
                    .map((x: any) => x.entry)
              }
              const returned = results.slice(0, 10).map((k: any) => ({ title: k.title, content: k.content, code: k.projects?.code }))
              output = { count: results.length, returned }
              stream.update({ speech: accumulatedSpeech, thought: `Found ${results.length} insights`, knowledgeResults: returned })
            }
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
          // NOTE: create_project / update_project / delete_project are handled by the
          // server-held propose/confirm/execute flow above (PROJECT_MUTATIONS / confirm_mutation),
          // not here. See lib/orb-mutations.ts.
          } else if (tc.name === 'set_dormancy') {
            const code = String(input.project_code || '').toUpperCase()
            const dormQuery = auth.admin.from('projects').select('id, code, name, created_by').ilike('code', code)
            if (!auth.isAdmin) dormQuery.eq('created_by', auth.user.id)
            const { data: project } = await dormQuery.maybeSingle()
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
          } else if (tc.name === 'query_db') {
            // ── Read-only database query via Supabase query builder ──
            const table = String(input.table || '')
            if (!ALLOWED_TABLES.has(table)) {
              output = { error: `Table "${table}" is not queryable. Allowed: ${[...ALLOWED_TABLES].join(', ')}` }
            } else {
              const selectStr = input.select || '*'
              const limit = Math.min(Math.max(input.limit ?? 50, 1), 200)

              // Use RLS-scoped client for regular users, admin for admins
              const client = auth.isAdmin ? auth.admin : supabase
              let query = client.from(table).select(selectStr)

              // Apply filters
              let filterError: string | null = null
              const filtersExplicitlyOnDeletedAt = new Set<string>()

              if (Array.isArray(input.filters)) {
                for (const f of input.filters) {
                  const col = String(f.column || '')
                  const op = String(f.op || '')
                  if (!COLUMN_NAME_RE.test(col)) { filterError = `Invalid column name: "${col}"`; break }
                  if (!ALLOWED_OPS.has(op)) { filterError = `Invalid operator: "${op}"`; break }
                  if (col === 'deleted_at') filtersExplicitlyOnDeletedAt.add(table)

                  switch (op) {
                    case 'eq':       query = query.eq(col, f.value); break
                    case 'neq':      query = query.neq(col, f.value); break
                    case 'gt':       query = query.gt(col, f.value); break
                    case 'gte':      query = query.gte(col, f.value); break
                    case 'lt':       query = query.lt(col, f.value); break
                    case 'lte':      query = query.lte(col, f.value); break
                    case 'like':     query = query.like(col, f.value); break
                    case 'ilike':    query = query.ilike(col, f.value); break
                    case 'is':       query = query.is(col, f.value); break
                    case 'not.is':   query = query.not(col, 'is', f.value); break
                    case 'in':       query = query.in(col, Array.isArray(f.value) ? f.value : [f.value]); break
                    case 'contains': query = query.contains(col, Array.isArray(f.value) ? f.value : [f.value]); break
                    case 'overlaps': query = query.overlaps(col, Array.isArray(f.value) ? f.value : [f.value]); break
                  }
                }
              }

              if (filterError) {
                output = { error: filterError }
              } else {
                // Auto-filter soft-deleted rows unless explicitly queried
                if (SOFT_DELETE_TABLES.has(table) && !filtersExplicitlyOnDeletedAt.has(table)) {
                  query = query.is('deleted_at', null)
                }

                // Apply OR filter (sanitized)
                if (input.or_filter) {
                  const sanitized = String(input.or_filter).replace(/[^a-z_.,()0-9 ]/gi, '')
                  if (sanitized) query = query.or(sanitized)
                }

                // Apply ordering
                if (input.order) {
                  const orderStr = String(input.order)
                  const descending = orderStr.startsWith('-')
                  const orderCol = descending ? orderStr.slice(1) : orderStr
                  if (COLUMN_NAME_RE.test(orderCol)) {
                    query = query.order(orderCol, { ascending: !descending })
                  }
                }

                // Apply limit
                query = query.limit(limit)

                const { data: rows, error: queryError } = await query
                if (queryError) {
                  output = { error: queryError.message }
                } else {
                  // Add a formatted `code` per row for tables with a user-facing code
                  // convention — same format query_tickets/query_projects already use.
                  // Without this, a code cited from a raw ticket_number is untraceable
                  // to any tool output, reading as an unbacked "phantom code" citation.
                  const resultRows = (rows ?? []).map((row: any) =>
                    table === 'tickets' && row.ticket_number != null ? { ...row, code: `TICKETS-${row.ticket_number}` } : row
                  )
                  output = {
                    count: resultRows.length,
                    rows: resultRows,
                    truncated: resultRows.length >= limit,
                  }
                  stream.update({ speech: accumulatedSpeech, thought: `Query returned ${resultRows.length} rows` })
                }
              }
            }
          } else if (tc.name === 'create_ticket') {
            const res = await createTicket({
              source: 'orb-auto',
              type: input.type as any,
              summary: input.summary,
              detail: input.detail ? { detail: input.detail } : {},
              conversation_snippet: req.input,
              reportedBy: auth.user.id,
              systemInfo: req.systemInfo,
            })
            if (res.error) output = { error: res.error }
            else {
              output = { ok: true, code: res.data?.code }
              stream.update({ speech: accumulatedSpeech, thought: `Noted ${res.data?.code || ''}`.trim() })
            }

          } else if (tc.name === 'get_preferences') {
            const { data } = await supabase.from('orb_preferences').select('key, value, updated_at').eq('user_id', auth.user.id)
            const prefs = (data ?? []) as Array<{ key: string; value: string; updated_at: string }>
            if (prefs.length === 0) {
              output = { preferences: [], defaults: Object.fromEntries(Object.entries(VALID_PREFERENCE_KEYS).map(([k, v]) => [k, { description: v.description, values: v.values, current: 'default' }])) }
            } else {
              output = { preferences: prefs, available_keys: VALID_PREFERENCE_KEYS }
            }

          } else if (tc.name === 'set_preference') {
            const keyDef = VALID_PREFERENCE_KEYS[input.key]
            if (!keyDef) {
              output = { error: `Unknown preference key "${input.key}". Valid keys: ${Object.keys(VALID_PREFERENCE_KEYS).join(', ')}` }
            } else if (!keyDef.values.includes(input.value)) {
              output = { error: `Invalid value "${input.value}" for ${input.key}. Valid values: ${keyDef.values.join(', ')}` }
            } else {
              const { error } = await supabase.from('orb_preferences').upsert(
                { user_id: auth.user.id, key: input.key, value: input.value, updated_at: new Date().toISOString() },
                { onConflict: 'user_id,key' }
              )
              if (error) output = { error: error.message }
              else {
                output = { ok: true, key: input.key, value: input.value }
                stream.update({ speech: accumulatedSpeech, thought: `Preference saved: ${input.key}=${input.value}` })
              }
            }

          } else if (tc.name === 'query_capabilities') {
            output = getCapabilities(input.section || 'all', auth.canInspectRepository)

          } else if (tc.name === 'query_repository') {
            output = await queryRepository(input, {
              userId: auth.user.id,
              canInspectRepository: auth.canInspectRepository,
            })

          } else if (tc.name === 'send_to_developer') {
            const targetTool = input.target_tool || 'Developer Tool'
            const { error: devErr } = await auth.admin.from('dev_channel').insert({
              direction: 'orb_to_dev',
              sender_label: `Orb (Sonnet 4.5)`,
              content: input.content,
              product_id: req.productId,
              metadata: { target_tool: targetTool },
            })
            if (devErr) output = { error: devErr.message }
            else {
              output = { ok: true, target: targetTool }
              stream.update({ speech: accumulatedSpeech, thought: `Sent to ${targetTool}` })
            }

          } else if (tc.name === 'save_memory') {
            if (memoryLevel === 'off') {
              output = { error: 'Memory is disabled. The user has set memory_level to "off".' }
            } else {
              const expiresAt = memoryLevel === 'session'
                ? new Date(new Date().setUTCHours(23, 59, 59, 999)).toISOString()
                : null
              const { data: mem, error: memErr } = await supabase.from('orb_memory').insert({
                user_id: auth.user.id,
                track: input.track,
                category: input.category,
                content: input.content,
                context: input.context || null,
                expires_at: expiresAt,
              }).select('id, track, category').single()
              if (memErr) output = { error: memErr.message }
              else output = { ok: true, id: mem.id, track: mem.track, category: mem.category }
            }

          } else if (tc.name === 'recall_memories') {
            if (memoryLevel === 'off') {
              output = { memories: [], note: 'Memory is disabled.' }
            } else {
              let query = supabase.from('orb_memory')
                .select('id, track, category, content, confidence, created_at')
                .eq('user_id', auth.user.id)
                .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
                .order('created_at', { ascending: false })
                .limit(input.limit || 10)
              if (input.category) query = query.eq('category', input.category)
              if (input.query) query = query.ilike('content', `%${input.query}%`)
              const { data: mems, error: memErr } = await query
              if (memErr) output = { error: memErr.message }
              else output = { memories: mems ?? [] }
            }
          } else if (tc.name === 'propose_adaptation') {
            const allowedCategories = new Set(['communication', 'observation', 'coaching', 'workflow'])
            if (!input.title || !input.rule || !input.rationale || !allowedCategories.has(input.category)) {
              output = { error: 'title, rule, rationale, and a valid category are required' }
            } else if (!auth.user.email) {
              output = { error: 'current user has no email address for adaptation approval' }
            } else {
              const { data: adaptation, error: adaptationErr } = await auth.admin.from('orb_adaptations').insert({
                user_id: auth.user.id,
                title: input.title,
                rule: input.rule,
                rationale: input.rationale,
                category: input.category,
                status: 'proposed',
              }).select('id, title, rule, rationale, category, status').single()

              if (adaptationErr) {
                output = { error: adaptationErr.message }
              } else {
                const emailResult = await sendAdaptationEmail({
                  to: auth.user.email,
                  adaptation,
                  origin: await getRequestOrigin(),
                })

                if (emailResult.error) {
                  output = { error: emailResult.error }
                } else {
                  output = { ok: true, id: adaptation.id, status: adaptation.status }
                  stream.update({ speech: accumulatedSpeech, thought: 'Adaptation proposed' })
                  await logAuditEvent({
                    action: 'adaptation_proposed',
                    table_name: 'orb_adaptations',
                    record_id: adaptation.id,
                    after: {
                      title: adaptation.title,
                      rule: adaptation.rule,
                      rationale: adaptation.rationale,
                      category: adaptation.category,
                      status: adaptation.status,
                    },
                    actor: 'orb',
                    user_id: auth.user.id,
                    system_info: req.systemInfo,
                  })
                }
              }
            }
          }
          } catch (toolErr: any) {
            console.error(`[orbConverse] Tool "${tc.name}" threw:`, toolErr)
            output = { error: `Tool execution failed: ${toolErr.message || 'Unknown error'}` }
            createTicket({
              source: 'orb-auto',
              type: 'bug',
              summary: `Orb tool "${tc.name}" threw an unhandled error`,
              detail: { error: toolErr.message || String(toolErr), tool: tc.name, input: JSON.stringify(input).slice(0, 500), timestamp: new Date().toISOString() },
              conversation_snippet: req.input,
              reportedBy: auth.user.id,
              systemInfo: req.systemInfo,
            }).catch(e => console.error('[orbConverse] Failed to auto-file tool error ticket:', e))
          }

          if (output?.error) {
            toolErrors.push(`${tc.name}: ${output.error}`)
            stream.update({ speech: accumulatedSpeech, thought: `Error: ${output.error}` })
          }

          // For mutation tools, inject explicit verification signals so the model
          // cannot ignore errors or fabricate codes in its post-tool response
          if (MUTATION_TOOLS.has(tc.name)) {
            if (output?.error) {
              output._verification = `VERIFICATION: This "${tc.name}" call FAILED with error: "${output.error}". You MUST tell the user it failed. Do NOT claim success or cite any codes.`
            } else {
              if (tc.name === 'update_todo' && output.linked_ticket && output.is_closing) {
                output._verification = `VERIFICATION: This "update_todo" call SUCCEEDED in closing ${input.code}. IMPORTANT: This todo is linked to reporter ticket "${output.linked_ticket}". You MUST notify the user about this linkage in your speech and ask what should happen to the reporter ticket. Do not update or close the ticket automatically.`
              } else {
                output._verification = `VERIFICATION: This "${tc.name}" call SUCCEEDED. Report ONLY the code/ID returned in this result. Do NOT invent or guess any codes.`
              }
            }
          }

          toolOutputs.push({ type: 'tool_result', tool_use_id: tc.id, content: JSON.stringify(output) })
          if (output?.code) toolProducedCodes.add(output.code)
          if (output?.old_code) toolProducedCodes.add(output.old_code)
          if (output?.new_code) toolProducedCodes.add(output.new_code)
          // List-shaped read tools (query_todos, query_projects, query_tickets) return
          // { count, returned: [{ code, ... }] } rather than a single top-level code —
          // without this, any code cited from a fresh list result (e.g. a ticket not
          // already in context) reads as an unbacked "phantom code" below.
          if (Array.isArray(output?.returned)) {
            for (const item of output.returned) {
              if (item?.code) toolProducedCodes.add(item.code)
            }
          }
          // query_db's fallback returns { rows: [...] } instead of { returned: [...] } —
          // same gap, different key. Projects rows already carry a real `code` column;
          // ticket rows get one computed above in the query_db handler.
          if (Array.isArray(output?.rows)) {
            for (const item of output.rows) {
              if (item?.code) toolProducedCodes.add(item.code)
            }
          }
        }
        if (heldTodoOperations.length > 0) {
          // Permission granted in the requesting message itself — don't make
          // the user confirm what they already authorized. Stop remains the
          // escape hatch, and deletes are soft.
          if (grantsUpfrontPermission(req.input)) {
            await executeTodoOperationsAndFinish(heldTodoOperations, { preAuthorized: true })
            return
          }
          const summary = summarizeTodoOperations(heldTodoOperations)
          const pending: PendingMutation = {
            kind: 'todo_action_transaction',
            operations: heldTodoOperations,
            summary,
          }
          const speech = `Confirm: ${summary}?\n\n${listTodoOperationLines(heldTodoOperations)}`
          recordModelRequest(speech)
          recordMetrics(speech.length)
          stream.done({ speech, isStreaming: false, pendingMutation: pending })
          return
        }
        if (!hasMutated && toolErrors.length > 0) {
          toolOutputs.push({ type: 'text' as const, text: `[SYSTEM: No data was modified. Errors occurred: ${toolErrors.join('; ')}. Report these errors to the user. Do NOT claim success.]` })
        }
        // Tool results are about to be shown to the model — register their
        // codes as legitimate provenance for subsequent mutation calls.
        for (const to of toolOutputs) {
          const text = typeof to.content === 'string' ? to.content : typeof to.text === 'string' ? to.text : ''
          for (const c of extractCitedCodes(text)) shownCodes.add(c)
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
      // Reached MAX_TURNS without a no-tool-call response. Return an explicit
      // outcome so the client never preserves a silent "Processing…" state.
      const exhaustedMessage = 'I could not complete that inspection within the available tool steps. Try asking about a more specific screen, component, or file.'
      const exhaustedSpeech = accumulatedSpeech ? `${accumulatedSpeech}\n\n${exhaustedMessage}` : exhaustedMessage
      recordModelRequest(exhaustedSpeech)
      recordMetrics(exhaustedSpeech.length)
      stream.done({
        speech: exhaustedSpeech,
        isStreaming: false,
      })
    } catch (err: any) {
      console.error('[orbConverse] Error:', err)
      const failure = classifyProviderFailure(err, metricProvider, metricRouteRole)
      if (providerInvocationStarted) {
        notifyOrbIncident({
          summary: failure.summary,
          provider: metricProvider,
          role: metricRouteRole,
          reason: failure.reason,
          detail: { error: failure.message, type: failure.type, input: req.input.slice(0, 500) },
          consoleUrl: failure.consoleUrl,
        }).catch(error => console.error('[orbConverse] Provider incident notification failed:', error))
      }

      // If we had partial speech before the error, preserve it
      const errorMessage = providerInvocationStarted
        ? failure.userMessage
        : 'Something went wrong before Orb could reach the AI service. Try again — if it persists, let Stan know.'
      const finalSpeech = accumulatedSpeech
        ? `${accumulatedSpeech}\n\n*${errorMessage}*`
        : errorMessage
      recordMetrics(finalSpeech.length)
      stream.done({ speech: finalSpeech, isServiceError: true, error: String(err) })
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
    const ctx = await buildOrbContext(auth.supabase, auth, { currentProductId: productId })

    if (ctx.todoList.length === 0) return null

    const observationsSection = ctx.observations.length > 0
      ? `\n\nPROACTIVE OBSERVATIONS (pick the most relevant one to weave into your opening — do not list them all):\n${ctx.observations.slice(0, 2).map(o => `- ${o}`).join('\n')}`
      : ''

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      system: `You are the voice of the orb. Generate a brief, ambient opening observation (1-2 sentences) based on the backlog below. Plain text, no markdown. Factual tone — no cheerleading. Address the user directly ("you"). Do not greet them or say hello. SCOPE TRANSPARENCY: Every number you cite must state its scope — say "across all projects" or name the specific projects by their display names (e.g. "across Orb, Helm"). Never present a count without saying where it comes from. Only state facts visible in the backlog — do not infer patterns or compute statistics. If a proactive observation is provided, prefer weaving it into the opening naturally over generic backlog stats.\n\n${STATUS_VOCABULARY}${observationsSection}`,
      messages: [{
        role: 'user',
        content: `Backlog:\n${ctx.contextString}`,
      }],
    })

    const text = (response.content[0] as any)?.text?.trim()
    if (text) {
      const admin = createAdminClient()
      admin.rpc('upsert_orb_metric', {
        p_user_id: auth.user.id,
        p_speech_chars: 0,
        p_voice_speech_chars: 0,
        p_input_chars: 0,
        p_tool_call_count: 0,
        p_ambient_chars: text.length,
        p_input_tokens: response.usage?.input_tokens ?? 0,
        p_output_tokens: response.usage?.output_tokens ?? 0,
        p_cache_creation_input_tokens: (response.usage as any)?.cache_creation_input_tokens ?? 0,
        p_cache_read_input_tokens: (response.usage as any)?.cache_read_input_tokens ?? 0,
        p_model: 'claude-haiku-4-5',
      }).then(({ error }) => {
        if (error) console.error('[orbGreeting] Metric upsert failed:', error.message)
      })
    }
    return text || null
  } catch (err) {
    console.error('[orbGreeting] Error:', err)
    return null
  }
}
