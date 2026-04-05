#!/usr/bin/env bash
# Deploy all 4 service images + compose + Caddyfile + .env to a remote host.
#
# Usage:
#   DEPLOY_HOST=example.com [DEPLOY_USER=ubuntu] [REMOTE_DIR=/opt/saas] \
#     [ENV_FILE=.env] [SSH_OPTS="-p 2222"] ./infra/deploy.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.yml"
CADDY_DIR="${ROOT_DIR}/infra/caddy"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"

DEPLOY_HOST="${DEPLOY_HOST:-}"
DEPLOY_USER="${DEPLOY_USER:-$USER}"
REMOTE_DIR="${REMOTE_DIR:-/opt/saas}"
SSH_OPTS="${SSH_OPTS:-}"

IMAGES=(
  "saas/user-gateway:latest"
  "saas/user-ingress:latest"
  "saas/admin-ui:latest"
  "saas/project-web:latest"
)

require() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 1; }
}

[ -z "$DEPLOY_HOST" ] && { echo "DEPLOY_HOST is required" >&2; exit 1; }
require docker
require ssh
require rsync

[ -f "$COMPOSE_FILE" ] || { echo "Compose file not found at $COMPOSE_FILE" >&2; exit 1; }
[ -f "$ENV_FILE" ] || { echo "Env file not found at $ENV_FILE (copy .env.example to .env)" >&2; exit 1; }

echo "==> Building all service images locally"
bash "${ROOT_DIR}/build-images.sh"

IMAGES_DIR="$(mktemp -d)"
trap 'rm -rf "$IMAGES_DIR"' EXIT

for img in "${IMAGES[@]}"; do
  safe="$(echo "$img" | tr '/:' '__')"
  echo "==> docker save $img"
  docker save "$img" > "${IMAGES_DIR}/${safe}.tar"
done

echo "==> Syncing to ${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_DIR}"
ssh $SSH_OPTS "${DEPLOY_USER}@${DEPLOY_HOST}" "mkdir -p ${REMOTE_DIR}/infra/caddy ${REMOTE_DIR}/images"

rsync -az -e "ssh ${SSH_OPTS}" "$COMPOSE_FILE" "${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_DIR}/docker-compose.yml"
rsync -az -e "ssh ${SSH_OPTS}" "$ENV_FILE" "${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_DIR}/.env"
rsync -az -e "ssh ${SSH_OPTS}" "${CADDY_DIR}/" "${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_DIR}/infra/caddy/"
rsync -az -e "ssh ${SSH_OPTS}" "$IMAGES_DIR/" "${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_DIR}/images/"

echo "==> Loading images and starting stack on remote host"
ssh $SSH_OPTS "${DEPLOY_USER}@${DEPLOY_HOST}" bash <<'REMOTE'
set -euo pipefail
cd "${REMOTE_DIR:-/opt/saas}"
for tar in images/*.tar; do
  docker load -i "$tar"
done
docker compose --env-file .env up -d
docker compose ps
REMOTE

echo "==> Done."
