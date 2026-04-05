#!/usr/bin/env bash
set -euo pipefail

SECRET_DIR="${SECRET_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/secrets}"
BYTES="${BYTES:-32}"

mkdir -p "$SECRET_DIR"

gen_secret() {
  local name="$1"
  local file="${SECRET_DIR}/${name}"
  if [ -s "$file" ]; then
    echo "Skipping ${name} (already exists)"
    return
  fi
  openssl rand -base64 "$BYTES" | tr -d '\n' > "$file"
  echo "Wrote ${file}"
}

gen_secret "jwt_secret"
gen_secret "postgres_password"
gen_secret "redis_password"
gen_secret "resend_api_key" # placeholder — replace with a real Resend API key
