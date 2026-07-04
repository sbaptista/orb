// ────────────────────────────────────────────────────────────────────────────
// Deterministic mutation spine — the "correctness" half of the Orb.
//
// Principle (see WIP.md): the non-deterministic Orb decides WHAT; this module
// owns WHEN and WHICH. Mutation tools PROPOSE; a single confirm step EXECUTES
// the exact stored intent. Identity is a resolved row id, never a free-text name.
//
// Scope (this pass): PROJECT mutations only. Todo mutations remain on the legacy
// gate until the follow-up pass; the resolution sophistication here (fuzzy name
// matching) is project-specific by design — todos are identified by their stable
// code and need no such resolution.
// ────────────────────────────────────────────────────────────────────────────

import type { createAdminClient } from '@/lib/supabase/admin'
import { createProject } from '@/app/actions/manage-project'
import { logAuditEvent } from '@/lib/audit'

type Admin = ReturnType<typeof createAdminClient>

export const PENDING_TTL_MS = 5 * 60 * 1000

// Project mutations routed through propose/confirm/execute this pass.
export const PROJECT_MUTATIONS = new Set(['create_project', 'update_project', 'delete_project'])

// Knowledge mutations ride the same spine. Update only — there is deliberately
// NO knowledge delete tool: deletion is reserved for admins in the Settings UI,
// and the Orb files a create_ticket when it detects staleness it cannot fix
// with an update (ORB-302).
export const KNOWLEDGE_MUTATIONS = new Set(['update_knowledge'])

export type PendingMutationRow = {
  id: string
  user_id: string
  tool: string
  target_id: string | null
  params: Record<string, any>
  summary: string
  created_at: string
  expires_at: string
}

// ── Resolution: free-text reference → exactly one row, or 0 / N ───────────────

export type ProjectResolution =
  | { status: 'found'; id: string; name: string; code: string }
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

  let q = admin.from('projects').select('id, name, code, created_by').is('deleted_at', null)
  if (!ctx.isAdmin) q = q.eq('created_by', ctx.userId)
  const { data } = await q
  const projects = (data ?? []) as Array<{ id: string; name: string; code: string; created_by: string }>

  let matches = projects.filter(p => normalize(p.name) === ref)
  if (matches.length === 0) matches = projects.filter(p => (p.code ?? '').toLowerCase() === ref)
  if (matches.length === 0) matches = projects.filter(p => normalize(p.name).includes(ref))

  if (matches.length === 1) {
    const m = matches[0]
    return { status: 'found', id: m.id, name: m.name, code: m.code }
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
    .from('orb_pending_mutations')
    .select('*')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  return (data as PendingMutationRow) ?? null
}

export async function storePendingMutation(
  admin: Admin,
  userId: string,
  m: { tool: string; target_id: string | null; params: Record<string, any>; summary: string },
): Promise<void> {
  const now = new Date()
  await admin.from('orb_pending_mutations').upsert(
    {
      user_id: userId,
      tool: m.tool,
      target_id: m.target_id,
      params: m.params,
      summary: m.summary,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + PENDING_TTL_MS).toISOString(),
    },
    { onConflict: 'user_id' },
  )
}

export async function clearPendingMutation(admin: Admin, userId: string): Promise<void> {
  await admin.from('orb_pending_mutations').delete().eq('user_id', userId)
}

// ── Propose: resolve + validate, but DO NOT execute ───────────────────────────

export type ProposeResult =
  | { kind: 'propose'; target_id: string | null; params: Record<string, any>; summary: string }
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
    return {
      kind: 'propose',
      target_id: null,
      params: { name, code: input.code || null, description: input.description || null },
      summary: `create a new project called "${name}"`,
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
      params: { new_name: hasName ? input.new_name.trim() : undefined, new_description: hasDesc ? input.new_description : undefined },
      summary: parts.join(' and '),
    }
  }

  if (tool === 'delete_project') {
    return {
      kind: 'propose',
      target_id: res.id,
      params: {},
      summary: `permanently delete the project "${res.name}" and all of its todos`,
    }
  }

  return { kind: 'error', message: `I don't know how to ${tool}.` }
}

export async function proposeKnowledgeMutation(
  admin: Admin,
  tool: string,
  input: any,
): Promise<ProposeResult> {
  if (tool !== 'update_knowledge') return { kind: 'error', message: `I don't know how to ${tool}.` }

  const reference = String(input.title ?? '').trim()
  if (!reference) return { kind: 'error', message: 'Which knowledge entry did you mean?' }

  const res = await resolveKnowledgeReference(admin, reference)
  if (res.status === 'not_found') return { kind: 'error', message: `I don't see a knowledge entry called "${reference}". Try search_knowledge to find the exact title.` }
  if (res.status === 'ambiguous') {
    return { kind: 'ambiguous', candidates: res.candidates.map(c => ({ name: c.title })) }
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
    params: { new_content: hasContent ? input.new_content.trim() : undefined, new_title: hasTitle ? input.new_title.trim() : undefined },
    summary: `${parts.join(' and ')} for "${res.title}"`,
  }
}

// ── Execute: run the EXACT stored intent against the resolved id ──────────────

export type ExecuteResult =
  | { ok: true; summary: string; mutationType: 'project_create' | 'project_update' | 'project_delete' | 'knowledge_update'; code?: string; newProject?: any }
  | { ok: false; error: string }

export async function executePendingProjectMutation(
  admin: Admin,
  ctx: { userId: string; isAdmin: boolean },
  pending: PendingMutationRow,
): Promise<ExecuteResult> {
  const { tool, target_id, params } = pending

  if (tool === 'create_project') {
    const res = await createProject({
      name: params.name,
      code: params.code || null,
      description: params.description || null,
      ownerId: ctx.userId,
    })
    if (res.error) return { ok: false, error: res.error }
    const project = res.project!
    return { ok: true, summary: `Created project ${project.name}`, mutationType: 'project_create', code: project.code, newProject: project }
  }

  // update / delete: re-validate the target still exists and is owned (fail-safe).
  if (!target_id) return { ok: false, error: 'That action lost its target. Please ask again.' }
  const { data: project } = await admin
    .from('projects')
    .select('id, name, code, created_by')
    .eq('id', target_id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!project) return { ok: false, error: 'That project no longer exists.' }
  if (!ctx.isAdmin && project.created_by !== ctx.userId) {
    return { ok: false, error: 'You can only change your own projects.' }
  }

  if (tool === 'update_project') {
    const updates: Record<string, any> = {}
    if (typeof params.new_name === 'string' && params.new_name.trim() !== '') updates.name = params.new_name.trim()
    if (params.new_description !== undefined) updates.description = params.new_description || null
    if (Object.keys(updates).length === 0) return { ok: false, error: 'There was nothing to change.' }
    const { data: updated, error } = await admin
      .from('projects')
      .update(updates)
      .eq('id', target_id)
      .select('id, name, code')
      .single()
    if (error) return { ok: false, error: error.message }
    await logAuditEvent({ action: 'project_update', table_name: 'projects', record_id: target_id, after: updates, actor: 'orb', user_id: ctx.userId })
    return { ok: true, summary: `Renamed to ${updated.name}`, mutationType: 'project_update', code: updated.code }
  }

  if (tool === 'delete_project') {
    const { data: del, error } = await admin.from('projects').delete().eq('id', target_id).select()
    if (error) return { ok: false, error: error.message }
    if (!del || del.length === 0) return { ok: false, error: 'Delete affected no rows.' }
    await logAuditEvent({ action: 'project_delete', table_name: 'projects', record_id: target_id, actor: 'orb', user_id: ctx.userId })
    return { ok: true, summary: `Deleted project ${project.name}`, mutationType: 'project_delete', code: project.code }
  }

  return { ok: false, error: `I don't know how to ${tool}.` }
}

export async function executePendingKnowledgeMutation(
  admin: Admin,
  ctx: { userId: string },
  pending: PendingMutationRow,
): Promise<ExecuteResult> {
  const { target_id, params } = pending
  if (!target_id) return { ok: false, error: 'That action lost its target. Please ask again.' }

  const { data: entry } = await admin
    .from('knowledge_repo')
    .select('id, title, content')
    .eq('id', target_id)
    .maybeSingle()
  if (!entry) return { ok: false, error: 'That knowledge entry no longer exists.' }

  const updates: Record<string, any> = {}
  const hasNewContent = typeof params.new_content === 'string' && params.new_content.trim() !== ''
  const hasNewTitle = typeof params.new_title === 'string' && params.new_title.trim() !== ''
  if (!hasNewContent && !hasNewTitle) return { ok: false, error: 'There was nothing to change.' }

  // Any successful update carries a fresh sign-and-timestamp, whether or not
  // the content text itself changed — "any update" per the standing rule.
  updates.content = stampKnowledgeContent(hasNewContent ? params.new_content.trim() : entry.content)
  if (hasNewTitle) updates.title = params.new_title.trim()

  const { data: updated, error } = await admin
    .from('knowledge_repo')
    .update(updates)
    .eq('id', target_id)
    .select('id, title')
    .single()
  if (error) return { ok: false, error: error.message }
  await logAuditEvent({ action: 'knowledge_update', table_name: 'knowledge_repo', record_id: target_id, before: { title: entry.title, content: entry.content }, after: updates, actor: 'orb', user_id: ctx.userId })
  return { ok: true, summary: `Updated "${updated.title}"`, mutationType: 'knowledge_update' }
}
