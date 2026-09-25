import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { executeConfirmation, type ConfirmationPorts, type OrbMutationConfirmation } from '../lib/orb-operations/confirmation-execution'
import { diagnosticRunCount } from '../lib/orb-interaction/diagnostic-policy'
import { aggregateSummariesContext, ArithmeticError, calculateArithmetic, summarizeTodoFacts, unsupportedAggregateClaims } from '../lib/orb-interaction/arithmetic'
import { evaluateMutationApproval, oncePerTurnApproval } from '../lib/orb-model/approval-policy'
import { resolveReadProject, safeReadProjection, assertToolAccess } from '../lib/orb-interaction/read-policy'
import { validateMemory } from '../lib/orb-interaction/memory-policy'
import { buildTodoStatusReport, isBroadProjectStateQuestion, isTodoStatusBreakdownRequest } from '../lib/orb-interaction/status-report'
import { DictationLifecycle, appendDictation } from '../lib/orb-interaction/dictation-lifecycle'
import { validateSpelledProjectField } from '../lib/orb-interaction/spelled-identifiers'
import {
  projectConversationMessages,
  projectModelHistory,
  mutationReceiptRefreshScopes,
  type OrbConversationEvent,
} from '../lib/orb-interaction/types'
import { comparableSpokenWords, toOrbSpokenText } from '../lib/orb-interaction/spoken-text'
import { isBareHaltCommand, isBareStopCommand, isOrbInterruptReason, mergedTurnText, TURN_CANCELLING_INTERRUPT_REASONS } from '../lib/orb-interaction/interrupt-intent'
import { hasCompletionLanguage, hasProposalLanguage, isFalseCompletionClaim, isUnconfirmedPendingMutationClaim, presentableLeadIn, presentableStreamingSpeech, stripHistoryProvenanceLabels, switchConfirmationSpeech, withoutOutcomeSentences } from '../lib/orb-model/false-claim-guard'
import { isClearlyFragmentaryProviderTranscript, isStalledVoiceVerifier, isUsableProviderTranscript, shouldRecoverVoiceVerifier } from '../lib/orb-interaction/voice-authenticity'
import { isBareMutationAffirmation, isTypoTolerantBareMutationAffirmation } from '../lib/orb-model/confirmation-grammar'
import { deletedProjectIdsFromPendingMutation, projectsAfterConfirmedCreation, projectsAfterConfirmedDeletion, selectedProjectAfterMutationRefresh } from '../lib/orb-interaction/project-refresh'
import { ORB_REALTIME_TRANSPORT_ONLY } from '../lib/orb-interaction/runtime'
import { getOrbModelOptions, supportsOrbRole } from '../lib/orb-model/catalog'
import { DEFAULT_ORB_AI_POLICY } from '../lib/orb-model/policy'
import { toGeminiContents } from '../lib/orb-model/gemini'
import { activeModelIdentitySpeech } from '../lib/orb-model/model-identity'
import { withExplicitSpellingClarification, withHistorySpellingClarifications } from '../lib/orb-interaction/spelled-identifiers'
import { lastShownProposalMatches } from '../lib/orb-interaction/model-history'
import { createOrbTurnTiming } from '../lib/orb-interaction/turn-timing'
import { completeToolRound } from '../lib/orb-interaction/tool-round-completion'
import { buildOrbQueryPresentation, directQueryPresentationMode, directQueryPresentationModeForTurn, directQuerySpokenSummary, renderDirectQueryCount } from '../lib/orb-query-presentation'
import { suggestProjectByReference } from '../lib/projects'
import {
  isRestartOnlyCommand,
  normalizeSpokenTurnText,
  restartReplacementText,
} from '../lib/orb-interaction/turn-text'
import { reconcileMessageIdentity, uniqueMessagesById } from '../lib/orb-interaction/message-identity'
import { isDifferentDevServerBoot } from '../lib/client-state'
import { defaultTodoQueryProjectCode, sortTodoQueryRows } from '../lib/orb-interaction/todo-query'
import {
  ORB_PENDING_RESTATEMENT_PREFIX,
  buildOrbConfirmationSpeechFromSummaries,
  buildOrbCommandBatchConfirmationSpeech,
  ORB_COMMAND_BATCH_TTL_MS,
  validatePreparedOrbCommandBatch,
  type PreparedOrbMutationCommand,
} from '../lib/orb-operations/command-batch-contract'

const base = {
  conversationId: 'conversation',
  userId: 'user',
  proposalId: null,
  responseId: null,
  createdAt: '2026-09-11T00:00:00.000Z',
} as const

const reconciledTranscript = reconcileMessageIdentity([
  { id: 'durable-response', text: 'Earlier replay' },
  { id: 'local-processing', text: 'Processing…' },
], 'local-processing', message => ({ ...message, id: 'durable-response', text: 'Final response' }))
assert.deepEqual(reconciledTranscript, [{ id: 'durable-response', text: 'Final response' }])
assert.deepEqual(uniqueMessagesById([
  { id: 'event-a', text: 'stale' },
  { id: 'event-a', text: 'authoritative' },
  { id: 'event-b', text: 'next' },
]), [
  { id: 'event-a', text: 'authoritative' },
  { id: 'event-b', text: 'next' },
])
assert.equal(isDifferentDevServerBoot(null, 'boot-a'), false)
assert.equal(isDifferentDevServerBoot('boot-a', 'boot-a'), false)
assert.equal(isDifferentDevServerBoot('boot-a', 'boot-b'), true)

const contextSource = readFileSync('lib/orb-model/context.ts', 'utf8')
const compactContextSource = contextSource.slice(contextSource.indexOf('export async function buildOrbContext'))
assert.equal((compactContextSource.match(/\.from\(/g) ?? []).length, 8, 'ordinary context should issue two workspace reads plus six control-plane reads')
assert.match(compactContextSource, /\.in\('status', \['open', 'in progress'\]\)/)
assert.match(compactContextSource, /users!created_by\(first_name, last_name, email\)/)
for (const eagerTable of ['audit_log', 'tickets', 'categories', 'groups', 'roles', 'platforms', 'invitations', 'orb_friction']) {
  assert.doesNotMatch(compactContextSource, new RegExp(`from\\('${eagerTable}'\\)`), `${eagerTable} must remain lazy`)
}

const converseSource = readFileSync('app/actions/orb-converse.ts', 'utf8')
const interruptionStoreSource = readFileSync('lib/orb-interaction/conversation-store.ts', 'utf8')
const interruptionLookupSource = interruptionStoreSource.slice(
  interruptionStoreSource.indexOf('export async function isOrbTurnInterrupted'),
  interruptionStoreSource.indexOf('export async function acknowledgeOrbConversationResponse'),
)
assert.doesNotMatch(interruptionLookupSource, /ownedActiveConversation/, 'an interruption checkpoint must remain one database query')
assert.equal((interruptionLookupSource.match(/\.from\(/g) ?? []).length, 1, 'an interruption checkpoint must issue one database request')
assert.match(interruptionLookupSource, /data\.status !== 'active'/, 'closing a conversation must still cancel its active turn')
assert.match(converseSource, /await assertTurnActive\('context_complete'\)/)
assert.match(converseSource, /await assertTurnActive\(`model_\$\{turnCount\}_before`\)/)
assert.match(converseSource, /await assertTurnActive\(`model_\$\{turnCount\}_after`\)/)
assert.match(converseSource, /await assertTurnActive\('mutation_persist_before'\)/)
assert.match(converseSource, /if \(interruptibleRead\) await assertTurnActive\(`read_\$\{tc\.name\}_after`\)/)

const turnTiming = createOrbTurnTiming('2026-09-25T00:00:00.000Z')
turnTiming.mark('authentication_complete')
const turnTimingSnapshot = turnTiming.snapshot()
assert.equal(turnTimingSnapshot.startedAt, '2026-09-25T00:00:00.000Z')
assert.deepEqual(turnTimingSnapshot.stages.map(stage => stage.name), ['request_received', 'authentication_complete'])
assert.ok(turnTimingSnapshot.durationMs >= 0)

assert.equal(ORB_REALTIME_TRANSPORT_ONLY, true)
assert.equal(DEFAULT_ORB_AI_POLICY.voiceModel, 'gpt-realtime-2.1-mini')
assert.deepEqual(
  getOrbModelOptions('operational').map(model => `${model.provider}/${model.model}`),
  ['anthropic/claude-haiku-4-5', 'google/gemini-3.1-pro-preview', 'moonshot/kimi-k3'],
)
assert.deepEqual(
  getOrbModelOptions('strategic').map(model => `${model.provider}/${model.model}`),
  ['anthropic/claude-haiku-4-5', 'google/gemini-3.1-pro-preview', 'moonshot/kimi-k3'],
)
assert.deepEqual(
  getOrbModelOptions('evaluation').map(model => `${model.provider}/${model.model}`),
  ['anthropic/claude-haiku-4-5', 'google/gemini-3.1-pro-preview', 'moonshot/kimi-k3'],
)
assert.deepEqual(
  getOrbModelOptions('voice').map(model => `${model.provider}/${model.model}`),
  ['openai/gpt-realtime-2.1-mini', 'openai/gpt-realtime-2.1'],
)
assert.equal(supportsOrbRole('moonshot', 'kimi-k3', 'operational'), true)
assert.equal(supportsOrbRole('moonshot', 'kimi-k3', 'strategic'), true)
assert.equal(supportsOrbRole('moonshot', 'kimi-k3', 'evaluation'), true)
assert.match(
  activeModelIdentitySpeech({
    provider: 'moonshot',
    model: 'kimi-k3',
    role: 'operational',
    environment: 'development',
  }),
  /Kimi K3 from Moonshot/,
)
assert.match(
  activeModelIdentitySpeech({
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    role: 'strategic',
    environment: 'production',
  }),
  /Claude Haiku 4\.5 from Anthropic/,
)
assert.deepEqual(
  toGeminiContents([
    { role: 'user', content: 'Find Orb tasks.' },
    { role: 'assistant', content: [{ type: 'tool_use', id: 'call-1', name: 'query_todos', input: { product_code: 'ORB' }, thought_signature: 'signed-reasoning' }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call-1', content: '{"count":2}' }] },
  ]),
  [
    { role: 'user', parts: [{ text: 'Find Orb tasks.' }] },
    { role: 'model', parts: [{ thoughtSignature: 'signed-reasoning', functionCall: { id: 'call-1', name: 'query_todos', args: { product_code: 'ORB' } } }] },
    { role: 'user', parts: [{ functionResponse: { id: 'call-1', name: 'query_todos', response: { count: 2 } } }] },
  ],
)
assert.equal(calculateArithmetic('4 + 21 + 295'), 320)
assert.equal(calculateArithmetic('(3 + 1) + (18 + 3) + 295'), 320)
assert.equal(calculateArithmetic('25% * 80'), 20)
assert.equal(calculateArithmetic('-2 + 3.5 * 4'), 12)
assert.throws(() => calculateArithmetic('1 / 0'), ArithmeticError)
assert.throws(() => calculateArithmetic('Math.random()'), ArithmeticError)
const todoSummaries = summarizeTodoFacts([
  { status: 'open', project: { code: 'ORB' } },
  { status: 'in progress', project: { code: 'ORB' } },
  { status: 'deferred', project: { code: 'ORB' } },
  { status: 'on hold', project: { code: 'ORB' } },
  { status: 'closed', project: { code: 'ORB' } },
])
assert.deepEqual(todoSummaries, [{ project: 'ORB', total_count: 5, open_count: 1, in_progress_count: 1, active_count: 2, deferred_count: 1, on_hold_count: 1, parked_count: 2, closed_count: 1 }])
assert.deepEqual(unsupportedAggregateClaims('| Open | 1 |\n| Total | 5 |', aggregateSummariesContext(todoSummaries), new Set()), [])
assert.equal(isBroadProjectStateQuestion('Give me a status update on Orb'), true)
assert.equal(isBroadProjectStateQuestion('Show me a status breakdown for project Orb'), false)
assert.equal(isTodoStatusBreakdownRequest('Show all Orb to-dos in a table by status or type'), true)
assert.equal(isTodoStatusBreakdownRequest('Show me the most recent closed to-dos in a table.'), false)
assert.equal(isTodoStatusBreakdownRequest('Show a table of all todo counts by type.'), true)
assert.equal(defaultTodoQueryProjectCode({}, 'ORB', 'List the 10 most recent closed todos.'), 'ORB')
assert.equal(defaultTodoQueryProjectCode({ ownership_scope: 'current_user' }, 'ORB', 'List closed todos across my projects.'), null)
assert.equal(defaultTodoQueryProjectCode({ code: 'HELM-3' }, 'ORB', 'Show HELM-3.'), null)
assert.deepEqual(sortTodoQueryRows([
  { code: 'ORB-1', closed_at: '2026-09-01T00:00:00Z' },
  { code: 'ORB-3', closed_at: null },
  { code: 'ORB-2', closed_at: '2026-09-03T00:00:00Z' },
], 'closed_at', 'desc').map(row => row.code), ['ORB-2', 'ORB-1', 'ORB-3'])
const statusReport = buildTodoStatusReport({
  currentUserId: 'user-1',
  input: 'Show me a status breakdown for project Orb',
  current: null,
  productList: [{ id: 'orb', name: 'Orb', code: 'ORB', created_by: 'user-1' }],
  todoList: [
    { product_id: 'orb', status: 'open' },
    { product_id: 'orb', status: 'in progress' },
    { product_id: 'orb', status: 'deferred' },
    { product_id: 'orb', status: 'on hold' },
    { product_id: 'orb', status: 'closed' },
  ],
})
assert.deepEqual(statusReport.rows, [{ project: 'Orb', open: 1, inProgress: 1, deferred: 1, onHold: 1, closed: 1, total: 5 }])
assert.match(statusReport.speech, /\| Orb \| 1 \| 1 \| 1 \| 1 \| 1 \| 5 \|/)
assert.match(statusReport.spokenText, /5 total to-dos/)
const aggregateContext = 'SUMMARY: total_count=320; open_count=3; in_progress_count=1; active_count=4; deferred_count=18; on_hold_count=3; parked_count=21; closed_count=295'
assert.deepEqual(unsupportedAggregateClaims('Orb has 320 total tasks (4 active, 21 parked, 295 closed).', aggregateContext, new Set()), [])
assert.deepEqual(unsupportedAggregateClaims('Orb has 328 total tasks.', aggregateContext, new Set()), [{ label: 'total', value: 328 }])
assert.deepEqual(unsupportedAggregateClaims('| Total | **328** |', aggregateContext, new Set()), [{ label: 'total', value: 328 }])
assert.deepEqual(unsupportedAggregateClaims('| **Total** | **328** |', aggregateContext, new Set()), [{ label: 'total', value: 328 }])
assert.deepEqual(unsupportedAggregateClaims('Orb has **328 total tasks**.', aggregateContext, new Set()), [{ label: 'total', value: 328 }])
assert.deepEqual(unsupportedAggregateClaims('The completion rate is 92.2%.', aggregateContext, new Set([92.2])), [])
assert.deepEqual(unsupportedAggregateClaims('The completion rate is 92.2%.', aggregateContext, new Set()), [{ label: 'percentage', value: 92.2 }])
assert.deepEqual(unsupportedAggregateClaims('The average is 12.5.', aggregateContext, new Set([12.5])), [])
assert.deepEqual(unsupportedAggregateClaims('The average is 12.5.', aggregateContext, new Set()), [{ label: 'average', value: 12.5 }])
assert.equal(ORB_COMMAND_BATCH_TTL_MS, 30 * 60_000)
assert.match(
  withExplicitSpellingClarification('Create test one, that\'s spelled T-E-S-T numeral one.'),
  /explicitly spelled[^\n]+"TEST1"/,
)
assert.match(
  withExplicitSpellingClarification('Use test one, spelled uppercase T-E-S-T and then numeral 1.'),
  /"TEST1"/,
)
assert.equal(
  withExplicitSpellingClarification('Create a project called Test One.'),
  'Create a project called Test One.',
)
// Stan's actual phrasings (2026-09-16), none of which say "spelled".
assert.match(withExplicitSpellingClarification('No, I want you to spell it differently, T-E-S-T numeral 8.'), /"TEST8"/)
assert.match(withExplicitSpellingClarification('Let me spell that: T-E-S-T numeral 9.'), /"TEST9"/)
assert.match(withExplicitSpellingClarification('Yes, T-E-S-T numeral eight.'), /"TEST8"/)
assert.match(withExplicitSpellingClarification('Create a project called test1, that\'s spelled T-E-S-T numeral 1, all lowercase.'), /"test1"/)
assert.equal(withExplicitSpellingClarification('Add twenty-one e-mail reminders.'), 'Add twenty-one e-mail reminders.')
assert.match(withHistorySpellingClarifications([{ role: 'user' as const, text: 'Spell it T-E-S-T numeral 8.' }])[0].text, /"TEST8"/)

const events: OrbConversationEvent[] = [
  {
    ...base,
    id: 'text-user', sequence: 1, turnId: 'turn-1', actor: 'user',
    eventType: 'user_message', modality: 'text', visibility: 'visible',
    payload: { text: 'Remember violet compass.' },
  },
  {
    ...base,
    id: 'thought', sequence: 2, turnId: 'turn-1', actor: 'system',
    eventType: 'mutation_proposed', modality: 'text', visibility: 'control',
    payload: { text: 'Thinking to myself' },
  },
  {
    ...base,
    id: 'voice-orb', sequence: 3, turnId: 'turn-1', actor: 'orb',
    eventType: 'assistant_message', modality: 'voice', visibility: 'visible',
    payload: {
      text: 'I will remember it.',
      spokenText: 'I will remember it.',
      refresh: true,
      refreshProjects: true,
      mutationType: 'project_create',
      newProjects: [{ id: 'created-project', name: 'Created', code: 'CREATED', description: null, created_by: 'user' }],
    },
  },
]

// turn-1 carries a mutation_proposed event, so its reply is framed as the
// server-issued proposal it is.
const turnOneHistory = projectModelHistory(events)
assert.equal(turnOneHistory[0]?.text, 'Remember violet compass.')
assert.match(turnOneHistory[1]?.text ?? '', /^I will remember it\.\n\n\[Server-issued confirmation request[^\]]*\]$/)

// 2026-09-16 regression: model-written proposal/receipt text with no stored
// proposal or receipt is labeled unverified; genuine receipts are labeled as
// database receipts; ordinary replies stay unlabeled.
const provenanceEvents: OrbConversationEvent[] = [
  { ...base, id: 'u1', sequence: 1, turnId: 't1', actor: 'user', eventType: 'user_message', modality: 'voice', visibility: 'visible', payload: { text: 'Create project test1.' } },
  { ...base, id: 'a1', sequence: 2, turnId: 't1', actor: 'orb', eventType: 'assistant_message', modality: 'voice', visibility: 'visible', payload: { text: 'I\'m about to create a new project called "test1".\n\nWant me to go ahead?' } },
  { ...base, id: 'u2', sequence: 3, turnId: 't2', actor: 'user', eventType: 'user_message', modality: 'voice', visibility: 'visible', payload: { text: 'Proceed.' } },
  { ...base, id: 'a2', sequence: 4, turnId: 't2', actor: 'orb', eventType: 'assistant_message', modality: 'voice', visibility: 'visible', payload: { text: 'Created the project "test1".' } },
  { ...base, id: 'a3', sequence: 5, turnId: 't3', actor: 'orb', eventType: 'assistant_message', modality: 'text', visibility: 'visible', proposalId: 'batch-1', payload: { text: 'Created the project “test2”.' } },
  { ...base, id: 'a4', sequence: 6, turnId: 't4', actor: 'orb', eventType: 'assistant_message', modality: 'text', visibility: 'visible', payload: { text: 'You have 7 active projects.' } },
]
const provenanceHistory = projectModelHistory(provenanceEvents)
assert.match(provenanceHistory[1]?.text ?? '', /\n\n\[Unverified:[^\]]*\]$/)
assert.match(provenanceHistory[3]?.text ?? '', /\n\n\[Unverified:[^\]]*\]$/)
assert.match(provenanceHistory[4]?.text ?? '', /\n\n\[Server-issued database receipt[^\]]*\]$/)
assert.equal(stripHistoryProvenanceLabels(provenanceHistory[4]?.text ?? ''), 'Created the project “test2”.')

// Labels never stream to the user, complete or partial (2026-09-16 leak).
assert.equal(presentableStreamingSpeech('[Server-issued confirmation request: a mutation tool call stored this exact proposal.]\nI'), 'I')
assert.equal(presentableStreamingSpeech('[Server-iss'), '')
assert.equal(presentableStreamingSpeech('Here it is.\n[Unver'), 'Here it is.')
assert.equal(presentableStreamingSpeech('['), '')
assert.equal(presentableStreamingSpeech('See [Open task](https://example.com)'), 'See [Open task](https://example.com)')
assert.equal(presentableStreamingSpeech('[Open task](https://ex'), '[Open task](https://ex')
assert.equal(provenanceHistory[5]?.text, 'You have 7 active projects.')

// Claim detection used by the production and eval gates.
assert.equal(hasCompletionLanguage('Created the project "test1".'), true)
assert.equal(hasCompletionLanguage('Permanently deleted the project "Test1".'), true)
assert.equal(hasCompletionLanguage('I added a new todo to Orb.'), true)
assert.equal(hasCompletionLanguage('You created the project in August.'), false)
assert.equal(hasCompletionLanguage('I created that project earlier today, before this conversation.'), false)
assert.equal(hasCompletionLanguage('Helm has 3 active tasks and 43 closed.'), false)
assert.equal(hasProposalLanguage('I\'m about to create a new project called "test1".\n\nWant me to go ahead?'), true)
assert.equal(hasProposalLanguage('Want me to show you ORB-359?'), false)
const noCodes = new Set<string>()
assert.equal(isFalseCompletionClaim('I\'m about to create a new project called "test1".\n\nWant me to go ahead?', noCodes, noCodes, false, false), true)
assert.equal(isFalseCompletionClaim('I\'m about to create a new project called "test1".\n\nWant me to go ahead?', noCodes, noCodes, false, true), false)
assert.equal(isFalseCompletionClaim('Created the project "test1".', noCodes, noCodes, false, true), true)
assert.equal(isFalseCompletionClaim('Created the project “test1”.', noCodes, noCodes, true, false), false)
assert.equal(isUnconfirmedPendingMutationClaim('Deleted ORB-381.', 'pending-delete', null), true)
assert.equal(isUnconfirmedPendingMutationClaim('Switched to Orb.', 'pending-delete', null), false)
assert.equal(isUnconfirmedPendingMutationClaim('Deleted ORB-381.', 'pending-delete', 'pending-delete'), false)
assert.equal(
  stripHistoryProvenanceLabels('[Server-issued database receipt: committed.]\nCreated the project “x”.'),
  'Created the project “x”.',
)
assert.equal(projectConversationMessages(events).some(message => message.text.includes('Thinking')), false)
assert.equal(projectConversationMessages(events)[1]?.modality, 'voice')
assert.equal(projectConversationMessages(events)[1]?.refreshProjects, true)
assert.equal(projectConversationMessages(events)[1]?.newProjects?.[0]?.id, 'created-project')
assert.equal(toOrbSpokenText('**Done.** [Open task](https://example.com).'), 'Done. Open task.')
// Speech-render comparison ignores what a listener cannot hear.
assert.equal(
  comparableSpokenWords('I\'m about to create "TEST-1" in test9.\n\nWant me to go ahead?'),
  comparableSpokenWords('I’m about to create test one in test nine. Want me to go ahead?'),
)
assert.notEqual(
  comparableSpokenWords('Created the project “test8”.'),
  comparableSpokenWords('Deleted the project test8.'),
)

assert.equal(isUsableProviderTranscript('How many closed to-dos are in Orb?'), true)
assert.equal(isUsableProviderTranscript('  continue  '), true)
assert.equal(isUsableProviderTranscript(''), false)
assert.equal(isUsableProviderTranscript('   '), false)
assert.equal(isClearlyFragmentaryProviderTranscript('S.'), true)
assert.equal(isClearlyFragmentaryProviderTranscript(' I '), true)
assert.equal(isClearlyFragmentaryProviderTranscript('No.'), false)
assert.equal(isClearlyFragmentaryProviderTranscript('OK'), false)
// A detector can initialize successfully and later stop receiving frames. A
// high-confidence provider transcript then uses the existing unavailable-VAD
// fallback while the client restarts Silero; weak transcripts still fail.
const stalledVerifier = {
  sileroShadowState: 'ready',
  sileroFrameStreamFresh: false,
  sileroLatestFrameAgeMs: 4_500,
  sileroFrameCount: 0,
  sileroSpeechObserved: false,
  sileroRealStartCount: 0,
} as const
assert.equal(isStalledVoiceVerifier(stalledVerifier), true)
assert.equal(isStalledVoiceVerifier({
  ...stalledVerifier,
  sileroFrameStreamFresh: true,
}), false)
assert.equal(shouldRecoverVoiceVerifier(stalledVerifier, 0.91), true)
assert.equal(shouldRecoverVoiceVerifier({
  sileroShadowState: 'ready',
  sileroFrameStreamFresh: true,
  sileroSpeechObserved: false,
}, 0.91), true)
assert.equal(shouldRecoverVoiceVerifier({
  sileroShadowState: 'ready',
  sileroFrameStreamFresh: true,
  sileroSpeechObserved: false,
}, 0.79), false)
assert.equal(shouldRecoverVoiceVerifier({
  sileroShadowState: 'ready',
  sileroFrameStreamFresh: true,
  sileroSpeechObserved: true,
}, 0.91), false)

// A repeated confirmation is recognised as one, so the client can drop it.
assert.equal(isBareMutationAffirmation('Yes Yes.'), true)
assert.equal(isBareMutationAffirmation('yes'), true)
assert.equal(isBareMutationAffirmation('Confirm confirm'), true)
assert.equal(isBareMutationAffirmation('Yes, but change the name'), false)
assert.equal(isBareMutationAffirmation('Make test1 the active project.'), false)

assert.equal(isTypoTolerantBareMutationAffirmation('Go aherad'), true)
assert.equal(isTypoTolerantBareMutationAffirmation('es'), true)
assert.equal(isTypoTolerantBareMutationAffirmation('no'), false)
assert.equal(isTypoTolerantBareMutationAffirmation('wait'), false)
assert.equal(isTypoTolerantBareMutationAffirmation('yes, but change it'), false)

const projectDeletes: PreparedOrbMutationCommand[] = [
  ['delete-1', 'Set up Apple Watch with iPhone'],
  ['delete-2', 'Shunyata'],
  ['delete-3', 'Pre-todos'],
].map(([toolUseId, title]) => ({
  toolUseId,
  kind: 'delete_project',
  title,
  summary: `permanently delete the project "${title}" and all of its todos`,
  projectId: `project-${toolUseId}`,
  params: {},
}))

validatePreparedOrbCommandBatch([projectDeletes[0]])
validatePreparedOrbCommandBatch(projectDeletes)
const batchSpeech = buildOrbCommandBatchConfirmationSpeech(projectDeletes)
assert.match(batchSpeech, /these 3 actions as one batch/)
assert.ok(batchSpeech.indexOf('Set up Apple Watch') < batchSpeech.indexOf('Shunyata'))
assert.ok(batchSpeech.indexOf('Shunyata') < batchSpeech.indexOf('Pre-todos'))
assert.equal((batchSpeech.match(/^\d+\./gm) ?? []).length, 3)
assert.throws(
  () => validatePreparedOrbCommandBatch([projectDeletes[0], projectDeletes[0]]),
  /Duplicate command identity/,
)

assert.deepEqual(mutationReceiptRefreshScopes({ kind: 'create_project' }), {
  projects: true,
  todos: false,
})
assert.deepEqual(mutationReceiptRefreshScopes({
  kind: 'command_batch',
  receipts: [{ kind: 'update_todo' }, { kind: 'delete_project' }],
}), {
  projects: true,
  todos: true,
})

const refreshedProjects = [{ id: 'current' }, { id: 'created' }, { id: 'fallback' }]
assert.equal(selectedProjectAfterMutationRefresh('current', refreshedProjects, 'created'), 'current')
assert.equal(selectedProjectAfterMutationRefresh('deleted', refreshedProjects), 'current')
assert.equal(selectedProjectAfterMutationRefresh(null, refreshedProjects, 'created'), 'created')
assert.equal(selectedProjectAfterMutationRefresh(null, refreshedProjects), null)
assert.deepEqual(
  projectsAfterConfirmedDeletion(refreshedProjects, ['current']),
  [{ id: 'created' }, { id: 'fallback' }],
)
assert.deepEqual(
  projectsAfterConfirmedCreation([{ id: 'current' }], { id: 'created' }),
  [{ id: 'current' }, { id: 'created' }],
)
assert.deepEqual(
  projectsAfterConfirmedCreation(
    [{ id: 'current' }, { id: 'created', stale: true }],
    { id: 'created', stale: false },
  ),
  [{ id: 'current' }, { id: 'created', stale: false }],
)
assert.deepEqual(deletedProjectIdsFromPendingMutation({
  tool: 'command_batch',
  project_id: null,
  params: {
    commands: [
      { kind: 'update_todo', project_id: 'keep' },
      { kind: 'delete_project', project_id: 'deleted-current' },
      { kind: 'delete_project', project_id: 'deleted-other' },
    ],
  },
}), ['deleted-current', 'deleted-other'])

// Switch claims and kept lead-ins (2026-09-16).
assert.equal(hasCompletionLanguage('Switching to test8.'), true)
assert.equal(hasCompletionLanguage('Okay. Switched you over to Helm.'), true)
assert.equal(hasCompletionLanguage('I\'m switching to Test7 now.'), true)
assert.equal(hasCompletionLanguage('Consider switching to Helm when the Orb work is done.'), false)
assert.equal(withoutOutcomeSentences('Sure thing. Switching to test8.'), 'Sure thing.')
assert.equal(presentableLeadIn('You\'re right, it should be test8.', noCodes, noCodes, false), 'You\'re right, it should be test8.')
assert.equal(presentableLeadIn('Created the project "test8".', noCodes, noCodes, false), '')
assert.equal(presentableLeadIn('Creating that now.', noCodes, noCodes, false), '')
assert.equal(presentableLeadIn('Sure — I\'m renaming it now.', noCodes, noCodes, false), '')
assert.equal(presentableLeadIn('Okay, deleting test8.', noCodes, noCodes, false), '')
assert.equal(presentableLeadIn('Switching to test8.', noCodes, noCodes, false), '')
assert.equal(presentableLeadIn('I\'m about to create "test8". Want me to go ahead?', noCodes, noCodes, false), '')

// Words answering a hidden SYSTEM CORRECTION never reach the user.
assert.equal(presentableLeadIn('You\'re right. I need to call the actual deletion tool:', noCodes, noCodes, true), '')
assert.equal(switchConfirmationSpeech('You\'re right. I need to actually call the tool to switch the project.', 'test8', true), 'Switched to “test8”.')
assert.equal(switchConfirmationSpeech('Sure thing. Switching to test8.', 'test8', false), 'Sure thing.\n\nSwitched to “test8”.')
assert.equal(switchConfirmationSpeech('', 'test8', false), 'Switched to “test8”.')

// Fix 1 (2026-09-16): a confirmation approves only the go-ahead the user saw.
const testEightSpeech = buildOrbConfirmationSpeechFromSummaries(['create a new project called "Test eight"'])
assert.equal(testEightSpeech, 'I\'m about to create a new project called "Test eight".\n\nWant me to go ahead?')
assert.equal(buildOrbCommandBatchConfirmationSpeech([projectDeletes[0]]), buildOrbConfirmationSpeechFromSummaries([projectDeletes[0].summary]))
assert.equal(lastShownProposalMatches([
  { role: 'user', text: 'Test eight.' },
  { role: 'assistant', text: `[Server-issued confirmation request: stored.]\n${testEightSpeech}` },
  { role: 'user', text: 'What time is it?' },
  { role: 'assistant', text: 'It is noon.' },
], testEightSpeech), true)
assert.equal(lastShownProposalMatches([
  { role: 'assistant', text: `[Server-issued confirmation request: stored.]\n${testEightSpeech}` },
  { role: 'user', text: 'All lowercase.' },
  { role: 'assistant', text: '[Unverified: nothing.]\nI\'m about to create a new project called “test8”.\n\nWant me to go ahead?' },
], testEightSpeech), false)
assert.equal(lastShownProposalMatches([{ role: 'user', text: 'Test eight.' }], testEightSpeech), false)
assert.equal(lastShownProposalMatches([
  { role: 'assistant', text: `You're right, it should be Test eight.\n\n${testEightSpeech}` },
], testEightSpeech), true)
assert.equal(lastShownProposalMatches([
  { role: 'assistant', text: `${ORB_PENDING_RESTATEMENT_PREFIX}\n\n${testEightSpeech.replace(/"/g, '“')}` },
], testEightSpeech), true)

// Interrupt contract: only deliberate input cancels; sound pauses speech.
assert.equal(isBareStopCommand('Stop.'), true)
assert.equal(isBareStopCommand('cancel, cancel'), true)
assert.equal(isBareStopCommand('never mind'), true)
assert.equal(isBareStopCommand('Stop and add milk to the list'), false)
assert.equal(isBareStopCommand('I thought that these funds are a little different.'), false)
assert.equal(isBareStopCommand('Yes, please go ahead.'), false)
assert.equal(isOrbInterruptReason('barge_in'), false)
assert.equal(isOrbInterruptReason({ type: 'click' }), false)
assert.equal(isOrbInterruptReason('exit_voice'), true)
assert.deepEqual([...TURN_CANCELLING_INTERRUPT_REASONS].sort(), ['merge', 'replacement', 'stop'])
assert.equal(isOrbInterruptReason('merge'), true)
assert.equal(isBareHaltCommand('Stop.'), true)
assert.equal(isBareHaltCommand('OK, stop.'), true)
assert.equal(isBareHaltCommand('Okay, wait.'), true)
assert.equal(isBareHaltCommand('wait, wait'), true)
assert.equal(isBareHaltCommand('Okay, tell me what is active.'), false)
assert.equal(isBareHaltCommand('No.'), false)
assert.equal(isBareHaltCommand('Nope'), false)
assert.equal(isBareHaltCommand('Okay, no.'), false)
assert.equal(mergedTurnText('Now create test 9.', ' Let me spell that: T-E-S-T numeral 9. '), 'Now create test 9. Let me spell that: T-E-S-T numeral 9.')
assert.equal(mergedTurnText('Switch to the Orb project.', 'Switch to the Orb project.'), 'Switch to the Orb project.')
assert.equal(mergedTurnText('Okay, switch to Orb.', 'Okay, switch to Orb. Now list tasks.'), 'Okay, switch to Orb. Now list tasks.')
assert.equal(normalizeSpokenTurnText('Let me try againCreate a to-do.'), 'Let me try again Create a to-do.')
assert.equal(isRestartOnlyCommand('Let me try again.'), true)
assert.equal(restartReplacementText('Let me try againCreate a to-do called Test in project Shunyata.'), 'Create a to-do called Test in project Shunyata.')
assert.equal(restartReplacementText('Try again switch to project Shunyata.'), 'switch to project Shunyata.')
assert.equal(
  mergedTurnText('Create a to-do called test.', 'Let me try againCreate a to-do called Test in project Shunyata.'),
  'Create a to-do called Test in project Shunyata.',
)
assert.equal(suggestProjectByReference([{ name: 'Shunyata', code: 'SHUNYATA' }, { name: 'Orb', code: 'ORB' }], 'Jinata')?.name, 'Shunyata')
assert.equal(suggestProjectByReference([{ name: 'Alpha' }, { name: 'Alphi' }], 'Alphx'), null)
assert.deepEqual(completeToolRound(['tool-1'], [{
  toolUseId: 'tool-1',
  speech: 'Switched to “Shunyata”.',
  clientAction: { action: 'switch_project', target: 'Shunyata', projectId: 'project-1' },
}]), {
  speech: 'Switched to “Shunyata”.',
  clientAction: { action: 'switch_project', target: 'Shunyata', projectId: 'project-1' },
})
assert.deepEqual(completeToolRound(['tool-1', 'tool-2'], [
  { toolUseId: 'tool-2', speech: 'Second result.' },
  { toolUseId: 'tool-1', speech: 'First result.' },
]), { speech: 'First result.\n\nSecond result.' })
assert.deepEqual(completeToolRound(['tool-1'], [{
  toolUseId: 'tool-1',
  speech: '| Code | Title |\n| --- | --- |\n| ORB-1 | Test |',
  spokenText: '295 matching results. I put the details on screen.',
}]), {
  speech: '| Code | Title |\n| --- | --- |\n| ORB-1 | Test |',
  spokenText: '295 matching results. I put the details on screen.',
})
assert.equal(completeToolRound(['tool-1', 'tool-2'], [{ toolUseId: 'tool-1', speech: 'Only one.' }]), null)
assert.equal(completeToolRound(['tool-1'], []), null)
assert.equal(directQueryPresentationMode('Show me all of my closed tasks.'), 'records')
assert.equal(directQueryPresentationMode('How many closed tasks do I have?'), 'count')
assert.equal(directQueryPresentationMode('Analyze my closed tasks and recommend what to archive.'), null)
assert.equal(directQueryPresentationModeForTurn('Yes, I meant Orb.', [
  { role: 'user', text: 'Show me all of my closed tasks in project CORB.' },
  { role: 'assistant', text: 'I do not have CORB. Did you mean Orb?' },
]), 'records')
assert.equal(directQueryPresentationModeForTurn('Yes.', [
  { role: 'user', text: 'Why are my closed tasks increasing?' },
  { role: 'assistant', text: 'Did you mean Orb?' },
]), null)
assert.equal(renderDirectQueryCount({ count: 295 }), '295 matching results.')
assert.equal(directQuerySpokenSummary({ count: 295 }), '295 matching results. I put the details on screen.')
assert.deepEqual(buildOrbQueryPresentation({ returned: [{
  id: 'uuid', code: 'ORB-1', todo_number: 1, title: 'Test', description: 'Long detail', status: 'closed',
  project: { name: 'Orb', code: 'ORB' }, owner: 'Stan', created_at: '2026-01-01',
}] })?.fields, ['code', 'title', 'status', 'project', 'owner'])

// A turn merged into its successor hides its fragment but keeps any receipt.
const mergeEvents: OrbConversationEvent[] = [
  { ...base, id: 'm-u1', sequence: 1, turnId: 'm1', actor: 'user', eventType: 'user_message', modality: 'voice', visibility: 'visible', payload: { text: 'Now create test 9.' } },
  { ...base, id: 'm-i1', sequence: 2, turnId: 'm1', actor: 'system', eventType: 'interrupt', modality: 'voice', visibility: 'control', payload: { reason: 'merge' } },
  { ...base, id: 'm-u2', sequence: 3, turnId: 'm2', actor: 'user', eventType: 'user_message', modality: 'voice', visibility: 'visible', payload: { text: 'Now create test 9. Let me spell that: T-E-S-T numeral 9.' } },
  { ...base, id: 'r-u1', sequence: 4, turnId: 'r1', actor: 'user', eventType: 'user_message', modality: 'voice', visibility: 'visible', payload: { text: 'Delete test eight.' } },
  { ...base, id: 'r-i1', sequence: 5, turnId: 'r1', actor: 'system', eventType: 'interrupt', modality: 'voice', visibility: 'control', payload: { reason: 'replacement' } },
]
assert.deepEqual(projectConversationMessages(mergeEvents).map(message => message.text), [
  'Now create test 9. Let me spell that: T-E-S-T numeral 9.',
  'Delete test eight.',
])

assert.throws(() => diagnosticRunCount([]))
assert.throws(() => diagnosticRunCount(['--tier', '2']))
assert.throws(() => diagnosticRunCount(['--allow-paid', '--id']))
assert.equal(diagnosticRunCount(['--allow-paid', '--id', 'case']), 1)
assert.equal(diagnosticRunCount(['--allow-paid', '--id', 'case', '--runs', '2']), 2)
assert.throws(() => diagnosticRunCount(['--allow-paid', '--id', 'case', '--runs', '0']))

// Generic boundaries: the same functions are called by production dispatch.
const visibleProjects = [{ id: 'one', code: 'ONE' }, { id: 'two', code: 'TWO' }]
assert.equal(resolveReadProject(visibleProjects, ' one ').id, 'one')
assert.throws(() => resolveReadProject(visibleProjects, 'unknown'))
assert.throws(() => resolveReadProject([...visibleProjects, visibleProjects[0]], 'ONE'))
assert.equal(safeReadProjection('todos', 'title,projects(code, name)'), 'title,projects(code,name)')
assert.ok(safeReadProjection('todos', '*').includes('title'))
for (const projection of ['users(email)', 'owner:users(*)', 'projects(*)', 'projects(users(email))', 'projects!inner(code)', 'title,', 'title)', 'title::text']) {
  assert.throws(() => safeReadProjection('todos', projection), projection)
}
assert.throws(() => safeReadProjection('users', '*'))
// `*` expands to the allowlist itself, so a bad entry there is not a rejected
// projection — it is a select PostgREST answers with "column does not exist".
// The tickets list was generated by scraping the prose in lib/db-schema.ts and
// captured two words out of a sentence, `query_tickets` and `support`, which
// broke every default read of that table. Only `todos` was exercised here, so
// nothing caught it.
//
// Pin the whole expansion of every table rather than testing the shape of each
// name: `support` is a perfectly well-formed identifier, so a shape check
// cannot tell it from a column. Only the exact list can. Changing a table's
// columns means changing this literal in the same edit, deliberately.
const EXPECTED_PROJECTIONS: Record<string, string> = {
  todos: 'id,todo_number,title,description,status,priority_value,product_id,created_at,updated_at,closed_at,resolution_notes,due_at,due_timezone,due_city,reminder_lead_value,reminder_lead_unit,urls,group_id,category_id,deleted_at',
  projects: 'id,name,code,description,created_by,is_dormant,sort_order',
  knowledge_repo: 'id,title,content,tags,product_id,origin_todo_id,created_at',
  audit_log: 'id,action,table_name,record_id,before,after,actor,created_at,user_id',
  statuses: 'id,name,is_open,is_closed,sort_order',
  priorities: 'id,value,label,is_urgent',
  categories: 'id,name,product_id,deleted_at,sort_order',
  groups: 'id,name,product_id,deleted_at,sort_order',
  tickets: 'id,ticket_number,type,source,summary,detail,conversation_snippet,reported_by,status,dismiss_reason,resolution_notes,todo_id,created_at,closed_at,deleted_at',
}
for (const [table, expected] of Object.entries(EXPECTED_PROJECTIONS)) {
  assert.equal(safeReadProjection(table, '*'), expected, table)
  for (const column of expected.split(',')) {
    assert.doesNotThrow(() => safeReadProjection(table, column), `${table}.${column}`)
  }
}
for (const notAColumn of ['query_tickets', 'support']) {
  assert.throws(() => safeReadProjection('tickets', notAColumn), notAColumn)
}
for (const tool of ['query_users', 'query_invitations', 'query_tickets', 'send_to_developer']) {
  assert.throws(() => assertToolAccess(tool, false))
  assert.doesNotThrow(() => assertToolAccess(tool, true))
}
assert.doesNotThrow(() => assertToolAccess('query_todos', false))
const memory = { track: 'autonomous', category: 'pattern', content: 'Prefers short responses.', evidence: ['Please keep the answers short.', 'Short answers help me focus.'] }
const observations = memory.evidence
assert.equal(validateMemory(memory, 'full', observations), null)
for (const texts of [[], [observations[0]], [observations[0], observations[0]], [observations.join(' ')]]) {
  assert.ok(validateMemory(memory, 'full', texts))
}
assert.ok(validateMemory(memory, 'off', observations))
assert.ok(validateMemory({ ...memory, track: 'invented' }, 'full', observations))
assert.equal(validateMemory({ ...memory, track: 'offered', evidence: [] }, 'session', []), null)
assert.equal(validateSpelledProjectField('Create a project called test, spelled T-E-S-T numeral 8.', 'create_project', { name: 'TEST8' }), null)
assert.ok(validateSpelledProjectField('Create a project called test, spelled T-E-S-T numeral 8.', 'create_project', { name: 'Test eight' }))
assert.ok(validateSpelledProjectField('Use T-E-S-T numeral 8.', 'create_project', { name: 'TEST8' }))
assert.equal(validateSpelledProjectField('Create a project called test, spelled T-E-S-T numeral 8.', 'create_todo', { title: 'Other' }), null)
const dictation = new DictationLifecycle()
const firstRecording = dictation.begin()!
assert.equal(dictation.begin(), null)
dictation.cancel()
const secondRecording = dictation.begin()!
assert.equal(dictation.finish(firstRecording), false)
assert.equal(dictation.isCurrent(secondRecording), true)
assert.equal(dictation.finish(secondRecording), true)
assert.equal(dictation.finish(secondRecording), false)
assert.equal(appendDictation('Draft', '  '), null)
assert.equal(appendDictation('Edited draft', 'new words'), 'Edited draft new words')

async function verifyApprovalBoundary() {
  let calls = 0
  const approvingAdapter = async () => { calls++; return true }
  for (const prefix of ['Yes', 'I approve', 'Proceed']) {
    for (const suffix of [', but rename it', ', if it costs nothing', ', first change the target', ', except the last item', ', and remove the second item', '?', ', T-E-S-T numeral eight']) {
      assert.equal(await evaluateMutationApproval(prefix + suffix, approvingAdapter), false, prefix + suffix)
    }
  }
  assert.equal(calls, 0, 'A semantic adapter cannot override deterministic vetoes')
  for (const text of ['yes', 'I approve the change', 'proceed', 'go ahead', 'yess']) {
    assert.equal(await evaluateMutationApproval(text, approvingAdapter), true)
  }
  assert.equal(calls, 0, 'Ordinary approvals require no classifier call')
  // Conjunction approvals. `and` was a deterministic veto until 2026-09-21, so
  // these — among the commonest ways a person says yes — could not confirm
  // anything. Because that filter also gates the classifier, there was no
  // fallback path either: the user got "did not explicitly confirm" whatever
  // they tried.
  for (const text of ['go ahead and do it', 'yes, go ahead and apply it', 'confirm and proceed', 'Go ahead and apply it.', 'ok, go ahead']) {
    assert.equal(await evaluateMutationApproval(text, approvingAdapter), true, text)
  }
  assert.equal(calls, 0, 'Conjunction approvals still need no classifier call')
  // The conjunction must not become a way to smuggle a modification through.
  for (const text of ['go ahead and also add a due date', 'yes and rename it to Test9', 'confirm and remove the second item']) {
    assert.equal(await evaluateMutationApproval(text, approvingAdapter), false, text)
  }
  assert.equal(calls, 0, 'A conjunction carrying a modification is still a deterministic veto')
  assert.equal(await evaluateMutationApproval('はい', approvingAdapter), true)
  assert.equal(calls, 1)
  assert.equal(await evaluateMutationApproval('oui', async () => { throw new Error('offline') }), false)
  assert.equal(await evaluateMutationApproval('discussion', async () => false), false)
  const classifyOnce = oncePerTurnApproval('oui', approvingAdapter)
  assert.deepEqual(await Promise.all([classifyOnce(), classifyOnce(), classifyOnce()]), [true, true, true])
  assert.equal(calls, 2, 'At most one adapter call for the same turn')
}
async function verifyConfirmationBoundary() {
  const receipt: OrbMutationConfirmation = { replayed: false, receipt: {
    kind: 'command_batch', receiptId: 'batch', commandCount: 1, receipts: [],
    source: 'database', observedAt: '2026-09-20T00:00:00Z', spokenText: 'Saved.',
  } }
  let calls = 0, recorded = 0, failures = 0
  const ports: ConfirmationPorts = {
    findBatch: async (id, user) => { assert.equal(id, 'batch'); assert.equal(user, 'actor'); return true },
    findProposal: async () => { throw new Error('wrong path') },
    rpc: async (name, params) => {
      assert.equal(name, 'confirm_orb_command_batch')
      assert.deepEqual(params, { p_batch_id: 'batch', p_user_id: 'actor', p_confirming_event_id: 'later-event' })
      calls++; return receipt
    },
    recordReceipt: async () => { recorded++ },
    receiptLogFailed: () => { failures++ },
  }
  const request = { userId: 'actor', proposalId: 'batch', durable: true, confirmingEventId: 'later-event' }
  assert.equal(await executeConfirmation(request, ports), receipt)
  assert.equal(calls, 1); assert.equal(recorded, 1)
  assert.equal(await executeConfirmation(request, { ...ports, recordReceipt: async () => { throw new Error('projection unavailable') } }), receipt)
  assert.equal(failures, 1, 'A secondary log failure cannot undo a committed receipt')
  const replay = { ...receipt, replayed: true }
  assert.equal(await executeConfirmation(request, { ...ports, rpc: async () => replay }), replay)
  await assert.rejects(() => executeConfirmation({ ...request, confirmingEventId: undefined }, ports))
  await assert.rejects(() => executeConfirmation(request, { ...ports, rpc: async () => null }))
  await assert.rejects(() => executeConfirmation(request, { ...ports, rpc: async () => { throw new Error('stale target') } }))
  await assert.rejects(() => executeConfirmation(request, { ...ports, findBatch: async () => false, findProposal: async () => null }))
  // This verifies orchestration against fake I/O, not database locking or rollback.
}
Promise.all([verifyApprovalBoundary(), verifyConfirmationBoundary()]).then(() => console.log('Unified Orb interaction contracts passed (model-free).')).catch(error => { console.error(error); process.exitCode = 1 })
