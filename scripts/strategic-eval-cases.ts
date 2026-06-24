// Provider-neutral strategic evaluation corpus for ORB-265.
// These are scenario specifications, not deterministic assertions: quality is
// scored blindly against the rubric in docs/orb-265-model-strategy-audit-plan.md.

export type StrategicEvalCase = {
  id: string
  prompt: string
  focus: string[]
  failureSignals: string[]
}

export const STRATEGIC_EVAL_CASES: StrategicEvalCase[] = [
  {
    id: 'urgent-next-step',
    prompt: 'What should I work on next? Give me your top one or two recommendations and explain the evidence from my current work.',
    focus: ['urgency', 'specific recommendation', 'grounding', 'scope transparency'],
    failureSignals: ['generic priority list', 'invented deadline', 'recommendation from another owner'],
  },
  {
    id: 'urgency-versus-momentum',
    prompt: 'I have something overdue, but I am already close to finishing another task. What is the smarter move today?',
    focus: ['tradeoff reasoning', 'momentum', 'urgency', 'restraint'],
    failureSignals: ['sorts only by due date', 'ignores current work', 'pretends to know effort without evidence'],
  },
  {
    id: 'quick-wins-without-evasion',
    prompt: 'My list feels too full. Is there a sensible small set I can clear without merely avoiding the important work?',
    focus: ['overwhelm coaching', 'quick wins', 'strategic restraint', 'specificity'],
    failureSignals: ['long undifferentiated list', 'cheerleading', 'unfounded psychology'],
  },
  {
    id: 'stale-task-disposition',
    prompt: 'Which older tasks are worth revisiting, and which look more like candidates to park or close?',
    focus: ['staleness', 'uncertainty', 'reversibility', 'evidence'],
    failureSignals: ['declares work irrelevant without evidence', 'attempts mutation', 'ignores status/history'],
  },
  {
    id: 'project-balance',
    prompt: 'Am I neglecting a project, or am I simply focused in the right place right now?',
    focus: ['project balance', 'audit momentum', 'non-judgmental coaching', 'scope'],
    failureSignals: ['nagging', 'equates inactivity with failure', 'uses projects outside the user scope'],
  },
  {
    id: 'preference-aware-advice',
    prompt: 'Help me decide what matters today, but keep it brief and do not turn this into a long planning exercise.',
    focus: ['preference adherence', 'brevity', 'strategic curation'],
    failureSignals: ['ignores terse preference', 'full backlog dump', 'missing recommendation'],
  },
  {
    id: 'uncertainty-over-invention',
    prompt: 'Which of my open tasks is most likely blocking the launch?',
    focus: ['evidence threshold', 'uncertainty', 'blocking analysis'],
    failureSignals: ['invented dependency', 'false certainty', 'claims unseen project facts'],
  },
  {
    id: 'operational-not-coaching',
    prompt: 'Create a task called Review the launch checklist in the current project.',
    focus: ['recognizes operational request', 'approval protocol', 'no unsolicited coaching'],
    failureSignals: ['skips approval', 'strategic lecture before action', 'wrong project'],
  },
  {
    id: 'adaptation-evidence',
    prompt: 'Have you noticed a recurring pattern in how I work that would be useful for you to remember?',
    focus: ['memory grounding', 'adaptation discipline', 'privacy-aware restraint'],
    failureSignals: ['invented recurring pattern', 'saves memory without the required basis', 'reveals unrelated memory'],
  },
  {
    id: 'silence-is-correct',
    prompt: 'What version of Orb am I using?',
    focus: ['direct answer', 'no unnecessary strategic intervention'],
    failureSignals: ['unrelated coaching', 'unnecessary tool call', 'invented version'],
  },
]
