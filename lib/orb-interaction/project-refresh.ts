export function selectedProjectAfterMutationRefresh(
  currentProjectId: string | null,
  refreshedProjects: Array<{ id: string }>,
  createdProjectId?: string,
): string | null {
  if (currentProjectId && refreshedProjects.some(project => project.id === currentProjectId)) {
    return currentProjectId
  }
  if (currentProjectId) return refreshedProjects[0]?.id ?? null
  if (createdProjectId && refreshedProjects.some(project => project.id === createdProjectId)) {
    return createdProjectId
  }
  return null
}

export function projectsAfterConfirmedDeletion<T extends { id: string }>(
  projects: T[],
  deletedProjectIds: string[],
): T[] {
  if (deletedProjectIds.length === 0) return projects
  const deleted = new Set(deletedProjectIds)
  return projects.filter(project => !deleted.has(project.id))
}

/** Project the committed receipt row immediately; a later read reconciles it. */
export function projectsAfterConfirmedCreation<T extends { id: string }>(
  projects: T[],
  createdProject?: T,
): T[] {
  if (!createdProject) return projects
  const existingIndex = projects.findIndex(project => project.id === createdProject.id)
  if (existingIndex < 0) return [...projects, createdProject]
  return projects.map((project, index) => index === existingIndex ? createdProject : project)
}

export function deletedProjectIdsFromPendingMutation(pending: {
  tool: string
  project_id: string | null
  params: Record<string, unknown>
}): string[] {
  if (pending.tool === 'delete_project') {
    return pending.project_id ? [pending.project_id] : []
  }
  if (pending.tool !== 'command_batch') return []
  const commands = Array.isArray(pending.params.commands) ? pending.params.commands : []
  return commands
    .filter((command): command is Record<string, unknown> =>
      Boolean(command) && typeof command === 'object' && (command as Record<string, unknown>).kind === 'delete_project',
    )
    .map(command => String(command.project_id ?? ''))
    .filter(Boolean)
}
