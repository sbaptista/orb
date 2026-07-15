import type { OrbModelInvocationSource, OrbModelRateSnapshot, OrbModelUsage } from './types'

export const GEMINI_STRATEGIC_EVAL_MODEL = 'gemini-3.1-pro-preview'

const GEMINI_3_1_PRO_RATE_SNAPSHOT: OrbModelRateSnapshot = {
  version: 'google-2026-06-22',
  effectiveDate: '2026-06-22',
  inputPerMillion: 2,
  outputPerMillion: 12,
  cachedInputPerMillion: 0.2,
  cacheWritePerMillion: null,
}

type GeminiPart = {
  text?: string
  functionCall?: { name?: string; args?: Record<string, unknown> }
}

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] }
    finishReason?: string
  }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    cachedContentTokenCount?: number
    thoughtsTokenCount?: number
    totalTokenCount?: number
  }
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function toGeminiContents(messages: Array<{ role: 'user' | 'assistant'; content: unknown }>) {
  return messages.map(message => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof message.content === 'string' ? message.content : JSON.stringify(message.content) }],
  }))
}

function toGeminiFunctionDeclarations(tools: Array<any>) {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema,
  }))
}

function normalizeGeminiUsage(
  usageMetadata: GeminiResponse['usageMetadata'],
  options: { model: string; source: OrbModelInvocationSource; latencyMs: number; clientToolCalls: number },
): OrbModelUsage {
  const inputTokens = numberOrZero(usageMetadata?.promptTokenCount)
  const outputTokens = numberOrZero(usageMetadata?.candidatesTokenCount)
  const cachedInputTokens = typeof usageMetadata?.cachedContentTokenCount === 'number'
    ? usageMetadata.cachedContentTokenCount
    : null
  const rateSnapshot = options.model === GEMINI_STRATEGIC_EVAL_MODEL
    ? GEMINI_3_1_PRO_RATE_SNAPSHOT
    : null
  const uncachedInputTokens = Math.max(0, inputTokens - (cachedInputTokens ?? 0))
  const estimatedCostUsd = rateSnapshot
    ? (uncachedInputTokens / 1_000_000) * rateSnapshot.inputPerMillion
      + (outputTokens / 1_000_000) * rateSnapshot.outputPerMillion
      + ((cachedInputTokens ?? 0) / 1_000_000) * (rateSnapshot.cachedInputPerMillion ?? 0)
    : null

  return {
    provider: 'google',
    model: options.model,
    source: options.source,
    inputTokens,
    outputTokens,
    cachedInputTokens,
    cacheWriteTokens: null,
    reasoningTokens: typeof usageMetadata?.thoughtsTokenCount === 'number' ? usageMetadata.thoughtsTokenCount : null,
    totalTokens: typeof usageMetadata?.totalTokenCount === 'number'
      ? usageMetadata.totalTokenCount
      : inputTokens + outputTokens,
    clientToolCalls: options.clientToolCalls,
    latencyMs: options.latencyMs,
    attemptCount: 1,
    success: true,
    failureCode: null,
    estimatedCostUsd,
    rateSnapshot,
    providerUsage: {
      promptTokenCount: usageMetadata?.promptTokenCount ?? null,
      candidatesTokenCount: usageMetadata?.candidatesTokenCount ?? null,
      cachedContentTokenCount: usageMetadata?.cachedContentTokenCount ?? null,
      thoughtsTokenCount: usageMetadata?.thoughtsTokenCount ?? null,
      totalTokenCount: usageMetadata?.totalTokenCount ?? null,
    },
  }
}

export async function completeGeminiEvaluation(options: {
  model?: string
  source?: OrbModelInvocationSource
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: unknown }>
  tools: Array<any>
  forcedTool?: string | null
}) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const model = options.model ?? GEMINI_STRATEGIC_EVAL_MODEL
  const requestStartedAt = Date.now()
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: options.systemPrompt }] },
        contents: toGeminiContents(options.messages),
        ...(options.tools.length > 0 ? {
          tools: [{ functionDeclarations: toGeminiFunctionDeclarations(options.tools) }],
        } : {}),
        ...(options.forcedTool ? {
          toolConfig: {
            functionCallingConfig: {
              mode: 'ANY',
              allowedFunctionNames: [options.forcedTool],
            },
          },
        } : {}),
        generationConfig: { maxOutputTokens: 4096 },
      }),
    },
  )

  const payload = await response.json() as GeminiResponse & { error?: { message?: string } }
  if (!response.ok) {
    throw new Error(`Gemini API ${response.status}: ${payload.error?.message ?? 'unknown error'}`)
  }

  const parts = payload.candidates?.[0]?.content?.parts ?? []
  const toolCalls = parts.flatMap(part => part.functionCall?.name
    ? [{ name: part.functionCall.name, params: part.functionCall.args ?? {} }]
    : [])
  const speech = parts.map(part => part.text ?? '').join('')
  const modelUsage = normalizeGeminiUsage(payload.usageMetadata, {
    model,
    source: options.source ?? 'eval',
    latencyMs: Date.now() - requestStartedAt,
    clientToolCalls: toolCalls.length,
  })

  return {
    speech,
    toolCalls,
    stopReason: payload.candidates?.[0]?.finishReason ?? 'unknown',
    tokenUsage: {
      input_tokens: modelUsage.inputTokens,
      output_tokens: modelUsage.outputTokens,
    },
    modelUsage,
  }
}
