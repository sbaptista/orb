#!/usr/bin/env npx tsx
/**
 * Orb Eval Runner
 *
 * Tests the Orb's decision-making: does it call the right tools with the right
 * parameters, and does its speech contain the expected content?
 *
 * Run with --help for usage, or --list to see every available case id.
 */

import { EVAL_CASES, type EvalCase } from './eval-cases'
import * as dotenv from 'dotenv'
import * as path from 'path'
import type { OrbModelUsage } from '../lib/orb-model/types'

// dotenv/BASE_URL are computed up front (before --help/--list) so the usage
// text below can reference the real target instead of a hardcoded guess that
// can silently go stale — this is a local file read + one env lookup, not
// network activity, so it costs --help/--list nothing.
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })
const BASE_URL = process.env.EVAL_BASE_URL || 'https://192.168.86.90:3001'

// Single source for usage text — printed by --help. Keeping this as the only
// copy (rather than a duplicate top-of-file comment) means the two can't
// silently drift the way orb-converse.ts and its eval mirror once did.
//
// Canonical invocation is `npm run eval -- ...`, not raw `npx tsx`: the npm
// scripts carry NODE_TLS_REJECT_UNAUTHORIZED=0, required because BASE_URL is
// self-signed HTTPS. Without it, fetch() fails the TLS handshake before the
// dev server ever sees the request — a confusing "fetch failed" with no
// indication why. A raw npx tsx example here would be a real, followed
// instruction that reproduces exactly that failure, not just inert text.
const USAGE = `Orb Eval Runner

Tests the Orb's decision-making: does it call the right tools with the right
parameters, and does its speech contain the expected content?

Usage:
  npm run eval                                  Run all tests
  npm run eval:t1                               Run only Tier 1 (deterministic)
  npm run eval:t2                               Run only Tier 2 (behavioral)
  npm run eval -- --id <id>[,<id>...]           Run one or more specific cases by id
  npm run eval -- --list                        List every case id, grouped by tier
  npm run eval -- --help                        Show this message

--tier and --id compose: --id filters within whatever --tier already selected.

Examples:
  npm run eval -- --id switch-project-partial-name-resolves
  npm run eval -- --id bulk-delete-project-todos-calls-tools,switch-project-partial-name-resolves
  npm run eval:t1 -- --id create-default-project

Case ids come from scripts/eval-cases.ts (the "id" field on each case) — run
--list to see them all without opening that file.

Requires the dev server reachable at ${BASE_URL} (override via EVAL_BASE_URL
in .env.local). --help and --list make no network calls and need no server.

Direct npx invocation (skips the npm wrapper) needs the TLS bypass BASE_URL
requires as a self-signed-HTTPS target, added manually:
  NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/orb-eval.ts --id <id>
`

// --help/--list need no network/auth setup, so they're handled before the
// API_SECRET check below.
const earlyArgs = process.argv.slice(2)
if (earlyArgs.includes('--help') || earlyArgs.includes('-h')) {
  console.log(USAGE)
  process.exit(0)
}
if (earlyArgs.includes('--list')) {
  const byTier = (tier: 1 | 2) => EVAL_CASES.filter(c => c.tier === tier)
  console.log(`\nOrb Eval — ${EVAL_CASES.length} cases\n`)
  for (const tier of [1, 2] as const) {
    const cases = byTier(tier)
    console.log(`Tier ${tier} (${tier === 1 ? 'deterministic' : 'behavioral'}, ${cases.length} case${cases.length === 1 ? '' : 's'}):`)
    for (const c of cases) console.log(`  ${c.id}\n    ${c.description}`)
    console.log()
  }
  console.log('Run one or more with: npm run eval -- --id <id>[,<id>...]')
  process.exit(0)
}

// Preflight: BASE_URL is self-signed HTTPS in local dev. Without the TLS
// bypass, fetch() fails the handshake before any request reaches the dev
// server — indistinguishable, from the runner's side, from the server being
// down or unreachable. Catching this here turns a generic "fetch failed"
// (which took real back-and-forth to diagnose once) into an immediate,
// specific, actionable error instead of relying on anyone reading the usage
// text correctly.
if (BASE_URL.startsWith('https://') && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0') {
  console.error(`❌ NODE_TLS_REJECT_UNAUTHORIZED is not set to '0', and BASE_URL (${BASE_URL}) is HTTPS with a self-signed dev certificate.`)
  console.error('   fetch() will fail the TLS handshake before the dev server ever sees a request.')
  console.error('   Run via the npm wrapper instead: npm run eval -- <args>')
  console.error('   Or, for direct npx: NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/orb-eval.ts <args>')
  process.exit(1)
}

const API_SECRET = process.env.ORB_API_SECRET
const EVAL_PROVIDER = process.env.EVAL_PROVIDER
const EVAL_MODEL = process.env.EVAL_MODEL
const EVAL_USER_EMAIL = process.env.EVAL_USER_EMAIL
const EVAL_CONTEXT_PACKET_ID = process.env.EVAL_CONTEXT_PACKET_ID

if (!API_SECRET) {
  console.error('❌ ORB_API_SECRET not found in .env.local')
  process.exit(1)
}

// ── Types ──────────────────────────────────────────────────────────────────

type EvalResponse = {
  speech: string
  toolCalls: Array<{ name: string; params: Record<string, any> }>
  stopReason: string
  tokenUsage: { input_tokens: number; output_tokens: number }
  modelUsage?: OrbModelUsage
  routeRole?: 'operational' | 'strategic'
  error?: string
}

type TestResult = {
  id: string
  tier: 1 | 2
  description: string
  passed: boolean
  runs: number
  passCount: number
  failures: string[]
  speech?: string
  toolCalls?: Array<{ name: string; params: Record<string, any> }>
  tokens?: number
  modelUsage?: OrbModelUsage
  modelUsages?: OrbModelUsage[]
  durationMs?: number
}

// ── API Call ────────────────────────────────────────────────────────────────

// The dev endpoint shares Orb's 10-calls-per-minute safety limit. Keep the
// deterministic suite under that ceiling so its results are meaningful.
const INTER_REQUEST_DELAY_MS = 6500

async function callOrb(testCase: EvalCase): Promise<EvalResponse> {
  const provider = testCase.provider ?? EVAL_PROVIDER
  const model = testCase.model ?? EVAL_MODEL
  const res = await fetch(`${BASE_URL}/api/orb-eval`, {
    method: 'POST',
    headers: {
      'Authorization': API_SECRET!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: testCase.input,
      productCode: testCase.productCode,
      history: testCase.history,
      pendingSummary: testCase.pendingSummary,
      actionSets: testCase.actionSets,
      backlogOverride: testCase.backlogOverride,
      mutationApproval: testCase.mutationApproval,
      voiceMode: testCase.voiceMode,
      ttsProvider: testCase.ttsProvider,
      ttsModel: testCase.ttsModel,
      ttsVoiceId: testCase.ttsVoiceId,
      evaluationMode: testCase.evaluationMode,
      autoRoute: testCase.autoRoute,
      budgetOverride: testCase.budgetOverride,
      evaluationCaseId: testCase.id,
      ...(provider ? { provider } : {}),
      ...(model ? { model } : {}),
      ...(testCase.userEmail || EVAL_USER_EMAIL ? { userEmail: testCase.userEmail ?? EVAL_USER_EMAIL } : {}),
      ...(EVAL_CONTEXT_PACKET_ID ? { contextPacketId: EVAL_CONTEXT_PACKET_ID } : {}),
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }

  return res.json()
}

function isNetworkError(msg: string): boolean {
  return /fetch failed|ECONNRESET|ETIMEDOUT|ECONNREFUSED|socket hang up/i.test(msg)
}

async function callOrbWithRetry(testCase: EvalCase, retries = 3): Promise<EvalResponse> {
  let delay = 1000
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await callOrb(testCase)
    } catch (err: any) {
      if (isNetworkError(err.message ?? '') && attempt < retries - 1) {
        process.stderr.write(`\n  ⚠️  Network error on ${testCase.id} — retrying in ${delay}ms...\n`)
        await new Promise(r => setTimeout(r, delay))
        delay *= 2
        continue
      }
      throw err
    }
  }
  throw new Error('Retries exhausted')
}

// ── Assertions ─────────────────────────────────────────────────────────────

function assertToolCall(response: EvalResponse, testCase: EvalCase): string[] {
  const failures: string[] = []

  if (testCase.expectNoTool) {
    if (response.toolCalls.length > 0) {
      failures.push(`Expected no tool calls, got: ${response.toolCalls.map(t => t.name).join(', ')}`)
    }
    return failures
  }

  if (testCase.expectTool) {
    const match = response.toolCalls.find(tc => tc.name === testCase.expectTool!.name)
    if (!match) {
      failures.push(`Expected tool "${testCase.expectTool.name}", got: ${response.toolCalls.length === 0 ? 'none' : response.toolCalls.map(t => t.name).join(', ')}`)
    } else if (testCase.expectTool.params) {
      for (const [key, expected] of Object.entries(testCase.expectTool.params)) {
        const actual = match.params[key]
        const expectedUpper = typeof expected === 'string' ? expected.toUpperCase() : expected
        const actualUpper = typeof actual === 'string' ? actual.toUpperCase() : actual
        if (actualUpper !== expectedUpper) {
          failures.push(`Tool "${testCase.expectTool.name}" param "${key}": expected "${expected}", got "${actual}"`)
        }
      }
    }
  }

  if (testCase.expectToolCount) {
    const actual = response.toolCalls.filter(tc => tc.name === testCase.expectToolCount!.name).length
    if (actual !== testCase.expectToolCount.count) {
      failures.push(`Expected ${testCase.expectToolCount.count} calls to "${testCase.expectToolCount.name}", got ${actual}`)
    }
  }

  return failures
}

function assertSpeech(response: EvalResponse, testCase: EvalCase): string[] {
  const failures: string[] = []
  const speechLower = response.speech.toLowerCase()

  if (testCase.speechContains) {
    // For "refuses-unknown-feature" style tests, ANY match is sufficient
    // For others, ALL must match. Use the id to distinguish? No — let's use a simple rule:
    // If the array has > 3 items, treat as "any match" (it's a list of synonyms)
    // Otherwise, treat as "all must match"
    if (testCase.speechContains.length > 3) {
      const anyMatch = testCase.speechContains.some(s => speechLower.includes(s.toLowerCase()))
      if (!anyMatch) {
        failures.push(`Speech should contain at least one of: ${testCase.speechContains.join(', ')}`)
      }
    } else {
      for (const s of testCase.speechContains) {
        if (!speechLower.includes(s.toLowerCase())) {
          failures.push(`Speech missing: "${s}"`)
        }
      }
    }
  }

  if (testCase.speechNotContains) {
    for (const s of testCase.speechNotContains) {
      if (speechLower.includes(s.toLowerCase())) {
        failures.push(`Speech should NOT contain: "${s}"`)
      }
    }
  }

  if (testCase.speechPattern) {
    if (!testCase.speechPattern.test(response.speech)) {
      failures.push(`Speech didn't match pattern: ${testCase.speechPattern}`)
    }
  }

  return failures
}

function assertRouting(response: EvalResponse, testCase: EvalCase): string[] {
  const failures: string[] = []
  if (testCase.expectProvider && response.modelUsage?.provider !== testCase.expectProvider) {
    failures.push(`Expected provider "${testCase.expectProvider}", got "${response.modelUsage?.provider ?? 'none'}"`)
  }
  if (testCase.expectRouteRole && response.routeRole !== testCase.expectRouteRole) {
    failures.push(`Expected route role "${testCase.expectRouteRole}", got "${response.routeRole ?? 'none'}"`)
  }
  return failures
}

// ── Runner ─────────────────────────────────────────────────────────────────

// Readable-but-collision-proof names (Supabase/Docker style + random suffix) for
// cases that create entities. Cases use the literal token __UNIQUE__ in `input`
// and `expectTool.params`; we substitute the SAME generated value into both.
const NAME_ADJ = ['brisk', 'calm', 'dapper', 'eager', 'fuzzy', 'jolly', 'keen', 'lush', 'mellow', 'nimble', 'plucky', 'quirky', 'rustic', 'snug', 'witty', 'zesty']
const NAME_NOUN = ['otter', 'beluga', 'bellows', 'cedar', 'comet', 'ember', 'fjord', 'gable', 'harbor', 'ibis', 'juniper', 'kestrel', 'lichen', 'marlin', 'nimbus', 'quartz']
function generateUniqueName(): string {
  const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)]
  return `${pick(NAME_ADJ)}-${pick(NAME_NOUN)}-${Math.random().toString(36).slice(2, 7)}`
}
function substituteUnique(testCase: EvalCase): EvalCase {
  const usesToken = testCase.input.includes('__UNIQUE__')
    || Object.values(testCase.expectTool?.params ?? {}).some(v => typeof v === 'string' && v.includes('__UNIQUE__'))
  if (!usesToken) return testCase
  const name = generateUniqueName()
  const params = testCase.expectTool?.params
    ? Object.fromEntries(Object.entries(testCase.expectTool.params).map(([k, v]) => [k, typeof v === 'string' ? v.replace('__UNIQUE__', name) : v]))
    : testCase.expectTool?.params
  return {
    ...testCase,
    input: testCase.input.replace('__UNIQUE__', name),
    ...(testCase.expectTool ? { expectTool: { ...testCase.expectTool, params } } : {}),
  }
}

async function runCase(testCaseRaw: EvalCase): Promise<TestResult> {
  const testCase = substituteUnique(testCaseRaw)
  const runs = testCase.tier === 2 ? 3 : 1
  let passCount = 0
  let lastFailures: string[] = []
  let lastResponse: EvalResponse | null = null
  const modelUsages: OrbModelUsage[] = []
  let totalMs = 0

  for (let i = 0; i < runs; i++) {
    const start = Date.now()
    try {
      const response = await callOrbWithRetry(testCase)
      totalMs += Date.now() - start
      lastResponse = response
      if (response.modelUsage) modelUsages.push(response.modelUsage)

      const toolFailures = assertToolCall(response, testCase)
      const speechFailures = assertSpeech(response, testCase)
      const routingFailures = assertRouting(response, testCase)
      const allFailures = [...toolFailures, ...speechFailures, ...routingFailures]

      if (allFailures.length === 0) {
        passCount++
      } else {
        lastFailures = allFailures
      }
    } catch (err: any) {
      totalMs += Date.now() - start
      lastFailures = [`Error: ${err.message}`]
    }

    if (i < runs - 1) await new Promise(r => setTimeout(r, INTER_REQUEST_DELAY_MS))
  }

  // Tier 1: must pass 1/1. Tier 2: must pass 2/3.
  const passThreshold = testCase.tier === 2 ? 2 : 1
  const passed = passCount >= passThreshold

  return {
    id: testCase.id,
    tier: testCase.tier,
    description: testCase.description,
    passed,
    runs,
    passCount,
    failures: passed ? [] : lastFailures,
    speech: lastResponse?.speech?.slice(0, 200),
    toolCalls: lastResponse?.toolCalls,
    tokens: lastResponse?.tokenUsage
      ? lastResponse.tokenUsage.input_tokens + lastResponse.tokenUsage.output_tokens
      : undefined,
    modelUsage: lastResponse?.modelUsage,
    modelUsages,
    durationMs: Math.round(totalMs / runs),
  }
}

// ── Status Bar ─────────────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

function formatDateTime(d: Date): string {
  const local = d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  })
  return `${local} (${d.toISOString()})`
}

function truncateStatusText(text: string, maxLength: number): string {
  if (maxLength <= 0) return ''
  if (text.length <= maxLength) return text
  if (maxLength === 1) return '…'
  return `${text.slice(0, maxLength - 1)}…`
}

function updateStatusBar(opts: {
  current: number; total: number; passed: number; failed: number;
  elapsed: number; currentCase?: string; currentRun?: number; totalRuns?: number
}) {
  const { current, total, passed, failed, elapsed, currentCase, currentRun, totalRuns } = opts
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  const terminalWidth = Math.max(40, process.stderr.columns || 100)
  const maxLineWidth = terminalWidth - 1
  const barWidth = Math.max(8, Math.min(20, Math.floor(terminalWidth / 5)))
  const filled = Math.round((current / total) * barWidth)
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled)

  const runInfo = currentRun && totalRuns ? ` run ${currentRun}/${totalRuns}` : ''
  const caseInfo = currentCase ? ` → ${currentCase}${runInfo}` : ''

  const prefix = `  ${bar} ${pct}% (${current}/${total}) | ✅ ${passed} ❌ ${failed} | ${formatElapsed(elapsed)}`
  const availableCaseWidth = maxLineWidth - prefix.length
  const line = truncateStatusText(`${prefix}${caseInfo}`, maxLineWidth)

  // Keep this to one physical terminal row. If the line wraps during a resize,
  // clearing only the current row leaves fragments behind.
  process.stderr.write(`\x1b[?25l\r\x1b[K${truncateStatusText(line, prefix.length + Math.max(0, availableCaseWidth))}`)
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const tierFilter = args.includes('--tier') ? parseInt(args[args.indexOf('--tier') + 1]) : null
  const idArg = args.includes('--id') ? args[args.indexOf('--id') + 1] : null
  const idFilters = idArg ? idArg.split(',').map(s => s.trim()).filter(Boolean) : null

  let cases = EVAL_CASES
  if (tierFilter) cases = cases.filter(c => c.tier === tierFilter)
  if (idFilters) {
    const knownIds = new Set(cases.map(c => c.id))
    const unmatched = idFilters.filter(id => !knownIds.has(id))
    if (unmatched.length > 0) {
      console.error(`❌ Unknown case id${unmatched.length > 1 ? 's' : ''}: ${unmatched.join(', ')}`)
      console.error('   Run --list to see every available case id.')
      process.exit(1)
    }
    cases = cases.filter(c => idFilters.includes(c.id))
  }

  if (cases.length === 0) {
    console.error('No test cases match the filter.')
    process.exit(1)
  }

  const totalRuns = cases.reduce((sum, c) => sum + (c.tier === 2 ? 3 : 1), 0)
  const startedAt = new Date()
  console.log(`\n🔮 Orb Eval — ${cases.length} cases, ${totalRuns} total runs\n`)
  console.log(`   Started: ${formatDateTime(startedAt)}`)
  console.log(`   Target: ${BASE_URL}`)
  console.log(`   Tier 1 (deterministic): ${cases.filter(c => c.tier === 1).length} cases`)
  console.log(`   Tier 2 (behavioral, 3× each): ${cases.filter(c => c.tier === 2).length} cases`)
  console.log()

  const results: TestResult[] = []
  const startTime = Date.now()
  let completedRuns = 0
  let passedCases = 0
  let failedCases = 0

  // Show initial status bar
  updateStatusBar({ current: 0, total: totalRuns, passed: 0, failed: 0, elapsed: 0, currentCase: cases[0]?.id })

  for (const testCase of cases) {
    const runs = testCase.tier === 2 ? 3 : 1
    let passCount = 0
    let lastFailures: string[] = []
    let lastResponse: EvalResponse | null = null
    const modelUsages: OrbModelUsage[] = []
    let totalMs = 0

    for (let i = 0; i < runs; i++) {
      updateStatusBar({
        current: completedRuns, total: totalRuns,
        passed: passedCases, failed: failedCases,
        elapsed: Date.now() - startTime,
        currentCase: testCase.id, currentRun: i + 1, totalRuns: runs,
      })

      const runStart = Date.now()
      try {
        const response = await callOrbWithRetry(testCase)
        totalMs += Date.now() - runStart
        lastResponse = response
        if (response.modelUsage) modelUsages.push(response.modelUsage)

        const toolFailures = assertToolCall(response, testCase)
        const speechFailures = assertSpeech(response, testCase)
        const routingFailures = assertRouting(response, testCase)
        const allFailures = [...toolFailures, ...speechFailures, ...routingFailures]

        if (allFailures.length === 0) {
          passCount++
        } else {
          lastFailures = allFailures
        }
      } catch (err: any) {
        totalMs += Date.now() - runStart
        const msg = err.message || ''
        if (msg.includes('credit balance') || msg.includes('rate_limit') || msg.includes('overloaded')) {
          console.warn(`\n  ⚠️  API limit hit on ${testCase.id} run ${i + 1} — skipping run`)
          completedRuns++
          continue
        }
        lastFailures = [`Error: ${msg}`]
      }
      completedRuns++

      // Cool-off between calls to respect the endpoint rate limit.
      if (i < runs - 1) await new Promise(r => setTimeout(r, INTER_REQUEST_DELAY_MS))
    }

    // Tier 1: must pass 1/1. Tier 2: must pass majority of COMPLETED runs.
    // Skipped runs (API limits) don't count against the test.
    const completedThisCase = passCount + lastFailures.length > 0 ? passCount + (lastFailures.length > 0 ? 1 : 0) : runs
    const passThreshold = testCase.tier === 2 ? Math.max(1, Math.ceil(completedThisCase * 0.66)) : 1
    const passed = passCount >= passThreshold
    if (passed) passedCases++; else failedCases++

    const result: TestResult = {
      id: testCase.id,
      tier: testCase.tier,
      description: testCase.description,
      passed,
      runs,
      passCount,
      failures: passed ? [] : lastFailures,
      speech: lastResponse?.speech?.slice(0, 200),
      toolCalls: lastResponse?.toolCalls,
      tokens: lastResponse?.tokenUsage
        ? lastResponse.tokenUsage.input_tokens + lastResponse.tokenUsage.output_tokens
        : undefined,
      modelUsage: lastResponse?.modelUsage,
      modelUsages,
      durationMs: Math.round(totalMs / runs),
    }
    results.push(result)

    if (testCase !== cases[cases.length - 1]) {
      await new Promise(r => setTimeout(r, INTER_REQUEST_DELAY_MS))
    }
  }

  // Clear the status bar
  process.stderr.write('\r\x1b[K\x1b[?25h')

  // ── Results ────────────────────────────────────────────────────────────

  console.log('  Results:\n')
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌'
    console.log(`  ${icon} [T${r.tier}] ${r.id} (${r.passCount}/${r.runs}) ${r.durationMs}ms`)
    if (!r.passed) {
      for (const f of r.failures) {
        console.log(`       → ${f}`)
      }
      if (r.speech) {
        console.log(`       Speech: "${r.speech}..."`)
      }
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────

  console.log('\n' + '═'.repeat(60))

  const tier1 = results.filter(r => r.tier === 1)
  const tier2 = results.filter(r => r.tier === 2)
  const tier1Pass = tier1.filter(r => r.passed).length
  const tier2Pass = tier2.filter(r => r.passed).length
  const allUsages = results.flatMap(result => result.modelUsages ?? (result.modelUsage ? [result.modelUsage] : []))
  const totalTokens = allUsages.length > 0
    ? allUsages.reduce((sum, usage) => sum + (usage.totalTokens ?? 0), 0)
    : results.reduce((sum, result) => sum + (result.tokens ?? 0), 0)
  const totalEstimatedCost = allUsages.reduce((sum, usage) => sum + (usage.estimatedCostUsd ?? 0), 0)
  const usageByModel = new Map<string, OrbModelUsage>()
  for (const usage of allUsages) {
    const key = `${usage.provider}:${usage.model}`
    const existing = usageByModel.get(key)
    if (existing) {
      existing.inputTokens += usage.inputTokens
      existing.outputTokens += usage.outputTokens
      existing.cachedInputTokens = (existing.cachedInputTokens ?? 0) + (usage.cachedInputTokens ?? 0)
      existing.cacheWriteTokens = (existing.cacheWriteTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
      existing.totalTokens = (existing.totalTokens ?? 0) + (usage.totalTokens ?? 0)
      existing.clientToolCalls += usage.clientToolCalls
      existing.latencyMs += usage.latencyMs
      existing.estimatedCostUsd = (existing.estimatedCostUsd ?? 0) + (usage.estimatedCostUsd ?? 0)
    } else {
      usageByModel.set(key, { ...usage })
    }
  }
  const elapsed = Date.now() - startTime
  const completedAt = new Date()

  if (tier1.length > 0) {
    console.log(`  Tier 1 (tool correctness): ${tier1Pass}/${tier1.length} passed${tier1Pass < tier1.length ? ' ⚠️  REGRESSION' : ' ✅'}`)
  }
  if (tier2.length > 0) {
    console.log(`  Tier 2 (behavioral):       ${tier2Pass}/${tier2.length} passed${tier2Pass < tier2.length ? ' ⚠️' : ' ✅'}`)
  }
  console.log(`  Total tokens used:         ~${totalTokens.toLocaleString()}`)
  if (usageByModel.size > 0) {
    console.log(`  Estimated cost:            ~$${totalEstimatedCost.toFixed(4)}`)
    for (const usage of usageByModel.values()) {
      const cacheRead = usage.cachedInputTokens == null ? 'n/a' : usage.cachedInputTokens.toLocaleString()
      const cacheWrite = usage.cacheWriteTokens == null ? 'n/a' : usage.cacheWriteTokens.toLocaleString()
      const modelRuns = allUsages.filter(candidate => candidate.provider === usage.provider && candidate.model === usage.model).length
      console.log(`  Usage ${usage.provider}/${usage.model}: in ${usage.inputTokens.toLocaleString()} | out ${usage.outputTokens.toLocaleString()} | cache read ${cacheRead} | cache write ${cacheWrite} | tools ${usage.clientToolCalls} | avg latency ${Math.round(usage.latencyMs / modelRuns)}ms`)
    }
  } else {
    console.log('  Estimated cost:            unavailable (endpoint returned legacy usage only)')
  }
  console.log(`  Started:                  ${formatDateTime(startedAt)}`)
  console.log(`  Completed:                ${formatDateTime(completedAt)}`)
  console.log(`  Elapsed:                   ${formatElapsed(elapsed)}`)
  console.log('═'.repeat(60) + '\n')

  // The endpoint may leave HTTP keep-alive handles open after a completed run.
  // Exit only after printing every result so the CLI gate is deterministic.
  process.exit(tier1Pass < tier1.length ? 1 : 0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
