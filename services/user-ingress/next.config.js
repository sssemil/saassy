/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // In production behind Caddy, /api/* is routed to user-gateway at the edge.
  // This rewrite is for local dev when running this service standalone without Caddy.
  async rewrites() {
    const apiBase = process.env.USER_GATEWAY_URL || 'http://localhost:3001'
    return [{ source: '/api/:path*', destination: `${apiBase}/api/:path*` }]
  },
}

module.exports = nextConfig
