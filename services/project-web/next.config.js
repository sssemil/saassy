/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // In production, Caddy routes /api/*, /admin/*, /login, /magic, /profile/*, /callback/*
  // to other services at the edge. This rewrite is the dev fallback when running standalone.
  async rewrites() {
    const apiBase = process.env.USER_GATEWAY_URL || 'http://localhost:3001'
    return [{ source: '/api/:path*', destination: `${apiBase}/api/:path*` }]
  },
}

module.exports = nextConfig
