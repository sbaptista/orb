'use client'

import { useState, useEffect, useCallback } from 'react'

export type PlatformId = 'ios' | 'ipados' | 'macos' | 'windows' | 'android' | 'other'
export type BrowserId = 'safari' | 'chrome' | 'edge' | 'firefox' | 'other'
type CapabilityStatus = 'available' | 'unavailable'
type MicPermission = 'granted' | 'prompt' | 'denied' | 'unknown'

export type Capabilities = {
  platform: PlatformId
  browser: BrowserId
  speech: {
    recognition: CapabilityStatus
    recognitionPath: 'native' | 'server' | 'unavailable'
    synthesis: CapabilityStatus
    audioContext: CapabilityStatus
    microphone: MicPermission
    continuous: boolean
  }
  voice: 'full' | 'degraded' | 'unavailable'
  warnings: string[]
}

function detectPlatform(): PlatformId {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  if (/iPhone|iPod/.test(ua)) return 'ios'
  if (/iPad/.test(ua)) return 'ipados'
  if (/Macintosh|Mac OS X/.test(ua)) return 'macos'
  if (/Windows/.test(ua)) return 'windows'
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

function detectBrowser(): BrowserId {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  if (ua.includes('CriOS/')) return 'chrome'
  if (ua.includes('FxiOS/')) return 'firefox'
  if (ua.includes('EdgA/') || ua.includes('Edg/')) return 'edge'
  if (ua.includes('Chrome/') && !ua.includes('Chromium/')) return 'chrome'
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'safari'
  if (ua.includes('Firefox/')) return 'firefox'
  return 'other'
}

function hasSpeechRecognition(): boolean {
  if (typeof window === 'undefined') return false
  return !!(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  )
}

function hasSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function hasAudioContext(): boolean {
  if (typeof window === 'undefined') return false
  return !!(
    (window as any).AudioContext ||
    (window as any).webkitAudioContext
  )
}

function hasServerRecognitionFallback(browser: BrowserId): boolean {
  return browser === 'firefox'
    && typeof window !== 'undefined'
    && typeof MediaRecorder !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
}

function isIOSPlatform(p: PlatformId): boolean {
  return p === 'ios' || p === 'ipados'
}

function microphoneRecoveryMessage(platform: PlatformId, browser: BrowserId): string {
  if (isIOSPlatform(platform) && browser === 'safari') {
    return 'Microphone access is blocked. In Safari, open the Page menu, choose Website Settings, set Microphone to Allow, then reload Orb.'
  }
  if (browser === 'safari') {
    return 'Microphone access is blocked. In Safari, choose Safari > Settings for This Website, set Microphone to Allow, then reload Orb.'
  }
  if (browser === 'chrome' || browser === 'edge') {
    const name = browser === 'edge' ? 'Edge' : 'Chrome'
    return `Microphone access is blocked. In ${name}, open the site controls beside the address, allow Microphone, then reload Orb.`
  }
  if (browser === 'firefox') {
    return 'Microphone access is blocked. In Firefox, open the permissions icon beside the address, allow Microphone, then reload Orb.'
  }
  return 'Microphone access is blocked. Allow microphone access for this site in your browser settings, then reload Orb.'
}

function buildWarnings(
  platform: PlatformId,
  browser: BrowserId,
  recognitionPath: 'native' | 'server' | 'unavailable',
  mic: MicPermission,
): string[] {
  const warnings: string[] = []

  if (isIOSPlatform(platform) && browser !== 'safari') {
    if (recognitionPath === 'unavailable') {
      warnings.push('Voice input is not available in this browser on iOS. Use Safari for voice mode.')
    }
  } else if (recognitionPath === 'unavailable') {
    warnings.push('Voice input is not available in this browser.')
  }

  if (mic === 'denied') {
    warnings.push(microphoneRecoveryMessage(platform, browser))
  }

  return warnings
}

function computeVoiceOverall(
  recognition: CapabilityStatus,
  serverRecognition: boolean,
  synthesis: CapabilityStatus,
  audioContext: CapabilityStatus,
  hasApiTts: boolean,
): 'full' | 'degraded' | 'unavailable' {
  if (recognition === 'unavailable' && !serverRecognition) return 'unavailable'
  const hasOutput = synthesis === 'available' || (hasApiTts && audioContext === 'available')
  if (!hasOutput) return 'unavailable'
  return 'full'
}

export function useCapabilities(hasApiTts: boolean = false): Capabilities {
  const [mic, setMic] = useState<MicPermission>('unknown')

  const platform = detectPlatform()
  const browser = detectBrowser()
  const recognition: CapabilityStatus = hasSpeechRecognition() ? 'available' : 'unavailable'
  const serverRecognition = hasServerRecognitionFallback(browser)
  const recognitionPath = recognition === 'available' ? 'native' : serverRecognition ? 'server' : 'unavailable'
  const synthesis: CapabilityStatus = hasSpeechSynthesis() ? 'available' : 'unavailable'
  const audioContext: CapabilityStatus = hasAudioContext() ? 'available' : 'unavailable'
  const continuous = !isIOSPlatform(platform)

  const queryMicPermission = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.permissions) {
      setMic('unknown')
      return
    }
    try {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      setMic(status.state as MicPermission)
      status.onchange = () => setMic(status.state as MicPermission)
    } catch {
      setMic('unknown')
    }
  }, [])

  useEffect(() => {
    queryMicPermission()
  }, [queryMicPermission])

  const voice = computeVoiceOverall(recognition, serverRecognition, synthesis, audioContext, hasApiTts)
  const warnings = buildWarnings(platform, browser, recognitionPath, mic)

  useEffect(() => {
    console.log('[capabilities]', {
      platform, browser, recognition, recognitionPath, synthesis, audioContext, mic, continuous, voice,
      hasSpeechRecognition: typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition),
      hasGetUserMedia: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
      warnings,
    })
  }, [platform, browser, recognition, recognitionPath, synthesis, audioContext, mic, continuous, voice, warnings])

  return {
    platform,
    browser,
    speech: { recognition, recognitionPath, synthesis, audioContext, microphone: mic, continuous },
    voice,
    warnings,
  }
}
