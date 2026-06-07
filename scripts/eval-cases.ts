// Orb Eval Test Cases
// Add new cases by appending to the EVAL_CASES array.
// Each case tests a specific Orb behavior — tool correctness or speech content.

export type EvalCase = {
  id: string
  description: string
  productCode: string              // which project is "selected" in the UI
  input: string                    // what the user says to the Orb
  history?: Array<{ role: 'user' | 'assistant'; text: string }>

  // Tier 1: Tool call assertions (deterministic)
  expectTool?: {
    name: string
    params?: Record<string, any>   // partial match — every key must match
  }
  expectNoTool?: boolean           // assert that no tool was called

  // Tier 2: Speech assertions (statistical — run multiple times, majority pass)
  speechContains?: string[]        // all must appear (case-insensitive)
  speechNotContains?: string[]     // none should appear (case-insensitive)
  speechPattern?: RegExp           // regex match on speech

  // Config
  tier: 1 | 2                     // Tier 1 = deterministic (1 run), Tier 2 = statistical (3 runs)
}

export const EVAL_CASES: EvalCase[] = [

  // ═══════════════════════════════════════════════════════════════════════
  // TIER 1: Tool correctness (deterministic — single run, pass/fail)
  // ═══════════════════════════════════════════════════════════════════════

  {
    id: 'create-default-project',
    description: 'Creating a task without naming a project uses the selected project',
    productCode: 'ORB',
    input: 'Create a task: [EVAL] test default project routing',
    tier: 1,
    expectTool: {
      name: 'create_todo',
      params: { product_code: 'ORB' },
    },
  },

  {
    id: 'create-explicit-project',
    description: 'Creating a task with an explicit project name routes to that project',
    productCode: 'ORB',
    input: 'Add a task to Helm: [EVAL] test explicit project routing',
    tier: 1,
    expectTool: {
      name: 'create_todo',
      params: { product_code: 'HELM' },
    },
  },

  {
    id: 'query-uses-tool',
    description: 'Asking about tasks triggers query_todos',
    productCode: 'ORB',
    input: 'Show me all open tasks in Orb',
    tier: 1,
    expectTool: { name: 'query_todos' },
  },

  {
    id: 'conversational-no-tool',
    description: 'A greeting or conversational message does not trigger a tool call',
    productCode: 'ORB',
    input: 'Hi there, how are you?',
    tier: 1,
    expectNoTool: true,
  },

  {
    id: 'knowledge-search-tool',
    description: 'Asking about a knowledge topic triggers search_knowledge',
    productCode: 'ORB',
    input: 'What do we know about the disk IO budget issue?',
    tier: 1,
    expectTool: { name: 'search_knowledge' },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // TIER 2: Behavioral correctness (statistical — 3 runs, pass 2/3)
  // ═══════════════════════════════════════════════════════════════════════

  {
    id: 'scope-transparency',
    description: 'When reporting task counts, the Orb states which project(s) it is counting from',
    productCode: 'ORB',
    input: 'How many open tasks do I have in Orb?',
    tier: 2,
    speechContains: ['orb'],
  },

  {
    id: 'cross-project-awareness',
    description: 'The Orb can answer questions about other projects without being told to switch',
    productCode: 'ORB',
    input: 'What is happening in Helm?',
    tier: 2,
    speechNotContains: ['I can only see', 'not in scope', 'switch to helm first'],
  },

  {
    id: 'refuses-unknown-feature',
    description: 'The Orb discloses when a feature is not supported instead of hallucinating',
    productCode: 'ORB',
    input: 'Set up a recurring daily task to check my email',
    tier: 2,
    speechContains: ['not supported', 'don\'t support', 'can\'t', 'cannot', 'doesn\'t support', 'not available', 'recurring'],
    // At least one of these should appear — checked as "any match" in the runner
  },

  {
    id: 'uses-display-name',
    description: 'The Orb refers to projects by display name, not code, in speech',
    productCode: 'ORB',
    input: 'Tell me about my Orb project',
    tier: 2,
    speechContains: ['orb'],
    speechNotContains: ['product_code', 'product_id'],
  },

  {
    id: 'whats-new',
    description: 'The Orb can answer what\'s new from the changelog',
    productCode: 'ORB',
    input: 'What\'s new in the latest version?',
    tier: 2,
    speechPattern: /v?0\.5\.\d+/,  // mentions a version number
  },

  {
    id: 'mutation-approval',
    description: 'The Orb proposes mutations before executing (asks for confirmation)',
    productCode: 'ORB',
    input: 'Delete all my closed tasks',
    tier: 2,
    speechContains: ['confirm', 'sure', 'proceed', 'go ahead', 'approve', 'want me to'],
  },

  {
    id: 'strategic-guidance-scoping',
    description: 'Strategic guidance recommendations only suggest tasks from projects owned by the user',
    productCode: 'ORB',
    input: 'what should I do next?',
    tier: 2,
    speechNotContains: ['PROJ-', 'TRAVEL-', 'PERSONAL-'],
  },

  // ── ORB-205: Judgment-Driven Resolution ────────────────────────────────

  {
    id: 'resolve-duplicate-searches-first',
    description: 'When told a task is a duplicate, the Orb searches before asking which one',
    productCode: 'ORB',
    input: 'ORB-178 is a duplicate of another task',
    tier: 1,
    expectTool: { name: 'query_todos' },
  },

  {
    id: 'no-lazy-escalation-on-lookup',
    description: 'When asked which task covers a topic, the Orb searches instead of guessing',
    productCode: 'ORB',
    input: 'which task covers the kanban work?',
    tier: 2,
    speechNotContains: ['are you referring to', 'did you mean', 'which one do you mean'],
  },
]
