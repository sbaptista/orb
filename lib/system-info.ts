export type SystemInfo = {
  browser: string
  os: string
  os_version: string
  viewport: string
}

export function collectSystemInfo(): SystemInfo {
  const ua = navigator.userAgent
  return {
    browser: parseBrowser(ua),
    os: parseOS(ua),
    os_version: parseOSVersion(ua),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  }
}

function parseBrowser(ua: string): string {
  if (ua.includes('CriOS/')) return 'Chrome iOS ' + extract(ua, /CriOS\/([\d.]+)/)
  if (ua.includes('FxiOS/')) return 'Firefox iOS ' + extract(ua, /FxiOS\/([\d.]+)/)
  if (ua.includes('EdgA/') || ua.includes('Edg/')) return 'Edge ' + extract(ua, /Edg[eA]?\/([\d.]+)/)
  if (ua.includes('OPR/') || ua.includes('Opera/')) return 'Opera ' + extract(ua, /OPR\/([\d.]+)/)
  if (ua.includes('Chrome/') && !ua.includes('Chromium/')) return 'Chrome ' + extract(ua, /Chrome\/([\d.]+)/)
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari ' + extract(ua, /Version\/([\d.]+)/)
  if (ua.includes('Firefox/')) return 'Firefox ' + extract(ua, /Firefox\/([\d.]+)/)
  return ua.slice(0, 60)
}

function parseOS(ua: string): string {
  if (ua.includes('iPhone') || ua.includes('iPad')) return ua.includes('iPad') ? 'iPadOS' : 'iOS'
  if (ua.includes('Mac OS X') || ua.includes('Macintosh')) return 'macOS'
  if (ua.includes('Android')) return 'Android'
  if (ua.includes('Windows')) return 'Windows'
  if (ua.includes('Linux')) return 'Linux'
  if (ua.includes('CrOS')) return 'ChromeOS'
  return 'Unknown'
}

function parseOSVersion(ua: string): string {
  if (ua.includes('iPhone OS') || ua.includes('iPad')) return extract(ua, /OS ([\d_]+)/).replace(/_/g, '.')
  if (ua.includes('Mac OS X')) return extract(ua, /Mac OS X ([\d._]+)/).replace(/_/g, '.')
  if (ua.includes('Android')) return extract(ua, /Android ([\d.]+)/)
  if (ua.includes('Windows NT')) {
    const nt = extract(ua, /Windows NT ([\d.]+)/)
    const map: Record<string, string> = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' }
    return map[nt] ?? nt
  }
  return ''
}

function extract(ua: string, re: RegExp): string {
  return ua.match(re)?.[1] ?? ''
}
