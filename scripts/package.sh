#!/usr/bin/env bash
# Builds the frontend and stages a deployable bundle for Lambda Web Functions.
#   .lambda/       directory (for `aws lambda-web deploy --code .lambda`)
#   function.zip   same contents zipped (for S3 upload / API calls)
# Order matters: build first (needs vite), then install production deps only.
set -euo pipefail
cd "$(dirname "$0")/.."

npm ci
npm run build

rm -rf .lambda function.zip
mkdir .lambda
cp -R index.js package.json package-lock.json server shared dist .lambda/
(cd .lambda && npm ci --omit=dev)
(cd .lambda && zip -qr ../function.zip . -x "node_modules/.cache/*")

echo "✓ .lambda/ and function.zip ready ($(du -h function.zip | cut -f1))"
