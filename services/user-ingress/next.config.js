/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // When sharing a domain with other Next.js apps behind one reverse proxy,
  // set NEXT_PUBLIC_ASSET_PREFIX at build time (e.g. '/_ui/ingress') so
  // /_next/static/* requests don't collide. The proxy strips the prefix
  // via handle_path before forwarding.
  assetPrefix: process.env.NEXT_PUBLIC_ASSET_PREFIX || undefined,
  // In production behind Caddy, /api/* is routed to user-gateway at the edge.
  // This rewrite is for local dev when running this service standalone without Caddy.
  async rewrites() {
    const apiBase = process.env.USER_GATEWAY_URL || "http://localhost:3001";
    return [{ source: "/api/:path*", destination: `${apiBase}/api/:path*` }];
  },
};

module.exports = nextConfig;
