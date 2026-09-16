import assert from 'node:assert/strict'
import {
  projectConversationMessages,
  projectModelHistory,
  mutationReceiptRefreshScopes,
  type OrbConversationEvent,
} from '../lib/orb-interaction/types'
import { toOrbSpokenText } from '../lib/orb-interaction/spoken-text'
import { isAuthenticVoiceTurn } from '../lib/orb-interaction/voice-authenticity'
import { isTypoTolerantBareMutationAffirmation } from '../lib/orb-model/confirmation-grammar'
import { deletedProjectIdsFromPendingMutation, projectsAfterConfirmedCreation, projectsAfterConfirmedDeletion, selectedProjectAfterMutationRefresh } from '../lib/orb-interaction/project-refresh'
import { ORB_REALTIME_TRANSPORT_ONLY } from '../lib/orb-interaction/runtime'
import { withExplicitSpellingClarification } from '../lib/orb-interaction/spelled-identifiers'
import {
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

assert.deepEqual(projectModelHistory(events), [
  { role: 'user', text: 'Remember violet compass.' },
  { role: 'assistant', text: 'I will remember it.' },
])
assert.equal(projectConversationMessages(events).some(message => message.text.includes('Thinking')), false)
assert.equal(projectConversationMessages(events)[1]?.modality, 'voice')
assert.equal(projectConversationMessages(events)[1]?.refreshProjects, true)
assert.equal(projectConversationMessages(events)[1]?.newProjects?.[0]?.id, 'created-project')
assert.equal(toOrbSpokenText('**Done.** [Open task](https://example.com).'), 'Done. Open task.')

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

console.log('Unified Orb interaction contracts passed.')
