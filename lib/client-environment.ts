export const CLIENT_PLATFORMS = ['mac', 'ipad', 'iphone', 'unknown'] as const

export type ClientPlatform = typeof CLIENT_PLATFORMS[number]
export type ModelRequestPlatform = ClientPlatform | 'server'

export type ClientEnvironmentSnapshot = {
  platform: ClientPlatform
  browser: string
  viewport: {
    width: number
    height: number
    dpr: number
    pointer: 'coarse' | 'fine' | 'unknown'
    hover: 'hover' | 'none' | 'unknown'
    standalone: boolean
  }
}

export function classifyClientPlatform(input: {
  userAgent: string
  navigatorPlatform: string
  touchPoints: number
  width: number
  coarsePointer: boolean
}): ClientPlatform {
  if (/iPhone|iPod/.test(input.userAgent) || input.navigatorPlatform === 'iPhone' || input.navigatorPlatform === 'iPod' || input.width <= 767) return 'iphone'
  if (/iPad/.test(input.userAgent) || input.navigatorPlatform === 'iPad' || (input.navigatorPlatform === 'MacIntel' && input.touchPoints > 1) || input.coarsePointer) return 'ipad'
  return 'mac'
}

export function collectClientEnvironment(): ClientEnvironmentSnapshot {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      platform: 'unknown',
      browser: 'unknown',
      viewport: { width: 0, height: 0, dpr: 1, pointer: 'unknown', hover: 'unknown', standalone: false },
    }
  }

  const ua = navigator.userAgent
  const navigatorPlatform = navigator.platform
  const touchPoints = navigator.maxTouchPoints || 0
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const platform = classifyClientPlatform({
    userAgent: ua,
    navigatorPlatform,
    touchPoints,
    width: window.innerWidth,
    coarsePointer: coarse,
  })

  const browser = /Edg\//.test(ua) ? 'Edge'
    : /CriOS|Chrome\//.test(ua) ? 'Chrome'
      : /Safari\//.test(ua) ? 'Safari'
        : /Firefox\//.test(ua) ? 'Firefox'
          : 'unknown'

  return {
    platform,
    browser,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
      pointer: coarse ? 'coarse' : 'fine',
      hover: window.matchMedia('(hover: hover)').matches ? 'hover' : 'none',
      standalone: window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    },
  }
}

export function sanitizeModelRequestPlatform(value: unknown): ModelRequestPlatform {
  if (value === 'server') return value
  return CLIENT_PLATFORMS.includes(value as ClientPlatform) ? value as ClientPlatform : 'unknown'
}
