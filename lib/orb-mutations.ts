// ────────────────────────────────────────────────────────────────────────────
// Deterministic mutation spine — the "correctness" half of the Orb.
//
// Principle (see WIP.md): the non-deterministic Orb decides WHAT; this module
// owns WHEN and WHICH. Mutation tools PROPOSE; a single confirm step EXECUTES
// the exact stored intent. Identity is a resolved row id, never a free-text name.
//
// This module owns serial-facing project/knowledge resolution. Persistence and
// execution are transport-neutral in lib/orb-operations; todos use the same
// spine through lib/orb-operations/serial-todos.ts.
// ────────────────────────────────────────────────────────────────────────────

import type { createAdminClient } from '@/lib/supabase/admin'
import type { AuthContext } from '@/lib/auth'
import { generateUniqueCode } from '@/lib/project-codes'
import { persistOrbMutationProposal, type OrbMutationKind } from '@/lib/orb-operations/proposals'

type Admin = ReturnType<typeof createAdminClient>

export const PROJECT_MUTATIONS = new Set(['create_project', 'update_project', 'delete_project'])

// There is deliberately no knowledge delete tool: deletion is reserved for
// admins in Settings, and Orb files a ticket when stale content cannot be fixed.
export const KNOWLEDGE_MUTATIONS = new Set(['add_knowledge', 'update_knowledge'])

export type PendingMutationRow = {
  id: string
  user_id: string
  tool: string
  target_id: string | null
  project_id: string | null
  params: Record<string, any>
  summary: string
  created_at: string
  expires_at: string
  proposal_id: string
}

// ── Resolution: free-text reference → exactly one row, or 0 / N ───────────────

export type ProjectResolution =
  | { status: 'found'; id: string; name: string; code: string; description: string | null; updated_at: string }
  | { status: 'ambiguous'; candidates: Array<{ id: string; name: string; code: string }> }
  | { status: 'not_found' }

// Normalize for MATCHING only — preserve original text for display.
function normalize(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Resolve a human reference to a concrete project. A name is a search key, not
 * an identity: this returns 0 / 1 / N and lets the caller disambiguate. Match
 * order: exact name → exact code → unique substring on name.
 */
export async function resolveProjectReference(
  admin: Admin,
  reference: string,
  ctx: { userId: string; isAdmin: boolean },
): Promise<ProjectResolution> {
  const ref = normalize(reference)
  if (!ref) return { status: 'not_found' }

  let q = admin.from('projects').select('id, name, code, description, updated_at, created_by').is('deleted_at', null)
  if (!ctx.isAdmin) q = q.eq('created_by', ctx.userId)
  const { data } = await q
  const projects = (data ?? []) as Array<{ id: string; name: string; code: string; description: string | null; updated_at: string; created_by: string }>

  let matches = projects.filter(p => normalize(p.name) === ref)
  if (matches.length === 0) matches = projects.filter(p => (p.code ?? '').toLowerCase() === ref)
  if (matches.length === 0) matches = projects.filter(p => normalize(p.name).includes(ref))

  if (matches.length === 1) {
    const m = matches[0]
    return { status: 'found', id: m.id, name: m.name, code: m.code, description: m.description, updated_at: m.updated_at }
  }
  if (matches.length > 1) {
    return { status: 'ambiguous', candidates: matches.map(m => ({ id: m.id, name: m.name, code: m.code })) }
  }
  return { status: 'not_found' }
}

// Knowledge entries are identified by title the way projects are identified by
// name: a search key, not an identity. Match order: exact title → high-coverage
// partial. Ambiguity and misses fall through to the caller — never guess.
export type KnowledgeResolution =
  | { status: 'found'; id: string; title: string }
  | { status: 'ambiguous'; candidates: Array<{ id: string; title: string }> }
  | { status: 'not_found' }

// Grammatical/meta words that don't distinguish one title from another —
// excluded before computing word-overlap coverage so they can't inflate a
// weak match's score.
const RESOLUTION_FILLER_WORDS = new Set(['the', 'a', 'an', 'of', 'for', 'about', 'that', 'this', 'entry', 'entries', 'issue', 'issues', 'item', 'items', 'note', 'notes', 'record', 'records'])

// Strip leading/trailing punctuation per word (title case "budget:" and
// "(gotrue" must equal "budget"/"gotrue" for overlap to count them) while
// preserving internal punctuation that's part of the word itself (auth.flow_state).
function significantWords(s: string): string[] {
  return s
    .split(/\s+/)
    .map(w => w.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ''))
    .filter(w => w.length > 0 && !RESOLUTION_FILLER_WORDS.has(w))
}

export async function resolveKnowledgeReference(
  admin: Admin,
  reference: string,
): Promise<KnowledgeResolution> {
  const ref = normalize(reference)
  if (!ref) return { status: 'not_found' }

  const { data } = await admin.from('knowledge_repo').select('id, title')
  const entries = (data ?? []) as Array<{ id: string; title: string }>

  const exact = entries.filter(e => normalize(e.title) === ref)
  if (exact.length === 1) return { status: 'found', id: exact[0].id, title: exact[0].title }
  if (exact.length > 1) return { status: 'ambiguous', candidates: exact.map(e => ({ id: e.id, title: e.title })) }

  // No exact match — consider a partial reference, but ONLY when nearly all of
  // the reference's significant words appear in the candidate title, and the
  // reference itself is substantial (2+ significant words). A naive
  // one-directional substring check (does the title contain the reference?)
  // let a short/generic fragment like "ORB-159" match an unrelated 5-word title
  // that happened to end in "(ORB-159)" while missing the actual intended
  // entry — a real wrong-target mutation caught in ORB-302 live testing.
  // Scoring by "fraction of the REFERENCE found in the title" (not penalized
  // by how much longer the title is) lets a real partial reference like "Disk
  // IO budget auth.flow_state accumulation" still resolve, while a single
  // generic token cannot.
  const REF_COVERAGE_THRESHOLD = 0.8
  const MIN_REF_WORDS = 2
  const refWords = significantWords(ref)
  const candidates = refWords.length >= MIN_REF_WORDS
    ? entries
        .map(e => {
          const titleWords = significantWords(normalize(e.title))
          if (titleWords.length === 0) return null
          const overlap = refWords.filter(w => titleWords.includes(w)).length
          const refCoverage = overlap / refWords.length
          return refCoverage >= REF_COVERAGE_THRESHOLD ? e : null
        })
        .filter((e): e is { id: string; title: string } => e !== null)
    : []

  if (candidates.length === 1) return { status: 'found', id: candidates[0].id, title: candidates[0].title }
  if (candidates.length > 1) return { status: 'ambiguous', candidates: candidates.map(e => ({ id: e.id, title: e.title })) }
  return { status: 'not_found' }
}

// ── Pending store (server-held; one row per user, superseded on each propose) ──

export async function getPendingMutation(admin: Admin, userId: string): Promise<PendingMutationRow | null> {
  const { data } = await admin
    .from('orb_realtime_proposals')
    .select('*')
    .eq('user_id', userId)
    .eq('channel', 'serial')
    .eq('status', 'proposed')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    proposal_id: data.id,
    user_id: data.user_id,
    tool: data.kind,
    target_id: data.target_todo_id ?? data.project_id ?? data.params?.knowledge_id ?? null,
    project_id: data.project_id ?? null,
    params: data.params ?? {},
    summary: data.summary ?? data.title,
    created_at: data.created_at,
    expires_at: data.expires_at,
  }
}

export async function storePendingMutation(
  auth: AuthContext,
  m: {
    tool: string
    target_id: string | null
    params: Record<string, any>
    summary: string
    title?: string
    project_id?: string | null
    destination_project_id?: string | null
  },
){
  await auth.admin
    .from('orb_realtime_proposals')
    .delete()
    .eq('user_id', auth.user.id)
    .eq('channel', 'serial')
    .eq('status', 'proposed')
  const isTodo = ['update_todo', 'delete_todo', 'move_todo', 'close_todo'].includes(m.tool)
  const isProject = ['update_project', 'delete_project'].includes(m.tool)
  return persistOrbMutationProposal(auth, {
    kind: m.tool as OrbMutationKind,
    title: (m.title ?? m.summary).slice(0, 240),
    projectId: m.project_id ?? (isProject ? m.target_id : null),
    params: m.params,
    targetTodoId: isTodo ? m.target_id : null,
    destinationProjectId: m.destination_project_id ?? null,
    channel: 'serial',
    summary: m.summary,
  })
}

export async function clearPendingMutation(admin: Admin, userId: string): Promise<void> {
  await admin
    .from('orb_realtime_proposals')
    .delete()
    .eq('user_id', userId)
    .eq('channel', 'serial')
    .eq('status', 'proposed')
}

// ── Propose: resolve + validate, but DO NOT execute ───────────────────────────

export type ProposeResult =
  | {
      kind: 'propose'
      target_id: string | null
      project_id?: string | null
      params: Record<string, any>
      summary: string
      title: string
    }
  | { kind: 'ambiguous'; candidates: Array<{ name: string; code?: string }> }
  | { kind: 'error'; message: string }

// Deterministic sign-and-stamp for any knowledge update — NOT model-composed,
// so it can never be skipped, malformed, or omitted by the model. Matches the
// "YYYY-MM-DD — Orb (Model)" attribution convention used elsewhere (resolution
// notes, add_knowledge), but with a time component since updates can happen
// multiple times same day. Strips any prior stamp so repeated updates show
// only the current one — full history lives in audit_log, not stacked in content.
const KNOWLEDGE_STAMP_RE = /^\[Updated: [^\]]+\]\n\n/

function stampKnowledgeContent(content: string): string {
  const stamp = `[Updated: ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC — Orb (Haiku 4.5)]`
  const stripped = content.replace(KNOWLEDGE_STAMP_RE, '')
  return `${stamp}\n\n${stripped}`
}

export async function proposeProjectMutation(
  admin: Admin,
  ctx: { userId: string; isAdmin: boolean },
  tool: string,
  input: any,
): Promise<ProposeResult> {
  if (tool === 'create_project') {
    const name = String(input.name ?? '').trim()
    if (!name) return { kind: 'error', message: 'I need a name for the new project.' }
    const { data: conflict } = await admin
      .from('projects')
      .select('name')
      .ilike('name', name)
      .eq('created_by', ctx.userId)
      .is('deleted_at', null)
      .maybeSingle()
    if (conflict) return { kind: 'error', message: `You already have a project named "${name}".` }
    const requestedCode = typeof input.code === 'string' ? input.code.trim().toUpperCase() : ''
    const candidateCode = requestedCode || await generateUniqueCode(admin, name, ctx.userId)
    if (!/^[A-Z0-9]{1,10}$/.test(candidateCode)) {
      return { kind: 'error', message: 'The project code must be 1–10 uppercase letters or numbers.' }
    }
    const { data: codeConflict } = await admin
      .from('projects')
      .select('id')
      .eq('created_by', ctx.userId)
      .ilike('code', candidateCode)
      .is('deleted_at', null)
      .maybeSingle()
    if (codeConflict) return { kind: 'error', message: `The project code "${candidateCode}" is already in use.` }
    return {
      kind: 'propose',
      target_id: null,
      project_id: null,
      params: { candidate_code: candidateCode, description: input.description || null },
      summary: `create a new project called "${name}"`,
      title: name,
    }
  }

  // update / delete target an existing project — resolve the reference first.
  const reference = String(input.name ?? '').trim()
  if (!reference) return { kind: 'error', message: 'Which project did you mean?' }

  const res = await resolveProjectReference(admin, reference, ctx)
  if (res.status === 'not_found') return { kind: 'error', message: `I don't see a project called "${reference}".` }
  if (res.status === 'ambiguous') {
    return { kind: 'ambiguous', candidates: res.candidates.map(c => ({ name: c.name, code: c.code })) }
  }

  if (tool === 'update_project') {
    const hasName = typeof input.new_name === 'string' && input.new_name.trim() !== ''
    const hasDesc = input.new_description !== undefined
    if (!hasName && !hasDesc) return { kind: 'error', message: 'What would you like to change about it?' }
    const parts: string[] = []
    if (hasName) parts.push(`rename "${res.name}" to "${input.new_name.trim()}"`)
    if (hasDesc) parts.push(`update its description`)
    return {
      kind: 'propose',
      target_id: res.id,
      project_id: res.id,
      params: {
        expected_updated_at: res.updated_at,
        expected_name: res.name,
        expected_code: res.code,
        expected_description: res.description,
        ...(hasName ? { new_name: input.new_name.trim() } : {}),
        ...(hasDesc ? { new_description: input.new_description } : {}),
      },
      summary: parts.join(' and '),
      title: res.name,
    }
  }

  if (tool === 'delete_project') {
    return {
      kind: 'propose',
      target_id: res.id,
      project_id: res.id,
      params: {
        expected_updated_at: res.updated_at,
        expected_name: res.name,
        expected_code: res.code,
        expected_description: res.description,
      },
      summary: `permanently delete the project "${res.name}" and all of its todos`,
      title: res.name,
    }
  }

  return { kind: 'error', message: `I don't know how to ${tool}.` }
}

export async function proposeKnowledgeMutation(
  admin: Admin,
  ctx: { userId: string; isAdmin: boolean },
  tool: string,
  input: any,
): Promise<ProposeResult> {
  if (tool === 'add_knowledge') {
    const title = String(input.title ?? '').trim().slice(0, 240)
    const content = String(input.content ?? '').trim()
    if (!title || !content) return { kind: 'error', message: 'A knowledge title and content are required.' }
    const code = String(input.product_code ?? '').trim()
    if (!code) return { kind: 'error', message: 'Choose a project before saving knowledge.' }
    let query = admin
      .from('projects')
      .select('id, name, code, created_by')
      .ilike('code', code)
      .is('deleted_at', null)
    if (!ctx.isAdmin) query = query.eq('created_by', ctx.userId)
    const { data: project, error } = await query.maybeSingle()
    if (error || !project) return { kind: 'error', message: `Project "${code}" was not found or is not editable.` }
    const attributed = `${new Date().toISOString().slice(0, 10)} — Orb (Claude Haiku 4.5)\n\n${content}`
    return {
      kind: 'propose',
      target_id: null,
      project_id: project.id,
      params: {
        content: attributed,
        tags: Array.from(new Set((Array.isArray(input.tags) ? input.tags : [])
          .map((tag: unknown) => String(tag).trim())
          .filter(Boolean))).slice(0, 20),
      },
      summary: `save the knowledge entry "${title}" in ${project.name}`,
      title,
    }
  }
  if (tool !== 'update_knowledge') return { kind: 'error', message: `I don't know how to ${tool}.` }

  const reference = String(input.title ?? '').trim()
  if (!reference) return { kind: 'error', message: 'Which knowledge entry did you mean?' }

  const res = await resolveKnowledgeReference(admin, reference)
  if (res.status === 'not_found') return { kind: 'error', message: `I don't see a knowledge entry called "${reference}". Try search_knowledge to find the exact title.` }
  if (res.status === 'ambiguous') {
    return { kind: 'ambiguous', candidates: res.candidates.map(c => ({ name: c.title })) }
  }

  const { data: entry, error: entryError } = await admin
    .from('knowledge_repo')
    .select('id, title, content, tags, updated_at, product_id')
    .eq('id', res.id)
    .single()
  if (entryError || !entry) {
    return { kind: 'error', message: 'That knowledge entry is no longer available.' }
  }

  const hasContent = typeof input.new_content === 'string' && input.new_content.trim() !== ''
  const hasTitle = typeof input.new_title === 'string' && input.new_title.trim() !== ''
  if (!hasContent && !hasTitle) return { kind: 'error', message: 'What would you like to change about it?' }
  const parts: string[] = []
  if (hasContent) parts.push('update its content')
  if (hasTitle) parts.push(`rename it to "${input.new_title.trim()}"`)
  return {
    kind: 'propose',
    target_id: res.id,
    project_id: entry.product_id,
    params: {
      knowledge_id: entry.id,
      expected_updated_at: entry.updated_at,
      expected_title: entry.title,
      expected_content: entry.content,
      expected_product_id: entry.product_id,
      expected_tags: entry.tags ?? [],
      new_content: stampKnowledgeContent(hasContent ? input.new_content.trim() : entry.content),
      ...(hasTitle ? { new_title: input.new_title.trim() } : {}),
    },
    summary: `${parts.join(' and ')} for "${res.title}"`,
    title: res.title,
  }
}
