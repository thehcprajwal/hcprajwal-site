#!/bin/bash
set -e

SERVER="ubuntu@your-lightsail-ip"
APP_DIR="/home/ubuntu/hc-system"

# ── Guard: catch un-edited placeholder ───────────────────────────────
if [[ "$SERVER" == *"your-lightsail-ip"* ]]; then
    echo "✗ Update SERVER with your actual Lightsail IP before deploying."
    exit 1
fi

if [[ ! -f .env ]]; then
    echo "✗ .env file not found. Create it with AWS credentials before deploying."
    exit 1
fi

echo "▸ Syncing files to server..."
rsync -avz --exclude='node_modules' \
           --exclude='.git' \
           --exclude='dist' \
           --exclude='.env' \
           --exclude='data' \
  ./ "$SERVER:$APP_DIR/"

echo "▸ Copying .env..."
scp .env "$SERVER:$APP_DIR/.env"

echo "▸ Building and restarting containers..."
ssh "$SERVER" "
  cd $APP_DIR
  docker compose pull caddy
  docker compose up --build -d
  docker compose ps
"

echo ""
echo "✓ Deployed. Check https://hcprajwal.in"
