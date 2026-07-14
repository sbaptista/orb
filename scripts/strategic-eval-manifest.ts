import { STRATEGIC_EVAL_CASES } from './strategic-eval-cases'
import { ORB_EVAL_DEFAULT_MODEL } from '../lib/orb-model/gemini'

export const STRATEGIC_EVAL_MANIFEST = {
  id: 'orb-334-gemini-default-2026-07-13',
  createdAt: '2026-07-13',
  contextPacketVersion: 'pending-frozen-packets-v1',
  promptVersion: 'orb-system-v0.6.40',
  candidates: [
    { provider: 'google', model: ORB_EVAL_DEFAULT_MODEL, role: 'reference' },
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
