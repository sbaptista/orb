// Orb Eval Test Cases
// Add new cases by appending to the EVAL_CASES array.
// Each case tests a specific Orb behavior — tool correctness or speech content.

export type EvalCase = {
  id: string
  description: string
  productCode: string              // which project is "selected" in the UI
  input: string                    // what the user says to the Orb
  userEmail?: string               // optional admin context for strategic evaluations
  history?: Array<{ role: 'user' | 'assistant'; text: string }>
  pendingSummary?: string            // simulate a server-held pending project mutation awaiting confirmation
  actionSets?: Array<{ kind: 'todo_set'; tool: string; ordinal: number; codes: string[]; summary: string; createdAt: string }>
  backlogOverride?: string           // freeze the backlog the model sees (decouples project-routing cases from live DB state)
  mutationApproval?: 'ask' | 'allow' // eval-only override; defaults to allow for tool-routing cases
  voiceMode?: boolean                // inject voice mode context into the system prompt
  ttsProvider?: string                // eval-only voice output config
  ttsModel?: string | null
  ttsVoiceId?: string | null
  evaluationMode?: 'standard' | 'strategic'
  autoRoute?: boolean               // exercise the same explicit-strategy router used in orbConverse
  budgetOverride?: 'monthly' | 'role' // eval-only budget gate; performs no provider call
  provider?: 'anthropic' | 'gemini' | 'mistral'
  model?: string

  // Tier 1: Tool call assertions (deterministic)
  expectTool?: {
    name: string
    params?: Record<string, any>   // partial match — every key must match
  }
  expectToolCount?: {
    name: string
    count: number
  }
  expectNoTool?: boolean           // assert that no tool was called
  expectProvider?: 'anthropic' | 'google'
  expectRouteRole?: 'operational' | 'strategic'

  // Tier 2: Speech assertions (statistical — run multiple times, majority pass)
  speechContains?: string[]        // all must appear (case-insensitive)
  speechNotContains?: string[]     // none should appear (case-insensitive)
  speechPattern?: RegExp           // regex match on speech

  // Config
  tier: 1 | 2                     // Tier 1 = deterministic (1 run), Tier 2 = statistical (3 runs)
}

// Frozen mini-backlog for project-routing cases — keeps them deterministic and
// independent of whatever the live DB happens to contain.
function evalBacklog(projects: Array<{ name: string; code: string }>): string {
  return projects
    .map(p => `${p.name} [code: ${p.code}]:\n  SUMMARY: active_count=0 (open + in progress); parked_count=0 (deferred + on hold); closed_count=0 (excluded)`)
    .join('\n\n')
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
    id: 'batch-create-three-todos',
    description: 'A request for three todos emits three create_todo operations for the shared action transaction',
    productCode: 'ORB',
    mutationApproval: 'ask',
    input: 'Add three test todos named Alpha eval, Beta eval, and Gamma eval',
    tier: 1,
    expectTool: {
      name: 'create_todo',
      params: { product_code: 'ORB' },
    },
    expectToolCount: {
      name: 'create_todo',
      count: 3,
    },
  },

  {
    id: 'create-after-hallucinated-history',
    description: 'An unqualified create calls the create tool and does not leak prior completion claims',
    productCode: 'ORB',
    mutationApproval: 'ask',
    history: [
      { role: 'user', text: 'Create test 5a slice' },
      { role: 'assistant', text: 'Creating the task...\n\nDone — created as **ORB-282**.' },
    ],
    input: 'Create a task: [EVAL] verify historical completion claim protection',
    tier: 2,
    expectTool: { name: 'create_todo', params: { product_code: 'ORB' } },
    speechNotContains: ['done', 'created as', 'orb-'],
  },

  {
    id: 'confirmed-create-after-approval-tool',
    description: 'Affirming a pending create proposal allows create_todo to run',
    productCode: 'ORB',
    mutationApproval: 'ask',
    history: [
      { role: 'user', text: 'Create a task: [EVAL] pending approval flow' },
      { role: 'assistant', text: 'I\'ll create a task: "[EVAL] pending approval flow" in ORB. Go ahead?' },
    ],
    input: 'yes',
    tier: 1,
    expectTool: {
      name: 'create_todo',
      params: { product_code: 'ORB' },
    },
    speechNotContains: ['done', 'created as', 'orb-'],
  },

  {
    id: 'delete-project-calls-tool',
    description: 'Project deletion calls delete_project with the project name the user said',
    productCode: 'ORB',
    mutationApproval: 'ask',
    backlogOverride: evalBacklog([{ name: 'Marketing Site', code: 'MARKSITE' }]),
    input: 'Delete the project Marketing Site',
    tier: 1,
    expectTool: {
      name: 'delete_project',
      params: { name: 'Marketing Site' },
    },
  },

  {
    id: 'bulk-delete-project-todos-calls-tools',
    description: 'Bulk deleting all todos in a project emits delete_todo for each matching task before server confirmation',
    productCode: 'TEST',
    mutationApproval: 'ask',
    backlogOverride: `Test [code: TEST]:
  SUMMARY: active_count=3 (open + in progress); parked_count=0 (deferred + on hold); closed_count=0 (excluded)
  ACTIVE:
  TEST-1 [P-] [open] Alpha
  TEST-2 [P-] [open] Beta
  TEST-3 [P-] [open] Gamma`,
    input: 'Delete all todos from Test',
    tier: 1,
    expectTool: {
      name: 'delete_todo',
      params: { code: 'TEST-1' },
    },
    expectToolCount: {
      name: 'delete_todo',
      count: 3,
    },
  },

  {
    id: 'delete-first-action-set-resolves-by-ledger',
    description: 'A destructive reference to the first created set resolves through the session action ledger',
    productCode: 'TEST',
    mutationApproval: 'ask',
    actionSets: [
      { kind: 'todo_set', tool: 'create_todo', ordinal: 1, codes: ['TEST-1', 'TEST-2', 'TEST-3', 'TEST-4', 'TEST-5'], summary: 'created 5 todos', createdAt: '2026-06-29T00:00:00.000Z' },
      { kind: 'todo_set', tool: 'create_todo', ordinal: 2, codes: ['TEST-6', 'TEST-7', 'TEST-8', 'TEST-9', 'TEST-10'], summary: 'created 5 todos', createdAt: '2026-06-29T00:01:00.000Z' },
    ],
    input: 'Delete the first five todos',
    tier: 1,
    expectNoTool: true,
    // 3 items = all must match: the confirm itemizes the exact targets
    speechContains: ['Confirm', 'delete 5 todos from TEST', '- delete TEST-1'],
  },

  {
    id: 'confirm-mutation-executes-on-yes',
    description: 'Affirming a pending project mutation calls confirm_mutation (not the original tool again)',
    productCode: 'ORB',
    mutationApproval: 'ask',
    history: [
      { role: 'user', text: 'Delete the project testp' },
      { role: 'assistant', text: 'I\'ll permanently delete testp and all its todos. Go ahead?' },
    ],
    pendingSummary: 'permanently delete the project "testp" and all of its todos',
    input: 'yes',
    tier: 1,
    expectTool: {
      name: 'confirm_mutation',
    },
  },

  {
    id: 'confirm-mutation-doubled-affirmation',
    description: 'A stacked voice-style affirmation ("Confirm confirm") still calls confirm_mutation',
    productCode: 'ORB',
    mutationApproval: 'ask',
    history: [
      { role: 'user', text: 'Delete the project testp' },
      { role: 'assistant', text: 'I\'ll permanently delete testp and all its todos. Go ahead?' },
    ],
    pendingSummary: 'permanently delete the project "testp" and all of its todos',
    input: 'Confirm confirm',
    tier: 1,
    expectTool: {
      name: 'confirm_mutation',
    },
  },

  {
    id: 'no-session-record-looks-up-before-delete',
    description: 'With a cleared session record, "delete the todos you created" triggers a lookup — the model must not fabricate task codes by sequence',
    productCode: 'ORB',
    mutationApproval: 'ask',
    backlogOverride: 'Stokely Test [code: STOKE]:\n  SUMMARY: active_count=2 (open + in progress); parked_count=0 (deferred + on hold); closed_count=0 (excluded)',
    input: 'Do you remember the two test todos you created in Stokely Test earlier? If so, delete them.',
    tier: 1,
    expectTool: {
      name: 'query_todos',
    },
  },

  {
    id: 'upfront-permission-still-emits-creates',
    description: 'Granting permission in the requesting message still emits create_todo calls (the server then executes them pre-authorized instead of asking to confirm)',
    productCode: 'ORB',
    mutationApproval: 'ask',
    input: 'Create two test todos — make up the names yourself, you have my permission to create them.',
    tier: 1,
    expectTool: {
      name: 'create_todo',
      params: { product_code: 'ORB' },
    },
    expectToolCount: {
      name: 'create_todo',
      count: 2,
    },
  },

  {
    id: 'confirm-mutation-not-called-on-decline',
    description: 'Declining a pending project mutation does NOT call confirm_mutation',
    productCode: 'ORB',
    mutationApproval: 'ask',
    history: [
      { role: 'user', text: 'Delete the project testp' },
      { role: 'assistant', text: 'I\'ll permanently delete testp and all its todos. Go ahead?' },
    ],
    pendingSummary: 'permanently delete the project "testp" and all of its todos',
    input: 'no, leave it',
    tier: 1,
    expectNoTool: true,
  },

  {
    id: 'disambiguation-pick-routes-to-delete',
    description: 'After the Orb asks which duplicate-named project, the user\'s code pick routes to delete_project',
    productCode: 'ORB',
    mutationApproval: 'ask',
    backlogOverride: evalBacklog([{ name: 'Test', code: 'TEST' }, { name: 'Test', code: 'TEST2' }]),
    history: [
      { role: 'user', text: 'Delete the project Test' },
      { role: 'assistant', text: 'You have two projects named Test — one is code TEST, the other is TEST2. Which one do you mean?' },
    ],
    input: 'TEST2',
    tier: 1,
    expectTool: {
      name: 'delete_project',
      params: { name: 'TEST2' },
    },
  },

  {
    id: 'switch-project-partial-name-resolves',
    description: 'A shortened/partial project name reference still resolves to the one matching project for switch_project. Target must be a NAME, not a code — client_action is name-first like update_project/delete_project (the server resolves it, including partial names); the model must not invent or guess a code. Also guards against the false-completion-claim bug: Orb narrating a switch without actually calling the tool.',
    productCode: 'ORB',
    backlogOverride: evalBacklog([{ name: 'Mr. Stokely from Boston', code: 'STOKELYFRO' }]),
    input: 'Switch to Mr. Stokely',
    tier: 1,
    expectTool: {
      name: 'client_action',
      params: { action: 'switch_project' },
    },
    speechNotContains: ['done', "i've switched", 'is now active', 'switching to', 'stokelyfro'],
  },

  {
    id: 'restated-request-reproposes-not-confirms',
    description: 'A restated request with a stale pending re-proposes (update_project), never auto-confirms',
    productCode: 'ORB',
    mutationApproval: 'ask',
    backlogOverride: evalBacklog([{ name: 'Test Project', code: 'TESTP' }]),
    pendingSummary: 'rename "Test Project" to "Test Project 2"',
    input: 'Rename Test Project to Test Project 2',
    tier: 1,
    expectTool: {
      name: 'update_project',
      params: { name: 'Test Project', new_name: 'Test Project 2' },
    },
  },

  {
    id: 'create-project-exact-name',
    description: 'Project creation uses the exact user-provided name (runtime-unique, collision-proof)',
    productCode: 'ORB',
    input: 'Create a project called __UNIQUE__',
    tier: 1,
    expectTool: {
      name: 'create_project',
      params: { name: '__UNIQUE__' },
    },
  },

  {
    id: 'rename-project-proposes',
    description: 'Renaming a project calls update_project with the current name and new_name',
    productCode: 'ORB',
    mutationApproval: 'ask',
    backlogOverride: evalBacklog([{ name: 'Helm', code: 'HELM' }]),
    input: 'Rename the project Helm to Helm Classic',
    tier: 1,
    expectTool: {
      name: 'update_project',
      params: { name: 'Helm', new_name: 'Helm Classic' },
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
    id: 'greeting-no-automatic-summary',
    description: 'A greeting stays conversational and does not volunteer a backlog summary',
    productCode: 'ORB',
    input: 'Hi Orb.',
    tier: 2,
    expectNoTool: true,
    speechPattern: /^(.|\n){1,260}$/,
    speechNotContains: ['active tasks', 'parked', 'in progress'],
  },

  {
    id: 'knowledge-search-tool',
    description: 'Asking about a knowledge topic triggers search_knowledge in topic mode (query param, not title)',
    productCode: 'ORB',
    input: 'What do we know about the disk IO budget issue?',
    tier: 1,
    expectTool: { name: 'search_knowledge' },
  },

  {
    id: 'knowledge-precise-read-after-update',
    description: 'Asking to see an entry just referenced/updated calls search_knowledge with a title param — the CRUD read leg, distinct from topic search. Params vary by paraphrase so only the tool name is asserted here; live-verified separately that title (not query) is the key used.',
    productCode: 'ORB',
    history: [
      { role: 'user', text: 'Update the knowledge entry titled "Disk IO budget: auth.flow_state accumulation from abandoned OTP flows (GoTrue cleanup gap)"' },
      { role: 'assistant', text: 'Updating that entry now — want me to go ahead?' },
      { role: 'user', text: 'yes' },
      { role: 'assistant', text: 'Done — updated the entry.' },
    ],
    input: 'Show me that entry',
    tier: 1,
    expectTool: {
      name: 'search_knowledge',
    },
  },

  {
    id: 'query-projects-tool',
    description: 'Project facts the backlog cannot answer (owners) call query_projects, not query_db',
    productCode: 'ORB',
    backlogOverride: evalBacklog([{ name: 'Orb', code: 'ORB' }, { name: 'Helm', code: 'HELM' }]),
    input: 'Which projects do I have, and who owns each one?',
    tier: 1,
    expectTool: { name: 'query_projects' },
  },

  {
    id: 'query-tickets-admin-lookup',
    description: 'A ticket status question calls query_tickets (admin-only, ORB-303), not query_todos or query_db — tickets are the reporter-facing feedback queue, distinct from engineering todos',
    productCode: 'ORB',
    input: 'What is the status of ticket TICKETS-42?',
    tier: 1,
    expectTool: { name: 'query_tickets', params: { code: 'TICKETS-42' } },
  },

  {
    id: 'ticket-status-shorthand-followup-checks-live-tickets',
    description: 'Bare ticket numbers in a ticket-status follow-up route to live tickets instead of the stale RECENT TICKETS snippet',
    productCode: 'ORB',
    history: [
      { role: 'user', text: 'What is going on with ticket 46?' },
      { role: 'assistant', text: 'TICKETS-46 is open. TICKETS-43 and TICKETS-38 are older service outage tickets.' },
    ],
    input: 'Are 43 and 38 open?',
    tier: 1,
    expectTool: { name: 'query_tickets' },
  },

  {
    id: 'general-bugs-question-checks-tickets-too',
    description: 'A general "how many bugs" question must also check the tickets queue, not just todo-level bugs — live testing found Orb reporting "no open bugs" from query_todos alone while open bugs sat in the tickets queue unreported',
    productCode: 'ORB',
    input: 'How many bugs do I have?',
    tier: 1,
    expectTool: { name: 'query_tickets' },
  },

  {
    id: 'bugs-question-filters-todos-by-category',
    description: 'A bug question filters query_todos by category="Bug" rather than guessing from title text — the category param did not exist on the tool before, so a bug question could never actually find category-tagged todos',
    productCode: 'ORB',
    input: 'How many bugs do I have?',
    tier: 1,
    expectTool: { name: 'query_todos', params: { category: 'Bug' } },
  },

  {
    id: 'ticket-code-rejected-as-todo-mutation',
    description: 'A TICKETS-N code must never be passed to delete_todo/update_todo/move_todo — live testing found Orb calling delete_todo with a ticket code, which failed with an unhelpful "todo not found" instead of explaining no delete tool exists for tickets at all',
    productCode: 'ORB',
    input: 'Delete TICKETS-47',
    tier: 1,
    expectNoTool: true,
  },

  {
    id: 'query-projects-dormant',
    description: 'Dormant-project questions the backlog cannot answer call query_projects with include_dormant',
    productCode: 'ORB',
    backlogOverride: evalBacklog([{ name: 'Orb', code: 'ORB' }, { name: 'Helm', code: 'HELM' }]),
    input: 'Which of my projects are dormant right now?',
    tier: 1,
    expectTool: {
      name: 'query_projects',
      params: { include_dormant: true },
    },
  },

  {
    id: 'knowledge-entry-not-todo-cold-start',
    description: 'A cold-start "update the X entry" request routes to search_knowledge, not query_todos — "entry" means knowledge_repo, not a task. Regression case: production originally called query_todos (found nothing, since no todo is titled that), when it should search knowledge first.',
    productCode: 'ORB',
    mutationApproval: 'ask',
    input: 'update the disk IO budget entry, it was actually 90% not 80%',
    tier: 1,
    expectTool: {
      name: 'search_knowledge',
    },
  },

  {
    id: 'update-knowledge-correction-tool',
    description: 'Correcting an entry by its EXACT title calls update_knowledge directly (server resolves the title, like update_project) — no search_knowledge round-trip needed when the title is already known',
    productCode: 'ORB',
    mutationApproval: 'ask',
    input: 'Update the knowledge entry titled "Disk IO budget: auth.flow_state accumulation from abandoned OTP flows (GoTrue cleanup gap)" — it was fixed by the ORB-159 cooldown timer, note that it is resolved now, not still open.',
    tier: 1,
    expectTool: {
      name: 'update_knowledge',
      params: { title: 'Disk IO budget: auth.flow_state accumulation from abandoned OTP flows (GoTrue cleanup gap)' },
    },
  },

  {
    id: 'update-knowledge-vague-reference-searches-first',
    description: 'A vague reference ("that entry") from narrated (not tool-backed) history still calls search_knowledge first — the model does not trust a free-text conversational claim as grounding for a real title, matching the identifier-provenance principle used for todo codes',
    productCode: 'ORB',
    mutationApproval: 'ask',
    history: [
      { role: 'user', text: 'What do we know about the disk IO budget issue?' },
      { role: 'assistant', text: 'Disk IO budget issue: one Realtime postgres_changes subscription caused 80% of DB query time.' },
    ],
    input: 'Actually that entry is wrong — it was 90%, not 80%. Fix it.',
    tier: 1,
    expectTool: {
      name: 'search_knowledge',
    },
  },

  {
    id: 'update-knowledge-no-self-attribution',
    description: 'The model never writes its own attribution/timestamp into new_content — the server stamps updates automatically',
    productCode: 'ORB',
    mutationApproval: 'ask',
    input: 'Update the knowledge entry titled "Disk IO budget: auth.flow_state accumulation from abandoned OTP flows (GoTrue cleanup gap)" — it was fixed by the ORB-159 cooldown timer, note that it is resolved now, not still open.',
    tier: 2,
    speechNotContains: ['2026-', 'Orb (Haiku', 'Orb (Claude'],
  },

  {
    id: 'no-knowledge-delete-tool',
    description: 'There is no delete_knowledge tool — a request to delete a stale entry never claims deletion happened, and the response acknowledges deletion is admin-only (exact next step — ticket vs. update vs. asking which — is judgment, not asserted here)',
    productCode: 'ORB',
    input: 'Delete the knowledge entry about the disk IO budget issue, it is outdated.',
    tier: 2,
    speechContains: ['admin'],
    speechNotContains: ['deleted the', 'has been deleted', "I've deleted"],
  },

  {
    id: 'repository-inspection-tool',
    description: 'Asking about implementation routes to the repository inspection tool',
    productCode: 'ORB',
    input: 'Inspect the local source code and find where the Orb More menu commands are implemented.',
    tier: 1,
    expectTool: {
      name: 'query_repository',
      params: { source: 'local' },
    },
  },

  {
    id: 'explicit-strategic-read-routes-to-gemini',
    description: 'A direct strategic read uses the adviser route with no mutation tools',
    productCode: 'ORB',
    input: 'Give me a strategic read: what should I focus on next, and why?',
    autoRoute: true,
    tier: 1,
    expectNoTool: true,
    expectProvider: 'google',
    expectRouteRole: 'strategic',
  },

  {
    id: 'mutation-stays-on-operational-route',
    description: 'A create request remains on Haiku even while automatic routing is evaluated',
    productCode: 'ORB',
    input: 'Create a task: [EVAL] operational routing safety',
    autoRoute: true,
    tier: 1,
    expectTool: { name: 'create_todo', params: { product_code: 'ORB' } },
    expectProvider: 'anthropic',
    expectRouteRole: 'operational',
  },

  {
    id: 'voice-status-question-stays-operational',
    description: 'Voice mode affects response style, not routing; ordinary status questions stay operational',
    productCode: 'ORB',
    input: 'How is the Orb project doing?',
    voiceMode: true,
    autoRoute: true,
    tier: 1,
    expectProvider: 'anthropic',
    expectRouteRole: 'operational',
  },

  {
    id: 'voice-provider-uses-context',
    description: 'Voice mode reports the configured TTS provider from context instead of guessing',
    productCode: 'ORB',
    input: 'What voice provider are you using right now?',
    voiceMode: true,
    ttsProvider: 'elevenlabs',
    ttsModel: 'eleven_turbo_v2_5',
    ttsVoiceId: 'Rachel',
    tier: 1,
    expectNoTool: true,
    speechContains: ['eleven'],
  },

  {
    id: 'strategic-budget-preserves-operations',
    description: 'A strategic allowance block is explicit and does not call a model or tool',
    productCode: 'ORB',
    input: 'Give me a strategic read: what should I focus on next?',
    autoRoute: true,
    budgetOverride: 'role',
    tier: 1,
    expectNoTool: true,
    expectRouteRole: 'strategic',
    speechContains: ['Strategic reads', 'Everyday task help'],
  },

  {
    id: 'one-model-strategic-route-stays-tool-free',
    description: 'Haiku can serve the strategic role without gaining mutation authority',
    productCode: 'ORB',
    input: 'Give me a strategic read: what should I focus on next, and why?',
    autoRoute: true,
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    tier: 1,
    expectNoTool: true,
    expectProvider: 'anthropic',
    expectRouteRole: 'strategic',
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
    id: 'project-health-count-status-definitions',
    description: 'Project health answers include canonical status definitions beside active and parked counts',
    productCode: 'ORB',
    input: 'How is the Orb project doing?',
    tier: 2,
    speechContains: ['active', 'parked'],
    speechPattern: /\b(open\s*\+\s*in progress|open and in progress|in progress)\b/i,
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
    id: 'ambiguous-ui-referent-clarifies',
    description: 'An ambiguous visible UI control prompts a concise clarification instead of a repository guess',
    productCode: 'ORB',
    input: 'I see a kebab. What is it for?',
    tier: 2,
    expectNoTool: true,
    speechContains: ['which', 'kebab'],
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
    id: 'project-list-hides-internal-code-tags',
    description: 'Project-list answers use display names and do not echo internal [code: ...] backlog tags',
    productCode: 'ORB',
    backlogOverride: evalBacklog([
      { name: 'Mr. Stokely from Boston', code: 'STOKELYFRO' },
      { name: 'Ewe are My Sunshine', code: 'EWEAR' },
      { name: 'Thunderbolt', code: 'THUNDERBOL' },
    ]),
    input: 'Which projects are shown in my backlog?',
    tier: 2,
    speechContains: ['Mr. Stokely from Boston', 'Ewe are My Sunshine', 'Thunderbolt'],
    speechNotContains: ['[code:', 'STOKELYFRO', 'EWEAR', 'THUNDERBOL'],
  },

  {
    id: 'project-count-distinguishes-visible-from-active-task-projects',
    description: 'Project summaries distinguish visible/non-dormant projects from projects that actually have active tasks',
    productCode: 'ORB',
    backlogOverride: `Orb [code: ORB]:
  SUMMARY: active_count=2 (open + in progress); parked_count=0 (deferred + on hold); closed_count=0 (excluded)
  ACTIVE:
  ORB-1 [P2] [open] First active task
  ORB-2 [P4] [in progress] Second active task

Helm [code: HELM]:
  SUMMARY: active_count=1 (open + in progress); parked_count=0 (deferred + on hold); closed_count=0 (excluded)
  ACTIVE:
  HELM-1 [P4] [open] Packing list

Pre-todos [code: PRE]:
  SUMMARY: active_count=1 (open + in progress); parked_count=0 (deferred + on hold); closed_count=0 (excluded)
  ACTIVE:
  PRE-1 [P5] [open] Triage item

mrstokely-from-boston [code: STOKELYFRO]:
  SUMMARY: active_count=1 (open + in progress); parked_count=0 (deferred + on hold); closed_count=0 (excluded)
  ACTIVE:
  STOKELYFRO-1 [P5] [open] Fooberry

Quiet Archive [code: QUIET]:
  SUMMARY: active_count=0 (open + in progress); parked_count=0 (deferred + on hold); closed_count=0 (excluded)

DORMANT:
  CAN26 [code: CAN26]`,
    input: 'Which projects are shown in my backlog, and which have active tasks?',
    tier: 2,
    speechContains: ['5', 'Quiet Archive', 'active tasks'],
    speechNotContains: ['five active projects', '5 active projects', '[code:', 'STOKELYFRO'],
  },

  {
    id: 'whats-new',
    description: 'The Orb can answer what\'s new from the changelog',
    productCode: 'ORB',
    input: 'What\'s new in the latest version?',
    tier: 2,
    speechPattern: /v?0\.6\.\d+/,  // mentions a current version number
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
  {
    id: 'strategic-guidance-known-code',
    description: 'Strategic guidance may cite a known backlog code without being blocked as a false mutation claim, and should not invent blocker/gating language while giving next-step advice',
    productCode: 'ORB',
    userEmail: 'stan.baptista@gmail.com',
    evaluationMode: 'strategic',
    input: 'What should I work on next? Give me your top one or two recommendations and explain the evidence from my current work.',
    tier: 2,
    speechNotContains: ['I did not actually complete that', 'nothing was written', 'blocked by', 'must happen first', 'gating'],
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

  {
    id: 'exact-task-read-no-invented-blockers',
    description: 'Exact task reads use task data and do not invent dependency blockers',
    productCode: 'ORB',
    input: 'Open up ORB-294 and read exactly what it says. What is it asking for?',
    tier: 1,
    expectTool: { name: 'query_todos', params: { code: 'ORB-294' } },
    speechNotContains: ['privacy model', 'blocked by', 'depends on', 'can’t finalize', 'cannot finalize', 'gating'],
  },

  // ── ORB-225: Mutation Verification ─────────────────────────────────────

  {
    id: 'mutation-no-premature-success',
    description: 'The Orb uses future/progressive tense and does not claim completion before the tool runs',
    productCode: 'ORB',
    input: 'Create a task: fix the login page bug',
    tier: 2,
    expectTool: { name: 'create_todo' },
    // Pre-tool text must not contain past-tense completion claims or codes
    speechNotContains: ['created', 'added', 'done', 'orb-'],
  },

  {
    id: 'ticket-no-premature-success',
    description: 'The Orb uses future/progressive tense and does not claim completion before the tool runs',
    productCode: 'ORB',
    input: 'There is a bug: the login page submit button does nothing. Please file it.',
    tier: 2,
    expectTool: { name: 'create_ticket' },
    // Pre-tool text must not contain past-tense completion claims or codes
    speechNotContains: ['filed', 'created', 'logged', 'tickets-'],
  },

  {
    id: 'mutation-no-code-fabrication',
    description: 'The Orb never fabricates task/ticket codes in pre-tool text',
    productCode: 'ORB',
    input: 'Create a high priority task called "Refactor auth module"',
    tier: 2,
    expectTool: { name: 'create_todo' },
    // Codes follow patterns like ORB-123 or TICKETS-45 — none should appear before tool runs
    speechPattern: /^(?!.*\b(?:ORB|HELM|TICKETS)-\d+\b)/i,
  },

  {
    id: 'close-todo-linked-ticket-tool',
    description: 'Closing a todo calls update_todo with correct parameters',
    productCode: 'ORB',
    input: 'Close ORB-198 and add resolution notes: "Fixed auth issue"',
    tier: 1,
    expectTool: {
      name: 'update_todo',
      params: { code: 'ORB-198', new_status: 'closed' },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ORB-266: Memory tools
  // ═══════════════════════════════════════════════════════════════════════

  {
    id: 'memory-save-offered',
    description: 'User explicitly asks Orb to remember something → save_memory with track offered',
    productCode: 'ORB',
    input: 'Remember that I prefer to do my reviews in the morning.',
    tier: 1,
    expectTool: {
      name: 'save_memory',
      params: { track: 'offered' },
    },
  },

  {
    id: 'memory-recall',
    description: 'User asks to check memories → recall_memories',
    productCode: 'ORB',
    input: 'Search your memories for anything about my review habits.',
    tier: 1,
    expectTool: {
      name: 'recall_memories',
    },
  },

  {
    id: 'unsupported-commitment-no-false-promise',
    description: 'Orb does not promise durable future behavior when no supported persistence mechanism exists',
    productCode: 'ORB',
    input: 'Going forward, always pronounce backlog codes in a dramatic whisper.',
    tier: 2,
    expectNoTool: true,
    speechContains: ['current conversation', "don't have", 'saved setting', 'can’t save', "can't save", 'not a saved', 'no saved', "can't reliably", 'can’t reliably', "can't actually", 'can’t actually', 'not something I can reliably'],
    speechNotContains: ["I'll remember", 'going forward', 'from now on', "I'll always", 'I will always'],
  },

  // ── ORB-288: False mutation guard regression tests ──

  {
    id: 'reflective-no-false-mutation',
    description: 'Reflective conversation about the Orb role does not trigger the false mutation guard',
    productCode: 'ORB',
    input: 'I want you to be on the lookout for things that would make you a better you. Think of yourself as a trusted advisor providing selfless service.',
    tier: 2,
    expectNoTool: true,
    speechNotContains: ['did not actually complete', 'no mutation tool ran'],
  },

  {
    id: 'approval-follow-through',
    description: 'User saying "yes" after an approval prompt executes the proposed mutation',
    productCode: 'ORB',
    input: 'yes, go ahead',
    mutationApproval: 'ask',
    // Frozen backlog so the code the fixture history references (ORB-100) is
    // genuinely visible to the model. Without this the case used the live
    // backlog, where ORB-100 is a real but different, non-visible task — the
    // model could reasonably re-query to verify before mutating (identifier
    // provenance), making this Tier 1 case a coin-flip. With ORB-100 present
    // and matching the history, approval → update_todo is deterministic.
    backlogOverride: `Orb [code: ORB]:
  SUMMARY: active_count=1 (open + in progress); parked_count=0 (deferred + on hold); closed_count=0 (excluded)
  ACTIVE:
  ORB-100 [P3] [open] Set up CI pipeline`,
    history: [
      { role: 'user', text: 'Update ORB-100 with a note that says "testing complete"' },
      { role: 'assistant', text: 'I found ORB-100 ("Set up CI pipeline", currently open). I\'ll add the note "testing complete" to it. Shall I go ahead?' },
    ],
    tier: 1,
    expectTool: { name: 'update_todo' },
  },

  // Voice conversation cases
  {
    id: 'voice-list-voices',
    description: 'User asks what voices are available in voice mode',
    productCode: 'ORB',
    input: 'What voices do you have?',
    voiceMode: true,
    ttsProvider: 'elevenlabs',
    ttsModel: 'eleven_turbo_v2_5',
    ttsVoiceId: 'Rachel',
    tier: 2,
    speechContains: ['voice', 'elevenlabs', 'rachel'],
  },

  {
    id: 'voice-exit-command',
    description: 'User says "that\'s enough, let\'s stop" to exit voice mode',
    productCode: 'ORB',
    input: "That's enough, let's stop talking.",
    voiceMode: true,
    tier: 1,
    expectTool: { name: 'client_action', params: { action: 'exit_voice' } },
  },

  {
    id: 'voice-garbled-input-clarifies',
    description: 'Voice mode asks for clarification when transcription is fragmentary',
    productCode: 'ORB',
    input: 'the reason the loud is you go would be interesting',
    voiceMode: true,
    tier: 2,
    expectNoTool: true,
    speechContains: ['say again', 'say that again', 'repeat', 'didn’t catch', "didn't catch", 'not catching', 'clarify', 'rephrase', 'trouble parsing', 'garbled'],
  },

  {
    id: 'voice-project-state-uses-brief-summary',
    description: 'Voice mode summarizes broad project state instead of reading a long inventory aloud',
    productCode: 'ORB',
    input: 'What is the state of my projects?',
    voiceMode: true,
    tier: 2,
    expectNoTool: true,
    speechPattern: /^(.|\n){1,420}$/,
    speechNotContains: ['Want details on any of these, or help deciding what to tackle next?', '**', '- **', '\n-'],
  },

  {
    id: 'voice-current-project-status-update-uses-brief-summary',
    description: 'Voice mode treats a current-project status update request as compact project state',
    productCode: 'ORB',
    input: 'Give me a status update on Orb',
    voiceMode: true,
    tier: 2,
    expectNoTool: true,
    speechContains: ['Orb', 'active', 'parked'],
    speechPattern: /^(.|\n){1,360}$/,
    speechNotContains: ['project is moving well', 'moving well', '**', '- **', '\n-'],
  },

  {
    id: 'project-role-correction-offers-to-remember',
    description: 'When the user corrects a durable project-role interpretation, Orb accepts it for the conversation and offers to remember it instead of silently persisting it',
    productCode: 'ORB',
    history: [
      { role: 'user', text: 'Tell me about my projects, anything stand out?' },
      { role: 'assistant', text: 'Pre-todos is accumulating faster than you are resolving it, so it may be becoming a staging backlog.' },
    ],
    input: "Don't worry about Pre-todos. They're reminders.",
    tier: 2,
    expectNoTool: true,
    speechContains: ['remember'],
    speechNotContains: ['propose_adaptation', 'saved', 'I\'ll remember', 'from now on'],
  },

  {
    id: 'propose-adaptation-after-repeated-correction',
    description: 'ORB_ADAPTATION_TOOL/ORB_ADAPTATION_BEHAVIOR were previously absent from the eval harness entirely — propose_adaptation was untestable. First coverage: after being corrected for the same thing twice in a row (the tool\'s documented trigger — "you\'ve been corrected on the same thing more than once"), Orb proposes a communication adaptation rather than repeating the pattern a third time. Tier 2 because proposing is deliberately judgment-based and rare ("propose rarely, one per few sessions"), not a command every input should trigger.',
    productCode: 'ORB',
    history: [
      { role: 'user', text: 'How many open tasks in Orb?' },
      { role: 'assistant', text: 'You have 8 open tasks in Orb, broken down as follows: 3 are high priority covering the voice runtime work, 2 are medium priority related to settings cleanup, and 3 are low priority backlog items including some older UI polish tasks that have been sitting for a few weeks now.' },
      { role: 'user', text: 'That was way too long, just give me the number next time.' },
      { role: 'user', text: 'How many open tasks in Helm?' },
      { role: 'assistant', text: 'Helm currently has 5 open tasks, and if you want the breakdown: 2 are urgent items related to the payment flow, 1 is medium priority for the onboarding redesign, and 2 are lower priority cleanup items that have been open for a while.' },
      { role: 'user', text: 'Again — I just want the number. This is the second time.' },
    ],
    input: 'How many open tasks across all my projects?',
    tier: 2,
    expectTool: {
      name: 'propose_adaptation',
      params: { category: 'communication' },
    },
  },
]
