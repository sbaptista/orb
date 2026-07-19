'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { startInteraction } from '@/lib/performance/telemetry'
import {
  startSileroShadow,
  type SileroShadowController,
  type SileroShadowMetadata,
} from '@/lib/voice/silero-shadow'

type SpikeStatus = 'off' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error'

type Options = {
  currentProjectId: string | null
  onUserTranscript: (text: string) => void
  onOrbTranscript: (text: string) => void
  onMutation: () => void
  onClientAction: (action: { action: string; target?: string }) => void
}

type RealtimeEvent = {
  type: string
  item_id?: string
  transcript?: string
  delta?: string
  response?: { id?: string; output?: Array<{ type?: string; name?: string; call_id?: string; arguments?: string }> }
  error?: { message?: string }
}

function parseArguments(value: string | undefined) {
  try { return JSON.parse(value || '{}') as Record<string, unknown> } catch { return {} }
}

// Result of one tool call. The batch aggregates these into a single response.
type ToolOutcome = { createResponse: boolean; exactText?: string; exitVoice?: boolean }

// ORB-325: Provider-owned turn-taking.
//
// The OpenAI Realtime session runs server VAD with `create_response: true` and
// `interrupt_response: true`, so the *provider* owns turn detection, barge-in
// truncation, and response creation. This hook never sends response.create or
// response.cancel for a user turn — the only response it ever creates is the
// single continuation after a tool result. That removes the entire class of
// response_cancel_not_active / conversation_already_has_active_response races
// that the previous client-side turn state machine produced. There is no
// greeting: the session opens straight into listening.
export function useRealtimeVoiceSpike(options: Options) {
  const [status, setStatus] = useState<SpikeStatus>('off')
  const [error, setError] = useState<string | null>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const channelRef = useRef<RTCDataChannel | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sileroShadowRef = useRef<SileroShadowController | null>(null)
  const sileroShadowStateRef = useRef<'off' | 'loading' | 'ready' | 'failed'>('off')
  const sileroGenerationRef = useRef(0)
  const connectionGenerationRef = useRef(0)
  const startupAbortRef = useRef<AbortController | null>(null)
  const hookInstanceIdRef = useRef<string | null>(null)
  const sileroTurnStartedAtRef = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const orbTranscriptRef = useRef('')
  const currentUtteranceRef = useRef('')
  const currentUtteranceTurnRef = useRef(0)
  const handledCallsRef = useRef(new Set<string>())
  const assistantSpeakingRef = useRef(false)
  const responseInFlightRef = useRef(false)
  // A turn whose transcript is ready but whose response creation is waiting for
  // the channel to clear (a prior response still running). Created on that
  // response's response.done so we never create while one is active.
  const pendingCreateTurnRef = useRef<number | null>(null)
  const activeTurnIdRef = useRef(0)
  const responseTurnIdsRef = useRef(new Map<string, number>())
  // response.done has been observed redelivered for the same response.id
  // (iPad Safari). Once an id's response.done is handled, its turn mapping is
  // deleted, so a redelivered event would otherwise fall back to
  // activeTurnIdRef.current and could be misread as belonging to whatever
  // turn is active by then. Track handled ids so a repeat is dropped outright.
  const handledResponseIdsRef = useRef(new Set<string>())
  const inputItemTurnIdsRef = useRef(new Map<string, number>())
  const toolControllersRef = useRef(new Map<string, AbortController>())
  const currentProjectIdRef = useRef(options.currentProjectId)
  const callbacksRef = useRef(options)
  const startupMeasurementRef = useRef<ReturnType<typeof startInteraction> | null>(null)
  const turnMeasurementRef = useRef<ReturnType<typeof startInteraction> | null>(null)
  const turnMetadataRef = useRef<Record<string, unknown>>({})
  const turnFailureRef = useRef<string | null>(null)
  const responseWatchdogRef = useRef<{ timeout: number; turnId: number } | null>(null)
  if (hookInstanceIdRef.current === null) {
    hookInstanceIdRef.current = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
  currentProjectIdRef.current = options.currentProjectId
  callbacksRef.current = options

  // ── Lifecycle trace (ORB-325) ──────────────────────────────────────────────
  // Always-on in DEV, independent of the perf-telemetry toggle. Records the
  // ordered event/status timeline so a bad session can be reconstructed exactly.
  // No transcript or audio content is recorded — event types and flags only.
  const traceRef = useRef<{ t: number; e: string }[]>([])
  const traceStartRef = useRef(0)
  const statusRef = useRef<SpikeStatus>('off')
  const emitTrace = useRef((entry: string) => {
    if (process.env.NODE_ENV === 'production') return
    const now = performance.now()
    if (traceStartRef.current === 0) traceStartRef.current = now
    const t = Math.round(now - traceStartRef.current)
    traceRef.current.push({ t, e: entry })
    if (traceRef.current.length > 400) traceRef.current.shift()
    console.debug(`[orb-rt +${t}ms] ${entry}`)
  })
  useEffect(() => {
    if (statusRef.current !== status) {
      emitTrace.current(`status ${statusRef.current} → ${status}`)
      statusRef.current = status
    }
  }, [status])

  const send = useCallback((event: Record<string, unknown>) => {
    const channel = channelRef.current
    if (channel?.readyState !== 'open') throw new Error('Realtime data channel is not open')
    channel.send(JSON.stringify(event))
  }, [])

  const clearResponseWatchdog = useCallback(() => {
    if (responseWatchdogRef.current) window.clearTimeout(responseWatchdogRef.current.timeout)
    responseWatchdogRef.current = null
  }, [])

  const sileroSnapshot = useCallback((): SileroShadowMetadata => {
    const controller = sileroShadowRef.current
    if (!controller) return { sileroShadowState: sileroShadowStateRef.current }
    return controller.snapshot(sileroTurnStartedAtRef.current)
  }, [])

  const stopSileroShadow = useCallback(() => {
    sileroGenerationRef.current += 1
    sileroTurnStartedAtRef.current = null
    sileroShadowStateRef.current = 'off'
    const controller = sileroShadowRef.current
    sileroShadowRef.current = null
    if (controller) void controller.destroy().catch(() => {})
  }, [])

  const beginSileroShadow = useCallback((stream: MediaStream) => {
    const generation = sileroGenerationRef.current + 1
    sileroGenerationRef.current = generation
    sileroShadowStateRef.current = 'loading'
    void startSileroShadow(stream)
      .then(controller => {
        if (sileroGenerationRef.current !== generation || streamRef.current !== stream) {
          void controller.destroy().catch(() => {})
          return
        }
        sileroShadowRef.current = controller
        sileroShadowStateRef.current = 'ready'
      })
      .catch(() => {
        if (sileroGenerationRef.current === generation) sileroShadowStateRef.current = 'failed'
      })
  }, [])

  // Safety net only — the provider owns response timing, so this should not fire
  // in a healthy session. It recovers the UI to listening if a response (or a
  // tool continuation) never produces audio.
  const armResponseWatchdog = useCallback((turnId: number) => {
    clearResponseWatchdog()
    const timeout = window.setTimeout(() => {
      if (turnId !== activeTurnIdRef.current) return
      responseWatchdogRef.current = null
      emitTrace.current(`response_timeout watchdog (turn ${turnId})`)
      toolControllersRef.current.forEach(controller => controller.abort())
      toolControllersRef.current.clear()
      assistantSpeakingRef.current = false
      turnMeasurementRef.current?.mark('watchdog')
      turnMeasurementRef.current?.end(false, 'response_timeout', turnMetadataRef.current)
      turnMeasurementRef.current = null
      turnMetadataRef.current = {}
      turnFailureRef.current = null
      callbacksRef.current.onOrbTranscript('Voice response timed out. Please try again.')
      setStatus('listening')
    }, 20_000)
    responseWatchdogRef.current = { timeout, turnId }
  }, [clearResponseWatchdog])

  const stop = useCallback((reason = 'session_stopped') => {
    emitTrace.current(`stop (${reason})`)
    const stoppedGeneration = connectionGenerationRef.current
    connectionGenerationRef.current += 1
    startupAbortRef.current?.abort()
    startupAbortRef.current = null
    clearResponseWatchdog()
    stopSileroShadow()
    channelRef.current?.close()
    peerRef.current?.close()
    streamRef.current?.getTracks().forEach(track => track.stop())
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.srcObject = null
      audioRef.current.remove()
    }
    channelRef.current = null
    peerRef.current = null
    streamRef.current = null
    audioRef.current = null
    orbTranscriptRef.current = ''
    currentUtteranceRef.current = ''
    currentUtteranceTurnRef.current = 0
    handledCallsRef.current.clear()
    toolControllersRef.current.forEach(controller => controller.abort())
    toolControllersRef.current.clear()
    responseTurnIdsRef.current.clear()
    handledResponseIdsRef.current.clear()
    inputItemTurnIdsRef.current.clear()
    assistantSpeakingRef.current = false
    responseInFlightRef.current = false
    pendingCreateTurnRef.current = null
    const lifecycleMetadata = {
      hookInstanceId: hookInstanceIdRef.current,
      connectionGeneration: stoppedGeneration,
      stopReason: reason,
    }
    startupMeasurementRef.current?.end(false, reason, lifecycleMetadata)
    startupMeasurementRef.current = null
    turnMeasurementRef.current?.end(false, reason, lifecycleMetadata)
    turnMeasurementRef.current = null
    turnFailureRef.current = null
    setError(null)
    setStatus('off')
  }, [clearResponseWatchdog, stopSileroShadow])

  // Send only the tool's function_call_output. The response.create is sent once
  // per response by executeToolBatch — a single response may carry several
  // parallel tool calls, and creating one response per call would collide
  // (conversation_already_has_active_response).
  const sendToolOutput = useCallback((callId: string, result: unknown) => {
    send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(result) } })
  }, [send])

  const executeToolCall = useCallback(async (item: { name?: string; call_id?: string; arguments?: string }, turnId: number): Promise<ToolOutcome> => {
    if (!item.call_id || !item.name || handledCallsRef.current.has(item.call_id)) return { createResponse: false }
    handledCallsRef.current.add(item.call_id)
    if (turnId !== activeTurnIdRef.current) {
      sendToolOutput(item.call_id, { cancelled: true, reason: 'turn_interrupted' })
      return { createResponse: false }
    }
    emitTrace.current(`tool ${item.name} (turn ${turnId})`)
    const turnMeasurement = turnMeasurementRef.current
    turnMeasurement?.mark(`tool_${item.name}_start`)
    const args = parseArguments(item.arguments)
    const mutationTool = item.name.startsWith('propose_') || item.name === 'confirm_todo_mutation'
    // A mutation tool needs the current turn's trusted utterance for the
    // server-side authorization check. Wait for the transcript, but bound it: if
    // it never arrives, proceed with an empty utterance so the server fails
    // closed to a confirmation rather than hanging the turn.
    let waitedForTranscript = 0
    while (
      mutationTool
      && turnId === activeTurnIdRef.current
      && currentUtteranceTurnRef.current !== turnId
      && waitedForTranscript < 200
    ) {
      await new Promise<void>(resolve => window.setTimeout(resolve, 25))
      waitedForTranscript += 1
    }
    if (turnId !== activeTurnIdRef.current) {
      sendToolOutput(item.call_id, { cancelled: true, reason: 'turn_interrupted' })
      return { createResponse: false }
    }
    const trustedUtterance = currentUtteranceTurnRef.current === turnId ? currentUtteranceRef.current : ''
    let operation: string
    let body: Record<string, unknown>
    if (item.name === 'get_task_count') {
      operation = 'task_count'
      body = { operation, projectScope: args.project_scope, projectName: args.project_name, statusScope: args.status_scope }
    } else if (item.name === 'get_project_directory') {
      operation = 'project_directory'; body = { operation }
    } else if (item.name === 'query_projects') {
      operation = 'query_projects'
      body = {
        operation,
        name: args.name,
        includeDormant: args.include_dormant,
        maxResults: args.max_results,
      }
    } else if (item.name === 'query_db') {
      operation = 'query_db'
      body = {
        operation,
        dbTable: args.table,
        dbSelect: args.select,
        dbFilters: args.filters,
        dbOrder: args.order,
        maxResults: args.limit,
      }
    } else if (item.name === 'get_todo_details') {
      operation = 'todo_details'
      body = {
        operation,
        todoReference: args.todo_reference,
        projectName: args.project_name,
        currentProjectId: currentProjectIdRef.current,
      }
    } else if (item.name === 'list_todos') {
      operation = 'todo_list'
      body = {
        operation,
        projectScope: args.project_scope,
        projectName: args.project_name,
        statusScope: args.status_scope,
        textMatch: args.text_match,
        maxResults: args.max_results,
      }
    } else if (item.name === 'get_next_step') {
      operation = 'next_step'; body = { operation }
    } else if (item.name === 'search_knowledge') {
      operation = 'search_knowledge'
      body = {
        operation,
        query: args.topic_query,
        knowledgeTitle: args.title,
        projectName: args.project_name,
        maxResults: args.max_results,
      }
    } else if (item.name === 'query_tickets') {
      operation = 'query_tickets'
      body = {
        operation,
        ticketCode: args.code,
        ticketStatus: args.status,
        ticketScope: args.scope,
        ticketType: args.type,
        search: args.search,
        maxResults: args.max_results,
      }
    } else if (item.name === 'query_audit') {
      operation = 'query_audit'
      body = {
        operation,
        code: args.code,
        tableName: args.table_name,
        action: args.action,
        since: args.since,
        maxResults: args.max_results,
      }
    } else if (item.name === 'query_repository') {
      operation = 'query_repository'
      body = {
        operation,
        repositoryOperation: args.operation,
        repositorySource: args.source,
        path: args.path,
        query: args.query,
        startLine: args.start_line,
        endLine: args.end_line,
        maxResults: args.max_results,
      }
    } else if (item.name === 'client_action') {
      operation = 'client_action'
      body = { operation, clientAction: args.action, target: args.target }
    } else if (item.name === 'set_project_dormancy') {
      operation = 'set_project_dormancy'
      body = {
        operation,
        name: args.name,
        preferenceValue: args.dormant === true ? 'dormant' : 'awake',
      }
    } else if (item.name === 'get_preferences') {
      operation = 'get_preferences'
      body = { operation }
    } else if (item.name === 'set_preference') {
      operation = 'set_preference'
      body = { operation, preferenceKey: args.key, preferenceValue: args.value }
    } else if (item.name === 'recall_memories') {
      operation = 'recall_memories'
      body = { operation, memoryCategory: args.category, query: args.query, maxResults: args.limit }
    } else if (item.name === 'save_memory') {
      operation = 'save_memory'
      body = {
        operation,
        memoryTrack: args.track,
        memoryCategory: args.category,
        content: args.content,
        context: args.context,
      }
    } else if (item.name === 'propose_adaptation') {
      operation = 'propose_adaptation'
      body = {
        operation,
        adaptationTitle: args.title,
        adaptationRule: args.rule,
        adaptationRationale: args.rationale,
        adaptationCategory: args.category,
      }
    } else if (item.name === 'create_ticket') {
      operation = 'create_ticket'
      body = {
        operation,
        ticketType: args.type,
        ticketSummary: args.summary,
        ticketDetail: args.detail,
        userUtterance: trustedUtterance,
      }
    } else if (item.name === 'query_capabilities') {
      operation = 'query_capabilities'
      body = { operation, query: args.section }
    } else if (item.name === 'send_to_developer') {
      operation = 'send_to_developer'
      body = {
        operation,
        content: args.content,
        developerTarget: args.target_tool,
        currentProjectId: currentProjectIdRef.current,
      }
    } else if (item.name === 'propose_create_todo') {
      operation = 'propose_create_todo'
      body = {
        operation,
        title: args.title,
        projectName: args.project_name,
        projectId: currentProjectIdRef.current,
        userUtterance: trustedUtterance,
      }
    } else if (item.name === 'propose_update_todo') {
      operation = 'propose_update_todo'
      body = {
        operation,
        todoReference: args.todo_reference,
        projectName: args.project_name,
        currentProjectId: currentProjectIdRef.current,
        newTitle: args.new_title,
        newStatus: args.new_status,
        newPriority: args.new_priority,
        userUtterance: trustedUtterance,
      }
    } else if (item.name === 'propose_delete_todo') {
      operation = 'propose_delete_todo'
      body = {
        operation,
        todoReference: args.todo_reference,
        projectName: args.project_name,
        currentProjectId: currentProjectIdRef.current,
        userUtterance: trustedUtterance,
      }
    } else if (item.name === 'propose_move_todo') {
      operation = 'propose_move_todo'
      body = {
        operation,
        todoReference: args.todo_reference,
        projectName: args.project_name,
        currentProjectId: currentProjectIdRef.current,
        targetProjectName: args.target_project_name,
        userUtterance: trustedUtterance,
      }
    } else if (item.name === 'propose_close_todo') {
      operation = 'propose_close_todo'
      body = {
        operation,
        todoReference: args.todo_reference,
        projectName: args.project_name,
        currentProjectId: currentProjectIdRef.current,
        resolutionNotes: args.resolution_notes,
        knowledgeTitle: args.knowledge_title,
        knowledgeContent: args.knowledge_content,
        userUtterance: trustedUtterance,
      }
    } else if (item.name === 'propose_create_project') {
      operation = 'propose_create_project'
      body = {
        operation,
        name: args.name,
        description: args.description,
        userUtterance: trustedUtterance,
      }
    } else if (item.name === 'propose_update_project') {
      operation = 'propose_update_project'
      body = {
        operation,
        name: args.name,
        newName: args.new_name,
        newDescription: args.new_description,
        userUtterance: trustedUtterance,
      }
    } else if (item.name === 'propose_delete_project') {
      operation = 'propose_delete_project'
      body = {
        operation,
        name: args.name,
        userUtterance: trustedUtterance,
      }
    } else if (item.name === 'propose_add_knowledge') {
      operation = 'propose_add_knowledge'
      body = {
        operation,
        knowledgeTitle: args.title,
        knowledgeContent: args.content,
        projectName: args.project_name,
        currentProjectId: currentProjectIdRef.current,
        tags: args.tags,
        userUtterance: trustedUtterance,
      }
    } else if (item.name === 'propose_update_knowledge') {
      operation = 'propose_update_knowledge'
      body = {
        operation,
        knowledgeTitle: args.title,
        newTitle: args.new_title,
        knowledgeContent: args.new_content,
        userUtterance: trustedUtterance,
      }
    } else if (item.name === 'confirm_todo_mutation') {
      operation = 'confirm_todo_mutation'
      body = {
        operation,
        proposalToken: args.proposal_token,
        userUtterance: trustedUtterance,
      }
    } else {
      sendToolOutput(item.call_id, { error: 'Unsupported tool' })
      return { createResponse: true }
    }

    try {
      const controller = new AbortController()
      if (operation !== 'confirm_todo_mutation') toolControllersRef.current.set(item.call_id, controller)
      const response = await fetch('/api/orb-realtime/turn', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        signal: operation === 'confirm_todo_mutation' ? undefined : controller.signal,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Realtime tool failed')
      toolControllersRef.current.delete(item.call_id)
      turnMeasurement?.mark(`tool_${item.name}_done`)
      if (turnId === activeTurnIdRef.current && typeof result.gatewayMs === 'number') {
        turnMetadataRef.current = {
          ...turnMetadataRef.current,
          gatewayMs: result.gatewayMs,
          tool: item.name,
          preAuthorized: result.preAuthorized === true,
          canonicalReceipt: Boolean(result.receipt),
        }
      }
      // Exact todo reads also return the short-lived capability token needed
      // for a mutation. Let the model continue into the proposal tool in the
      // same turn; the session contract still requires it to preserve the
      // packet's factual core if the user only asked to read the todo.
      if (result.clientAction?.action === 'exit_voice') {
        sendToolOutput(item.call_id, result)
        callbacksRef.current.onClientAction(result.clientAction)
        return { createResponse: false, exitVoice: true }
      }
      if (result.clientAction) callbacksRef.current.onClientAction(result.clientAction)
      const exactText = result.referenceToken
        ? undefined
        : result.packet?.spokenText ?? result.proposal?.spokenText ?? result.receipt?.spokenText ?? result.spokenText
      if ((result.receipt && !result.replayed) || result.mutated === true) callbacksRef.current.onMutation()
      sendToolOutput(item.call_id, result)
      if (turnId !== activeTurnIdRef.current) return { createResponse: false }
      return { createResponse: true, exactText }
    } catch (toolError) {
      toolControllersRef.current.delete(item.call_id)
      if (toolError instanceof DOMException && toolError.name === 'AbortError') {
        sendToolOutput(item.call_id, { cancelled: true, reason: 'turn_interrupted' })
        return { createResponse: false }
      }
      const message = toolError instanceof Error ? toolError.message : 'Realtime tool failed'
      turnMeasurement?.mark(`tool_${item.name}_failed`)
      const current = turnId === activeTurnIdRef.current
      if (current) {
        turnFailureRef.current = `tool_${item.name}_failed`
        turnMetadataRef.current = { ...turnMetadataRef.current, tool: item.name, toolError: true }
      }
      sendToolOutput(item.call_id, { error: message })
      return { createResponse: current, exactText: current ? `I couldn't verify that safely. ${message}` : undefined }
    }
  }, [sendToolOutput])

  // Run every tool call in a response, then send exactly one response.create for
  // the whole batch. A single response can carry parallel tool calls; creating a
  // response per call collides on the provider's one-active-response rule.
  const executeToolBatch = useCallback(async (items: Array<{ name?: string; call_id?: string; arguments?: string }>, turnId: number) => {
    setStatus('thinking')
    const outcomes = await Promise.all(items.map(item => executeToolCall(item, turnId)))
    if (turnId !== activeTurnIdRef.current) return
    if (outcomes.some(outcome => outcome.exitVoice)) return
    if (!outcomes.some(outcome => outcome.createResponse)) return
    if (responseInFlightRef.current) {
      // Defense in depth: a response is somehow already running. Never create a
      // second one (that is the fatal conversation_already_has_active_response);
      // defer to its response.done instead.
      pendingCreateTurnRef.current = turnId
      return
    }
    const exactTexts = outcomes
      .filter(outcome => outcome.createResponse && outcome.exactText)
      .map(outcome => outcome.exactText as string)
    armResponseWatchdog(turnId)
    if (exactTexts.length === 1) {
      // Exactly one canonical text to speak — force it verbatim and block further
      // tool calls while narrating it.
      send({
        type: 'response.create',
        response: {
          instructions: `Say exactly this, with no added facts or follow-up: ${exactTexts[0]}`,
          tool_choice: 'none',
          tools: [],
        },
      })
    } else {
      // Zero or several canonical texts — let the model synthesize one reply from
      // the tool outputs (the session contract still requires it to preserve any
      // factual core).
      send({ type: 'response.create' })
    }
  }, [armResponseWatchdog, executeToolCall, send])

  const endTurnMeasurement = useCallback((failureCode: string | null) => {
    turnMeasurementRef.current?.mark('mic_return')
    turnMeasurementRef.current?.end(!failureCode, failureCode, turnMetadataRef.current)
    turnMeasurementRef.current = null
    turnMetadataRef.current = {}
    turnFailureRef.current = null
  }, [])

  const handleEvent = useCallback((event: MessageEvent<string>) => {
    let message: RealtimeEvent
    try { message = JSON.parse(event.data) as RealtimeEvent } catch { return }
    if (
      message.type !== 'conversation.item.input_audio_transcription.delta'
      && message.type !== 'response.output_audio_transcript.delta'
      && message.type !== 'response.function_call_arguments.delta'
    ) {
      emitTrace.current(`evt ${message.type}`)
    }

    // Map a committed input item to the turn that was active when it committed,
    // so a completed transcript is attributed to the right turn for tools.
    if (message.type === 'input_audio_buffer.committed' && message.item_id) {
      if (!inputItemTurnIdsRef.current.has(message.item_id)) {
        inputItemTurnIdsRef.current.set(message.item_id, activeTurnIdRef.current)
      }
      return
    }

    // The user began speaking. The provider truncates its own audio
    // (interrupt_response) and will commit + transcribe + create a response on
    // its own. We only reflect the interruption and open a fresh turn.
    if (message.type === 'input_audio_buffer.speech_started') {
      clearResponseWatchdog()
      pendingCreateTurnRef.current = null
      if (turnMeasurementRef.current) endTurnMeasurement('interrupted')
      activeTurnIdRef.current += 1
      toolControllersRef.current.forEach(controller => controller.abort())
      toolControllersRef.current.clear()
      assistantSpeakingRef.current = false
      orbTranscriptRef.current = ''
      currentUtteranceRef.current = ''
      currentUtteranceTurnRef.current = 0
      sileroTurnStartedAtRef.current = performance.now()
      if (message.item_id) inputItemTurnIdsRef.current.set(message.item_id, activeTurnIdRef.current)
      turnMeasurementRef.current = startInteraction({
        focus: 'voice', flow: 'voice-realtime-spike', interaction: 'speech_to_mic_return',
        surface: 'orb-realtime-spike', immediateFlush: true,
      })
      turnMeasurementRef.current.mark('speech_started')
      setStatus('listening')
      return
    }

    if (message.type === 'output_audio_buffer.started') {
      assistantSpeakingRef.current = true
      clearResponseWatchdog()
      if (startupMeasurementRef.current) {
        startupMeasurementRef.current.mark('first_webrtc_audio_packet')
        startupMeasurementRef.current.end(true)
        startupMeasurementRef.current = null
      }
      turnMeasurementRef.current?.mark('first_audio')
      setStatus('speaking')
      return
    }

    // Audio finished (stopped) or was truncated by a barge-in (cleared). This —
    // not response.done — is the truthful end of Orb speaking.
    if (message.type === 'output_audio_buffer.stopped' || message.type === 'output_audio_buffer.cleared') {
      assistantSpeakingRef.current = false
      if (message.type === 'output_audio_buffer.stopped' && !responseInFlightRef.current) {
        setStatus('listening')
      }
      return
    }

    if (message.type === 'conversation.item.input_audio_transcription.completed' && message.transcript?.trim()) {
      const transcript = message.transcript.trim()
      const transcriptTurnId = message.item_id ? inputItemTurnIdsRef.current.get(message.item_id) : undefined
      if (message.item_id) inputItemTurnIdsRef.current.delete(message.item_id)
      callbacksRef.current.onUserTranscript(transcript)
      // Attribute the trusted utterance to its turn so a mutation tool can only
      // act on the current turn's actual words.
      const turnId = transcriptTurnId ?? activeTurnIdRef.current
      currentUtteranceRef.current = transcript
      currentUtteranceTurnRef.current = turnId
      turnMetadataRef.current = { ...turnMetadataRef.current, ...sileroSnapshot() }
      sileroTurnStartedAtRef.current = null
      turnMeasurementRef.current?.mark('transcript_complete')
      // The provider does not auto-create the response (create_response:false).
      // Create it now that the input item + transcript are in context — unless a
      // prior response is still running, in which case defer to its response.done.
      if (turnId === activeTurnIdRef.current) {
        if (responseInFlightRef.current) {
          pendingCreateTurnRef.current = turnId
          emitTrace.current(`transcript ready; deferring response.create (turn ${turnId}, response in flight)`)
        } else {
          setStatus('thinking')
          armResponseWatchdog(turnId)
          emitTrace.current(`transcript → response.create (turn ${turnId})`)
          send({ type: 'response.create' })
        }
      }
      return
    }

    if (message.type === 'response.created') {
      responseInFlightRef.current = true
      if (message.response?.id) responseTurnIdsRef.current.set(message.response.id, activeTurnIdRef.current)
      if (statusRef.current === 'listening') setStatus('thinking')
      return
    }

    if (message.type === 'response.output_audio_transcript.delta' && message.delta) {
      orbTranscriptRef.current += message.delta
      return
    }
    if (message.type === 'response.output_audio_transcript.done') {
      const transcript = (message.transcript || orbTranscriptRef.current).trim()
      if (transcript) callbacksRef.current.onOrbTranscript(transcript)
      orbTranscriptRef.current = ''
      return
    }

    if (message.type === 'response.done') {
      const responseId = message.response?.id
      // iPad Safari has been observed redelivering response.done for the same
      // response.id. Its turn mapping is deleted on first handling, so a
      // redelivery would otherwise fall back to activeTurnIdRef.current and
      // could be misread as belonging to whatever turn is active by then —
      // re-running tool dispatch and flickering status. Drop it outright.
      if (responseId && handledResponseIdsRef.current.has(responseId)) {
        emitTrace.current(`response.done duplicate ignored (id=${responseId})`)
        return
      }
      if (responseId) handledResponseIdsRef.current.add(responseId)
      responseInFlightRef.current = false
      const calls = message.response?.output?.filter(item => item.type === 'function_call') ?? []
      const responseTurnId = responseId
        ? responseTurnIdsRef.current.get(responseId) ?? activeTurnIdRef.current
        : activeTurnIdRef.current
      if (responseId) responseTurnIdsRef.current.delete(responseId)
      emitTrace.current(`response.done calls=${calls.length} turn=${responseTurnId} active=${activeTurnIdRef.current}`)
      if (calls.length) {
        // The model wants to use tools. Run them all, then send one continuation
        // response.create for the whole batch (guarded by turn id).
        void executeToolBatch(calls, responseTurnId)
        return
      }
      // A spoken response finished generating. If audio already stopped (or
      // there was none), settle to listening now; otherwise output_audio_buffer
      // .stopped will. Only settle for the current turn.
      if (responseTurnId === activeTurnIdRef.current) {
        clearResponseWatchdog()
        endTurnMeasurement(turnFailureRef.current)
        if (!assistantSpeakingRef.current) setStatus('listening')
      }
      // The channel is now clear. If a newer turn's transcript was waiting for
      // it, create that response now.
      if (
        pendingCreateTurnRef.current !== null
        && pendingCreateTurnRef.current === activeTurnIdRef.current
        && !responseInFlightRef.current
      ) {
        const pendingTurn = pendingCreateTurnRef.current
        pendingCreateTurnRef.current = null
        setStatus('thinking')
        armResponseWatchdog(pendingTurn)
        emitTrace.current(`deferred transcript → response.create (turn ${pendingTurn})`)
        send({ type: 'response.create' })
      }
      return
    }

    if (message.type === 'error') {
      const realtimeError = message.error?.message || 'Realtime voice error'
      emitTrace.current(`PROVIDER ERROR: ${JSON.stringify(message.error ?? {})}`)
      stop('realtime_error')
      setError(realtimeError)
      setStatus('error')
    }
  }, [armResponseWatchdog, clearResponseWatchdog, endTurnMeasurement, executeToolBatch, send, sileroSnapshot, stop])

  const start = useCallback(async (source = 'unknown') => {
    if (peerRef.current) return
    traceRef.current = []
    traceStartRef.current = 0
    responseInFlightRef.current = false
    assistantSpeakingRef.current = false
    pendingCreateTurnRef.current = null
    activeTurnIdRef.current = 0
    emitTrace.current(`start (${source})`)
    const generation = connectionGenerationRef.current + 1
    connectionGenerationRef.current = generation
    const startupAbort = new AbortController()
    startupAbortRef.current = startupAbort
    setStatus('connecting')
    setError(null)
    const measurement = startInteraction({
      focus: 'voice', flow: 'voice-realtime-spike-start', interaction: 'tap_to_first_webrtc_audio_packet',
      surface: 'orb-realtime-spike', immediateFlush: true,
      metadata: {
        hookInstanceId: hookInstanceIdRef.current,
        connectionGeneration: generation,
        startSource: source,
      },
    })
    startupMeasurementRef.current = measurement
    let peer: RTCPeerConnection | null = null
    let audio: HTMLAudioElement | null = null
    let stream: MediaStream | null = null
    let channel: RTCDataChannel | null = null
    const isCurrent = () => (
      connectionGenerationRef.current === generation
      && peerRef.current === peer
      && !startupAbort.signal.aborted
    )
    const disposeLocal = () => {
      channel?.close()
      peer?.close()
      stream?.getTracks().forEach(track => track.stop())
      if (audio) {
        audio.pause()
        audio.srcObject = null
        audio.remove()
      }
    }
    try {
      peer = new RTCPeerConnection()
      peerRef.current = peer
      audio = document.createElement('audio')
      audio.autoplay = true
      audio.setAttribute('playsinline', '')
      audioRef.current = audio
      peer.ontrack = event => {
        if (!isCurrent() || !audio) return
        audio.srcObject = event.streams[0]
        void audio.play().catch(() => {})
      }

      measurement.mark('microphone_request')
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      if (!isCurrent()) {
        disposeLocal()
        return
      }
      streamRef.current = stream
      peer.addTrack(stream.getAudioTracks()[0], stream)
      measurement.mark('microphone_ready')
      // Reuse the exact WebRTC MediaStream and initialize asynchronously. The
      // classifier is advisory telemetry only; it never delays startup, gates
      // audio, or alters the provider sender.
      beginSileroShadow(stream)

      const dataChannel = peer.createDataChannel('oai-events')
      channel = dataChannel
      channelRef.current = dataChannel
      dataChannel.addEventListener('message', event => {
        if (!isCurrent() || channelRef.current !== dataChannel) return
        handleEvent(event)
      })
      const openPromise = new Promise<void>(resolve => {
        dataChannel.addEventListener('open', () => resolve(), { once: true })
        dataChannel.addEventListener('error', () => resolve(), { once: true })
        dataChannel.addEventListener('close', () => resolve(), { once: true })
      })
      const offer = await peer.createOffer()
      if (!isCurrent()) {
        disposeLocal()
        return
      }
      await peer.setLocalDescription(offer)
      if (!isCurrent()) {
        disposeLocal()
        return
      }
      measurement.mark('sdp_offer_ready')
      const response = await fetch('/api/orb-realtime/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: offer.sdp,
        signal: startupAbort.signal,
      })
      if (!isCurrent()) {
        disposeLocal()
        return
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Could not start Realtime voice')
      }
      const answerSdp = await response.text()
      if (!isCurrent()) {
        disposeLocal()
        return
      }
      await peer.setRemoteDescription({ type: 'answer', sdp: answerSdp })
      if (!isCurrent()) {
        disposeLocal()
        return
      }
      await openPromise
      if (!isCurrent()) {
        disposeLocal()
        return
      }
      if (dataChannel.readyState !== 'open') throw new Error('Realtime data channel failed')
      measurement.mark('data_channel_open')
      startupAbortRef.current = null
      // No greeting. The provider owns turn-taking, so the session simply opens
      // into listening and waits for the user to speak.
      emitTrace.current('data channel open → listening (no greeting)')
      setStatus('listening')
    } catch (startError) {
      const staleStart = connectionGenerationRef.current !== generation || startupAbort.signal.aborted
      disposeLocal()
      if (staleStart) return
      connectionGenerationRef.current += 1
      startupAbortRef.current = null
      if (peerRef.current === peer) peerRef.current = null
      if (channelRef.current === channel) channelRef.current = null
      if (streamRef.current === stream) streamRef.current = null
      if (audioRef.current === audio) audioRef.current = null
      if (startupMeasurementRef.current === measurement) startupMeasurementRef.current = null
      const message = startError instanceof Error ? startError.message : 'Could not start Realtime voice'
      const errorName = startError instanceof Error ? startError.name : 'UnknownError'
      emitTrace.current(`START FAILED: ${errorName}: ${message.slice(0, 240)}`)
      measurement.end(false, 'start_failed', {
        hookInstanceId: hookInstanceIdRef.current,
        connectionGeneration: generation,
        startSource: source,
        errorName,
        errorMessage: message.slice(0, 240),
      })
      setError(message)
      setStatus('error')
      stopSileroShadow()
    }
  }, [beginSileroShadow, handleEvent, stopSileroShadow])

  useEffect(() => () => stop('component_unmount'), [stop])

  // DEV-only: preview the error visual state without a real connection failure.
  // Never wires a peer, so a subsequent real start() is unaffected.
  const simulateError = useCallback((message = 'Simulated voice error (DEV)') => {
    if (process.env.NODE_ENV === 'production') return
    emitTrace.current(`SIMULATED ERROR: ${message}`)
    setError(message)
    setStatus('error')
  }, [])

  return {
    status,
    error,
    active: status !== 'off' && status !== 'error',
    start,
    stop,
    simulateError,
    getTrace: () => traceRef.current.map(entry => `+${entry.t}ms  ${entry.e}`).join('\n'),
  }
}
