import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // Allow server actions
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
}

export default nextConfig
