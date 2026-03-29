import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '..'),
  webpack: (config, { isServer }) => {
    config.resolve = config.resolve ?? {}
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@react-native-async-storage/async-storage': false,
    }
    config.resolve.fallback = {
      ...(config.resolve.fallback ?? {}),
      fs: false,
      net: false,
      path: false,
      tls: false,
    }

    if (isServer) {
      const externals = Array.isArray(config.externals) ? config.externals : []
      config.externals = [...externals, 'pino-pretty', 'lokijs', 'encoding']
    }

    return config
  },
}

export default nextConfig
