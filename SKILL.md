---
name: saassy
description: >-
  Add passwordless magic-link auth, user management, and an admin panel
  (with impersonation + audit log) to a project by running four prebuilt
  Docker containers from tqdminc/* behind Caddy. Use when the user asks
  for login, sign-in, auth, magic links, passwordless, admin panel, or
  user management in a single-tenant SaaS project.
---

# saassy — AI agent integration guide

**saassy** is a microservice-shaped template for the thing every SaaS
project rewrites badly: auth, user CRUD, and admin. Four Docker images
behind Caddy. You drop them into any project, call one HTTP endpoint to
check who the user is, and never touch a JWT library again.

This file is the source of truth for AI agents adding saassy to a user's
project. Read it top to bottom; every code block is copy-paste ready.

Repo: https://github.com/sssemil/saassy
Docs: https://saassy.xyz
Images: https://hub.docker.com/u/tqdminc

---

## Use it

No file on disk needed — pipe this guide directly into your agent and
ask it to act. Run from the root of the project you want to add saassy to:

**Claude Code:**

```bash
curl -fsSL https://saassy.xyz/SKILL.md \
  | claude "Add saassy to this project following the instructions above."
```

**OpenAI Codex CLI:**

```bash
curl -fsSL https://saassy.xyz/SKILL.md \
  | codex "Add saassy to this project following the instructions above."
```

The curl output lands in the agent's stdin and the string after it is the
prompt. The agent reads the guide as context and proceeds with the task.

Already have an agent session open? Just paste:

> Read `https://saassy.xyz/SKILL.md` and follow it to add saassy to this project.

---

## TL;DR

- **What you get**: passwordless magic-link auth (Resend), user CRUD
  (create/list/search/delete/freeze), admin panel with impersonation and
  an append-only audit log, same-origin routing via Caddy.
- **How it runs**: `docker compose up -d`. Four service containers +
  Postgres + Redis + Caddy = a working login system at
  `http://localhost` in ~2 minutes.
- **How you check auth**: from any downstream service, forward the user's
  cookies to `GET user-gateway:3001/api/auth/verify`. Response is
  `{id, email, is_admin}` or 401/403. Never decode JWTs yourself.

---

## When to invoke this skill

Use this skill when the user says any of:

- "add login" / "add auth" / "add sign in"
- "add an admin panel" / "admin users" / "user management"
- "magic link" / "passwordless login"
- "I need to know who the user is in my app"
- "protect this route behind auth"
- "impersonate users" / "log in as another user"
- "audit log of admin actions"
- mentions saassy or tqdminc by name

**Do NOT use this skill when**:

- The user already has a working auth system and wants a small tweak to
  it. (Adding saassy to a project with existing auth is a rewrite, not a
  tweak — be explicit about that before suggesting it.)
- The user needs OAuth-first login (Google, GitHub, Apple). saassy is
  magic-link-only today; OAuth callbacks are scaffolded under
  `user-ingress/app/callback/` but not implemented.
- The user needs multi-tenant hosted auth (one auth service serving many
  customer domains). saassy is deliberately single-tenant. Suggest a
  different approach.
- The user can't run Docker. saassy ships as containers; there's no
  "install from source" path that's supported.

---

## Pre-flight questions to ask the user

Before generating any code, confirm all three:

1. **Is your app single-tenant?** (One operator, one domain, one user
   base. If they're building hosted auth-as-a-service, stop — saassy is
   the wrong fit.)
2. **Can you run Docker in production?** (VPS, Fly, Railway, self-hosted
   k8s, Docker-capable PaaS are all fine. Cloudflare Workers / Vercel
   Edge / pure-static hosts are not.)
3. **Do you want to own the login/profile UI, or use saassy's stock
   `user-ingress` service?** (Most users should start with user-ingress
   and rip it out later if they outgrow it.)

If any answer disqualifies saassy, say so. Don't paper over the mismatch.

---

## The four services

| Service         | Lang         | Role                                                            | Required? |
|-----------------|--------------|-----------------------------------------------------------------|-----------|
| `user-gateway`  | Rust / Axum  | The API. Auth, user CRUD, admin, audit. Owns its Postgres DB.   | **yes**   |
| `user-ingress`  | Next.js      | `/login`, `/magic`, `/profile` — reusable end-user auth UI.     | optional  |
| `admin-ui`      | Next.js      | `/admin/*` — reusable admin panel with impersonation.           | optional  |
| `project-web`   | Next.js      | Landing + the user's own project frontend. **You replace this.**| yes       |

Plus infra: Postgres 16, Redis 7, Caddy 2.

"Optional" means: remove the service from compose if the user wants to
build their own login UI or run an API-only admin (curl against the
endpoints). The core is `user-gateway`; everything else is UI.

---

## Integration mode A: Fork the template

The simplest path if the user is starting fresh or is willing to adopt
saassy's repo layout as their own.

```bash
git clone https://github.com/sssemil/saassy my-project
cd my-project

# Replace project-web/ with the user's actual frontend code later.
# For now, keep it so docker compose has something to serve.

cp .env.example .env
# Edit .env:
#   POSTGRES_PASSWORD=<random>
#   JWT_SECRET=<openssl rand -base64 32>
#   RESEND_API_KEY=<real key, or leave placeholder to see links in logs>
#   EMAIL_FROM=noreply@example.com
#   APP_ORIGIN=http://localhost
#   ADMIN_EMAILS=<the user's email>

docker compose up -d --build
```

Visit `http://localhost/`. Sign in at `/login`. If `RESEND_API_KEY` is a
placeholder, the magic link prints in `docker compose logs -f user-gateway`.

Pros: full ownership. Cons: the user is tracking saassy's `main`; pulling
updates later means git-merging their `project-web/` changes against
upstream.

---

## Integration mode B: Consume prebuilt images (most common)

The user already has a project. Add saassy alongside it.

### Step 1 — add a `docker-compose.saassy.yml` to their repo

Write this file verbatim. It pulls `tqdminc/*` images from Docker Hub; no
saassy source code enters the user's repo.

```yaml
services:
  saassy-postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: saassy
      POSTGRES_PASSWORD: ${SAASSY_POSTGRES_PASSWORD:?set SAASSY_POSTGRES_PASSWORD}
      POSTGRES_DB: user_gateway
    volumes:
      - saassy_postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U saassy"]
      interval: 5s
      retries: 10
    networks: [saassy-net]

  saassy-redis:
    image: redis:7-alpine
    command: ["redis-server", "--save", "", "--appendonly", "no"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 10
    networks: [saassy-net]

  user-gateway:
    image: tqdminc/user-gateway:latest
    environment:
      DATABASE_URL: postgres://saassy:${SAASSY_POSTGRES_PASSWORD}@saassy-postgres:5432/user_gateway
      REDIS_URL: redis://saassy-redis:6379
      JWT_SECRET: ${SAASSY_JWT_SECRET:?set SAASSY_JWT_SECRET}
      RESEND_API_KEY: ${SAASSY_RESEND_API_KEY:-placeholder}
      EMAIL_FROM: ${SAASSY_EMAIL_FROM:-noreply@localhost}
      APP_ORIGIN: ${SAASSY_APP_ORIGIN:-http://localhost}
      CORS_ORIGIN: ${SAASSY_APP_ORIGIN:-http://localhost}
      BIND_ADDR: 0.0.0.0:3001
      ADMIN_EMAILS: ${SAASSY_ADMIN_EMAILS:-}
    depends_on:
      saassy-postgres: { condition: service_healthy }
      saassy-redis:    { condition: service_healthy }
    networks: [saassy-net]

  user-ingress:
    image: tqdminc/user-ingress:latest
    environment:
      USER_GATEWAY_URL: http://user-gateway:3001
    depends_on: [user-gateway]
    networks: [saassy-net]

  admin-ui:
    image: tqdminc/admin-ui:latest
    environment:
      USER_GATEWAY_URL: http://user-gateway:3001
    depends_on: [user-gateway]
    networks: [saassy-net]

  caddy:
    image: caddy:2-alpine
    environment:
      SITE_ADDRESS: ${SAASSY_SITE_ADDRESS:-http://:80}
    ports:
      - "${SAASSY_HTTP_PORT:-80}:80"
      - "${SAASSY_HTTPS_PORT:-443}:443"
    volumes:
      - ./saassy.Caddyfile:/etc/caddy/Caddyfile:ro
      - saassy_caddy_data:/data
      - saassy_caddy_config:/config
    depends_on:
      - user-gateway
      - user-ingress
      - admin-ui
    networks: [saassy-net]

volumes:
  saassy_postgres:
  saassy_caddy_data:
  saassy_caddy_config:

networks:
  saassy-net:
    driver: bridge
```

### Step 2 — add a `saassy.Caddyfile` next to the compose file

```caddy
{$SITE_ADDRESS:http://:80} {
    encode gzip

    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }

    # saassy routes
    handle /api/*     { reverse_proxy user-gateway:3001 }
    handle /admin*    { reverse_proxy admin-ui:3100 }
    handle /login     { reverse_proxy user-ingress:3200 }
    handle /magic     { reverse_proxy user-ingress:3200 }
    handle /profile*  { reverse_proxy user-ingress:3200 }
    handle /callback/* { reverse_proxy user-ingress:3200 }

    # The user's own app — replace the service name with whatever their
    # existing frontend container is called in their base docker-compose.yml.
    handle {
        reverse_proxy my-app:3000
    }
}
```

### Step 3 — add saassy env vars to the user's `.env`

```bash
SAASSY_POSTGRES_PASSWORD=<random>
SAASSY_JWT_SECRET=<openssl rand -base64 32>
SAASSY_RESEND_API_KEY=<real Resend key or "placeholder" for dev>
SAASSY_EMAIL_FROM=noreply@example.com
SAASSY_APP_ORIGIN=http://localhost          # or https://yourdomain.com in prod
SAASSY_ADMIN_EMAILS=you@example.com
# SAASSY_SITE_ADDRESS=yourdomain.com         # prod: set this, Caddy auto-provisions TLS
```

### Step 4 — merge the compose files on boot

```bash
docker compose -f docker-compose.yml -f docker-compose.saassy.yml up -d
```

The user's existing `my-app` service keeps running. Caddy routes
`/api/*`, `/admin*`, `/login`, `/magic`, `/profile*`, `/callback/*` to
saassy. Everything else falls through to `my-app`.

---

## The one pattern that matters: checking auth from downstream code

Every downstream service — the user's frontend, their backend, a worker,
anything — checks who the user is by forwarding cookies to
`GET /api/auth/verify`. Response is **always** one of:

- `200 { "id": "<uuid>", "email": "...", "is_admin": true|false }` — authed
- `401 { "code": "INVALID_CREDENTIALS" }` — no/bad session
- `403 { "code": "ACCOUNT_FROZEN" }` — session exists but user was frozen

**Never decode JWTs yourself. Never share `JWT_SECRET` with downstream
services.** The reasons:

1. Revocation is instant. If an admin freezes or deletes a user,
   user-gateway reloads them from Postgres on the next `verify` and the
   session fails within milliseconds. Local JWT decoding would need
   manual invalidation.
2. No crypto in your code path. One signing key, one validator, in Rust.
3. Schema changes (new fields on `VerifyResponse`) land in one place.

### Next.js (App Router, server component)

The canonical pattern lives at `services/project-web/app/dashboard/page.tsx`.
Copy verbatim for any auth-gated page:

```tsx
import { redirect } from 'next/navigation'
import { serverApiFetch } from '../lib/api-fetch'

type Me = { id: string; email: string; is_admin: boolean }

export default async function DashboardPage() {
  const res = await serverApiFetch('/api/auth/verify')
  if (res.status === 401 || res.status === 403) {
    redirect('/login?next=/dashboard')
  }
  if (!res.ok) throw new Error(`verify failed: ${res.status}`)
  const me: Me = await res.json()

  return <main>Hello, {me.email}. {me.is_admin && '(admin)'}</main>
}
```

`serverApiFetch` is a thin helper that reads the incoming request's
cookies via `next/headers` and forwards them to `user-gateway` over the
internal Docker network. Its source, worth copying into any Next.js
downstream service:

```ts
// app/lib/api-fetch.ts
import { headers, cookies } from 'next/headers'

export async function serverApiFetch(path: string, options?: RequestInit) {
  const base = process.env.USER_GATEWAY_URL || 'http://localhost:3001'
  const url = new URL(path, base).toString()

  const h = await headers()
  const c = await cookies()
  const fetchHeaders: Record<string, string> = {}

  if (options?.headers) {
    new Headers(options.headers).forEach((v, k) => { fetchHeaders[k] = v })
  }
  const cookieHeader = c.getAll().map(ck => `${ck.name}=${ck.value}`).join('; ')
  if (cookieHeader) fetchHeaders['cookie'] = cookieHeader

  return fetch(url, { ...options, headers: fetchHeaders, cache: 'no-store' })
}
```

Set `USER_GATEWAY_URL=http://user-gateway:3001` as an env var on the
user's Next.js container.

### Go (net/http)

```go
req, _ := http.NewRequest("GET", "http://user-gateway:3001/api/auth/verify", nil)
req.Header.Set("Cookie", r.Header.Get("Cookie")) // forward incoming cookies
resp, err := http.DefaultClient.Do(req)
if err != nil || resp.StatusCode != 200 {
    http.Redirect(w, r, "/login", http.StatusFound); return
}
var me struct{ ID, Email string; IsAdmin bool `json:"is_admin"` }
json.NewDecoder(resp.Body).Decode(&me)
```

### Python (requests / httpx)

```python
r = httpx.get("http://user-gateway:3001/api/auth/verify",
              headers={"Cookie": request.headers.get("cookie", "")})
if r.status_code != 200:
    return redirect("/login")
me = r.json()   # {"id": ..., "email": ..., "is_admin": ...}
```

### Raw HTTP (any language)

```
GET /api/auth/verify HTTP/1.1
Host: user-gateway:3001
Cookie: access_token=eyJ...; refresh_token=eyJ...

HTTP/1.1 200 OK
Content-Type: application/json
{"id":"...","email":"...","is_admin":false}
```

---

## Adding a project-specific backend behind Caddy

The user's own API service goes behind the same Caddy, authenticated the
same way. Sketch:

```yaml
# In the user's docker-compose.yml or docker-compose.saassy.yml
services:
  my-api:
    build: ./api
    environment:
      USER_GATEWAY_URL: http://user-gateway:3001
    networks: [saassy-net]  # same network so it can reach user-gateway
```

Add a route in `saassy.Caddyfile` **above** the catch-all `handle { ... }`
block:

```caddy
handle /myapi/* {
    reverse_proxy my-api:8000
}
```

In `my-api`'s request handlers, call
`http://user-gateway:3001/api/auth/verify` with the incoming `Cookie`
header (see the language examples above). Reject with 401 on non-200.

---

## Admin provisioning

Admins are provisioned via the `ADMIN_EMAILS` environment variable:

```bash
ADMIN_EMAILS=alice@example.com,bob@example.com
```

**Semantics**:

- On each magic-link login, user-gateway checks whether the logged-in
  email is in `ADMIN_EMAILS`. If yes and the user isn't already an admin,
  `is_admin = true` is set on their row.
- **Grant-on-login only.** Removing an email from `ADMIN_EMAILS` does
  **not** revoke admin. To revoke:

  ```sql
  UPDATE users SET is_admin = false WHERE email = 'alice@example.com';
  ```

  Reach the DB via `docker compose exec saassy-postgres psql -U saassy -d user_gateway`.

- This is deliberate. Rotating an env var must not be able to lock the
  operator out of their own admin panel.

- Admins see `/admin/*` (served by `admin-ui`). Non-admins get 403.

---

## Required env vars reference

Source of truth: `services/user-gateway/src/infra/config.rs`.

**Required** — user-gateway panics on startup if unset:

| Var               | Example                                           | What it does                                          |
|-------------------|---------------------------------------------------|-------------------------------------------------------|
| `JWT_SECRET`      | `$(openssl rand -base64 32)`                      | HS256 signing key for session tokens                  |
| `RESEND_API_KEY`  | `re_...` or `placeholder` in dev                  | Sends magic-link emails via Resend                    |
| `EMAIL_FROM`      | `noreply@example.com`                             | `From:` address on outgoing emails                    |
| `APP_ORIGIN`      | `http://localhost` / `https://app.example.com`    | Base URL for building magic links                     |
| `DATABASE_URL`    | `postgres://user:pass@host:5432/user_gateway`     | Postgres connection                                   |

**Optional** — sensible defaults in parentheses:

| Var                         | Default                       | What it does                                    |
|-----------------------------|-------------------------------|-------------------------------------------------|
| `REDIS_URL`                 | `redis://127.0.0.1:6379`      | Magic-link token store, rate limit counters     |
| `CORS_ORIGIN`               | `http://localhost:3000`       | `Access-Control-Allow-Origin` value             |
| `BIND_ADDR`                 | `127.0.0.1:3001`              | Where user-gateway listens                      |
| `MAGIC_LINK_TTL_MINUTES`    | `15`                          | How long magic links live before expiring       |
| `ACCESS_TOKEN_TTL_SECS`     | `86400` (24h)                 | Session access-token lifetime                   |
| `REFRESH_TOKEN_TTL_DAYS`    | `30`                          | Session refresh-token lifetime                  |
| `RATE_LIMIT_WINDOW_SECS`    | `60`                          | Rate-limit window size                          |
| `RATE_LIMIT_PER_IP`         | `60`                          | Requests per IP per window                      |
| `RATE_LIMIT_PER_EMAIL`      | `30`                          | Magic-link requests per email per window        |
| `ADMIN_EMAILS`              | `""`                          | Comma-separated auto-admin list                 |
| `IMPERSONATION_TTL_MINUTES` | `60`                          | TTL of tokens issued via admin impersonation    |

**Next.js services** (user-ingress, admin-ui, downstream) all read:

- `USER_GATEWAY_URL` — internal URL to reach user-gateway (e.g. `http://user-gateway:3001`).

**Caddy** reads:

- `SITE_ADDRESS` — `http://:80` in dev (default). Set to a bare domain
  (e.g. `app.example.com`) in prod and Caddy auto-provisions TLS via
  Let's Encrypt.

---

## Anti-patterns (things AI agents must NOT do)

1. **Don't decode JWTs in downstream code.** Call `/api/auth/verify`
   every time. The network call is a handful of milliseconds and buys
   instant revocation + zero crypto code in the user's repo.
2. **Don't share `JWT_SECRET` across services.** Only `user-gateway`
   ever sees it. If the user asks you to pass it to `my-api`, refuse and
   explain why.
3. **Don't bypass Caddy** with per-service host-port publishes in dev or
   prod. Same-origin routing is what makes cookies work across the four
   Next.js apps without CORS. Expose only Caddy (`:80` / `:443`).
4. **Don't modify `user-gateway` source** for project-specific behavior.
   Add a sibling service with its own routes in the project's repo; keep
   saassy on an upgrade path.
5. **Don't commit `.env`** or anything in `infra/secrets/`. Both are
   gitignored — keep them that way.
6. **Don't use saassy for multi-tenant hosted auth.** One operator, one
   user base, one Postgres. For multi-tenant you want something else
   entirely.
7. **Don't hand-roll password auth.** The whole point of saassy is that
   magic links eliminate password storage. If the user insists on
   passwords, saassy is the wrong tool.
8. **Don't build `user-gateway` from source in the user's CI** unless
   they're modifying it. `docker compose pull` grabs multi-arch images
   from `tqdminc/*` directly.
9. **Don't add user-ingress `/login` and the user's own `/login`
   simultaneously.** Pick one or the other. Most projects want
   user-ingress.

---

## Troubleshooting

| Symptom                                           | Cause                                                      | Fix                                                                                   |
|---------------------------------------------------|------------------------------------------------------------|---------------------------------------------------------------------------------------|
| Login email never arrives                         | `RESEND_API_KEY` is a placeholder                          | Set a real key, OR read the magic link from `docker compose logs -f user-gateway`     |
| `/admin` returns 403 after login                  | Email not in `ADMIN_EMAILS` at the moment of login         | Add email → restart user-gateway → sign in again (grant happens on login)             |
| Cookies not sent in dev                           | User is hitting a service directly, bypassing Caddy        | Always visit through Caddy at `http://localhost` (or `CADDY_HTTP_PORT`)               |
| CSRF errors on mutations from the browser         | Request origin isn't the Caddy origin                      | All browser requests must go through the single Caddy origin — no cross-origin fetches |
| `POSTGRES_PASSWORD is missing a value`            | `.env` not loaded or variable not set                      | `cp .env.example .env` and fill it in; compose's `:?` guard fails fast                 |
| `docker compose up` appears to hang               | user-gateway waiting for postgres healthcheck              | Normal for 3–5s on first boot; check `docker compose logs saassy-postgres`            |
| Build of user-gateway times out in CI             | Multi-arch Rust under QEMU is slow                         | Pull `tqdminc/user-gateway:latest` instead of building unless you're editing the src  |
| Impersonation session won't end                   | Deliberate: impersonation replaces the admin's own tokens  | Admin logs out and logs in again to regain admin access                               |
| 401 on `/api/auth/verify` despite valid cookies   | Cookies are scoped to the wrong origin                     | Confirm `APP_ORIGIN` in the user-gateway env matches what the browser is hitting      |

---

## Pointers for deeper reading

- Endpoint list with request/response shapes:
  `services/user-gateway/src/adapters/http/routes/{auth,user,admin}.rs`
- Env var source of truth:
  `services/user-gateway/src/infra/config.rs`
- Reference Next.js integration:
  `services/project-web/app/dashboard/page.tsx` +
  `services/project-web/app/lib/api-fetch.ts`
- Caddy route table: `infra/caddy/Caddyfile`
- Repo root compose (full stack): `docker-compose.yml`
- CI / publish workflows: `.github/workflows/`

When the code and this guide disagree, **the code wins**. File an issue
at https://github.com/sssemil/saassy/issues and saassy-the-maintainer will
update this guide.
