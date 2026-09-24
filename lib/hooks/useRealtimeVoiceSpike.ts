'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { startInteraction } from '@/lib/performance/telemetry'
import { collectClientEnvironment } from '@/lib/client-environment'
import { ORB_PRESENTABLE_QUERY_TOOL_NAMES, buildOrbQueryPresentation, orbQueryPresentationRequest, renderOrbQueryPacketMarkdown } from '@/lib/orb-query-presentation'
import {
  startSileroShadow,
  type SileroShadowController,
  type SileroShadowMetadata,
} from '@/lib/voice/silero-shadow'
import { isClearlyFragmentaryProviderTranscript, isUsableProviderTranscript, shouldRecoverVoiceVerifier } from '@/lib/orb-interaction/voice-authenticity'
import { comparableSpokenWords } from '@/lib/orb-interaction/spoken-text'

type SpikeStatus = 'off' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error'

type Options = {
  currentProjectId: string | null
  transportOnly?: boolean
  onUserTranscript: (text: string) => void
  onOrbTranscript: (text: string) => void
  onMutation: () => void
  onClientAction: (action: { action: string; target?: string }) => void
}

type RealtimeUsage = {
  total_tokens?: number
  input_tokens?: number
  output_tokens?: number
  input_token_details?: { cached_tokens?: number; text_tokens?: number; audio_tokens?: number }
  output_token_details?: { text_tokens?: number; audio_tokens?: number }
}

type RealtimeEvent = {
  type: string
  item_id?: string
  transcript?: string
  response_id?: string
  logprobs?: Array<{ logprob?: number }>
  delta?: string
  response?: { id?: string; output?: Array<{ type?: string; name?: string; call_id?: string; arguments?: string }>; usage?: RealtimeUsage }
  error?: { message?: string; code?: string; type?: string }
}

function isBenignCancellationRace(error: RealtimeEvent['error']): boolean {
  const detail = `${error?.code ?? ''} ${error?.type ?? ''} ${error?.message ?? ''}`
  return /cancel(?:lation)?[^\n]*no active response|no active response[^\n]*cancel/i.test(detail)
}

function transcriptionConfidence(logprobs: RealtimeEvent['logprobs']) {
  const values = (logprobs ?? [])
    .map(item => item.logprob)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (values.length === 0) return null
  const averageLogProbability = values.reduce((sum, value) => sum + value, 0) / values.length
  return Math.exp(averageLogProbability)
}

// Fire-and-forget: log this response's token usage to Orb's own ledger so
// ORB-353's usage warnings can see voice spend. Never blocks or throws into
// the turn-taking path — a failed usage log must never affect the call.
function reportRealtimeUsage(usage: RealtimeUsage | undefined) {
  if (!usage) return
  fetch('/api/orb-realtime/usage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usage, platform: collectClientEnvironment().platform }),
    keepalive: true,
  }).catch(() => {})
}

function parseArguments(value: string | undefined) {
  try { return JSON.parse(value || '{}') as Record<string, unknown> } catch { return {} }
}

// Result of one tool call. The batch aggregates these into a single response.
type ToolOutcome = { createResponse: boolean; exactText?: string; exitVoice?: boolean }

// How long 'thinking' may last before the UI recovers itself. The provider
// answering directly is fast, so a lapse there is a fault. A transport-only
// turn is answered by Orb's own server action — a model call plus tools — so it
// is legitimately slower and gets a longer leash. Neither is a deadline for the
// work itself: the watchdog only releases the UI, and a later reply still
// renders.
const PROVIDER_RESPONSE_WATCHDOG_MS = 20_000
const TRANSPORT_TURN_WATCHDOG_MS = 45_000

// ORB-325 legacy mode used provider-owned turn-taking. The unified mode keeps
// provider VAD only as a capture signal: Silero authenticates interruptions,
// Orb's shared server action owns the answer/tools, and Realtime only renders
// a supplied response artifact.
//
// Both modes use server VAD with automatic response creation disabled. Legacy
// mode still asks the Realtime model to answer after a transcript. Unified mode
// forwards completed provider transcripts and later creates one out-of-band audio response
// with tools disabled. There is no greeting.
export function useRealtimeVoiceSpike(options: Options) {
  const [status, setStatus] = useState<SpikeStatus>('off')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  // ORB-372: OpenAI's handle for the live call, so stop() can end it there
  // and not just locally. Null once ended or never established.
  const callIdRef = useRef<string | null>(null)
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
  const expectedSpeechRef = useRef<{
    responseId: string
    text: string
    providerResponseId?: string
    interrupted: boolean
  } | null>(null)
  const pendingAcousticInterruptRef = useRef(false)
  // Unified mode: the reply whose rendering an acoustic barge-in cancelled.
  // Sound alone only pauses speech; if the sound is not trusted speech, this
  // reply is spoken again. See lib/orb-interaction/interrupt-intent.ts.
  const pausedSpeechRef = useRef<{ responseId: string; text: string } | null>(null)
  // Provider transcripts already forwarded, by input item id. A redelivered
  // transcription event must not become a second user turn.
  const handledTranscriptItemIdsRef = useRef(new Set<string>())
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
    if (channel?.readyState !== 'open') {
      emitTrace.current(`send skipped: data channel not open (${typeof event.type === 'string' ? event.type : 'unknown'})`)
      return false
    }
    try {
      channel.send(JSON.stringify(event))
      return true
    } catch (error) {
      emitTrace.current(`send failed: ${error instanceof Error ? error.message : 'unknown error'}`)
      return false
    }
  }, [])

  const speakExact = useCallback((text: string, responseId: string) => {
    const spokenText = text.trim()
    if (!spokenText) return false
    const sent = send({
      type: 'response.create',
      response: {
        conversation: 'none',
        output_modalities: ['audio'],
        tools: [],
        tool_choice: 'none',
        metadata: { orb_response_id: responseId, response_purpose: 'exact_speech_render' },
        instructions: 'Read the supplied text exactly. Do not add, remove, paraphrase, answer, or comment on it.',
        input: [{
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: spokenText }],
        }],
      },
    })
    if (!sent) return false
    expectedSpeechRef.current = { responseId, text: spokenText, interrupted: false }
    orbTranscriptRef.current = ''
    setStatus('thinking')
    return true
  }, [send])

  const markExpectedSpeechInterrupted = useCallback(() => {
    if (expectedSpeechRef.current) expectedSpeechRef.current.interrupted = true
    orbTranscriptRef.current = ''
  }, [])

  // Acoustic barge-in: stop rendering the current reply and remember it. This
  // never cancels the user's turn or any server work — only deliberate input
  // does that, through the shared conversation (handleStop in the dashboard).
  const pauseSpeech = useCallback(() => {
    const rendering = expectedSpeechRef.current
    markExpectedSpeechInterrupted()
    if (!responseInFlightRef.current) return
    if (rendering) pausedSpeechRef.current = { responseId: rendering.responseId, text: rendering.text }
    turnMeasurementRef.current?.mark('speech_paused_by_sound')
    try { send({ type: 'response.cancel' }) } catch { /* channel teardown wins */ }
  }, [markExpectedSpeechInterrupted, send])

  // The sound that paused speech produced no usable transcript (wind, a cough,
  // a siren, or a provider transcription failure).
  // Speak the unfinished reply again so nothing Orb said is silently lost.
  const resumePausedSpeech = useCallback(() => {
    const paused = pausedSpeechRef.current
    pausedSpeechRef.current = null
    if (!paused || responseInFlightRef.current) return false
    emitTrace.current(`resuming speech paused by untranscribed sound (${paused.responseId})`)
    turnMeasurementRef.current?.mark('speech_resumed_after_untrusted_sound')
    return speakExact(paused.text, paused.responseId)
  }, [speakExact])

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
    void startSileroShadow(stream, () => {
      if (!callbacksRef.current.transportOnly || !pendingAcousticInterruptRef.current) return
      pendingAcousticInterruptRef.current = false
      pauseSpeech()
    })
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
  }, [pauseSpeech])

  const restartSileroShadow = useCallback(() => {
    const stream = streamRef.current
    if (!stream) return
    emitTrace.current('Silero evidence unhealthy; restarting classifier')
    stopSileroShadow()
    beginSileroShadow(stream)
  }, [beginSileroShadow, stopSileroShadow])

  // Safety net only — the provider owns response timing, so this should not fire
  // in a healthy session. It recovers the UI to listening if a response (or a
  // tool continuation) never produces audio.
  const armResponseWatchdog = useCallback((turnId: number, timeoutMs = PROVIDER_RESPONSE_WATCHDOG_MS) => {
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
    }, timeoutMs)
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
    expectedSpeechRef.current = null
    pendingAcousticInterruptRef.current = false
    pausedSpeechRef.current = null
    handledTranscriptItemIdsRef.current.clear()
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
    setReady(false)
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
    const mutationTool = item.name.startsWith('propose_') || item.name === 'create_ticket' || item.name === 'confirm_todo_mutation'
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
        offset: args.offset,
      }
    } else if (item.name === 'get_orb_state') {
      // ORB-368: voice asks the server why the orb is the colour it is,
      // rather than inferring a cause from a task list.
      operation = 'orb_state'
      body = {
        operation,
        projectName: args.project_name,
        allProjects: args.all_projects === true,
        currentProjectId: currentProjectIdRef.current,
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
    } else if (item.name === 'query_users') {
      operation = 'query_users'
      body = {
        operation,
        search: args.search,
        maxResults: args.max_results,
      }
    } else if (item.name === 'query_invitations') {
      operation = 'query_invitations'
      body = {
        operation,
        invitationStatus: args.status,
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
        description: args.description,
        priorityValue: args.priority_value,
        dueAt: args.due_at,
        dueTimezone: args.due_timezone,
        dueCity: args.due_city,
        reminderLeadValue: args.reminder_lead_value,
        reminderLeadUnit: args.reminder_lead_unit,
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
        description: args.description,
        resolutionNotes: args.resolution_notes,
        urls: args.urls,
        dueAt: args.due_at,
        dueTimezone: args.due_timezone,
        dueCity: args.due_city,
        reminderLeadValue: args.reminder_lead_value,
        reminderLeadUnit: args.reminder_lead_unit,
        dismissReminderNudge: args.dismiss_reminder_nudge,
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
    } else if (item.name === 'propose_todo_batch') {
      operation = 'propose_todo_batch'
      const rawOperations = Array.isArray(args.operations) ? args.operations as Array<Record<string, unknown>> : []
      body = {
        operation,
        operations: rawOperations.map(op => ({
          action: op.action,
          todoReference: op.todo_reference,
          projectName: op.project_name,
          title: op.title,
          priorityValue: op.priority_value,
          newTitle: op.new_title,
          newStatus: op.new_status,
          newPriority: op.new_priority,
          description: op.description,
          resolutionNotes: op.resolution_notes,
          urls: op.urls,
          dueAt: op.due_at,
          dueTimezone: op.due_timezone,
          dueCity: op.due_city,
          reminderLeadValue: op.reminder_lead_value,
          reminderLeadUnit: op.reminder_lead_unit,
          dismissReminderNudge: op.dismiss_reminder_nudge,
          targetProjectName: op.target_project_name,
        })),
        currentProjectId: currentProjectIdRef.current,
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
      body.requestTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
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
      // Query detail goes through the same Markdown conversation surface as
      // text. The bridge only converts trusted packet rows to Markdown; it does
      // not own a second Voice-only table component or database query path.
      const presentationRequest = orbQueryPresentationRequest(args)
      const presentation = ORB_PRESENTABLE_QUERY_TOOL_NAMES.has(item.name)
        ? buildOrbQueryPresentation(result.packet, presentationRequest)
        : null
      if (presentation) result.presentation = presentation
      const displayMarkdown = presentation
        ? renderOrbQueryPacketMarkdown(result.packet, presentationRequest)
        : null
      if (displayMarkdown) callbacksRef.current.onOrbTranscript(displayMarkdown)
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
    if (exactTexts.length > 0) {
      // One or several canonical texts — force ALL of them verbatim. A prior
      // version only did this for exactly one and let the model freely
      // improvise for 2+ (e.g. three parallel propose_delete_todo calls from
      // "delete test1, test2, test3"), which silently dropped every pending
      // proposal's actual confirmation text in favor of vague paraphrase —
      // the user was never told what was actually pending.
      const instructions = exactTexts.length === 1
        ? `Say exactly this, with no added facts or follow-up: ${exactTexts[0]}`
        : `Say exactly these, one after another, with no added facts or follow-up: ${exactTexts.join(' ')}`
      send({
        type: 'response.create',
        response: { instructions, tool_choice: 'none', tools: [] },
      })
    } else {
      // No canonical text to force — let the model synthesize one reply from
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

    // The provider detected possible speech. Open a capture turn, but unified
    // mode does not interrupt on this event alone: Silero real-start evidence
    // (or the admitted short-speech boundary at transcript completion) owns it.
    if (message.type === 'input_audio_buffer.speech_started') {
      const interruptedOutput = assistantSpeakingRef.current || responseInFlightRef.current || statusRef.current === 'thinking'
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
      pendingAcousticInterruptRef.current = options.transportOnly === true && interruptedOutput
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

    // Speech that produced no usable transcript (noise the provider could not
    // transcribe, or a failed transcription) cannot be a user turn. If it paused
    // Orb's reply, resume that reply.
    if (
      options.transportOnly
      && (
        message.type === 'conversation.item.input_audio_transcription.failed'
        || (message.type === 'conversation.item.input_audio_transcription.completed' && !message.transcript?.trim())
      )
    ) {
      if (message.item_id) inputItemTurnIdsRef.current.delete(message.item_id)
      pendingAcousticInterruptRef.current = false
      sileroTurnStartedAtRef.current = null
      if (!resumePausedSpeech()) setStatus('listening')
      return
    }

    if (message.type === 'conversation.item.input_audio_transcription.completed' && message.transcript?.trim()) {
      if (message.item_id) {
        if (handledTranscriptItemIdsRef.current.has(message.item_id)) {
          emitTrace.current(`duplicate transcript ignored (item=${message.item_id})`)
          return
        }
        handledTranscriptItemIdsRef.current.add(message.item_id)
      }
      const transcript = message.transcript.trim()
      const transcriptTurnId = message.item_id ? inputItemTurnIdsRef.current.get(message.item_id) : undefined
      if (message.item_id) inputItemTurnIdsRef.current.delete(message.item_id)
      const acousticEvidence = sileroSnapshot()
      const providerConfidence = transcriptionConfidence(message.logprobs)
      if (shouldRecoverVoiceVerifier(acousticEvidence, providerConfidence)) restartSileroShadow()
      turnMetadataRef.current = {
        ...turnMetadataRef.current,
        ...acousticEvidence,
        transcriptionConfidence: providerConfidence,
      }
      // A completed provider transcript is the voice equivalent of submitted
      // text. Silero is retained in telemetry and restarted on disagreement,
      // but no longer has authority to discard a usable transcript.
      if (!isUsableProviderTranscript(transcript)) return
      if (options.transportOnly && isClearlyFragmentaryProviderTranscript(transcript)) {
        emitTrace.current(`fragmentary transcript withheld (characters=${transcript.length})`)
        pendingAcousticInterruptRef.current = false
        pausedSpeechRef.current = null
        sileroTurnStartedAtRef.current = null
        turnMeasurementRef.current?.mark('transcript_complete')
        turnMetadataRef.current.fragmentaryTranscript = true
        const turnId = transcriptTurnId ?? activeTurnIdRef.current
        if (speakExact('I only caught part of that. Please say it again.', `fragment-${turnId}`)) {
          armResponseWatchdog(turnId)
        } else {
          endTurnMeasurement('fragment_clarification_unavailable')
          setStatus('listening')
        }
        return
      }
      if (options.transportOnly && pendingAcousticInterruptRef.current) {
        pendingAcousticInterruptRef.current = false
        pauseSpeech()
      }
      // Transcribed speech is the user's next turn; the paused reply is superseded
      // and the shared conversation decides whether that is a stop, a
      // replacement, or an answer.
      pausedSpeechRef.current = null
      callbacksRef.current.onUserTranscript(transcript)
      // Attribute the transcribed utterance to its turn so a mutation tool can only
      // act on the current turn's actual words.
      const turnId = transcriptTurnId ?? activeTurnIdRef.current
      currentUtteranceRef.current = transcript
      currentUtteranceTurnRef.current = turnId
      sileroTurnStartedAtRef.current = null
      turnMeasurementRef.current?.mark('transcript_complete')
      if (options.transportOnly) {
        setStatus('thinking')
        // The provider does not answer this turn — the server does, and its
        // reply comes back through speakExact. Nothing here observes that
        // round trip, so without a watchdog a server turn that errors, is
        // stopped, or never produces speech leaves the UI on "Gathering
        // data…" for the rest of the session. Every other path to 'thinking'
        // arms one; this one did not.
        armResponseWatchdog(turnId, TRANSPORT_TURN_WATCHDOG_MS)
        return
      }
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
      if (
        options.transportOnly
        && message.response?.id
        && expectedSpeechRef.current
        && !expectedSpeechRef.current.providerResponseId
      ) {
        expectedSpeechRef.current.providerResponseId = message.response.id
      }
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
      if (options.transportOnly) {
        const expectedSpeech = expectedSpeechRef.current
        if (
          !expectedSpeech
          || !message.response_id
          || expectedSpeech.providerResponseId !== message.response_id
        ) {
          emitTrace.current(`speech transcript ignored for non-current response (${message.response_id ?? 'unknown'})`)
          orbTranscriptRef.current = ''
          return
        }
        if (expectedSpeech.interrupted) {
          emitTrace.current(`partial speech transcript accepted for interrupted response (${message.response_id})`)
          orbTranscriptRef.current = ''
          return
        }
        const expected = comparableSpokenWords(expectedSpeech.text)
        const observed = comparableSpokenWords(transcript)
        if (expected && observed && expected !== observed) {
          // The screen always shows Orb's canonical text, so a rendering that
          // differed is reported, not fatal: ending the voice session over it
          // (as before 2026-09-16) cost far more than the discrepancy.
          turnMeasurementRef.current?.mark('speech_render_mismatch')
          emitTrace.current(`speech render mismatch (${expectedSpeech.responseId})`)
          console.warn('[orb-realtime] Spoken rendering differed from Orb’s response', {
            responseId: expectedSpeech.responseId,
            expectedWords: expected.split(' ').length,
            observedWords: observed.split(' ').length,
            ...(process.env.NODE_ENV === 'development'
              ? { expected: expectedSpeech.text, observed: transcript }
              : {}),
          })
        }
      } else if (transcript) {
        callbacksRef.current.onOrbTranscript(transcript)
      }
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
      reportRealtimeUsage(message.response?.usage)
      const calls = message.response?.output?.filter(item => item.type === 'function_call') ?? []
      const responseTurnId = responseId
        ? responseTurnIdsRef.current.get(responseId) ?? activeTurnIdRef.current
        : activeTurnIdRef.current
      if (responseId) responseTurnIdsRef.current.delete(responseId)
      emitTrace.current(`response.done calls=${calls.length} turn=${responseTurnId} active=${activeTurnIdRef.current}`)
      if (calls.length) {
        if (options.transportOnly) {
          emitTrace.current(`unexpected tool calls ignored (${calls.length})`)
          setError('Voice renderer attempted an unavailable operation.')
          setStatus('error')
          return
        }
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
      if (
        options.transportOnly
        && expectedSpeechRef.current
        && responseId
        && expectedSpeechRef.current.providerResponseId === responseId
      ) {
        expectedSpeechRef.current = null
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
      if (isBenignCancellationRace(message.error)) {
        responseInFlightRef.current = false
        emitTrace.current(`benign cancellation race ignored: ${realtimeError}`)
        return
      }
      emitTrace.current(`PROVIDER ERROR: ${JSON.stringify(message.error ?? {})}`)
      stop('realtime_error')
      setError(realtimeError)
      setStatus('error')
    }
  }, [armResponseWatchdog, clearResponseWatchdog, endTurnMeasurement, executeToolBatch, options.transportOnly, pauseSpeech, restartSileroShadow, resumePausedSpeech, send, sileroSnapshot, speakExact, stop])

  const start = useCallback(async (source = 'unknown') => {
    if (peerRef.current) return
    traceRef.current = []
    traceStartRef.current = 0
    responseInFlightRef.current = false
    assistantSpeakingRef.current = false
    pendingCreateTurnRef.current = null
    activeTurnIdRef.current = 0
    setReady(false)
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
      dataChannel.addEventListener('close', () => {
        if (isCurrent()) setReady(false)
      })
      dataChannel.addEventListener('error', () => {
        if (isCurrent()) setReady(false)
      })
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
      // ORB-372: OpenAI's handle for this call, so stop() can end it there.
      callIdRef.current = response.headers.get('X-Orb-Call-Id') || null
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
      setReady(true)
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
      setReady(false)
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
    ready,
    active: status !== 'off' && status !== 'error',
    start,
    stop,
    speakExact,
    simulateError,
    getTrace: () => traceRef.current.map(entry => `+${entry.t}ms  ${entry.e}`).join('\n'),
  }
}
