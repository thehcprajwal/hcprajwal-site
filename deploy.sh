#!/bin/bash
set -e

# Set SERVER before running: export SERVER="user@your-server-ip"
# Works with Lightsail, a Raspberry Pi, or any SSH-accessible host.
SERVER="${SERVER:-user@your-server-ip}"
APP_DIR="${APP_DIR:-/home/ubuntu/hc-system}"

if [[ "$SERVER" == *"your-server-ip"* ]]; then
    echo "✗ Set the SERVER env var before deploying:"
    echo "    export SERVER='ubuntu@<ip>'  # Lightsail"
    echo "    export SERVER='pi@<ip>'      # Raspberry Pi"
    exit 1
fi

if [[ ! -f .env ]]; then
    echo "✗ .env file not found. Copy .env.example and fill in the values."
    exit 1
fi

echo "▸ Syncing files to $SERVER..."
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
echo "✓ Deployed to $SERVER"
