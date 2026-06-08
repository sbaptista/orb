'use server'

import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { createStreamableValue } from 'ai/rsc'
import { getAuthContext, type AuthContext } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'
import { ORB_TOOLS, ORB_TOOL_LABELS } from '@/lib/orb-contract'
import { ORB_PRINCIPLES, ORB_RESOLUTION_LAWS, ORB_VOICE, ORB_ATTRIBUTION, ORB_MUTATION_VERIFICATION, ORB_FEEDBACK_TONE, ORB_QUERY_ROUTING, ORB_SCOPE_RULES, ORB_SESSION_ADAPTATION, ORB_PREFERENCE_DISCOVERY, ORB_PROACTIVE_TONE, ORB_SELF_DIAGNOSTICS, buildUrgencyRules, buildPreferencesPrompt, buildObservationsPrompt, buildMutationApprovalPrompt, computeObservations, ORB_PREFERENCE_TOOLS, ORB_CAPABILITIES_TOOL, ORB_DEV_CHANNEL_TOOL, ORB_DEV_CHANNEL_PROMPT, getCapabilities, VALID_PREFERENCE_KEYS } from '@/lib/orb-prompt'
// computeInsights suspended — code preserved in lib/insights.ts for future use
import { visibleProjectsQuery } from '@/lib/projects'
import { isActive, isParked, STATUS_VOCABULARY } from '@/lib/status-groups'
import { computeUrgency, type Urgency } from '@/lib/orb-state'
import { checkAndNotifyEscalation, snapshotUrgency } from '@/lib/push'
import { createTicket } from '@/app/actions/ticket-actions'

import { VERSION } from '@/lib/version'
import { createProject } from '@/app/actions/manage-project'
import { DB_SCHEMA, ALLOWED_TABLES, SOFT_DELETE_TABLES, ALLOWED_OPS, COLUMN_NAME_RE } from '@/lib/db-schema'
import { fuzzyMatch } from '@/lib/fuzzy-search'
import { CHANGELOG } from '@/lib/changelog'

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export type OrbResponse = {
  speech: string
  thought?: string // A discrete "work step" completed by the Orb
  refresh?: boolean
  mutatedProductId?: string
  mutationType?: 'create' | 'update' | 'delete' | 'project_create' | 'dormancy'
  clientAction?: { action: string; target?: string }
  error?: string
  isStreaming?: boolean
  suggestedKnowledge?: { id: string; productId: string; title: string; suggestion: { title: string; content: string } }
  knowledgeResults?: Array<{ title: string; content: string; code?: string }>
  newProject?: { id: string; name: string; code: string; description: string | null; created_by: string }
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
}

export type OrbRequest = {
  input: string
  productId: string | null
  // scopeToProduct removed — query scope is always global, mutations default to current project
  history?: Array<{ role: 'user' | 'assistant'; text: string }>
  dryRun?: boolean
  roleOverride?: string | null
  uiContext?: UIContext
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

// ──────────────────────────────────────────────────────────────────────────
// Tool Context & Helpers
// ──────────────────────────────────────────────────────────────────────────

function todoCode(todo: any, productList: any[]): string {
  const p = productList.find((pp: any) => pp.id === todo.product_id)
  return `${p?.code ?? p?.name ?? '???'}-${todo.todo_number}`
}

async function buildContext(supabase: any, auth: AuthContext, currentProductId: string | null) {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const [
    { data: products },
    { data: dormantProducts },
    { data: todos },
    { data: statuses },
    { data: priorities },
    { data: knowledge },
    { data: recentAudit, count: auditTotalCount },
    { data: userProfile },
    { data: categories },
    { data: groups },
    { data: roles },
    { data: platforms },
    { data: frictionLogs, count: frictionTotalCount },
    { data: invitations },
    { data: allUsers },
    { data: orbPreferences },
    { data: recentTickets },
    { data: behaviorRules },
  ] = await Promise.all([
    visibleProjectsQuery(supabase, 'id, name, code, description, created_by'),
    auth.isAdmin ? supabase.from('projects').select('id, name, code').eq('is_dormant', true).order('sort_order') : Promise.resolve({ data: [] }),
    supabase.from('todos').select('id, todo_number, title, description, status, priority_value, product_id, created_at, updated_at, closed_at, resolution_notes, due_at, urls, group_id, category_id, groups(name), categories(name)').is('deleted_at', null),
    supabase.from('statuses').select('*').order('sort_order'),
    supabase.from('priorities').select('*').order('value'),
    supabase.from('knowledge_repo').select('*, projects(code, name)').order('created_at', { ascending: false }),
    supabase.from('audit_log').select('action, record_id, created_at, before, after, actor', { count: 'exact' }).gte('created_at', fourteenDaysAgo).order('created_at', { ascending: false }).limit(200),
    supabase.from('users').select('urgency_threshold_hours, timezone, first_name, last_name').eq('id', auth.user.id).maybeSingle(),
    // ── Additional context (ORB-146) ──
    supabase.from('categories').select('id, name, product_id').is('deleted_at', null).order('sort_order'),
    supabase.from('groups').select('id, name, product_id').is('deleted_at', null).order('sort_order'),
    supabase.from('roles').select('id, name').order('id'),
    supabase.from('platforms').select('id, name').order('id'),
    auth.isAdmin
      ? auth.admin.from('orb_friction').select('id, category, summary, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(20)
      : Promise.resolve({ data: [], count: 0 }),
    auth.isAdmin
      ? auth.admin.from('invitations').select('id, email, first_name, last_name, status, release_stage, invited_at, responded_at, decline_reason, role_id').order('invited_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    auth.isAdmin
      ? auth.admin.from('users').select('id, email, first_name, last_name, role_id, onboarded_at, release_stage').order('created_at')
      : Promise.resolve({ data: [] }),
    supabase.from('orb_preferences').select('key, value').eq('user_id', auth.user.id),
    auth.isAdmin
      ? auth.admin.from('tickets').select('id, ticket_number, type, summary, status, dismiss_reason, created_at, closed_at, detail').order('created_at', { ascending: false }).limit(10)
      : Promise.resolve({ data: [] }),
    supabase.from('knowledge_repo').select('title, content').contains('tags', ['orb-behavior']).order('created_at', { ascending: false }).limit(20),
  ])

  const currentUserName = userProfile ? [userProfile.first_name, userProfile.last_name].filter(Boolean).join(' ') : ''
  const currentUser = { id: auth.user.id, email: auth.user.email, name: currentUserName || null, roles: { name: auth.role } }

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
  const userList = (allUsers ?? [])

  // Build a user lookup map for project ownership (admin sees all users, regular users see just themselves)
  const userMap = new Map<string, string>()
  for (const u of userList) {
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ')
    userMap.set(u.id, name || u.email)
  }
  // Ensure the current user is always in the map
  if (currentUser.name) {
    userMap.set(auth.user.id, currentUser.name)
  } else if (!userMap.has(auth.user.id)) {
    userMap.set(auth.user.id, auth.user.email ?? 'you')
  }

  function todoLine(t: any): string {
    const parts = [`  ${todoCode(t, productList)} [P${t.priority_value ?? '-'}] [${t.status}] ${t.title}`]
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
    // All projects always visible in query scope (ORB-203)
    const pTodos = todoList.filter((t: any) => t.product_id === p.id && !statusList.find((s: any) => s.name === t.status)?.is_closed)
    const activeLine = pTodos
      .filter((t: any) => isActive(t.status))
      .map(todoLine)
      .join('\n')
    const parkedLine = pTodos
      .filter((t: any) => !isActive(t.status))
      .map(todoLine)
      .join('\n')
    let body = ''
    if (activeLine) body += `  ACTIVE:\n${activeLine}`
    if (parkedLine) body += `${activeLine ? '\n' : ''}  PARKED (on hold/deferred):\n${parkedLine}`
    return `${header}:\n${body || '  (none active)'}`
  }).join('\n\n')

  const dormantSection = dormantList.length > 0
    ? `\n\nDORMANT (hidden from active views, no CRUD — use set_dormancy to wake):\n${dormantList.map((p: any) => `  ${p.code ?? p.name}`).join(', ')}`
    : ''

  // ── Additional context sections (ORB-146) ──
  const categoryList = (categories ?? [])
  const groupList = (groups ?? [])
  const roleList = (roles ?? [])
  const platformList = (platforms ?? [])
  const frictionList = (frictionLogs ?? [])
  const invitationList = (invitations ?? [])

  const categoriesSection = categoryList.length > 0
    ? `\n\nCATEGORIES:\n${categoryList.map((c: any) => {
        const proj = productList.find((p: any) => p.id === c.product_id)
        return `  ${c.name}${proj ? ` (${proj.code ?? proj.name})` : ''}`
      }).join('\n')}`
    : ''

  const groupsSection = groupList.length > 0
    ? `\n\nGROUPS:\n${groupList.map((g: any) => {
        const proj = productList.find((p: any) => p.id === g.product_id)
        return `  ${g.name}${proj ? ` (${proj.code ?? proj.name})` : ''}`
      }).join('\n')}`
    : ''

  const rolesSection = roleList.length > 0
    ? `\n\nROLES: ${roleList.map((r: any) => r.name).join(', ')}`
    : ''

  const platformsSection = platformList.length > 0
    ? `\n\nPLATFORMS: ${platformList.map((p: any) => p.name).join(', ')}`
    : ''

  // Admin-only sections
  const frictionTotal = frictionTotalCount ?? frictionList.length
  const frictionLabel = frictionList.length < frictionTotal
    ? `showing ${frictionList.length} of ${frictionTotal}`
    : `${frictionList.length} total`
  const frictionSection = auth.isAdmin && frictionList.length > 0
    ? `\n\nFRICTION LOGS (${frictionLabel}, admin view):\n${frictionList.map((f: any) => `  [${f.category}] ${f.summary} (${new Date(f.created_at).toLocaleDateString()})`).join('\n')}`
    : ''

  const invitationsSection = auth.isAdmin && invitationList.length > 0
    ? `\n\nINVITATIONS (admin view):\n${invitationList.map((i: any) => {
        const role = roleList.find((r: any) => r.id === i.role_id)
        const roleName = role ? `, role: ${role.name}` : ''
        const declined = i.decline_reason ? ` — reason: ${i.decline_reason}` : ''
        return `  ${i.email} (${[i.first_name, i.last_name].filter(Boolean).join(' ') || 'no name'}) — ${i.status}${roleName}${i.release_stage ? `, ${i.release_stage}` : ''}${declined}`
      }).join('\n')}`
    : ''

  const usersSection = auth.isAdmin && userList.length > 0
    ? `\n\nUSERS (admin view, ${userList.length} total):\n${userList.map((u: any) => {
        const role = roleList.find((r: any) => r.id === u.role_id)
        return `  ${u.email} (${[u.first_name, u.last_name].filter(Boolean).join(' ') || 'no name'}) — ${role?.name ?? 'unknown role'}${u.onboarded_at ? ', onboarded' : ', not onboarded'}${u.release_stage ? `, ${u.release_stage}` : ''}`
      }).join('\n')}`
    : ''

  const extraContext = categoriesSection + groupsSection + rolesSection + platformsSection + frictionSection + invitationsSection + usersSection

  const urgencyThresholdHours = userProfile?.urgency_threshold_hours ?? 0
  const preferenceList = (orbPreferences ?? []) as Array<{ key: string; value: string }>
  const guidanceLevel = preferenceList.find(p => p.key === 'guidance_level')?.value ?? 'gentle'
  const myProducts = productList.filter((p: any) => p.created_by === auth.user.id)
  const myProductIds = new Set(myProducts.map((p: any) => p.id))
  const myTodos = todoList.filter((t: any) => myProductIds.has(t.product_id))
  const observations = guidanceLevel !== 'quiet' ? computeObservations(myTodos, myProducts) : []
  if (observations.length > 0) console.log('[buildContext] Proactive observations:', observations)
  else console.log('[buildContext] No observations computed. guidanceLevel:', guidanceLevel, 'todos:', todoList.length, 'products:', productList.length)

  const ticketList = (recentTickets ?? []) as Array<{ id: string; ticket_number: number; type: string; summary: string; status: string; dismiss_reason: string | null; created_at: string; closed_at: string | null; detail: Record<string, any> }>
  const ticketsSection = ticketList.length > 0
    ? `\n\nRECENT TICKETS (filed by you or the Orb — ${ticketList.length} most recent):\n${ticketList.map(t => {
        const status = t.status.toUpperCase()
        const dismissed = t.dismiss_reason ? ` — dismissed: ${t.dismiss_reason}` : ''
        const detail = t.detail?.detail ? ` | Detail: ${String(t.detail.detail).slice(0, 80)}` : ''
        return `  TICKETS-${t.ticket_number} [${status}] (${t.type}) ${t.summary}${dismissed}${detail}`
      }).join('\n')}\nUse this to avoid filing duplicates and to reference resolved issues.`
    : ''

  const behaviorRuleList = (behaviorRules ?? []) as Array<{ title: string; content: string }>

  return { productList, dormantList, todoList, statusList, priorityList, knowledgeList, auditList, current, currentUser, userMap, urgencyThresholdHours, preferenceList, guidanceLevel, observations, behaviorRuleList, contextString: byProduct + dormantSection + extraContext + ticketsSection }
}



function buildSurveyPrompt(daysActive: number | undefined, prefs: Array<{ key: string; value: string }>): string {
  const completed = prefs.find(p => p.key === 'survey_completed')?.value === 'true'
  if (completed || !daysActive || daysActive < 7) return ''

  const stage = prefs.find(p => p.key === 'survey_stage')?.value ?? 'none'

  return `PRE-ALPHA USER SURVEY CHECK-IN RULES:
Since the user has been active for ${daysActive} days (>= 7 days) and hasn't completed the survey, you MUST administer the pre-alpha check-in.
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
     - summary: "Pre-Alpha Feedback: Ambient Orb"
     - detail: "User feedback on Ambient Orb (after ${daysActive} days active): [user's raw response text]"
  2. Acknowledge briefly and present Question 2: "2. **Strategic Guidance:** Has the Orb's strategic support—such as asking 'What should I do next?' or receiving proactive summaries—provided genuine value in organizing your day compared to traditional todo lists?"
  3. Save preference "survey_stage" to "q2" using set_preference immediately.

- Current Stage: 'q2'
  Action: Capture their response to Question 2.
  1. Call tool create_ticket with:
     - type: "suggestion"
     - summary: "Pre-Alpha Feedback: Strategic Guidance"
     - detail: "User feedback on Strategic Guidance (after ${daysActive} days active): [user's raw response text]"
  2. Acknowledge briefly and present Question 3: "3. **Friction & Bugs:** Did you run into any major friction points or confusing behavior when talking to the Orb, switching between views (List, Checklist, Kanban), or navigating settings?"
  3. Save preference "survey_stage" to "q3" using set_preference immediately.

- Current Stage: 'q3'
  Action: Capture their response to Question 3.
  1. Call tool create_ticket with:
     - type: "suggestion"
     - summary: "Pre-Alpha Feedback: Friction & Bugs"
     - detail: "User feedback on Friction & Bugs (after ${daysActive} days active): [user's raw response text]"
  2. Thank the user warmly for their valuable time.
  3. Save preference "survey_completed" to "true" AND save preference "survey_stage" to "completed" using set_preference immediately.

IMPORTANT: Do not skip stages. Set the preference immediately when you present the question so that the stage updates. Focus on one question at a time. Be conversational and human.`
}

export async function orbConverse(req: OrbRequest) {
  const stream = createStreamableValue<OrbResponse>()

  ;(async () => {
    try {
      const auth = await getAuthContext()
      const supabase = auth.supabase
      const ctx = await buildContext(supabase, auth, req.productId)

      let uiCatalog = ''
      try {
        const catalogPath = path.join(process.cwd(), 'docs/ui-catalog.md')
        uiCatalog = fs.readFileSync(catalogPath, 'utf8')
      } catch (err) {
        console.error('[orbConverse] Failed to read ui-catalog.md:', err)
      }
      const beforeUrgency = await snapshotUrgency(supabase, auth.user.id)
      let hasMutated = false
      const statusNames = ctx.statusList.map((s: any) => `${s.name}${s.is_closed ? ' (closed)' : s.is_open ? ' (default)' : ''}`).join(', ')
      const priorityInfo = ctx.priorityList.map((p: any) => `${p.value}:${p.label}${p.is_urgent ? ' (URGENT)' : ''}`).join(', ')

      const userRole = req.roleOverride || auth.role

      const messages: any[] = [
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
          max_tokens: 4096,
          system: [
            // Identity
            `You are the voice of the orb — the conversational layer of Orb.`,
            ORB_VOICE,
            `CURRENT DATE: ${new Date().toISOString().split('T')[0]}`,
            ctx.currentUser ? `USER CONTEXT: You are talking to ${ctx.currentUser.email} (Name: ${ctx.currentUser.name || 'Unknown'}, Role: ${userRole || 'Unknown'}).` : '',

            // Layer 1: Principles
            ORB_PRINCIPLES,
            ORB_RESOLUTION_LAWS,

            // Layer 2: Domain Knowledge
            `VALID VALUES: Statuses: ${statusNames} | Priorities: ${priorityInfo}`,
            STATUS_VOCABULARY,
            `The BACKLOG below separates ACTIVE from PARKED — use this split, not your own filtering. When the user asks "how many tasks" or "my tasks" without specifying, report the ACTIVE count. If parked tasks exist, mention them separately.`,
            buildUrgencyRules(ctx.urgencyThresholdHours),
            `SCOPE:\n- You can see and discuss ALL projects in the backlog.\n- When creating or updating todos, default to the currently selected project "${ctx.current?.name}" (code: "${ctx.current?.code}") unless the user explicitly names a different project.\n- When calling tools (create_todo, query_todos, etc.), ALWAYS pass the project code — never omit it.\n- When speaking to the user, refer to projects by display name.\n- SCOPE TRANSPARENCY (mandatory): Every response that mentions task counts, lists, or summaries MUST name the project(s) involved. Say "You have 3 open tasks in ${ctx.current?.name}" or "Across all projects, you have 12 open tasks." NEVER give a count without naming the scope.\n- STRATEGIC GUIDANCE & RECOMMENDATIONS: When the user asks for strategic guidance, task recommendations, workload summaries, or next steps (e.g., "what should I do next?", "what should I work on?"), you MUST ONLY recommend or surface active tasks from projects owned by the current user (where the project owner listed in the backlog is the current user's name: "${ctx.currentUser.name || ctx.currentUser.email}"). Do NOT suggest or highlight tasks from projects owned by other users.`,
            req.uiContext ? `UI STATE: The user is viewing: ${req.uiContext.viewMode ?? 'list'} view | filter: ${req.uiContext.filterStatus ?? 'active'} | priority filter: ${req.uiContext.filterPriority ?? 'all'} | sort: ${req.uiContext.sortAsc ? 'oldest first' : 'newest first'} | orb pane: ${req.uiContext.orbPaneVisible ? 'visible' : 'hidden'} | list pane: ${req.uiContext.listPaneVisible ? 'visible' : 'hidden'} | device: ${req.uiContext.isMobile ? 'mobile' : 'desktop'}. Use this to understand what the user sees when they say "this view", "the list", "that column", etc.` : '',
            uiCatalog ? `UI CATALOG & NAVIGATION (the layout structure, buttons, views, and settings of the app):\n${uiCatalog}` : '',
            `BACKLOG (includes DORMANT section if any exist — answer dormant project questions from here, do not query):\n${ctx.contextString}`,
            `KNOWLEDGE BASE (Recent):\n${ctx.knowledgeList.slice(0, 5).map((k: any) => {
              const tags = (k.tags && k.tags.length > 0) ? ` [${k.tags.join(', ')}]` : ''
              let origin = ''
              if (k.origin_todo_id) {
                const srcTodo = ctx.todoList.find((t: any) => t.id === k.origin_todo_id)
                if (srcTodo) origin = ` [from: ${todoCode(srcTodo, ctx.productList)}]`
              }
              return `- [${k.projects?.name || k.projects?.code}] ${k.title}${tags}${origin}: ${k.content.slice(0, 100)}...`
            }).join('\n')}\n(Note: Use the 'search_knowledge' tool to query the full repository if the answer isn't here.)`,
            ORB_QUERY_ROUTING,
            `DATABASE SCHEMA (for query_db):\n${DB_SCHEMA}`,
            ORB_SCOPE_RULES,
            `WHAT'S NEW (recent releases — use when the user asks "what's new?", "what changed?", or "what version is this?"):\n${CHANGELOG.slice(0, 3).map(r => `${r.version} (${r.date}):\n${r.changes.map(c => `  - ${c}`).join('\n')}`).join('\n\n')}`,

            // Layer 3: Behavioral Guidelines
            buildMutationApprovalPrompt(ctx.preferenceList),
            ctx.behaviorRuleList.length > 0
              ? `BEHAVIORAL RULES (agreed with the user — always enforce):\n${ctx.behaviorRuleList.map((r: any) => `- **${r.title}:** ${r.content}`).join('\n')}`
              : '',
            ORB_SESSION_ADAPTATION,
            ORB_SELF_DIAGNOSTICS,
            ORB_PREFERENCE_DISCOVERY,
            buildPreferencesPrompt(ctx.preferenceList),
            buildSurveyPrompt(req.uiContext?.daysActive, ctx.preferenceList),
            ORB_PROACTIVE_TONE,
            buildObservationsPrompt(ctx.observations, ctx.guidanceLevel),
            ORB_ATTRIBUTION,
            ORB_MUTATION_VERIFICATION,
            ORB_FEEDBACK_TONE,
            ORB_DEV_CHANNEL_PROMPT,
          ].filter(Boolean).join('\n\n'),
          messages,
          tools: [...ORB_TOOLS, ...ORB_PREFERENCE_TOOLS, ORB_CAPABILITIES_TOOL, ORB_DEV_CHANNEL_TOOL],
          stream: true,
        })

        let currentTurnSpeech = ''
        const baseSpeech = accumulatedSpeech
        const toolCalls: any[] = []

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

        // Mutation tools that change data — used to inject verification signals
        const MUTATION_TOOLS = new Set([
          'create_todo', 'update_todo', 'delete_todo', 'move_todo',
          'create_project', 'update_project', 'delete_project', 'set_dormancy',
          'create_ticket', 'add_knowledge', 'set_preference',
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
            const label = input.action === 'switch_project' ? `Switched to ${input.target}`
              : input.action === 'check_update' ? 'Checking for updates…'
              : input.action === 'apply_update' ? 'Updating…'
              : 'Navigating...'
            stream.update({ speech: accumulatedSpeech, thought: label, clientAction: { action: input.action, target: input.target } })
            output = { ok: true }
          } else if (tc.name === 'search_knowledge') {
            let results = ctx.knowledgeList.slice()
            if (input.product_code) {
                const p = ctx.productList.find((pp: any) => pp.code?.toUpperCase() === String(input.product_code).toUpperCase())
                if (p) results = results.filter((k: any) => k.product_id === p.id)
            }
            if (input.query) {
                const q = String(input.query)
                results = results.filter((k: any) => fuzzyMatch(q, `${k.title} ${k.content}`))
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
            const res = await createProject({
              name: input.name,
              code: input.code || null,
              description: input.description || null,
              ownerId: auth.user.id,
            })
            if (res.error) {
              output = { error: res.error }
            } else {
              const project = res.project!
              output = { ok: true, code: project.code, name: project.name }
              // Push into live context so subsequent tool calls (e.g. create_todo)
              // in the same turn can resolve the new project code (fixes ORB-136)
              ctx.productList.push(project)
              stream.update({ speech: accumulatedSpeech, thought: `Created project ${project.code}`, refresh: true, mutationType: 'project_create', newProject: project })
            }
          } else if (tc.name === 'update_project') {
            const code = String(input.project_code || '').toUpperCase()
            const projectQuery = supabase.from('projects').select('id, code, name, description, created_by').ilike('code', code)
            if (!auth.isAdmin) projectQuery.eq('created_by', auth.user.id)
            const { data: project } = await projectQuery.maybeSingle()
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
                const { data: conflict } = await auth.admin.from('projects').select('id').ilike('code', cleanCode).eq('created_by', project.created_by).neq('id', project.id).is('deleted_at', null).maybeSingle()
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
              const delProjectQuery = supabase.from('projects').select('id, code, name, created_by').ilike('code', code)
              if (!auth.isAdmin) delProjectQuery.eq('created_by', auth.user.id)
              const { data: project } = await delProjectQuery.maybeSingle()
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
                  const resultRows = rows ?? []
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
            output = getCapabilities(input.section || 'all')

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
          }
          } catch (toolErr: any) {
            // Safety net: if any tool handler throws, catch it cleanly
            // instead of crashing the entire streaming loop
            console.error(`[orbConverse] Tool "${tc.name}" threw:`, toolErr)
            output = { error: `Tool execution failed: ${toolErr.message || 'Unknown error'}` }
          }

          if (output?.error) {
            stream.update({ speech: accumulatedSpeech, thought: `Error: ${output.error}` })
          }

          // For mutation tools, inject explicit verification signals so the model
          // cannot ignore errors or fabricate codes in its post-tool response
          if (MUTATION_TOOLS.has(tc.name)) {
            if (output?.error) {
              output._verification = `VERIFICATION: This "${tc.name}" call FAILED with error: "${output.error}". You MUST tell the user it failed. Do NOT claim success or cite any codes.`
            } else {
              output._verification = `VERIFICATION: This "${tc.name}" call SUCCEEDED. Report ONLY the code/ID returned in this result. Do NOT invent or guess any codes.`
            }
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
    const ctx = await buildContext(auth.supabase, auth, productId)

    if (ctx.todoList.length === 0) return null

    const observationsSection = ctx.observations.length > 0
      ? `\n\nPROACTIVE OBSERVATIONS (pick the most relevant one to weave into your opening — do not list them all):\n${ctx.observations.slice(0, 2).map(o => `- ${o}`).join('\n')}`
      : ''

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 200,
      system: `You are the voice of the orb. Generate a brief, ambient opening observation (1-2 sentences) based on the backlog below. Plain text, no markdown. Factual tone — no cheerleading. Address the user directly ("you"). Do not greet them or say hello. SCOPE TRANSPARENCY: Every number you cite must state its scope — say "across all projects" or name the specific projects by their display names (e.g. "across Orb, Helm"). Never present a count without saying where it comes from. Only state facts visible in the backlog — do not infer patterns or compute statistics. If a proactive observation is provided, prefer weaving it into the opening naturally over generic backlog stats.\n\n${STATUS_VOCABULARY}${observationsSection}`,
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
