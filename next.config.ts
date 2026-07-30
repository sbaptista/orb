import type { NextConfig } from "next";

const REQUIRED_ENV = ['OPENAI_API_KEY', 'ELEVENLABS_API_KEY'] as const
const missing = REQUIRED_ENV.filter(k => !process.env[k])
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
}

const nextConfig: NextConfig = {
  // Dev-only cross-origin allowlist, so iPad and iPhone can reach the dev
  // server over the LAN (it binds 0.0.0.0:3001 with --experimental-https).
  //
  // Previously six hand-added entries that grew every time the Mac's DHCP
  // lease changed, leaving permanent grants to addresses that now belong to
  // some other device on some other network. Half of them were also dead:
  // Next passes a HOSTNAME to the matcher, so the 'https://…:3001' forms
  // could never match anything.
  //
  // Wildcards verified against the matcher itself
  // (next/dist/esm/server/app-render/csrf-protection.js): matchWildcardDomain
  // splits on '.' and compares segments right-to-left, and only rejects a
  // single-part '*'/'**' pattern — so octet wildcards on an IP work exactly
  // like subdomain wildcards on a name. The published docs only show the
  // '*.example.com' form, which is why this is worth recording.
  //
  //   192.168.*.*  home and office LANs
  //   172.20.10.*  iPhone Personal Hotspot (Apple's fixed subnet)
  //
  // Deliberately not 10.*.*.* — no device here has used that range, and an
  // unused range is a grant with no purpose.
  allowedDevOrigins: ['192.168.*.*', '172.20.10.*'],
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
