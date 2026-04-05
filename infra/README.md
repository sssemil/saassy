# infra/

Deployment assets for the saassy stack. Most of what used to live here has
moved to the repo root (`docker-compose.yml`, `.env.example`); what remains
is Caddy config and a deploy script for shipping images to a remote host.

## Files

- `caddy/Caddyfile` — single reverse proxy config. Routes `/api/*` to
  user-gateway, `/admin*` to admin-ui, `/login`/`/magic`/`/profile*` to
  user-ingress, everything else to project-web. See the Caddyfile itself
  for the full route table.
- `secrets/` — gitignored dir for any file-based secrets the stack may need.
  Currently empty (only `.gitkeep` is tracked).
- `deploy.sh` — builds all four service images locally, saves them to
  tarballs, rsyncs the compose file, `.env`, Caddyfile, and images to a
  remote host, then runs `docker compose up -d` there.
- `setup_firewall.sh` — configures UFW + Docker firewall rules on a remote
  host. Optional hardening helper.
- `generate-secrets.sh` — generates placeholder files in `secrets/`. Kept
  around for projects that want file-based secrets; not required by the
  current compose setup (which reads everything from environment variables
  in `.env`).
- `images/` — where `deploy.sh` stashes built image tarballs before rsync.

## Local dev

For local development you don't need anything in this dir — just run
`docker compose up -d --build` from the repo root. The Caddyfile here is
mounted into the Caddy container by the root `docker-compose.yml`.

## Deploying to a remote host

Set `DEPLOY_HOST` (and optionally `DEPLOY_USER`, `REMOTE_DIR`, `SSH_OPTS`)
and run from the repo root:

```bash
DEPLOY_HOST=your.host.example.com \
DEPLOY_USER=root \
./infra/deploy.sh
```

The script builds all four images, saves them as tarballs, rsyncs them
alongside `docker-compose.yml` / `.env` / the Caddyfile to `/opt/saassy/`
on the target, loads them, and runs `docker compose up -d`.

For TLS, set `SITE_ADDRESS=<your-domain>` in the remote `.env` before
deploying — Caddy will auto-provision a Let's Encrypt certificate via the
HTTP-01 challenge on port 80.
