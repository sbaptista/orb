import { isActive } from '@/lib/status-groups'
import type { ProjectHealthPacket } from './project-health'

export type NextStepSignal =
  | 'in_progress'
  | 'urgent'
  | 'due'
  | 'stale_active'
  | 'recent_activity'
  | 'low_priority'
  | 'owned_active_work'

export type NextStepCandidate = {
  code: string
  title: string
  projectName: string
  status: string
  priorityValue: number | null
  dueAt: string | null
  createdAt: string | null
  updatedAt: string | null
  score: number
  signals: NextStepSignal[]
}

export type NextStepPacket = {
  generatedAt: string
  currentUserName: string | null
  candidates: NextStepCandidate[]
  omittedOtherUserActiveCount: number
  note: string
}

type BuildNextStepPacketInput = {
  projects: any[]
  todos: any[]
  priorities: any[]
  auditEvents: any[]
  projectHealth: ProjectHealthPacket
  currentUserId: string
  currentUserName?: string | null
  generatedAt?: Date
  maxCandidates?: number
}

const DAY_MS = 86_400_000

function projectCode(todo: any, projects: any[]): string {
  const project = projects.find((p: any) => p.id === todo.product_id)
  return `${project?.code ?? project?.name ?? '???'}-${todo.todo_number}`
}

function isDueOrOverdue(dueAt: string | null | undefined, now: Date): boolean {
  if (!dueAt) return false
  const due = new Date(dueAt).getTime()
  if (Number.isNaN(due)) return false
  return due <= now.getTime()
}

function hasRecentActivity(todo: any, auditEvents: any[]): boolean {
  return (auditEvents ?? []).some((event: any) => event.record_id === todo.id)
}

export function buildNextStepPacket(input: BuildNextStepPacketInput): NextStepPacket {
  const generatedAt = input.generatedAt ?? new Date()
  const maxCandidates = input.maxCandidates ?? 6
  const projects = input.projects ?? []
  const ownedProjectIds = new Set(
    projects
      .filter((project: any) => project.created_by === input.currentUserId)
      .map((project: any) => project.id)
  )
  const projectById = new Map(projects.map((project: any) => [project.id, project]))
  const urgentPriorityValues = new Set<number>(
    (input.priorities ?? []).filter((p: any) => p.is_urgent).map((p: any) => p.value as number)
  )
  const staleCreatedBefore = generatedAt.getTime() - 30 * DAY_MS
  const staleUpdatedBefore = generatedAt.getTime() - 14 * DAY_MS

  const activeTodos = (input.todos ?? []).filter((todo: any) => isActive(todo.status))
  const ownedActiveTodos = activeTodos.filter((todo: any) => ownedProjectIds.has(todo.product_id))
  const omittedOtherUserActiveCount = activeTodos.length - ownedActiveTodos.length

  const candidates = ownedActiveTodos
    .map((todo: any): NextStepCandidate => {
      const signals: NextStepSignal[] = ['owned_active_work']
      let score = 0

      if (todo.status === 'in progress') {
        signals.push('in_progress')
        score += 35
      }

      if (todo.priority_value != null && urgentPriorityValues.has(todo.priority_value)) {
        signals.push('urgent')
        score += 45
      }

      if (isDueOrOverdue(todo.due_at, generatedAt)) {
        signals.push('due')
        score += 45
      }

      const createdAt = new Date(todo.created_at).getTime()
      const updatedAt = new Date(todo.updated_at ?? todo.created_at).getTime()
      if (createdAt <= staleCreatedBefore && updatedAt <= staleUpdatedBefore) {
        signals.push('stale_active')
        score += 16
      }

      if (hasRecentActivity(todo, input.auditEvents ?? [])) {
        signals.push('recent_activity')
        score += 20
      }

      if (todo.priority_value == null || todo.priority_value >= 4) {
        signals.push('low_priority')
        score += 5
      } else {
        score += Math.max(0, 18 - todo.priority_value * 3)
      }

      return {
        code: projectCode(todo, projects),
        title: todo.title,
        projectName: projectById.get(todo.product_id)?.name ?? 'Unknown project',
        status: todo.status,
        priorityValue: todo.priority_value ?? null,
        dueAt: todo.due_at ?? null,
        createdAt: todo.created_at ?? null,
        updatedAt: todo.updated_at ?? todo.created_at ?? null,
        score,
        signals,
      }
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, maxCandidates)

  const ownedProjectHealth = input.projectHealth.projects.filter(project => project.ownedByCurrentUser)
  const activeOwnedProjects = ownedProjectHealth.filter(project => project.activeCount > 0).length

  return {
    generatedAt: generatedAt.toISOString(),
    currentUserName: input.currentUserName ?? null,
    candidates,
    omittedOtherUserActiveCount,
    note: `Candidate set is limited to current-user-owned active tasks across ${activeOwnedProjects} owned project(s) with active work. Signals are evidence cues, not commands.`,
  }
}

export function renderNextStepPacket(packet: NextStepPacket): string {
  const lines = packet.candidates.map(candidate => {
    const due = candidate.dueAt ? `; due="${candidate.dueAt}"` : ''
    const priority = candidate.priorityValue == null ? 'P-' : `P${candidate.priorityValue}`
    return `- ${candidate.code}: project="${candidate.projectName}"; ${priority}; status="${candidate.status}"${due}; score=${candidate.score}; signals=[${candidate.signals.join(', ')}]; title="${candidate.title}"`
  })

  const omitted = packet.omittedOtherUserActiveCount > 0
    ? ` Other-user active tasks omitted from recommendations: ${packet.omittedOtherUserActiveCount}.`
    : ''

  return `NEXT-STEP PACKET (generated ${packet.generatedAt}):
${packet.note}${omitted}
Use these as recommendation candidates for "what should I work on next?" reads. Prefer one primary recommendation and, only if useful, one alternate. Do not treat scores as facts to reveal; explain using the signals and visible backlog evidence.
${lines.length > 0 ? lines.join('\n') : '- No current-user-owned active task candidates.'}`
}
