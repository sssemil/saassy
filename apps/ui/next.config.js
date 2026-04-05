/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // In local dev, proxy /api/* to the Rust backend so the UI can call
    // same-origin endpoints without CORS. In production, a reverse proxy
    // (Caddy/nginx) handles this.
    const apiBase = process.env.API_BASE || 'http://localhost:3001'
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
