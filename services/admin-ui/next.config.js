/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Routes live natively under /admin/* in this service's app/ directory,
  // so Caddy's plain reverse_proxy with no prefix stripping works out of the box.
  async rewrites() {
    const apiBase = process.env.USER_GATEWAY_URL || 'http://localhost:3001'
    return [{ source: '/api/:path*', destination: `${apiBase}/api/:path*` }]
  },
}

module.exports = nextConfig
