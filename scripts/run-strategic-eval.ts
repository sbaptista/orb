#!/usr/bin/env npx tsx

import fs from 'fs'
import path from 'path'
import * as dotenv from 'dotenv'
import { STRATEGIC_EVAL_MANIFEST, STRATEGIC_EXPLORATORY_CASES } from './strategic-eval-manifest'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const baseUrl = process.env.EVAL_BASE_URL || 'https://localhost:3001'
const secret = process.env.ORB_API_SECRET
const userEmail = process.env.EVAL_USER_EMAIL || 'stan.baptista@gmail.com'

if (!secret) throw new Error('ORB_API_SECRET not found in .env.local')

type Result = {
  reviewId: string
  scenarioId: string
  run: number
  speech: string
  latencyMs: number | null
  estimatedCostUsd: number | null
  provider: string
  model: string
  contextPacketVersion: string | null
  contextPacketId: string | null
  toolCalls: Array<{ name: string; params: Record<string, unknown> }>
}

let interRequestDelayMs = 0
let lastRequestAt = 0

async function paceProviderRequest() {
  const remaining = interRequestDelayMs - (Date.now() - lastRequestAt)
  if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining))
  lastRequestAt = Date.now()
}

function providerRateLimitDelayMs(message: string, fallbackMs: number) {
  const retryMatch = message.match(/try again after\s+([\d.]+)\s*(milliseconds?|ms|seconds?|s)/i)
  const retryValue = retryMatch ? Number(retryMatch[1]) : 0
  const retryMs = retryMatch
    ? retryValue * (/^m/i.test(retryMatch[2]) ? 1 : 1000)
    : 0
  const rpmMatch = message.match(/max RPM\s*:\s*(\d+)/i)
  const rpm = rpmMatch ? Number(rpmMatch[1]) : 0
  const rpmIntervalMs = rpm > 0 ? Math.ceil(60_000 / rpm) + 500 : 0
  return Math.max(fallbackMs, retryMs, rpmIntervalMs)
}

async function runWithRetry(request: () => Promise<Response>, label: string): Promise<Response> {
  let retryDelayMs = 2_000
  for (let attempt = 1; attempt <= 4; attempt++) {
    await paceProviderRequest()
    const response = await request()
    const errorBody = response.ok ? '' : await response.clone().text()
    const rateLimited = response.status === 429 || /API 429:|rate.?limit|reached organization max RPM/i.test(errorBody)
    const providerBusy = rateLimited || response.status === 503
    if (response.ok || !providerBusy || attempt === 4) return response
    if (rateLimited) {
      const providerIntervalMs = providerRateLimitDelayMs(errorBody, 1_000)
      interRequestDelayMs = Math.max(interRequestDelayMs, providerIntervalMs)
      retryDelayMs = Math.max(retryDelayMs, providerIntervalMs)
    }
    console.log(`${label}: provider busy (${response.status}); retrying in ${retryDelayMs / 1_000}s`)
    await new Promise(resolve => setTimeout(resolve, retryDelayMs))
    retryDelayMs *= 2
  }
  throw new Error(`${label}: retry loop exhausted`)
}

function writeBatch(outputName: string, results: Result[]) {
  const orderedResults = [...results].sort((a, b) => Number(a.reviewId.slice(1)) - Number(b.reviewId.slice(1)))
  const review = orderedResults.map(({ reviewId, scenarioId, run, speech }) => ({ reviewId, scenarioId, run, speech }))
  const output = {
    manifest: STRATEGIC_EVAL_MANIFEST,
    generatedAt: new Date().toISOString(),
    review,
    privateMetrics: orderedResults.map(({ reviewId, latencyMs, estimatedCostUsd, provider, model, contextPacketVersion, contextPacketId, toolCalls }) => ({ reviewId, latencyMs, estimatedCostUsd, provider, model, contextPacketVersion, contextPacketId, toolCalls })),
  }
  const outputPath = `/tmp/orb-265-strategic-${outputName}.json`
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))
  return outputPath
}

function loadCheckpoint(outputName: string): Result[] {
  const outputPath = `/tmp/orb-265-strategic-${outputName}.json`
  if (!fs.existsSync(outputPath)) return []
  const parsed = JSON.parse(fs.readFileSync(outputPath, 'utf8')) as {
    review?: Array<Pick<Result, 'reviewId' | 'scenarioId' | 'run' | 'speech'>>
    privateMetrics?: Array<Pick<Result, 'reviewId' | 'latencyMs' | 'estimatedCostUsd' | 'provider' | 'model' | 'contextPacketVersion' | 'contextPacketId' | 'toolCalls'>>
  }
  const metricsByReviewId = new Map((parsed.privateMetrics ?? []).map(metric => [metric.reviewId, metric]))
  const results = (parsed.review ?? []).flatMap(review => {
    const metrics = metricsByReviewId.get(review.reviewId)
    return metrics ? [{ ...review, ...metrics, toolCalls: metrics.toolCalls ?? [] }] : []
  })
  const firstResultByReviewId = new Map<string, Result>()
  for (const result of results) {
    if (!firstResultByReviewId.has(result.reviewId)) firstResultByReviewId.set(result.reviewId, result)
  }
  return [...firstResultByReviewId.values()]
}

async function main() {
  const args = process.argv.slice(2)
  const offset = Number(args[args.indexOf('--offset') + 1] ?? 0)
  const limit = Number(args[args.indexOf('--limit') + 1] ?? 30)
  const outputName = args.includes('--output')
    ? args[args.indexOf('--output') + 1]
    : `batch-${offset}`
  const requestedProvider = args.includes('--provider')
    ? args[args.indexOf('--provider') + 1]
    : null
  const candidates = requestedProvider
    ? STRATEGIC_EVAL_MANIFEST.candidates.filter(candidate => candidate.provider === requestedProvider)
    : STRATEGIC_EVAL_MANIFEST.candidates
  if (requestedProvider && candidates.length === 0) {
    throw new Error(`Unknown provider: ${requestedProvider}`)
  }
  const allJobs = STRATEGIC_EXPLORATORY_CASES.flatMap(scenario =>
    candidates.flatMap(candidate =>
      Array.from({ length: STRATEGIC_EVAL_MANIFEST.runsPerScenario }, (_, index) => ({ scenario, candidate, run: index + 1 })),
    ),
  )
  const jobs = allJobs.slice(offset, offset + limit).map((job, index) => ({ ...job, reviewNumber: offset + index + 1 }))
  const totalJobs = STRATEGIC_EXPLORATORY_CASES.length
    * candidates.length
    * STRATEGIC_EVAL_MANIFEST.runsPerScenario
  const results = loadCheckpoint(outputName)
  const recordedReviewIds = new Set(results.map(result => result.reviewId))
  for (const { scenario, candidate, run, reviewNumber } of jobs) {
        const reviewId = `R${String(reviewNumber).padStart(2, '0')}`
        if (recordedReviewIds.has(reviewId)) {
          console.log(`${reviewNumber}/${totalJobs} ${scenario.id} run ${run} already checkpointed`)
          continue
        }
        const isOperationalCase = scenario.id === 'operational-not-coaching'
        const response = await runWithRetry(() => fetch(`${baseUrl}/api/orb-eval`, {
          method: 'POST',
          headers: { Authorization: secret!, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: scenario.prompt,
            productCode: 'ORB',
            provider: candidate.provider === 'google' ? 'gemini' : candidate.provider,
            model: candidate.model,
            userEmail,
            evaluationMode: isOperationalCase ? 'standard' : 'strategic',
            ...(isOperationalCase ? { mutationApproval: 'allow' } : { contextPacketId: scenario.id }),
          }),
        }), `${scenario.id}/${candidate.model}/${run}`)
        if (!response.ok) throw new Error(`${scenario.id}/${candidate.model}/${run}: ${await response.text()}`)
        const body = await response.json()
        results.push({
          reviewId,
          scenarioId: scenario.id,
          run,
          speech: body.speech,
          latencyMs: body.modelUsage?.latencyMs ?? null,
          estimatedCostUsd: body.modelUsage?.estimatedCostUsd ?? null,
          provider: candidate.provider,
          model: candidate.model,
          contextPacketVersion: body.contextPacketVersion ?? null,
          contextPacketId: body.contextPacketId ?? null,
          toolCalls: body.toolCalls ?? [],
        })
        recordedReviewIds.add(reviewId)
        const outputPath = writeBatch(outputName, results)
        console.log(`${reviewNumber}/${totalJobs} ${scenario.id} run ${run}`)
        console.log(`Checkpointed: ${outputPath}`)
  }

  const outputPath = writeBatch(outputName, results)
  console.log(`Wrote blinded review packet: ${outputPath}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
