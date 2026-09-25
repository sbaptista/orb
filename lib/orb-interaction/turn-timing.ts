export type OrbTurnTimingStage = {
  name: string
  atMs: number
}

export type OrbTurnTimingSnapshot = {
  startedAt: string
  durationMs: number
  stages: OrbTurnTimingStage[]
}

function monotonicNow() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

/**
 * A small monotonic recorder shared by the conversation coordinator and its
 * deterministic verifier. Stage names describe completed boundaries; the
 * difference between adjacent atMs values is the time spent in that step.
 */
export function createOrbTurnTiming(startedAt = new Date().toISOString()) {
  const startMs = monotonicNow()
  const stages: OrbTurnTimingStage[] = [{ name: 'request_received', atMs: 0 }]

  return {
    mark(name: string) {
      if (!/^[a-z0-9_.-]{1,80}$/i.test(name) || stages.length >= 80) return
      stages.push({ name, atMs: Math.round((monotonicNow() - startMs) * 10) / 10 })
    },
    snapshot(): OrbTurnTimingSnapshot {
      return {
        startedAt,
        durationMs: Math.round(monotonicNow() - startMs),
        stages: [...stages],
      }
    },
  }
}
