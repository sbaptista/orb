import type { NextConfig } from "next";

const REQUIRED_ENV = ['OPENAI_API_KEY', 'ELEVENLABS_API_KEY'] as const
const missing = REQUIRED_ENV.filter(k => !process.env[k])
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.86.90', 'https://192.168.86.90:3001', '172.20.10.3', 'https://172.20.10.3:3001', '192.168.99.36', 'https://192.168.99.36:3001'],
  devIndicators: process.env.NODE_ENV === 'production' ? false : undefined,
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
