import assert from 'node:assert/strict'
import { AI_REQUEST_CSV_HEADERS, aiRequestCsvHeader, aiRequestCsvRow } from '../lib/ai-metrics/csv'
import { classifyClientPlatform, sanitizeModelRequestPlatform } from '../lib/client-environment'

const row = aiRequestCsvRow({
  id: '=unsafe-id',
  created_at: '2026-08-18T12:00:00.000Z',
  provider: 'moonshot ☾',
  model: 'kimi-k3',
  source: 'eval',
  route_role: 'strategic',
  platform: 'server',
  success: true,
  failure_code: 'comma, quote " and\nnewline',
  attempt_count: 1,
  latency_ms: 1200,
  input_tokens: 123,
  output_tokens: 45,
  cached_input_tokens: null,
  cache_write_tokens: 0,
  reasoning_tokens: 8,
  total_tokens: 176,
  client_tool_calls: 0,
  estimated_cost_usd: '0.00001234',
  rate_snapshot: { version: 'configured-2026-08-18', effectiveDate: '2026-08-18', inputPerMillion: 0.6 },
  correlation_id: null,
  evaluation_case_id: '+formula',
  prompt_version: 'prompt-v1',
  context_packet_version: 'context-v1',
})

assert.equal(aiRequestCsvHeader().split(',').length, AI_REQUEST_CSV_HEADERS.length)
assert.ok(aiRequestCsvHeader().endsWith('\r\n'))
assert.ok(row.startsWith("'=unsafe-id,"))
assert.ok(row.includes('"comma, quote "" and\nnewline"'))
assert.ok(row.includes(',0.00001234,'))
assert.ok(row.includes("'+formula"))
assert.ok(row.includes('moonshot ☾'))
assert.ok(row.endsWith('\r\n'))
assert.equal(classifyClientPlatform({ userAgent: 'Safari', navigatorPlatform: 'MacIntel', touchPoints: 0, width: 1440, coarsePointer: false }), 'mac')
assert.equal(classifyClientPlatform({ userAgent: 'Safari', navigatorPlatform: 'MacIntel', touchPoints: 5, width: 1024, coarsePointer: true }), 'ipad')
assert.equal(classifyClientPlatform({ userAgent: 'iPhone', navigatorPlatform: 'iPhone', touchPoints: 5, width: 390, coarsePointer: true }), 'iphone')
assert.equal(sanitizeModelRequestPlatform('server'), 'server')
assert.equal(sanitizeModelRequestPlatform('windows'), 'unknown')

console.log(`AI Metrics CSV verification passed (${AI_REQUEST_CSV_HEADERS.length} columns).`)
