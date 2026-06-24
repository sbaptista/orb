import { STRATEGIC_EVAL_CASES } from './strategic-eval-cases'

export const STRATEGIC_EVAL_MANIFEST = {
  id: 'orb-265-exploratory-2026-06-23',
  createdAt: '2026-06-23',
  contextPacketVersion: 'pending-frozen-packets-v1',
  promptVersion: 'orb-system-v0.6.40',
  candidates: [
    { provider: 'anthropic', model: 'claude-haiku-4-5', role: 'reference' },
    { provider: 'google', model: 'gemini-3.1-pro-preview', role: 'challenger' },
    { provider: 'mistral', model: 'mistral-medium-latest', role: 'challenger' },
  ],
  scenarioIds: [
    'urgent-next-step',
    'urgency-versus-momentum',
    'stale-task-disposition',
    'preference-aware-advice',
    'uncertainty-over-invention',
    'quick-wins-without-evasion',
    'project-balance',
    'adaptation-evidence',
    'operational-not-coaching',
    'silence-is-correct',
  ],
  runsPerScenario: 3,
  feasibility: {
    monthlyCapUsd: 40,
    strategicInteractionsPerMonth: 300,
    maxAcceptedStrategicAnswerUsd: 0.08,
    strategicBudgetUsd: 24,
    nonStrategicReserveUsd: 16,
  },
  rubric: ['grounding', 'judgment', 'specificity', 'restraint', 'attunement', 'followThrough'],
} as const

export const STRATEGIC_EXPLORATORY_CASES = STRATEGIC_EVAL_MANIFEST.scenarioIds.map(id => {
  const scenario = STRATEGIC_EVAL_CASES.find(candidate => candidate.id === id)
  if (!scenario) throw new Error(`Missing strategic scenario: ${id}`)
  return scenario
})
