const REPOSITORY_ROLE_NAMES = new Set(['admin', 'super admin', 'developer'])

export function canRoleInspectRepository(role: string): boolean {
  return REPOSITORY_ROLE_NAMES.has(role.trim().toLowerCase())
}
