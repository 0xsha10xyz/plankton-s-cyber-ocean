#!/bin/bash
set -euo pipefail

APP_DIR="/opt/plankton-s-cyber-ocean"

echo "[1/8] Updating packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

echo "[2/8] Installing dependencies (git, curl, build tools)..."
sudo apt-get install -y git curl ca-certificates build-essential

echo "[3/8] Installing Node.js 20 (NodeSource)..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "[4/8] Installing PM2 globally (optional. For running backend/)..."
sudo npm install -g pm2

echo "[5/8] Preparing app directory at ${APP_DIR}..."
sudo mkdir -p "$APP_DIR"
sudo chown -R "$USER":"$USER" "$APP_DIR"

echo
echo "Clone this repo into ${APP_DIR}."
echo "Example:"
echo "  git clone <your-repo> ${APP_DIR}"
echo

if [ ! -f "${APP_DIR}/package.json" ]; then
  echo "No package.json found in ${APP_DIR}. Skipping install."
  exit 0
fi

cd "$APP_DIR"

echo "[6/8] Installing npm deps..."
npm install

echo "[7/8] Backend .env (if missing)..."
if [ ! -f "backend/.env" ]; then
  if [ -f "backend/.env.example" ]; then
    cp backend/.env.example backend/.env
    echo "Created backend/.env from backend/.env.example. Edit before production:"
    echo "  nano ${APP_DIR}/backend/.env"
  else
    echo "Create backend/.env manually (see docs/CONFIGURATION.md)."
  fi
fi

echo "[8/8] Next: build and run Express (example)"
echo "  cd ${APP_DIR}/backend && npm run build && npm run start"
echo "Or configure pm2 to run the backend entrypoint. See docs/DEPLOYMENT.md."
