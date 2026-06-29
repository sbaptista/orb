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
  | { kind: 'ambiguous'; candidates: Array<{ name: string; code: string }> }
  | { kind: 'error'; message: string }

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

// ── Execute: run the EXACT stored intent against the resolved id ──────────────

export type ExecuteResult =
  | { ok: true; summary: string; mutationType: 'project_create' | 'project_update' | 'project_delete'; code?: string; newProject?: any }
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
