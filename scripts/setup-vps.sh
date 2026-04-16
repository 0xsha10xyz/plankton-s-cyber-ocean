#!/bin/bash
set -euo pipefail

APP_DIR="/opt/syraa-agent"

echo "[1/9] Updating packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

echo "[2/9] Installing dependencies (git, curl, build tools)..."
sudo apt-get install -y git curl ca-certificates build-essential

echo "[3/9] Installing Node.js 20 (NodeSource)..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "[4/9] Installing PM2 + tsx globally..."
sudo npm install -g pm2 tsx

echo "[5/9] Preparing app directory at ${APP_DIR}..."
sudo mkdir -p "$APP_DIR"
sudo chown -R "$USER":"$USER" "$APP_DIR"

echo
echo "Upload or clone this repo into ${APP_DIR}."
echo "Example:"
echo "  git clone <your-repo> ${APP_DIR}"
echo

if [ ! -f "${APP_DIR}/package.json" ]; then
  echo "No package.json found in ${APP_DIR}. Skipping install/start."
  exit 0
fi

cd "$APP_DIR"

echo "[6/9] Installing npm deps..."
npm install

echo "[7/9] Creating .env (if missing)..."
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo "Created ${APP_DIR}/.env from .env.example. Edit it now:"
    echo "  nano ${APP_DIR}/.env"
  else
    echo "No .env.example found. Create ${APP_DIR}/.env manually."
  fi
fi

echo "[8/9] Starting PM2 process..."
pm2 start ecosystem.config.js

echo "Installing PM2 logrotate..."
pm2 install pm2-logrotate || true

echo "Saving PM2 process list + enabling startup..."
pm2 save
pm2 startup systemd -u "$USER" --hp "$HOME"

echo "[9/9] Status:"
pm2 list

