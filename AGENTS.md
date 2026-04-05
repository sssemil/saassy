# Repository Guidelines

saassy is a microservice template: one Rust API (`user-gateway`) + three
Next.js UIs (`user-ingress`, `admin-ui`, `project-web`), fronted by Caddy.
Follow the conventions below to stay consistent.

## Project structure

```
services/
  user-gateway/    Rust (Axum + SQLx). Owns users, auth, admin, audit.
                   Runs its own migrations on startup via sqlx::migrate!
  user-ingress/    Next.js. /login /magic /profile (optional, reusable)
  admin-ui/        Next.js. /admin/* (optional, reusable)
  project-web/     Next.js. Per-project landing + /dashboard example
infra/caddy/       Caddyfile, single reverse proxy / entry point
docs/              Static GitHub Pages site served at saassy.xyz
.github/workflows/ CI, Docker Hub publish, Pages deploy
docker-compose.yml Boots all 7 containers (4 services + postgres + redis + caddy)
```

Each service is a standalone container with its own `Dockerfile` and its own
lockfile. No workspace-level Cargo or pnpm workspace — services are
deliberately decoupled so they can be extracted per-project.

## Build, test, and development commands

Local stack via compose (recommended):
- `cp .env.example .env` then edit `POSTGRES_PASSWORD` and `JWT_SECRET`
- `docker compose up -d --build` — boots the full stack at `http://localhost` (or `CADDY_HTTP_PORT`)
- `docker compose logs -f user-gateway` — tail logs (magic links show up here)
- `docker compose down -v` — stop and wipe volumes

Standalone per service:
- user-gateway (`cd services/user-gateway`):
  - `SQLX_OFFLINE=true cargo check --all-targets`
  - `cargo fmt` / `cargo clippy --all-targets -- -D warnings`
  - `cargo test` (offline by default; no DB needed for unit tests)
  - `cargo sqlx prepare` — refresh `.sqlx` offline cache after query changes (needs a live DB via `DATABASE_URL`)
  - `cargo run` — start the binary; binds to `BIND_ADDR`, reads `.env`
- Next.js services (`cd services/<name>`):
  - `npm install`
  - `npx tsc --noEmit` / `npx next build`
  - `USER_GATEWAY_URL=http://localhost:3001 npm run dev`

CI: `.github/workflows/ci.yml` runs fmt/check/clippy/test for user-gateway
and tsc/next-build for the three Next.js services on every push and PR.

## Coding style

- **Rust**: 2024 edition. Always `cargo fmt` before committing. Clippy with
  `-D warnings` is enforced in CI. Clean architecture layers under
  `src/{domain,application,adapters,infra}`. Errors are typed enums in
  `application/app_error.rs`; never return free-form error strings.
  SQL queries use `sqlx::query!` / `sqlx::query_as!` macros (compile-time
  checked against the `.sqlx` offline cache).
- **TypeScript**: Strict mode. Functional React components. Server components
  for auth-gated pages (use `serverApiFetch` from `app/lib/api-fetch.ts`,
  which forwards cookies to user-gateway). Client components only when you
  need state or event handlers.
- **HTTP boundary**: Response shapes are defined by plain structs in the
  Rust handlers (`adapters/http/routes/`). When you change them, update the
  Next.js consumers in the same commit.

## Testing

- Rust: co-located `#[cfg(test)]` modules. Prefer pure unit tests for
  use_cases. For DB tests, spin up a postgres via `docker compose up -d postgres`
  and use `sqlx::query!` against a test schema. Run with `cargo test` from
  `services/user-gateway`.
- Next.js: no framework wired yet. Prefer React Testing Library if adding.
- End-to-end: smoke-test the full stack by running `docker compose up -d`
  and hitting `http://localhost/login`, `/dashboard`, `/admin` as documented
  in the commit history (see the admin panel and microservices commits).

## Security & config

- Never commit secrets. `.env` is gitignored; `.env.example` at the repo root
  is the single source of truth for required variables.
- `JWT_SECRET` and `POSTGRES_PASSWORD` are required (`:?` in `docker-compose.yml`
  will fail fast if unset).
- `ADMIN_EMAILS` grants admin on magic-link sign-in only — revocation is
  SQL-only (`UPDATE users SET is_admin=false`). This is deliberate: rotating
  the env var can't lock operators out.
- All mutating admin endpoints write to `admin_audit_log`.
- `cargo-audit` and `npm audit` are wired into CI; CVEs fail the build.

## Commit & PR guidelines

- Short, imperative summaries (`add impersonation guard for admin target`,
  `bump next to 16.2.2 for CSRF fix`). No conventional-commit prefixes
  required but not forbidden.
- PRs: brief description, list of commands/tests run, schema-change callout
  if applicable, screenshots for UI changes.
