export type OrbRealtimeFactPacket = {
  kind: 'task_count' | 'next_step' | 'project_directory' | 'todo_details' | 'todo_list'
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
  spokenText: string
}

export type OrbRealtimeProposal = {
  kind: 'create_todo' | 'update_todo' | 'delete_todo' | 'move_todo'
  proposalToken: string
  project: { id: string; name: string; code: string }
  title: string
  code?: string
  destinationProject?: { id: string; name: string; code: string }
  changes?: {
    title?: string
    status?: 'open' | 'in progress' | 'deferred' | 'on hold'
    priority?: number
  }
  spokenText: string
}

export type OrbRealtimeMutationReceipt = {
  kind: 'create_todo' | 'update_todo' | 'delete_todo' | 'move_todo'
  receiptId: string
  code: string
  oldCode?: string
  title: string
  project: string
  observedAt: string
  source: 'database'
  spokenText: string
}
