import { STRATEGIC_EVAL_CASES } from './strategic-eval-cases'
import { GEMINI_STRATEGIC_EVAL_MODEL } from '../lib/orb-model/gemini'
import { MOONSHOT_KIMI_K3_MODEL } from '../lib/orb-model/moonshot'

export const STRATEGIC_EVAL_MANIFEST = {
  id: 'orb-kimi-k3-candidate-r2-2026-08-15',
  createdAt: '2026-08-15',
  contextPacketVersion: 'pending-frozen-packets-v1',
  promptVersion: 'orb-system-v0.6.40',
  candidates: [
    { provider: 'google', model: GEMINI_STRATEGIC_EVAL_MODEL, role: 'reference' },
    { provider: 'moonshot', model: MOONSHOT_KIMI_K3_MODEL, role: 'candidate' },
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
