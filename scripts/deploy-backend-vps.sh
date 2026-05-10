#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Rebuild and restart the Express API on your VPS.
#
# Before running:
#   1. Set DEPLOY_REPO_ROOT to the folder where this repo is cloned on the server.
#   2. Optionally set PM2_APP_NAME if your PM2 process name differs.
#
# Examples:
#   chmod +x scripts/deploy-backend-vps.sh
#   export DEPLOY_REPO_ROOT=/opt/plankton-s-cyber-ocean
#   export PM2_APP_NAME=plankton-api
#   ./scripts/deploy-backend-vps.sh
#
# One-liner:
#   DEPLOY_REPO_ROOT=/root/plankton-s-cyber-ocean PM2_APP_NAME=plankton-api bash scripts/deploy-backend-vps.sh
#
# Environment:
#   DEPLOY_REPO_ROOT  - Absolute path to repo root (required; default: /opt/plankton-s-cyber-ocean)
#   PM2_APP_NAME      - PM2 process name to restart after build (default: plankton-api). Empty = skip PM2.
#   RUN_GIT_PULL      - Set to 0 to skip "git pull" (default: 1)
# -----------------------------------------------------------------------------
set -euo pipefail

DEPLOY_REPO_ROOT="${DEPLOY_REPO_ROOT:-/opt/plankton-s-cyber-ocean}"
PM2_APP_NAME="${PM2_APP_NAME:-plankton-api}"
RUN_GIT_PULL="${RUN_GIT_PULL:-1}"

echo "=== Plankton backend deploy ==="
echo "DEPLOY_REPO_ROOT=${DEPLOY_REPO_ROOT}"
echo "PM2_APP_NAME=${PM2_APP_NAME:-<none>}"
echo

if [[ ! -d "${DEPLOY_REPO_ROOT}" ]]; then
  echo "ERROR: Directory does not exist: ${DEPLOY_REPO_ROOT}"
  echo "Fix: export DEPLOY_REPO_ROOT=/full/path/to/your/plankton-s-cyber-ocean"
  exit 1
fi

if [[ ! -f "${DEPLOY_REPO_ROOT}/backend/package.json" ]]; then
  echo "ERROR: backend/package.json not found under ${DEPLOY_REPO_ROOT}"
  exit 1
fi

cd "${DEPLOY_REPO_ROOT}"

if [[ "${RUN_GIT_PULL}" == "1" ]]; then
  if [[ -d .git ]]; then
    echo "[1/4] git pull..."
    git pull
  else
    echo "[1/4] WARN: No .git directory — skipping git pull."
  fi
else
  echo "[1/4] Skipping git pull (RUN_GIT_PULL=0)."
fi

echo "[2/4] npm ci (monorepo root)..."
cd "${DEPLOY_REPO_ROOT}"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

echo "[3/4] npm run build (backend)..."
cd "${DEPLOY_REPO_ROOT}/backend"
npm run build

if [[ -n "${PM2_APP_NAME}" ]]; then
  echo "[4/4] pm2 restart ${PM2_APP_NAME}..."
  if command -v pm2 >/dev/null 2>&1; then
    pm2 restart "${PM2_APP_NAME}"
    pm2 save 2>/dev/null || true
  else
    echo "WARN: pm2 not installed — start manually, e.g.: node dist/index.js"
    exit 1
  fi
else
  echo "[4/4] Skipping PM2 (PM2_APP_NAME is empty)."
  echo "Start manually from backend: node dist/index.js"
fi

echo
echo "Smoke test (expect HTTP 200 and JSON starting with {\"openapi\"):"
echo "  curl -sS -i \"http://127.0.0.1:3000/openapi.json\" | head -n 15"
echo "Done."
