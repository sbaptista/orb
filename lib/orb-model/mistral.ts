import type { OrbModelRateSnapshot, OrbModelUsage } from './types'

export const MISTRAL_STRATEGIC_EVAL_MODEL = 'mistral-medium-latest'

const MISTRAL_MEDIUM_3_5_RATE_SNAPSHOT: OrbModelRateSnapshot = {
  version: 'mistral-2026-06-23',
  effectiveDate: '2026-06-23',
  inputPerMillion: 1.5,
  outputPerMillion: 7.5,
  cachedInputPerMillion: 0.15,
  cacheWritePerMillion: null,
}

type MistralToolCall = {
  function?: { name?: string; arguments?: string }
}

type MistralResponse = {
  choices?: Array<{
    finish_reason?: string
    message?: { content?: unknown; tool_calls?: MistralToolCall[] }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
    prompt_tokens_details?: { cached_tokens?: number }
  }
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function parseToolArguments(argumentsJson: string | undefined): Record<string, unknown> {
  if (!argumentsJson) return {}
  try {
    const parsed = JSON.parse(argumentsJson)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function messageText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map(part => messageText(part)).join('')
  }
  if (content && typeof content === 'object') {
    const record = content as Record<string, unknown>
    if (typeof record.text === 'string') return record.text
    if (typeof record.content === 'string') return record.content
  }
  return ''
}

function toMistralTools(tools: Array<any>) {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }))
}

function normalizeMistralUsage(
  usage: MistralResponse['usage'],
  options: { model: string; latencyMs: number; clientToolCalls: number },
): OrbModelUsage {
  const inputTokens = numberOrZero(usage?.prompt_tokens)
  const outputTokens = numberOrZero(usage?.completion_tokens)
  const cachedInputTokens = typeof usage?.prompt_tokens_details?.cached_tokens === 'number'
    ? usage.prompt_tokens_details.cached_tokens
    : null
  const rateSnapshot = options.model === MISTRAL_STRATEGIC_EVAL_MODEL
    ? MISTRAL_MEDIUM_3_5_RATE_SNAPSHOT
    : null
  const uncachedInputTokens = Math.max(0, inputTokens - (cachedInputTokens ?? 0))
  const estimatedCostUsd = rateSnapshot
    ? (uncachedInputTokens / 1_000_000) * rateSnapshot.inputPerMillion
      + (outputTokens / 1_000_000) * rateSnapshot.outputPerMillion
      + ((cachedInputTokens ?? 0) / 1_000_000) * (rateSnapshot.cachedInputPerMillion ?? 0)
    : null

  return {
    provider: 'mistral',
    model: options.model,
    source: 'eval',
    inputTokens,
    outputTokens,
    cachedInputTokens,
    cacheWriteTokens: null,
    reasoningTokens: null,
    totalTokens: typeof usage?.total_tokens === 'number' ? usage.total_tokens : inputTokens + outputTokens,
    clientToolCalls: options.clientToolCalls,
    latencyMs: options.latencyMs,
    attemptCount: 1,
    success: true,
    failureCode: null,
    estimatedCostUsd,
    rateSnapshot,
    providerUsage: usage ?? {},
  }
}

export async function completeMistralEvaluation(options: {
  model?: string
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: unknown }>
  tools: Array<any>
  forcedTool?: string | null
  strategic?: boolean
}) {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) throw new Error('MISTRAL_API_KEY is not configured')

  const model = options.model ?? MISTRAL_STRATEGIC_EVAL_MODEL
  // High reasoning can consume the entire response budget before emitting final text.
  const maxTokens = options.strategic ? 8192 : 512
  const requestStartedAt = Date.now()
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: options.systemPrompt },
        ...options.messages.map(message => ({
          role: message.role,
          content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
        })),
      ],
      ...(options.tools.length > 0 ? { tools: toMistralTools(options.tools) } : {}),
      ...(options.forcedTool ? {
        tool_choice: { type: 'function', function: { name: options.forcedTool } },
      } : {}),
      ...(options.strategic ? { reasoning_effort: 'high' } : {}),
      max_tokens: maxTokens,
    }),
  })

  const payload = await response.json() as MistralResponse & { message?: string; error?: { message?: string } }
  if (!response.ok) {
    throw new Error(`Mistral API ${response.status}: ${payload.error?.message ?? payload.message ?? 'unknown error'}`)
  }

  const choice = payload.choices?.[0]
  const toolCalls = (choice?.message?.tool_calls ?? []).flatMap(call => call.function?.name
    ? [{ name: call.function.name, params: parseToolArguments(call.function.arguments) }]
    : [])
  const modelUsage = normalizeMistralUsage(payload.usage, {
    model,
    latencyMs: Date.now() - requestStartedAt,
    clientToolCalls: toolCalls.length,
  })

  return {
    speech: messageText(choice?.message?.content),
    toolCalls,
    stopReason: choice?.finish_reason ?? 'unknown',
    tokenUsage: {
      input_tokens: modelUsage.inputTokens,
      output_tokens: modelUsage.outputTokens,
    },
    modelUsage,
  }
}
