import type { NextConfig } from "next";

const REQUIRED_ENV = ['OPENAI_API_KEY', 'ELEVENLABS_API_KEY'] as const
const missing = REQUIRED_ENV.filter(k => !process.env[k])
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
}

function getAllowedDevOrigins(): string[] {
  const rawOrigins = process.env.ORB_DEV_ALLOWED_ORIGINS?.split(',') ?? []
  const origins = rawOrigins.map(origin => origin.trim()).filter(Boolean)
  const validHostname = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/i
  const validIpv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/

  for (const origin of origins) {
    if (!validHostname.test(origin) && !validIpv4.test(origin)) {
      throw new Error(`Invalid ORB_DEV_ALLOWED_ORIGINS hostname: ${origin}`)
    }
  }

  return [...new Set(origins)]
}

const nextConfig: NextConfig = {
  // orb-dev supplies only the Mac's current mDNS hostname and LAN address.
  // No permanent subnet wildcard remains when the Mac changes networks.
  allowedDevOrigins: getAllowedDevOrigins(),
  devIndicators: process.env.NODE_ENV === 'production' ? false : undefined,
  outputFileTracingRoot: process.cwd(),
  async headers() {
    return [
      {
        source: '/vad/0.0.30/:asset*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
