import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // @kroex/api is a workspace package shipped as TypeScript source (so web,
  // mobile and desktop all consume one copy); Next must transpile it.
  transpilePackages: ['@kroex/api'],
  experimental: { serverActions: { allowedOrigins: ['*'] } },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }
    ]
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
      ]
    }
  ]
}
export default nextConfig
