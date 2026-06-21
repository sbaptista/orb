#!/usr/bin/env npx tsx
/**
 * Orb Eval Runner
 *
 * Tests the Orb's decision-making: does it call the right tools with the right
 * parameters, and does its speech contain the expected content?
 *
 * Usage:
 *   npx tsx scripts/orb-eval.ts                    # run all tests
 *   npx tsx scripts/orb-eval.ts --tier 1           # run only Tier 1 (deterministic)
 *   npx tsx scripts/orb-eval.ts --tier 2           # run only Tier 2 (behavioral)
 *   npx tsx scripts/orb-eval.ts --id scope-transparency  # run a single test
 *
 * Requires the dev server running on localhost:3001.
 */

import { EVAL_CASES, type EvalCase } from './eval-cases'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const BASE_URL = process.env.EVAL_BASE_URL || 'https://192.168.86.90:3001'
const API_SECRET = process.env.ORB_API_SECRET

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
  durationMs?: number
}

// ── API Call ────────────────────────────────────────────────────────────────

// The dev endpoint shares Orb's 10-calls-per-minute safety limit. Keep the
// deterministic suite under that ceiling so its results are meaningful.
const INTER_REQUEST_DELAY_MS = 6500

async function callOrb(testCase: EvalCase): Promise<EvalResponse> {
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
      mutationApproval: testCase.mutationApproval,
      voiceMode: testCase.voiceMode,
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

// ── Runner ─────────────────────────────────────────────────────────────────

async function runCase(testCase: EvalCase): Promise<TestResult> {
  const runs = testCase.tier === 2 ? 3 : 1
  let passCount = 0
  let lastFailures: string[] = []
  let lastResponse: EvalResponse | null = null
  let totalMs = 0

  for (let i = 0; i < runs; i++) {
    const start = Date.now()
    try {
      const response = await callOrbWithRetry(testCase)
      totalMs += Date.now() - start
      lastResponse = response

      const toolFailures = assertToolCall(response, testCase)
      const speechFailures = assertSpeech(response, testCase)
      const allFailures = [...toolFailures, ...speechFailures]

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
    durationMs: Math.round(totalMs / runs),
  }
}

// ── Status Bar ─────────────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

function updateStatusBar(opts: {
  current: number; total: number; passed: number; failed: number;
  elapsed: number; currentCase?: string; currentRun?: number; totalRuns?: number
}) {
  const { current, total, passed, failed, elapsed, currentCase, currentRun, totalRuns } = opts
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  const barWidth = 20
  const filled = Math.round((current / total) * barWidth)
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled)

  const runInfo = currentRun && totalRuns ? ` run ${currentRun}/${totalRuns}` : ''
  const caseInfo = currentCase ? ` → ${currentCase}${runInfo}` : ''

  const line = `  ${bar} ${pct}% (${current}/${total}) | ✅ ${passed} ❌ ${failed} | ${formatElapsed(elapsed)}${caseInfo}`

  // Clear line and rewrite
  process.stderr.write(`\r\x1b[K${line}`)
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const tierFilter = args.includes('--tier') ? parseInt(args[args.indexOf('--tier') + 1]) : null
  const idFilter = args.includes('--id') ? args[args.indexOf('--id') + 1] : null

  let cases = EVAL_CASES
  if (tierFilter) cases = cases.filter(c => c.tier === tierFilter)
  if (idFilter) cases = cases.filter(c => c.id === idFilter)

  if (cases.length === 0) {
    console.error('No test cases match the filter.')
    process.exit(1)
  }

  const totalRuns = cases.reduce((sum, c) => sum + (c.tier === 2 ? 3 : 1), 0)
  console.log(`\n🔮 Orb Eval — ${cases.length} cases, ${totalRuns} total runs\n`)
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

        const toolFailures = assertToolCall(response, testCase)
        const speechFailures = assertSpeech(response, testCase)
        const allFailures = [...toolFailures, ...speechFailures]

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
      durationMs: Math.round(totalMs / runs),
    }
    results.push(result)

    if (testCase !== cases[cases.length - 1]) {
      await new Promise(r => setTimeout(r, INTER_REQUEST_DELAY_MS))
    }
  }

  // Clear the status bar
  process.stderr.write('\r\x1b[K')

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
  const totalTokens = results.reduce((sum, r) => sum + (r.tokens ?? 0), 0)
  const elapsed = Date.now() - startTime

  if (tier1.length > 0) {
    console.log(`  Tier 1 (tool correctness): ${tier1Pass}/${tier1.length} passed${tier1Pass < tier1.length ? ' ⚠️  REGRESSION' : ' ✅'}`)
  }
  if (tier2.length > 0) {
    console.log(`  Tier 2 (behavioral):       ${tier2Pass}/${tier2.length} passed${tier2Pass < tier2.length ? ' ⚠️' : ' ✅'}`)
  }
  console.log(`  Total tokens used:         ~${totalTokens.toLocaleString()}`)
  console.log(`  Estimated cost:            ~$${(totalTokens * 0.000004).toFixed(3)}`)
  console.log(`  Elapsed:                   ${formatElapsed(elapsed)}`)
  console.log('═'.repeat(60) + '\n')

  // Exit with error code if Tier 1 has any failures (regression)
  if (tier1Pass < tier1.length) {
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
