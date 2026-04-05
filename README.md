# common-saas-template

Opinionated starter template for single-tenant SaaS products, split into
reusable microservice containers. Passwordless magic-link auth, admin panel
with impersonation + audit log, Rust API, Next.js UIs, Postgres + Redis, all
fronted by Caddy.

The goal is that **you don't rebuild auth + admin for every new project**.
You clone this repo, replace `services/project-web/` with your own frontend,
and the rest of the stack — `user-gateway`, `user-ingress`, `admin-ui` —
comes along as prebuilt containers you never touch.

## Architecture

```
                       ┌────────────┐
                       │   Caddy    │  :80 (dev) / :443 (prod, auto TLS)
                       └─────┬──────┘
                             │
        ┌────────────────────┼──────────────────┬──────────────┐
        │                    │                  │              │
        ▼                    ▼                  ▼              ▼
 ┌──────────────┐  ┌──────────────────┐  ┌────────────┐  ┌────────────┐
 │ user-gateway │  │   user-ingress   │  │  admin-ui  │  │ project-web│
 │   (Rust)     │  │    (Next.js)     │  │ (Next.js)  │  │ (Next.js)  │
 │              │  │                  │  │            │  │            │
 │  /api/*      │  │  /login /magic   │  │  /admin*   │  │  /  /*     │
 │              │  │  /profile*       │  │            │  │  /dashboard│
 └──────┬───────┘  └────────┬─────────┘  └─────┬──────┘  └─────┬──────┘
        │                   │                  │               │
        └── HTTP ─┬─────────┴──────────────────┴───────────────┘
                  │   (downstream UIs forward cookies to /api/auth/verify)
                  ▼
         ┌─────────────────┐
         │ Postgres + Redis│
         └─────────────────┘
```

| Service         | Role                                                         | Reusable? |
|-----------------|--------------------------------------------------------------|-----------|
| `user-gateway`  | Rust API: auth, user CRUD, admin, audit                      | yes       |
| `user-ingress`  | Next.js UI for end-user auth + profile                       | yes, optional |
| `admin-ui`      | Next.js admin panel (users, audit, impersonation)            | yes, optional |
| `project-web`   | Next.js project-specific frontend — **you replace this**     | no        |
| `caddy`         | Single reverse proxy, same-origin routing, auto HTTPS in prod| yes       |
| `postgres`      | Storage                                                      | yes       |
| `redis`         | Magic-link tokens, rate limiting                             | yes       |

**Inter-service auth**: project-web (or any downstream) checks who the user is
by forwarding their cookies to `GET /api/auth/verify` on user-gateway. No
shared secrets, no JWT decoding in downstream services, revocation is
immediate because user-gateway loads the user from DB on every verify.

## Quick start

```bash
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD, JWT_SECRET, ADMIN_EMAILS
docker compose up -d --build
```

Visit:

- `http://localhost/` → project-web landing page
- `http://localhost/login` → magic-link sign in
- `http://localhost/dashboard` → auth-gated example page
- `http://localhost/profile` → your account
- `http://localhost/admin` → admin panel (only works if your email is in `ADMIN_EMAILS`)

The first time you sign in with a magic link:

1. Enter your email on `/login`.
2. Check user-gateway logs for the magic link URL (or configure a real
   `RESEND_API_KEY` in `.env` to receive actual emails).
   ```bash
   docker compose logs -f user-gateway
   ```
3. Click the link → redirected into the app with a session cookie.
4. If your email is listed in `ADMIN_EMAILS`, you're auto-promoted to admin on
   that first login.

## Starting a new project from this template

1. Fork this repo or use it as a template on GitHub.
2. **Leave alone**: `services/user-gateway`, `services/user-ingress`,
   `services/admin-ui`, `infra/caddy`, `docker-compose.yml`.
3. **Replace**: `services/project-web/` with your own Next.js (or other)
   frontend. The integration is just two things:
   - Forward cookies to `user-gateway` when you need to check identity. See
     `services/project-web/app/lib/api-fetch.ts` and
     `services/project-web/app/dashboard/page.tsx` for the one pattern that
     matters.
   - Route `/api/*`, `/login`, `/magic`, `/profile*`, `/admin*`, `/callback/*`
     to the respective services via Caddy (already configured — you only touch
     `infra/caddy/Caddyfile` if you add new routes).
4. Rebuild & run: `docker compose up -d --build`.

## Services

### `services/user-gateway/` (Rust, Axum, SQLx)

The core API. Owns the `users` and `admin_audit_log` tables and Redis
magic-link tokens.

Endpoints:

- `POST /api/auth/request` — send a magic link
- `POST /api/auth/consume` — consume a magic link, issue session cookies
- `GET  /api/auth/verify` — return user info if authenticated (used by
  downstream services for identity checks)
- `POST /api/auth/logout`
- `DELETE /api/user/delete`
- `GET  /api/admin/me`
- `GET  /api/admin/stats`
- `GET  /api/admin/users[?q&limit&offset]`
- `GET  /api/admin/users/:id`
- `POST /api/admin/users/:id/freeze`
- `POST /api/admin/users/:id/unfreeze`
- `DELETE /api/admin/users/:id`
- `POST /api/admin/users/:id/impersonate`
- `GET  /api/admin/audit[?limit&offset]`

Migrations run automatically on startup via `sqlx::migrate!`.

### `services/user-ingress/` (Next.js)

Optional. End-user auth and profile UI:

- `/login` — magic-link form
- `/magic` — magic-link consumer callback
- `/profile` — user info + delete account
- `/callback/*` — reserved for OAuth (Google/Twitter, future)

Remove from `docker-compose.yml` if you want to serve these pages yourself.

### `services/admin-ui/` (Next.js)

Optional. Admin panel:

- `/admin` — overview stats
- `/admin/users` — searchable user list
- `/admin/users/[id]` — user detail with freeze/unfreeze/delete/impersonate
- `/admin/audit` — audit log

Guarded by checking `is_admin` via user-gateway. Remove from
`docker-compose.yml` for a CLI-only admin story.

### `services/project-web/` (Next.js)

The thing you replace per project. Ships with:

- `/` — landing page with links to the other services
- `/dashboard` — auth-gated example that calls `verify` and shows the user
- `/[lang]/{impressum,privacy,terms}` — legal page stubs (i18n example, delete
  if you don't need it)

## Development without Docker

Each service can run standalone:

```bash
# user-gateway
cd services/user-gateway
export DATABASE_URL=postgres://... REDIS_URL=redis://... JWT_SECRET=... RESEND_API_KEY=... EMAIL_FROM=... APP_ORIGIN=http://localhost:3000
cargo run

# any of the Next.js services (requires user-gateway running on :3001)
cd services/user-ingress   # or admin-ui or project-web
npm install
USER_GATEWAY_URL=http://localhost:3001 npm run dev
```

Without Caddy in the picture you lose same-origin cookie sharing, so you'll
want to hit only one UI service at a time or set up Caddy anyway.

## Notices

- Legal pages under `services/project-web/app/[lang]/{impressum,privacy,terms}`
  contain placeholder text. Replace before deploying to real users.
- Licensed under MIT (see `LICENSE`).
