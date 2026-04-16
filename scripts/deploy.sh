#!/bin/bash
set -euo pipefail

APP_DIR="/opt/syraa-agent"
APP_NAME="syraa-signal-agent"

cd "$APP_DIR"

echo "Pulling latest..."
git pull --rebase

echo "Installing deps..."
npm install

echo "Building..."
npm run agent:build

echo "Restarting PM2..."
pm2 restart "$APP_NAME" || pm2 start ecosystem.config.js
pm2 save

echo "Done."
pm2 status "$APP_NAME" || true

