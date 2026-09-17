import assert from 'node:assert/strict'
import {
  projectConversationMessages,
  projectModelHistory,
  mutationReceiptRefreshScopes,
  type OrbConversationEvent,
} from '../lib/orb-interaction/types'
import { comparableSpokenWords, toOrbSpokenText } from '../lib/orb-interaction/spoken-text'
import { isBareHaltCommand, isBareStopCommand, isOrbInterruptReason, mergedTurnText, TURN_CANCELLING_INTERRUPT_REASONS } from '../lib/orb-interaction/interrupt-intent'
import { hasCompletionLanguage, hasProposalLanguage, isFalseCompletionClaim, presentableLeadIn, presentableStreamingSpeech, stripHistoryProvenanceLabels, switchConfirmationSpeech, withoutOutcomeSentences } from '../lib/orb-model/false-claim-guard'
import { isAuthenticVoiceTurn } from '../lib/orb-interaction/voice-authenticity'
import { isTypoTolerantBareMutationAffirmation } from '../lib/orb-model/confirmation-grammar'
import { deletedProjectIdsFromPendingMutation, projectsAfterConfirmedCreation, projectsAfterConfirmedDeletion, selectedProjectAfterMutationRefresh } from '../lib/orb-interaction/project-refresh'
import { ORB_REALTIME_TRANSPORT_ONLY } from '../lib/orb-interaction/runtime'
import { withExplicitSpellingClarification, withHistorySpellingClarifications } from '../lib/orb-interaction/spelled-identifiers'
import { lastShownProposalMatches } from '../lib/orb-interaction/model-history'
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

assert.equal(ORB_REALTIME_TRANSPORT_ONLY, true)
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

assert.equal(isAuthenticVoiceTurn({
  sileroShadowState: 'ready',
  sileroFrameCount: 40,
  sileroSpeechObserved: true,
  sileroRealStartCount: 1,
}, 0.9), true)
assert.equal(isAuthenticVoiceTurn({
  sileroShadowState: 'ready',
  sileroFrameCount: 30,
  sileroSpeechObserved: true,
  sileroRealStartCount: 0,
  sileroPositiveFrameCount: 8,
  sileroPositiveFrameRatio: 0.2667,
  sileroMaximumProbability: 0.7289,
}, 0.2), true)
assert.equal(isAuthenticVoiceTurn({
  sileroShadowState: 'ready',
  sileroFrameCount: 40,
  sileroSpeechObserved: false,
  sileroRealStartCount: 0,
}, 0.3), false)
assert.equal(isAuthenticVoiceTurn({
  sileroShadowState: 'ready',
  sileroFrameCount: 68,
  sileroSpeechObserved: true,
  sileroRealStartCount: 0,
  sileroPositiveFrameCount: 8,
  sileroPositiveFrameRatio: 0.1176,
  sileroMaximumProbability: 0.7,
}, 0.33), false)
assert.equal(isAuthenticVoiceTurn({ sileroShadowState: 'failed' }, null), false)
assert.equal(isAuthenticVoiceTurn({
  sileroShadowState: 'ready',
  sileroFrameCount: 8,
  sileroSpeechObserved: false,
  sileroRealStartCount: 0,
}, 0.99), false)

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
assert.equal(isBareHaltCommand('wait, wait'), true)
assert.equal(isBareHaltCommand('No.'), false)
assert.equal(isBareHaltCommand('Nope'), false)
assert.equal(mergedTurnText('Now create test 9.', ' Let me spell that: T-E-S-T numeral 9. '), 'Now create test 9. Let me spell that: T-E-S-T numeral 9.')

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

console.log('Unified Orb interaction contracts passed.')
