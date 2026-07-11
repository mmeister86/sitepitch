import type { NextConfig } from "next"

function normalizeHost(value: string | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.replace(/\/+$/, "")
}

const rybbitHost = normalizeHost(process.env.NEXT_PUBLIC_RYBBIT_HOST)

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    if (!rybbitHost) {
      return []
    }
    return [
      {
        source: "/analytics/script.js",
        destination: `${rybbitHost}/api/script.js`,
      },
      {
        source: "/analytics/track",
        destination: `${rybbitHost}/api/track`,
      },
    ]
  },
}

export default nextConfig
