import type { OrbModelInvocationSource, OrbModelRateSnapshot, OrbModelUsage } from './types'

export const MOONSHOT_KIMI_K3_MODEL = 'kimi-k3'

const KIMI_K3_RATE_SNAPSHOT: OrbModelRateSnapshot = {
  version: 'moonshot-2026-08-15',
  effectiveDate: '2026-08-15',
  inputPerMillion: 3,
  outputPerMillion: 15,
  cachedInputPerMillion: 0.3,
  cacheWritePerMillion: null,
}

type MoonshotReasoningEffort = 'low' | 'high' | 'max'

type MoonshotToolCall = {
  id?: string
  type?: string
  function?: { name?: string; arguments?: string }
}

export type MoonshotUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  cached_tokens?: number
}

type MoonshotResponse = {
  choices?: Array<{
    finish_reason?: string
    message?: {
      role?: string
      content?: unknown
      reasoning_content?: string
      tool_calls?: MoonshotToolCall[]
    }
  }>
  usage?: MoonshotUsage
  error?: { message?: string; type?: string; code?: string }
  message?: string
}

type OrbTransportMessage = {
  role: 'user' | 'assistant'
  content: unknown
  reasoning_content?: string
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
  if (Array.isArray(content)) return content.map(messageText).join('')
  if (content && typeof content === 'object') {
    const record = content as Record<string, unknown>
    if (typeof record.text === 'string') return record.text
    if (typeof record.content === 'string') return record.content
  }
  return ''
}

function toMoonshotTools(tools: Array<any>) {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
      strict: true,
    },
  }))
}

/**
 * Orb's live loop stores Anthropic-shaped content blocks. Keep the safety/tool
 * machinery provider-neutral by translating those blocks only at this API
 * boundary. A user message containing tool results expands into the OpenAI-
 * compatible `tool` messages Kimi expects.
 */
export function toMoonshotMessages(messages: OrbTransportMessage[]) {
  return messages.flatMap(message => {
    if (typeof message.content === 'string') {
      return [{
        role: message.role,
        content: message.content,
        ...(message.role === 'assistant' && message.reasoning_content
          ? { reasoning_content: message.reasoning_content }
          : {}),
      }]
    }

    if (!Array.isArray(message.content)) {
      return [{ role: message.role, content: JSON.stringify(message.content) }]
    }

    if (message.role === 'assistant') {
      const text = message.content
        .filter(block => block?.type === 'text')
        .map(block => String(block.text ?? ''))
        .join('')
      const toolCalls = message.content
        .filter(block => block?.type === 'tool_use')
        .map(block => ({
          id: String(block.id),
          type: 'function',
          function: {
            name: String(block.name),
            arguments: JSON.stringify(block.input ?? {}),
          },
        }))
      return [{
        role: 'assistant' as const,
        content: text,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        ...(message.reasoning_content ? { reasoning_content: message.reasoning_content } : {}),
      }]
    }

    const expanded: Array<Record<string, unknown>> = []
    let userText = ''
    for (const block of message.content) {
      if (block?.type === 'tool_result') {
        expanded.push({
          role: 'tool',
          tool_call_id: String(block.tool_use_id),
          content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
        })
      } else if (block?.type === 'text') {
        userText += String(block.text ?? '')
      }
    }
    if (userText) expanded.push({ role: 'user', content: userText })
    return expanded
  })
}

export function normalizeMoonshotUsage(
  usage: MoonshotUsage | undefined,
  options: {
    model?: string
    source: OrbModelInvocationSource
    latencyMs: number
    clientToolCalls: number
    attemptCount?: number
  },
): OrbModelUsage {
  const model = options.model ?? MOONSHOT_KIMI_K3_MODEL
  const inputTokens = numberOrZero(usage?.prompt_tokens)
  const outputTokens = numberOrZero(usage?.completion_tokens)
  const cachedInputTokens = typeof usage?.cached_tokens === 'number' ? usage.cached_tokens : null
  const rateSnapshot = model === MOONSHOT_KIMI_K3_MODEL ? KIMI_K3_RATE_SNAPSHOT : null
  const uncachedInputTokens = Math.max(0, inputTokens - (cachedInputTokens ?? 0))
  const estimatedCostUsd = rateSnapshot
    ? (uncachedInputTokens / 1_000_000) * rateSnapshot.inputPerMillion
      + (outputTokens / 1_000_000) * rateSnapshot.outputPerMillion
      + ((cachedInputTokens ?? 0) / 1_000_000) * (rateSnapshot.cachedInputPerMillion ?? 0)
    : null

  return {
    provider: 'moonshot',
    model,
    source: options.source,
    inputTokens,
    outputTokens,
    cachedInputTokens,
    cacheWriteTokens: null,
    reasoningTokens: null,
    totalTokens: typeof usage?.total_tokens === 'number' ? usage.total_tokens : inputTokens + outputTokens,
    clientToolCalls: options.clientToolCalls,
    latencyMs: options.latencyMs,
    attemptCount: options.attemptCount ?? 1,
    success: true,
    failureCode: null,
    estimatedCostUsd,
    rateSnapshot,
    providerUsage: usage ?? {},
  }
}

export async function completeMoonshot(options: {
  model?: string
  source?: OrbModelInvocationSource
  systemPrompt: string
  messages: OrbTransportMessage[]
  tools: Array<any>
  forcedTool?: string | null
  reasoningEffort: MoonshotReasoningEffort
  maxCompletionTokens?: number
  promptCacheKey?: string
}) {
  const apiKey = process.env.MOONSHOT_API_KEY
  if (!apiKey) throw new Error('MOONSHOT_API_KEY is not configured')

  const model = options.model ?? MOONSHOT_KIMI_K3_MODEL
  const requestStartedAt = Date.now()
  const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: options.systemPrompt },
        ...toMoonshotMessages(options.messages),
      ],
      ...(options.tools.length > 0 ? { tools: toMoonshotTools(options.tools) } : {}),
      ...(options.forcedTool ? {
        tool_choice: { type: 'function', function: { name: options.forcedTool } },
      } : {}),
      reasoning_effort: options.reasoningEffort,
      max_completion_tokens: options.maxCompletionTokens ?? 4096,
      ...(options.promptCacheKey ? { prompt_cache_key: options.promptCacheKey } : {}),
      stream: false,
    }),
  })

  const payload = await response.json() as MoonshotResponse
  if (!response.ok) {
    const error = new Error(`Moonshot API ${response.status}: ${payload.error?.message ?? payload.message ?? 'unknown error'}`)
    Object.assign(error, { type: payload.error?.type, code: payload.error?.code, status: response.status })
    throw error
  }

  const choice = payload.choices?.[0]
  const responseMessage = choice?.message
  const toolCalls = (responseMessage?.tool_calls ?? []).flatMap(call => call.function?.name
    ? [{
        id: call.id ?? `moonshot-tool-${crypto.randomUUID()}`,
        name: call.function.name,
        params: parseToolArguments(call.function.arguments),
      }]
    : [])
  const speech = messageText(responseMessage?.content)
  const modelUsage = normalizeMoonshotUsage(payload.usage, {
    model,
    source: options.source ?? 'eval',
    latencyMs: Date.now() - requestStartedAt,
    clientToolCalls: toolCalls.length,
  })
  const assistantContent: Array<Record<string, unknown>> = []
  if (speech) assistantContent.push({ type: 'text', text: speech })
  for (const toolCall of toolCalls) {
    assistantContent.push({
      type: 'tool_use',
      id: toolCall.id,
      name: toolCall.name,
      input: toolCall.params,
    })
  }

  return {
    speech,
    toolCalls,
    assistantMessage: {
      role: 'assistant' as const,
      content: assistantContent,
      ...(responseMessage?.reasoning_content
        ? { reasoning_content: responseMessage.reasoning_content }
        : {}),
    },
    stopReason: choice?.finish_reason ?? 'unknown',
    tokenUsage: {
      input_tokens: modelUsage.inputTokens,
      output_tokens: modelUsage.outputTokens,
    },
    modelUsage,
  }
}
