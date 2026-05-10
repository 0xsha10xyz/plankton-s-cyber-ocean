#!/usr/bin/env bash
# =============================================================================
# Plankton — VPS one-shot: pull, build Express backend, restart PM2, smoke tests
# Edit REPO_ROOT / PM2_NAME if your paths differ, then run:
#   chmod +x scripts/vps-paste-all.sh
#   bash scripts/vps-paste-all.sh
# Or from repo root:  bash ./scripts/vps-paste-all.sh
# =============================================================================
set -euo pipefail

# --- Configuration (change if needed) ---
REPO_ROOT="${REPO_ROOT:-/opt/plankton-s-cyber-ocean}"
PM2_NAME="${PM2_NAME:-plankton-api}"
PORT="${PORT:-3000}"

echo "==> Plankton VPS one-shot"
echo "    REPO_ROOT=${REPO_ROOT}"
echo "    PM2_NAME=${PM2_NAME}"
echo

if [[ ! -d "${REPO_ROOT}" ]]; then
  echo "ERROR: REPO_ROOT does not exist: ${REPO_ROOT}"
  echo "       Fix: export REPO_ROOT=/full/path/to/plankton-s-cyber-ocean"
  exit 1
fi
if [[ ! -f "${REPO_ROOT}/backend/package.json" ]]; then
  echo "ERROR: backend/package.json not found under ${REPO_ROOT}"
  exit 1
fi

cd "${REPO_ROOT}"
if [[ -d .git ]]; then
  echo "==> [1/4] git pull"
  git pull
else
  echo "==> [1/4] WARN: no .git here — skip git pull (copy a fresh build or add .git)"
fi

echo "==> [2/4] npm ci (backend)"
cd "${REPO_ROOT}/backend"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

echo "==> [3/4] npm run build (backend)"
npm run build

if command -v pm2 >/dev/null 2>&1; then
  echo "==> [4/4] pm2 restart ${PM2_NAME}"
  pm2 restart "${PM2_NAME}"
  pm2 save 2>/dev/null || true
else
  echo "ERROR: pm2 not found. Install PM2 or start manually:  node dist/index.js"
  exit 1
fi

echo
echo "==> Smoke tests (local API on port ${PORT})"
if curl -sS -o /dev/null -w "openapi.json  HTTP %{http_code}\n" "http://127.0.0.1:${PORT}/openapi.json" 2>/dev/null; then
  :
else
  echo "    (curl failed — is the app listening on ${PORT}? Check pm2 logs.)"
fi

echo
echo "==> Optional: recent HYRE integration logs (empty until a DeFi keyword triggers HYRE)"
grep -i HYRE "${HOME}/.pm2/logs/${PM2_NAME}-out.log" 2>/dev/null | tail -15 || echo "    (no HYRE lines yet or log path differs)"

echo
echo "Done. Remember:"
echo "  • Secrets live only in backend/.env on the server — never commit keys."
echo "  • HYRE: HYRE_SOLANA_PRIVATE_KEY, HYRE_DEFI_CHAT=1 — see backend/.env.example"
echo "  • x402scan: X402_RESOURCE_BASE_URL must match your public API origin."
echo "  • Logs: pm2 logs ${PM2_NAME} --lines 100 --nostream 2>/dev/null | tail -50"
