#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_ARGS="${BUILD_ARGS:-}"

echo "==> user-gateway"
docker build $BUILD_ARGS -t saas/user-gateway:latest "${ROOT_DIR}/services/user-gateway"

echo "==> user-ingress"
docker build $BUILD_ARGS -t saas/user-ingress:latest "${ROOT_DIR}/services/user-ingress"

echo "==> admin-ui"
docker build $BUILD_ARGS -t saas/admin-ui:latest "${ROOT_DIR}/services/admin-ui"

echo "==> project-web"
docker build $BUILD_ARGS -t saas/project-web:latest "${ROOT_DIR}/services/project-web"

echo
echo "Built: saas/{user-gateway,user-ingress,admin-ui,project-web}:latest"
