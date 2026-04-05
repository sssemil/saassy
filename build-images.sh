#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_ARGS="${BUILD_ARGS:-}"

echo "==> user-gateway"
docker build $BUILD_ARGS -t saassy/user-gateway:latest "${ROOT_DIR}/services/user-gateway"

echo "==> user-ingress"
docker build $BUILD_ARGS -t saassy/user-ingress:latest "${ROOT_DIR}/services/user-ingress"

echo "==> admin-ui"
docker build $BUILD_ARGS -t saassy/admin-ui:latest "${ROOT_DIR}/services/admin-ui"

echo "==> project-web"
docker build $BUILD_ARGS -t saassy/project-web:latest "${ROOT_DIR}/services/project-web"

echo
echo "Built: saassy/{user-gateway,user-ingress,admin-ui,project-web}:latest"
