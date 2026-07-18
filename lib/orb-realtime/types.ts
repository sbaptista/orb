export type OrbRealtimeFactPacket = {
  kind: 'task_count' | 'next_step' | 'project_directory' | 'todo_details' | 'todo_list' | 'knowledge_search'
  observedAt: string
  source: 'database'
  statuses: string[]
  count: number
  project?: { id: string; name: string }
  projects?: Array<{ id: string; name: string }>
  task?: {
    id: string
    code: string
    title: string
    status: string
    priority: number | null
    project: string
  }
  tasks?: Array<{
    id: string
    code: string
    title: string
    status: string
    priority: number | null
    dueAt: string | null
    project: string
  }>
  knowledgeEntries?: Array<{
    id: string
    title: string
    content: string
    tags: string[]
    project: string | null
    projectCode: string | null
    updatedAt: string | null
  }>
  spokenText: string
}

export type OrbRealtimeProposal = {
  kind:
    | 'create_todo'
    | 'update_todo'
    | 'delete_todo'
    | 'move_todo'
    | 'close_todo'
    | 'create_project'
    | 'update_project'
    | 'delete_project'
    | 'add_knowledge'
    | 'update_knowledge'
  proposalToken: string
  project: { id: string; name: string; code: string }
  title: string
  code?: string
  destinationProject?: { id: string; name: string; code: string }
  changes?: {
    title?: string
    status?: 'open' | 'in progress' | 'deferred' | 'on hold'
    priority?: number
    name?: string
    description?: string | null
  }
  resolutionNotes?: string
  spokenText: string
}

export type OrbRealtimeMutationReceipt = {
  kind:
    | 'create_todo'
    | 'update_todo'
    | 'delete_todo'
    | 'move_todo'
    | 'close_todo'
    | 'create_project'
    | 'update_project'
    | 'delete_project'
    | 'add_knowledge'
    | 'update_knowledge'
  receiptId: string
  code: string
  oldCode?: string
  title: string
  project: string
  knowledgeEntryId?: string
  observedAt: string
  source: 'database'
  spokenText: string
}
