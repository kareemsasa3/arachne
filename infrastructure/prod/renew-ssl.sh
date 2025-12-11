#!/usr/bin/env bash
set -euo pipefail

# Location of the cloned repo on the server
PROJECT_DIR="${PROJECT_DIR:-$HOME/personal-website}"
cd "$PROJECT_DIR"

# Ensure directories exist
mkdir -p infrastructure/nginx/ssl \
         infrastructure/nginx/certbot/www \
         infrastructure/logs/certbot

CERTBOT_IMAGE="certbot/certbot:latest"

echo "[renew-ssl] Starting certbot renew (webroot)..."
docker run --rm \
  -v "$(pwd)/infrastructure/nginx/ssl:/etc/letsencrypt" \
  -v "$(pwd)/infrastructure/nginx/certbot/www:/var/www/certbot" \
  -v "$(pwd)/infrastructure/logs/certbot:/var/log/letsencrypt" \
  "$CERTBOT_IMAGE" renew --webroot -w /var/www/certbot --quiet || true

# Reload nginx if it's up
if docker ps --format '{{.Names}}' | grep -q '^arachne-nginx-prod$'; then
  echo "[renew-ssl] Reloading nginx..."
  docker exec arachne-nginx-prod nginx -t && \
  docker exec arachne-nginx-prod nginx -s reload || \
  docker restart arachne-nginx-prod || true
fi

echo "[renew-ssl] Done."


