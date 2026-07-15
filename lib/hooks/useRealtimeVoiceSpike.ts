'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { startInteraction } from '@/lib/performance/telemetry'

type SpikeStatus = 'off' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error'

type Options = {
  currentProjectId: string | null
  onUserTranscript: (text: string) => void
  onOrbTranscript: (text: string) => void
  onMutation: () => void
}

type RealtimeEvent = {
  type: string
  item_id?: string
  audio_start_ms?: number
  audio_end_ms?: number
  logprobs?: Array<{ logprob?: number }>
  transcript?: string
  delta?: string
  response?: { id?: string; output?: Array<{ type?: string; name?: string; call_id?: string; arguments?: string }> }
  error?: { message?: string }
}

function parseArguments(value: string | undefined) {
  try { return JSON.parse(value || '{}') as Record<string, unknown> } catch { return {} }
}

export function useRealtimeVoiceSpike(options: Options) {
  const [status, setStatus] = useState<SpikeStatus>('off')
  const [error, setError] = useState<string | null>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const channelRef = useRef<RTCDataChannel | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const orbTranscriptRef = useRef('')
  const currentUtteranceRef = useRef('')
  const currentUtteranceTurnRef = useRef(0)
  const handledCallsRef = useRef(new Set<string>())
  const assistantSpeakingRef = useRef(false)
  const activeTurnIdRef = useRef(0)
  const responseTurnIdsRef = useRef(new Map<string, number>())
  const inputItemTurnIdsRef = useRef(new Map<string, number>())
  const speechStartMsByItemRef = useRef(new Map<string, number>())
  const vadDurationMsByItemRef = useRef(new Map<string, number>())
  const transcriptionLogprobsByItemRef = useRef(new Map<string, number[]>())
  const toolControllersRef = useRef(new Map<string, AbortController>())
  const currentProjectIdRef = useRef(options.currentProjectId)
  const callbacksRef = useRef(options)
  const startupMeasurementRef = useRef<ReturnType<typeof startInteraction> | null>(null)
  const turnMeasurementRef = useRef<ReturnType<typeof startInteraction> | null>(null)
  const turnMetadataRef = useRef<Record<string, unknown>>({})
  const turnFailureRef = useRef<string | null>(null)
  const audioProbeTimerRef = useRef<number | null>(null)
  const responseWatchdogRef = useRef<{
    timeout: number
    turnId: number
    phase: 'awaiting_response' | 'response_started'
    deadlineAt: number
  } | null>(null)
  const transcriptionWatchdogRef = useRef<number | null>(null)
  const interruptionProbeRef = useRef<{
    measurement: ReturnType<typeof startInteraction>
    timeout: number
  } | null>(null)
  currentProjectIdRef.current = options.currentProjectId
  callbacksRef.current = options

  const send = useCallback((event: Record<string, unknown>) => {
    const channel = channelRef.current
    if (channel?.readyState !== 'open') throw new Error('Realtime data channel is not open')
    channel.send(JSON.stringify(event))
  }, [])

  const stopAudioProbe = useCallback(() => {
    if (audioProbeTimerRef.current !== null) window.clearTimeout(audioProbeTimerRef.current)
    audioProbeTimerRef.current = null
  }, [])

  const clearResponseWatchdog = useCallback(() => {
    if (responseWatchdogRef.current) window.clearTimeout(responseWatchdogRef.current.timeout)
    responseWatchdogRef.current = null
  }, [])

  const clearTranscriptionWatchdog = useCallback(() => {
    if (transcriptionWatchdogRef.current !== null) window.clearTimeout(transcriptionWatchdogRef.current)
    transcriptionWatchdogRef.current = null
  }, [])

  const armTranscriptionWatchdog = useCallback((turnId: number) => {
    clearTranscriptionWatchdog()
    transcriptionWatchdogRef.current = window.setTimeout(() => {
      if (turnId !== activeTurnIdRef.current) return
      transcriptionWatchdogRef.current = null
      try { send({ type: 'input_audio_buffer.clear' }) } catch { /* channel may already be closing */ }
      const microphone = streamRef.current?.getAudioTracks()[0]
      if (microphone) {
        microphone.enabled = false
        window.setTimeout(() => {
          if (streamRef.current?.getAudioTracks()[0] === microphone) microphone.enabled = true
        }, 150)
      }
      activeTurnIdRef.current += 1
      turnMeasurementRef.current?.mark('watchdog_awaiting_transcription')
      turnMeasurementRef.current?.end(false, 'transcription_timeout', { watchdogPhase: 'awaiting_transcription' })
      turnMeasurementRef.current = null
      turnMetadataRef.current = {}
      callbacksRef.current.onOrbTranscript('I stopped receiving your voice. Please try again.')
      setStatus('listening')
    }, 12_000)
  }, [clearTranscriptionWatchdog, send])

  const armResponseWatchdog = useCallback((turnId: number, phase: 'awaiting_response' | 'response_started') => {
    const existing = responseWatchdogRef.current
    if (existing) window.clearTimeout(existing.timeout)
    const deadlineAt = existing?.turnId === turnId ? existing.deadlineAt : Date.now() + 12_000
    const timeout = window.setTimeout(() => {
      const watchdog = responseWatchdogRef.current
      if (!watchdog || watchdog.turnId !== turnId) return
      responseWatchdogRef.current = null
      try { send({ type: 'response.cancel' }) } catch { /* channel may already be closing */ }
      stopAudioProbe()
      assistantSpeakingRef.current = false
      toolControllersRef.current.forEach(controller => controller.abort())
      toolControllersRef.current.clear()
      activeTurnIdRef.current += 1
      turnMeasurementRef.current?.mark(`watchdog_${watchdog.phase}`)
      turnMeasurementRef.current?.end(false, 'response_timeout', {
        ...turnMetadataRef.current,
        watchdogPhase: watchdog.phase,
        absoluteDeadline: true,
        remoteAudioPaused: audioRef.current?.paused ?? null,
      })
      turnMeasurementRef.current = null
      turnMetadataRef.current = {}
      turnFailureRef.current = null
      callbacksRef.current.onOrbTranscript('Voice response timed out. Please try again.')
      setStatus('listening')
    }, Math.max(0, deadlineAt - Date.now()))
    responseWatchdogRef.current = { timeout, turnId, phase, deadlineAt }
  }, [send, stopAudioProbe])

  const probeFirstWebRtcAudio = useCallback(async () => {
    stopAudioProbe()
    const peer = peerRef.current
    if (!peer) return
    let baselineBytes: number | null = null
    const sample = async () => {
      if (peerRef.current !== peer || peer.connectionState === 'closed') return
      try {
        const stats = await peer.getStats()
        let receivedBytes = 0
        stats.forEach(report => {
          const inbound = report as RTCInboundRtpStreamStats & { mediaType?: string }
          if (inbound.type === 'inbound-rtp' && (inbound.kind === 'audio' || inbound.mediaType === 'audio')) {
            receivedBytes += inbound.bytesReceived ?? 0
          }
        })
        if (baselineBytes === null) baselineBytes = receivedBytes
        else if (receivedBytes > baselineBytes) {
          turnMetadataRef.current = {
            ...turnMetadataRef.current,
            remoteAudioPausedAtFirstPacket: audioRef.current?.paused ?? null,
          }
          assistantSpeakingRef.current = true
          setStatus('speaking')
          if (startupMeasurementRef.current) {
            startupMeasurementRef.current.mark('first_webrtc_audio_packet')
            startupMeasurementRef.current.end(true)
            startupMeasurementRef.current = null
          }
          turnMeasurementRef.current?.mark('first_webrtc_audio_packet')
          audioProbeTimerRef.current = null
          return
        }
      } catch {
        // Safari may transiently reject getStats while the remote track is attaching.
      }
      audioProbeTimerRef.current = window.setTimeout(() => { void sample() }, 50)
    }
    await sample()
  }, [stopAudioProbe])

  const stop = useCallback(() => {
    stopAudioProbe()
    clearResponseWatchdog()
    clearTranscriptionWatchdog()
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
    inputItemTurnIdsRef.current.clear()
    speechStartMsByItemRef.current.clear()
    vadDurationMsByItemRef.current.clear()
    transcriptionLogprobsByItemRef.current.clear()
    assistantSpeakingRef.current = false
    startupMeasurementRef.current?.end(false, 'session_stopped')
    startupMeasurementRef.current = null
    turnMeasurementRef.current?.end(false, 'session_stopped')
    turnMeasurementRef.current = null
    turnFailureRef.current = null
    if (interruptionProbeRef.current) {
      window.clearTimeout(interruptionProbeRef.current.timeout)
      interruptionProbeRef.current.measurement.end(false, 'session_stopped')
      interruptionProbeRef.current = null
    }
    setStatus('off')
  }, [clearResponseWatchdog, clearTranscriptionWatchdog, stopAudioProbe])

  const returnToolResult = useCallback((callId: string, result: unknown, exactText?: string, createResponse = true) => {
    send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(result) } })
    if (!createResponse) return
    send({
      type: 'response.create',
      response: exactText
        ? {
            instructions: `Say exactly this, with no added facts or follow-up: ${exactText}`,
            tool_choice: 'none',
            tools: [],
          }
        : {},
    })
  }, [send])

  const executeTool = useCallback(async (item: { name?: string; call_id?: string; arguments?: string }, turnId: number) => {
    if (!item.call_id || !item.name || handledCallsRef.current.has(item.call_id)) return
    handledCallsRef.current.add(item.call_id)
    if (turnId !== activeTurnIdRef.current) {
      returnToolResult(item.call_id, { cancelled: true, reason: 'turn_interrupted' }, undefined, false)
      return
    }
    setStatus('thinking')
    const turnMeasurement = turnMeasurementRef.current
    turnMeasurement?.mark(`tool_${item.name}_start`)
    const args = parseArguments(item.arguments)
    const mutationTool = item.name.startsWith('propose_') || item.name === 'confirm_todo_mutation'
    while (mutationTool && turnId === activeTurnIdRef.current && currentUtteranceTurnRef.current !== turnId) {
      await new Promise<void>(resolve => window.setTimeout(resolve, 25))
    }
    if (turnId !== activeTurnIdRef.current) {
      returnToolResult(item.call_id, { cancelled: true, reason: 'turn_interrupted' }, undefined, false)
      return
    }
    const trustedUtterance = currentUtteranceTurnRef.current === turnId ? currentUtteranceRef.current : ''
    let operation: string
    let body: Record<string, unknown>
    if (item.name === 'get_task_count') {
      operation = 'task_count'
      body = { operation, projectScope: args.project_scope, projectName: args.project_name, statusScope: args.status_scope }
    } else if (item.name === 'get_project_directory') {
      operation = 'project_directory'; body = { operation }
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
    } else if (item.name === 'propose_create_todo') {
      operation = 'propose_create_todo'
      body = {
        operation,
        title: args.title,
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
    } else if (item.name === 'confirm_todo_mutation') {
      operation = 'confirm_todo_mutation'
      body = {
        operation,
        proposalToken: args.proposal_token,
        userUtterance: trustedUtterance,
      }
    } else {
      returnToolResult(item.call_id, { error: 'Unsupported tool' })
      return
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
      const exactText = result.referenceToken
        ? undefined
        : result.packet?.spokenText ?? result.proposal?.spokenText ?? result.receipt?.spokenText
      if (result.receipt && !result.replayed) callbacksRef.current.onMutation()
      if (turnId !== activeTurnIdRef.current) {
        returnToolResult(item.call_id, result, undefined, false)
        return
      }
      if (currentUtteranceTurnRef.current === turnId) armResponseWatchdog(turnId, 'awaiting_response')
      returnToolResult(item.call_id, result, exactText)
    } catch (toolError) {
      toolControllersRef.current.delete(item.call_id)
      if (toolError instanceof DOMException && toolError.name === 'AbortError') {
        returnToolResult(item.call_id, { cancelled: true, reason: 'turn_interrupted' }, undefined, false)
        return
      }
      const message = toolError instanceof Error ? toolError.message : 'Realtime tool failed'
      turnMeasurement?.mark(`tool_${item.name}_failed`)
      if (turnId === activeTurnIdRef.current) {
        turnFailureRef.current = `tool_${item.name}_failed`
        turnMetadataRef.current = { ...turnMetadataRef.current, tool: item.name, toolError: true }
      }
      returnToolResult(item.call_id, { error: message }, `I couldn't verify that safely. ${message}`, turnId === activeTurnIdRef.current)
    }
  }, [armResponseWatchdog, returnToolResult])

  const handleEvent = useCallback((event: MessageEvent<string>) => {
    let message: RealtimeEvent
    try { message = JSON.parse(event.data) as RealtimeEvent } catch { return }
    if (message.type === 'input_audio_buffer.committed' && message.item_id) {
      if (!inputItemTurnIdsRef.current.has(message.item_id)) {
        inputItemTurnIdsRef.current.set(message.item_id, activeTurnIdRef.current)
      }
      return
    }
    if (message.type === 'input_audio_buffer.speech_started') {
      clearResponseWatchdog()
      clearTranscriptionWatchdog()
      activeTurnIdRef.current += 1
      if (message.item_id) {
        inputItemTurnIdsRef.current.set(message.item_id, activeTurnIdRef.current)
        if (typeof message.audio_start_ms === 'number') {
          speechStartMsByItemRef.current.set(message.item_id, message.audio_start_ms)
        }
      }
      toolControllersRef.current.forEach(controller => controller.abort())
      toolControllersRef.current.clear()
      const interruptedPlayback = assistantSpeakingRef.current
      // WebRTC Realtime owns interruption and remote-audio truncation. Pausing
      // the shared media element here creates a competing per-turn lifecycle,
      // which can strand Firefox's receive graph after repeated exchanges.
      assistantSpeakingRef.current = false
      orbTranscriptRef.current = ''
      currentUtteranceRef.current = ''
      currentUtteranceTurnRef.current = 0
      if (interruptedPlayback) {
        if (interruptionProbeRef.current) {
          window.clearTimeout(interruptionProbeRef.current.timeout)
          interruptionProbeRef.current.measurement.end(false, 'superseded')
        }
        const measurement = startInteraction({
          focus: 'voice', flow: 'voice-realtime-spike-interruption', interaction: 'speech_during_playback',
          surface: 'orb-realtime-spike', immediateFlush: true,
          metadata: { duringPlayback: true },
        })
        measurement.mark('speech_started')
        const timeout = window.setTimeout(() => {
          if (interruptionProbeRef.current?.measurement !== measurement) return
          measurement.end(false, 'no_transcript', { hasTranscript: false })
          interruptionProbeRef.current = null
        }, 8_000)
        interruptionProbeRef.current = { measurement, timeout }
      }
      setStatus('listening')
      turnMeasurementRef.current?.end(false, 'interrupted')
      turnMetadataRef.current = {}
      turnFailureRef.current = null
      turnMeasurementRef.current = startInteraction({
        focus: 'voice', flow: 'voice-realtime-spike', interaction: 'speech_to_mic_return',
        surface: 'orb-realtime-spike', immediateFlush: true,
      })
      turnMeasurementRef.current.mark('speech_started')
      turnMeasurementRef.current.mark('transcription_watchdog_armed')
      armTranscriptionWatchdog(activeTurnIdRef.current)
      return
    }
    if (message.type === 'input_audio_buffer.speech_stopped' && message.item_id) {
      const audioStartMs = speechStartMsByItemRef.current.get(message.item_id)
      if (typeof audioStartMs === 'number' && typeof message.audio_end_ms === 'number') {
        vadDurationMsByItemRef.current.set(message.item_id, Math.max(0, message.audio_end_ms - audioStartMs))
      }
      speechStartMsByItemRef.current.delete(message.item_id)
      return
    }
    if (message.type === 'conversation.item.input_audio_transcription.delta' && message.item_id && message.logprobs?.length) {
      const values = message.logprobs
        .map(entry => entry.logprob)
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      if (values.length) {
        const existing = transcriptionLogprobsByItemRef.current.get(message.item_id) ?? []
        transcriptionLogprobsByItemRef.current.set(message.item_id, [...existing, ...values])
      }
      return
    }
    if (message.type === 'response.created') {
      if (message.response?.id) responseTurnIdsRef.current.set(message.response.id, activeTurnIdRef.current)
      if (responseWatchdogRef.current?.turnId === activeTurnIdRef.current) {
        armResponseWatchdog(activeTurnIdRef.current, 'response_started')
      }
      void probeFirstWebRtcAudio()
      return
    }
    if (message.type === 'conversation.item.input_audio_transcription.completed' && message.transcript?.trim()) {
      const transcript = message.transcript.trim()
      const transcriptTurnId = message.item_id
        ? inputItemTurnIdsRef.current.get(message.item_id)
        : undefined
      const vadAudioMs = message.item_id ? vadDurationMsByItemRef.current.get(message.item_id) : undefined
      const completedLogprobs = message.logprobs
        ?.map(entry => entry.logprob)
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      const logprobs = completedLogprobs?.length
        ? completedLogprobs
        : message.item_id ? transcriptionLogprobsByItemRef.current.get(message.item_id) ?? [] : []
      if (message.item_id) inputItemTurnIdsRef.current.delete(message.item_id)
      if (message.item_id) vadDurationMsByItemRef.current.delete(message.item_id)
      if (message.item_id) transcriptionLogprobsByItemRef.current.delete(message.item_id)
      callbacksRef.current.onUserTranscript(transcript)
      // Transcription is asynchronous. If the user has already started a new
      // utterance, keep the late transcript visible but let only the newest
      // committed audio item create a response or authorize a mutation.
      if (transcriptTurnId !== activeTurnIdRef.current) return
      clearTranscriptionWatchdog()
      const averageLogprob = logprobs.length
        ? logprobs.reduce((total, value) => total + value, 0) / logprobs.length
        : null
      turnMetadataRef.current = {
        ...turnMetadataRef.current,
        ...(typeof vadAudioMs === 'number' ? { vadAudioMs } : {}),
        transcriptionTokenCount: logprobs.length,
        ...(averageLogprob !== null ? {
          transcriptionAverageLogprob: Number(averageLogprob.toFixed(4)),
          transcriptionMinimumLogprob: Number(Math.min(...logprobs).toFixed(4)),
          transcriptionGeometricConfidence: Number(Math.exp(averageLogprob).toFixed(4)),
        } : {}),
      }
      if (interruptionProbeRef.current) {
        window.clearTimeout(interruptionProbeRef.current.timeout)
        interruptionProbeRef.current.measurement.mark('transcript_complete')
        interruptionProbeRef.current.measurement.end(true, null, { hasTranscript: true })
        interruptionProbeRef.current = null
      }
      turnMeasurementRef.current?.mark('transcript_complete')
      turnMeasurementRef.current?.mark('watchdog_armed')
      armResponseWatchdog(activeTurnIdRef.current, 'awaiting_response')
      currentUtteranceRef.current = transcript
      currentUtteranceTurnRef.current = activeTurnIdRef.current
      setStatus('thinking')
      // Server VAD commits the native audio item but never starts the model.
      // Orb creates a response only after the matching transcript exists, so
      // ambient/no-transcript events cannot produce unsolicited speech and
      // the authorization boundary always has the current utterance.
      send({ type: 'response.create' })
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
      const calls = message.response?.output?.filter(item => item.type === 'function_call') ?? []
      // Firefox can surface the next speech_started just before the prior
      // response.done. Never let that stale completion close the new input
      // turn while it is still awaiting transcription. Function-call
      // responses remain valid because providers may emit them before the
      // separate transcription-completed event.
      if (transcriptionWatchdogRef.current !== null && calls.length === 0) {
        turnMeasurementRef.current?.mark('prior_response_done_during_input')
        return
      }
      stopAudioProbe()
      const responseTurnId = message.response?.id
        ? responseTurnIdsRef.current.get(message.response.id) ?? activeTurnIdRef.current
        : activeTurnIdRef.current
      if (message.response?.id) responseTurnIdsRef.current.delete(message.response.id)
      if (responseTurnId !== activeTurnIdRef.current) return
      if (calls.length) calls.forEach(item => { void executeTool(item, responseTurnId) })
      else {
        clearResponseWatchdog()
        assistantSpeakingRef.current = false
        if (startupMeasurementRef.current) {
          startupMeasurementRef.current.end(false, 'no_greeting_audio')
          startupMeasurementRef.current = null
        }
        setStatus('listening')
        turnMeasurementRef.current?.mark('response_done_mic_return')
        const turnFailure = turnFailureRef.current
        turnMeasurementRef.current?.end(!turnFailure, turnFailure, turnMetadataRef.current)
        turnMeasurementRef.current = null
        turnMetadataRef.current = {}
        turnFailureRef.current = null
      }
      return
    }
    if (message.type === 'error') {
      startupMeasurementRef.current?.end(false, 'realtime_error')
      startupMeasurementRef.current = null
      setError(message.error?.message || 'Realtime voice error')
      setStatus('error')
    }
  }, [armResponseWatchdog, armTranscriptionWatchdog, clearResponseWatchdog, clearTranscriptionWatchdog, executeTool, probeFirstWebRtcAudio, send, stopAudioProbe])

  const start = useCallback(async () => {
    if (peerRef.current) return
    setStatus('connecting')
    setError(null)
    const measurement = startInteraction({
      focus: 'voice', flow: 'voice-realtime-spike-start', interaction: 'tap_to_first_webrtc_audio_packet',
      surface: 'orb-realtime-spike', immediateFlush: true,
    })
    try {
      const peer = new RTCPeerConnection()
      peerRef.current = peer
      const audio = document.createElement('audio')
      audio.autoplay = true
      audio.setAttribute('playsinline', '')
      audio.addEventListener('playing', () => {
        assistantSpeakingRef.current = true
        setStatus('speaking')
      })
      audioRef.current = audio
      peer.ontrack = event => {
        audio.srcObject = event.streams[0]
        void audio.play().catch(() => {})
      }

      measurement.mark('microphone_request')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream
      peer.addTrack(stream.getAudioTracks()[0], stream)
      measurement.mark('microphone_ready')

      const channel = peer.createDataChannel('oai-events')
      channelRef.current = channel
      channel.addEventListener('message', handleEvent)
      const openPromise = new Promise<void>((resolve, reject) => {
        channel.addEventListener('open', () => resolve(), { once: true })
        channel.addEventListener('error', () => reject(new Error('Realtime data channel failed')), { once: true })
      })
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      measurement.mark('sdp_offer_ready')
      const response = await fetch('/api/orb-realtime/session', {
        method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: offer.sdp,
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Could not start Realtime voice')
      }
      await peer.setRemoteDescription({ type: 'answer', sdp: await response.text() })
      await openPromise
      measurement.mark('data_channel_open')
      startupMeasurementRef.current = measurement
      setStatus('listening')
      send({
        type: 'response.create',
        response: { instructions: 'Greet the user briefly and naturally, then ask what they would like to tackle. Do not state any task or project facts.' },
      })
    } catch (startError) {
      if (startupMeasurementRef.current === measurement) startupMeasurementRef.current = null
      const message = startError instanceof Error ? startError.message : 'Could not start Realtime voice'
      const errorName = startError instanceof Error ? startError.name : 'UnknownError'
      measurement.end(false, 'start_failed', { errorName, errorMessage: message.slice(0, 240) })
      setError(message)
      setStatus('error')
      channelRef.current?.close()
      peerRef.current?.close()
      streamRef.current?.getTracks().forEach(track => track.stop())
      channelRef.current = null; peerRef.current = null; streamRef.current = null
    }
  }, [handleEvent, send])

  useEffect(() => stop, [stop])

  return { status, error, active: status !== 'off' && status !== 'error', start, stop }
}
