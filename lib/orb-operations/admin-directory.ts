import type { AuthContext } from '@/lib/auth'

const SUPER_ADMIN_ROLE_ID = 3

export type AdminDirectoryQuery = {
  search?: string
  status?: string
  maxResults?: number
}

function requireAdminDirectoryAccess(auth: AuthContext) {
  if (!auth.isAdmin) throw new Error('Admin access required')
}

function boundedLimit(value: number | undefined) {
  return Math.min(Math.max(value ?? 50, 1), 100)
}

function safeDirectorySearch(value: string | undefined) {
  return value?.trim().replace(/[^a-z0-9@._+\-\s]/gi, ' ').replace(/\s+/g, ' ').trim() ?? ''
}

export async function queryOrbUsers(auth: AuthContext, input: AdminDirectoryQuery = {}) {
  requireAdminDirectoryAccess(auth)
  const limit = boundedLimit(input.maxResults)
  let query = auth.admin
    .from('users')
    .select('id, email, first_name, last_name, role_id, release_stage, onboarded_at, program_joined_at, created_at')
    .order('email')
    .limit(limit)

  const search = safeDirectorySearch(input.search)
  if (search) {
    query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
  }

  const [{ data, error }, { data: roles, error: rolesError }] = await Promise.all([
    query,
    auth.admin.from('roles').select('id, name'),
  ])
  if (error) throw error
  if (rolesError) throw rolesError
  const roleNames = new Map((roles ?? []).map(role => [role.id, role.name]))
  const visible = auth.roleId === SUPER_ADMIN_ROLE_ID
    ? (data ?? [])
    : (data ?? []).filter(user => user.role_id !== SUPER_ADMIN_ROLE_ID)

  const users = visible.map(user => ({
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    role: roleNames.get(user.role_id) ?? 'unknown',
    release_stage: user.release_stage,
    onboarded_at: user.onboarded_at,
    program_joined_at: user.program_joined_at,
    created_at: user.created_at,
  }))
  return {
    kind: 'users_query' as const,
    observedAt: new Date().toISOString(),
    source: 'database' as const,
    count: visible.length,
    users,
    spokenText: users.length === 0
      ? 'I found no registered users matching that request.'
      : `I found ${users.length} matching registered ${users.length === 1 ? 'user' : 'users'}.`,
  }
}

export async function queryOrbInvitations(auth: AuthContext, input: AdminDirectoryQuery = {}) {
  requireAdminDirectoryAccess(auth)
  const limit = boundedLimit(input.maxResults)
  let query = auth.admin
    .from('invitations')
    .select('id, email, first_name, last_name, status, release_stage, invited_at, responded_at, decline_reason, role_id')
    .order('invited_at', { ascending: false })
    .limit(limit)

  const status = input.status?.trim()
  if (status && !['pending', 'accepted', 'declined'].includes(status)) {
    throw new Error('Invitation status must be pending, accepted, or declined')
  }
  if (status) query = query.eq('status', status)
  const search = safeDirectorySearch(input.search)
  if (search) {
    query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
  }

  const [{ data, error }, { data: roles, error: rolesError }] = await Promise.all([
    query,
    auth.admin.from('roles').select('id, name'),
  ])
  if (error) throw error
  if (rolesError) throw rolesError
  const roleNames = new Map((roles ?? []).map(role => [role.id, role.name]))
  const invitations = (data ?? []).map(invitation => ({
    id: invitation.id,
    email: invitation.email,
    first_name: invitation.first_name,
    last_name: invitation.last_name,
    status: invitation.status,
    release_stage: invitation.release_stage,
    invited_at: invitation.invited_at,
    responded_at: invitation.responded_at,
    decline_reason: invitation.decline_reason,
    role: roleNames.get(invitation.role_id) ?? 'unknown',
  }))
  return {
    kind: 'invitations_query' as const,
    observedAt: new Date().toISOString(),
    source: 'database' as const,
    count: data?.length ?? 0,
    invitations,
    spokenText: invitations.length === 0
      ? 'I found no invitations matching that request.'
      : `I found ${invitations.length} matching ${invitations.length === 1 ? 'invitation' : 'invitations'}.`,
  }
}
