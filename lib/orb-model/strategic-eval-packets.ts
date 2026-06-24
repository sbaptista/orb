export type StrategicContextPacket = {
  id: string
  currentDate: string
  currentProject: string
  userName: string
  backlog: string
  knowledge: string
  preferences: string
  observations: string
}

const BASE_BACKLOG = `
ORBIT:
  ACTIVE:
  ORB-410 [P1] [in progress] Finish provider-neutral model evaluation [Due: 2026-06-25]
  ORB-411 [P2] [open] Add frozen strategic context packets
  ORB-412 [P2] [open] Investigate developer-channel polling overhead
  PARKED:
  ORB-376 [P3] [deferred] Revisit old onboarding copy

HELM:
  ACTIVE:
  HELM-88 [P1] [in progress] Resolve customer import failure [Due: 2026-06-23]
  HELM-91 [P2] [open] Review launch checklist

STUDIO:
  ACTIVE:
  STUDIO-54 [P3] [open] Refresh portfolio copy`

export const STRATEGIC_CONTEXT_PACKETS: Record<string, StrategicContextPacket> = {
  'urgent-next-step': {
    id: 'urgent-next-step', currentDate: '2026-06-23', currentProject: 'ORBIT', userName: 'Stan', backlog: BASE_BACKLOG,
    knowledge: 'HELM-88 has two recent audit updates but no recorded resolution. ORB-410 is the active evaluation dependency.',
    preferences: 'Keep planning concise. Prefer a concrete recommendation over a long list.',
    observations: 'Helm has recent active work; Studio has no recent closure evidence.',
  },
  'urgency-versus-momentum': {
    id: 'urgency-versus-momentum', currentDate: '2026-06-23', currentProject: 'ORBIT', userName: 'Stan', backlog: BASE_BACKLOG,
    knowledge: 'ORB-410 is already in progress. HELM-88 is due today, but the packet does not establish whether Stan owns or can unblock it.',
    preferences: 'Keep planning concise. Respect momentum when the evidence supports it.',
    observations: 'Two projects have active P1 work; dependency information is incomplete.',
  },
  'stale-task-disposition': {
    id: 'stale-task-disposition', currentDate: '2026-06-23', currentProject: 'ORBIT', userName: 'Stan', backlog: BASE_BACKLOG,
    knowledge: 'ORB-376 was deferred 90 days ago without later activity. No evidence says it is obsolete.',
    preferences: 'Recommend reversible actions when confidence is limited.',
    observations: 'ORB-376 is stale; its value is unknown.',
  },
  'preference-aware-advice': {
    id: 'preference-aware-advice', currentDate: '2026-06-23', currentProject: 'ORBIT', userName: 'Stan', backlog: BASE_BACKLOG,
    knowledge: 'ORB-410 is the current selected-project work. HELM-88 is urgent but ownership is not established.',
    preferences: 'Keep planning brief. Do not turn a request into a long planning exercise.',
    observations: 'Current work is concentrated in Orbit.',
  },
  'uncertainty-over-invention': {
    id: 'uncertainty-over-invention', currentDate: '2026-06-23', currentProject: 'ORBIT', userName: 'Stan', backlog: BASE_BACKLOG,
    knowledge: 'No task includes a recorded launch dependency. HELM-91 mentions a launch checklist but has no due date or dependency link.',
    preferences: 'Name uncertainty briefly when the evidence is incomplete.',
    observations: 'The packet contains no verified launch blocker.',
  },
  'quick-wins-without-evasion': { id: 'quick-wins-without-evasion', currentDate: '2026-06-23', currentProject: 'ORBIT', userName: 'Stan', backlog: BASE_BACKLOG, knowledge: 'ORB-411 and ORB-412 are open P2 tasks; no effort estimates are recorded.', preferences: 'Avoid easy work when it merely evades important work.', observations: 'Two P1 tasks remain in progress.' },
  'project-balance': { id: 'project-balance', currentDate: '2026-06-23', currentProject: 'ORBIT', userName: 'Stan', backlog: BASE_BACKLOG, knowledge: 'Studio has no closure evidence. No packet evidence establishes that Studio should be active now.', preferences: 'Do not nag about inactive projects without evidence.', observations: 'Recent activity is concentrated in Orbit and Helm.' },
  'adaptation-evidence': { id: 'adaptation-evidence', currentDate: '2026-06-23', currentProject: 'ORBIT', userName: 'Stan', backlog: BASE_BACKLOG, knowledge: 'The packet contains one stated preference: keep planning brief. It contains no repeated behavioral pattern.', preferences: 'Keep planning brief.', observations: 'No evidence supports saving a new memory.' },
  'operational-not-coaching': { id: 'operational-not-coaching', currentDate: '2026-06-23', currentProject: 'ORBIT', userName: 'Stan', backlog: BASE_BACKLOG, knowledge: 'No additional strategic context is needed for a direct create request.', preferences: 'Keep planning brief.', observations: 'Direct operational request.' },
  'silence-is-correct': { id: 'silence-is-correct', currentDate: '2026-06-23', currentProject: 'ORBIT', userName: 'Stan', backlog: BASE_BACKLOG, knowledge: 'Version under evaluation: v0.6.44.', preferences: 'Keep planning brief.', observations: 'No strategic intervention is warranted.' },
}
