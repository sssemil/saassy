# common-saas-template

Opinionated starter template for single-tenant SaaS products. Rust (Axum + SQLx) backend with a Next.js UI, passwordless magic-link auth, Google and Twitter OAuth, Redis-backed rate limits, and Postgres persistence. Deploy with Docker Compose.

Built on top of [`dokustatus`](https://github.com/sssemil/dokustatus)'s clean-architecture skeleton, with auth improvements ported from the `reauth` project (stripped of multi-tenant / hosted-service concerns).

## Status

Work in progress. Currently: bootstrap complete — dokustatus domain code removed, crate renamed, infra rewired. Next: port Google OAuth, Twitter OAuth, Caddy TLS, and a minimal login/dashboard UI.

## Notices
- Legal pages under `apps/ui/app/[lang]/{impressum,privacy,terms}` still contain placeholder text from the upstream project. Replace before deploying.
- Licensed under MIT (see `LICENSE`).
