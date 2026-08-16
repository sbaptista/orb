#!/usr/bin/env npx tsx

import assert from 'node:assert/strict'
import { completeMoonshot, normalizeMoonshotUsage, toMoonshotMessages } from '../lib/orb-model/moonshot'

const converted = toMoonshotMessages([
  { role: 'user', content: 'Find the task.' },
  {
    role: 'assistant',
    reasoning_content: 'I should query the task list.',
    content: [
      { type: 'text', text: 'I’ll check.' },
      { type: 'tool_use', id: 'call_1', name: 'query_todos', input: { search: 'task' } },
    ],
  },
  {
    role: 'user',
    content: [
      { type: 'tool_result', tool_use_id: 'call_1', content: '{"count":1}' },
      { type: 'text', text: 'Use only that verified result.' },
    ],
  },
])

assert.deepEqual(converted, [
  { role: 'user', content: 'Find the task.' },
  {
    role: 'assistant',
    content: 'I’ll check.',
    tool_calls: [{
      id: 'call_1',
      type: 'function',
      function: { name: 'query_todos', arguments: '{"search":"task"}' },
    }],
    reasoning_content: 'I should query the task list.',
  },
  { role: 'tool', tool_call_id: 'call_1', content: '{"count":1}' },
  { role: 'user', content: 'Use only that verified result.' },
])

const usage = normalizeMoonshotUsage({
  prompt_tokens: 20_000,
  completion_tokens: 1_000,
  total_tokens: 21_000,
  cached_tokens: 0,
}, {
  source: 'eval',
  latencyMs: 1_250,
  clientToolCalls: 1,
})

assert.equal(usage.provider, 'moonshot')
assert.equal(usage.model, 'kimi-k3')
assert.equal(usage.estimatedCostUsd, 0.075)
assert.equal(usage.cachedInputTokens, 0)
assert.equal(usage.totalTokens, 21_000)

const cachedUsage = normalizeMoonshotUsage({
  prompt_tokens: 20_000,
  completion_tokens: 1_000,
  total_tokens: 21_000,
  cached_tokens: 20_000,
}, {
  source: 'eval',
  latencyMs: 1_250,
  clientToolCalls: 0,
})

assert.equal(cachedUsage.estimatedCostUsd, 0.020999999999999998)

const originalFetch = globalThis.fetch
const originalApiKey = process.env.MOONSHOT_API_KEY
let capturedBody: Record<string, any> = {}
process.env.MOONSHOT_API_KEY = 'deterministic-test-key'
globalThis.fetch = async (_input, init) => {
  capturedBody = JSON.parse(String(init?.body))
  return new Response(JSON.stringify({
    choices: [{
      finish_reason: 'tool_calls',
      message: {
        role: 'assistant',
        content: '',
        reasoning_content: 'I need the verified list.',
        tool_calls: [{
          id: 'call_2',
          type: 'function',
          function: { name: 'query_todos', arguments: '{"search":"Orb"}' },
        }],
      },
    }],
    usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120, cached_tokens: 80 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

async function runCompletionCheck() {
  try {
    const completion = await completeMoonshot({
      systemPrompt: 'System instructions',
      messages: [{ role: 'user', content: 'Find Orb todos.' }],
      tools: [{ name: 'query_todos', description: 'Search todos', input_schema: { type: 'object', properties: {} } }],
      reasoningEffort: 'low',
      promptCacheKey: 'orb-eval-operational-v1',
    })

    assert.equal(capturedBody.model, 'kimi-k3')
    assert.equal(capturedBody.reasoning_effort, 'low')
    assert.equal(capturedBody.max_completion_tokens, 4096)
    assert.equal(capturedBody.prompt_cache_key, 'orb-eval-operational-v1')
    assert.equal(capturedBody.tools?.[0]?.function?.strict, true)
    assert.deepEqual(completion.toolCalls, [{ id: 'call_2', name: 'query_todos', params: { search: 'Orb' } }])
    assert.equal(completion.assistantMessage.reasoning_content, 'I need the verified list.')
    assert.equal(completion.modelUsage.cachedInputTokens, 80)
  } finally {
    globalThis.fetch = originalFetch
    if (originalApiKey === undefined) delete process.env.MOONSHOT_API_KEY
    else process.env.MOONSHOT_API_KEY = originalApiKey
  }
}

runCompletionCheck()
  .then(() => console.log('Moonshot adapter deterministic checks passed.'))
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
