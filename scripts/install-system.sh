#!/usr/bin/env bash
set -euo pipefail

# Arachne System Installer (Erebus-style)
# - Deploys code to /opt/arachne
# - Stores secrets in /etc/arachne/arachne.env
# - Persistent data in /var/lib/arachne
# - systemd service: arachne.service (starts on boot)
# - Optional "private by default": bind nginx to 127.0.0.1

APP_NAME="arachne"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="/opt/${APP_NAME}"
ENV_DIR="/etc/${APP_NAME}"
ENV_FILE="${ENV_DIR}/${APP_NAME}.env"
NGINX_CONF_FILE="${ENV_DIR}/nginx.default.conf"
NETWORK_OVERRIDE_FILE="${ENV_DIR}/network.override.yml"
RUNTIME_OVERRIDE_FILE="${ENV_DIR}/runtime.override.yml"
DATA_DIR="/var/lib/${APP_NAME}"
SYSTEMD_UNIT="/etc/systemd/system/${APP_NAME}.service"
EMIT_BIN="/usr/local/bin/${APP_NAME}-erebus-emit"
SYSTEM_COMPOSE_FILE="${INSTALL_DIR}/infrastructure/system/docker-compose.system.yml"

log() { printf "\033[1;34m[INFO]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[WARN]\033[0m %s\n" "$*"; }
err() { printf "\033[1;31m[ERR ]\033[0m %s\n" "$*" >&2; }
die() { err "$*"; exit 1; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || die "Missing dependency: $1"; }

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "Run as root: sudo $0"
  fi
}

gen_secret() {
  # 48 bytes URL-safe ~ 64 chars
  python - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
}

compose_cmd() {
  /usr/bin/docker compose -p "${APP_NAME}" --env-file "${ENV_FILE}" \
    -f "${SYSTEM_COMPOSE_FILE}" \
    -f "${NETWORK_OVERRIDE_FILE}" \
    -f "${RUNTIME_OVERRIDE_FILE}" \
    "$@"
}

write_emitter() {
  log "Installing Erebus emitter helper: ${EMIT_BIN}"
  cat > "${EMIT_BIN}" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
TYPE="${1:?type required}"
PAYLOAD="${2:-{}}"
erebus emit --best-effort --source-name arachne.systemd --type "$TYPE" --payload "$PAYLOAD" >/dev/null 2>&1 || true
SH
  chmod +x "${EMIT_BIN}"
}

write_systemd_unit() {
  log "Writing systemd unit: ${SYSTEMD_UNIT}"
  cat > "${SYSTEMD_UNIT}" <<EOF
[Unit]
Description=Arachne (prod-private) - docker compose stack
Wants=network-online.target docker.service
After=network-online.target docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${INSTALL_DIR}/infrastructure
Environment=ARACHNE_ENV_FILE=${ENV_FILE}
Environment=ARACHNE_COMPOSE_BASE=${SYSTEM_COMPOSE_FILE}
Environment=ARACHNE_NETWORK_OVERRIDE=${NETWORK_OVERRIDE_FILE}
Environment=ARACHNE_RUNTIME_OVERRIDE=${RUNTIME_OVERRIDE_FILE}

ExecStartPre=/usr/bin/docker version
ExecStart=/usr/bin/docker compose -p ${APP_NAME} --env-file \${ARACHNE_ENV_FILE} -f \${ARACHNE_COMPOSE_BASE} -f \${ARACHNE_NETWORK_OVERRIDE} -f \${ARACHNE_RUNTIME_OVERRIDE} up -d --build
ExecStartPost=${EMIT_BIN} arachne.up '{"entry":"http://127.0.0.1:8787/","mode":"prod-private","stack":"compose"}'
ExecStop=/usr/bin/docker compose -p ${APP_NAME} --env-file \${ARACHNE_ENV_FILE} -f \${ARACHNE_COMPOSE_BASE} -f \${ARACHNE_NETWORK_OVERRIDE} -f \${ARACHNE_RUNTIME_OVERRIDE} down
ExecStopPost=${EMIT_BIN} arachne.down '{}'

Restart=on-failure
RestartSec=5

StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
}

init_env_file() {
  mkdir -p "${ENV_DIR}"
  chmod 750 "${ENV_DIR}"

  if [[ -f "${ENV_FILE}" ]]; then
    log "Env file exists: ${ENV_FILE} (leaving as-is)"
    return 0
  fi

  local example="${INSTALL_DIR}/infrastructure/env.example"
  [[ -f "${example}" ]] || die "Expected env.example at ${example} (repo layout changed?)"

  log "Creating env file from env.example: ${ENV_FILE}"
  cp "${example}" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"

  # Best-effort: inject secrets if keys exist in example (don’t assume names beyond common ones).
  # You can still edit manually afterwards.
  local secret_1 secret_2
  secret_1="$(gen_secret)"
  secret_2="$(gen_secret)"

  # Add or replace these if present; if not present, append them.
  if rg -n '^GEMINI_API_KEY=' "${ENV_FILE}" >/dev/null 2>&1; then
    warn "GEMINI_API_KEY present but empty is common; please set it for AI features."
  fi

  # Common “app secret” patterns; harmless if unused.
  if rg -n '^ARACHNE_SECRET_KEY=' "${ENV_FILE}" >/dev/null 2>&1; then
    sed -i "s/^ARACHNE_SECRET_KEY=.*/ARACHNE_SECRET_KEY=${secret_1}/" "${ENV_FILE}"
  else
    printf "\nARACHNE_SECRET_KEY=%s\n" "${secret_1}" >> "${ENV_FILE}"
  fi

  if rg -n '^ARACHNE_DB_PASSWORD=' "${ENV_FILE}" >/dev/null 2>&1; then
    sed -i "s/^ARACHNE_DB_PASSWORD=.*/ARACHNE_DB_PASSWORD=${secret_2}/" "${ENV_FILE}"
  else
    printf "ARACHNE_DB_PASSWORD=%s\n" "${secret_2}" >> "${ENV_FILE}"
  fi

  # Default to an internal name. You can change later.
  if rg -n '^DOMAIN_NAME=' "${ENV_FILE}" >/dev/null 2>&1; then
    sed -i "s/^DOMAIN_NAME=.*/DOMAIN_NAME=arachne.local/" "${ENV_FILE}"
  else
    printf "DOMAIN_NAME=arachne.local\n" >> "${ENV_FILE}"
  fi

  warn "Created ${ENV_FILE}. Review it now (especially GEMINI_API_KEY / SSL fields):"
  warn "  sudoedit ${ENV_FILE}"
}

write_nginx_default_conf() {
  local template="${INSTALL_DIR}/infrastructure/nginx/conf.d/default.conf"
  [[ -f "${template}" ]] || die "Expected nginx template at ${template} (repo layout changed?)"

  log "Generating nginx config: ${NGINX_CONF_FILE}"
  sed \
    -e 's/^\s*listen\s\+.*;/    listen 80;/' \
    -e 's/proxy_pass http:\/\/web:3002;/proxy_pass http:\/\/web:3000;/' \
    "${template}" > "${NGINX_CONF_FILE}"
  chmod 0644 "${NGINX_CONF_FILE}"
}

write_network_override() {
  log "Generating network override: ${NETWORK_OVERRIDE_FILE}"
  cat > "${NETWORK_OVERRIDE_FILE}" <<EOF
networks:
  arachne-network:
    name: arachne-network
EOF
  chmod 0644 "${NETWORK_OVERRIDE_FILE}"
}

write_runtime_override() {
  log "Generating runtime override: ${RUNTIME_OVERRIDE_FILE}"
  cat > "${RUNTIME_OVERRIDE_FILE}" <<EOF
services:
  nginx:
    ports:
      - "127.0.0.1:8787:80"
    volumes:
      - ${NGINX_CONF_FILE}:/etc/nginx/conf.d/default.conf:ro
EOF
  chmod 0644 "${RUNTIME_OVERRIDE_FILE}"
}

sync_code() {
  log "Syncing code -> ${INSTALL_DIR}"
  mkdir -p "${INSTALL_DIR}"
  # Exclude node_modules, build output, etc.
  rsync -a --delete \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude 'dist' \
    --exclude 'build' \
    "${SRC_DIR}/" "${INSTALL_DIR}/"

  chown -R root:root "${INSTALL_DIR}"
}

ensure_data_dirs() {
  log "Ensuring data dirs: ${DATA_DIR}"
  mkdir -p "${DATA_DIR}"
  chown -R root:root "${DATA_DIR}"
}

compose_smoke_test() {
  log "Running docker compose config check"
  compose_cmd config >/dev/null

  log "Bringing stack up (systemd will own it afterward)"
  systemctl daemon-reload
  systemctl enable --now "${APP_NAME}.service"

  log "Waiting briefly for nginx/health (best-effort)"
  sleep 2
  if curl -fsS http://127.0.0.1:8787/health >/dev/null 2>&1; then
    log "Health OK: http://127.0.0.1:8787/health"
  else
    warn "Health not reachable yet at http://127.0.0.1:8787/health"
    warn "Check: sudo journalctl -u ${APP_NAME}.service -n 200 --no-pager"
    warn "Also: sudo docker compose -p ${APP_NAME} --env-file ${ENV_FILE} -f ${SYSTEM_COMPOSE_FILE} -f ${NETWORK_OVERRIDE_FILE} -f ${RUNTIME_OVERRIDE_FILE} ps"
  fi
  
  log "Verifying systemd unit finished successfully"
  if ! systemctl is-active --quiet arachne.service; then
    warn "arachne.service not active"
    systemctl status arachne.service --no-pager || true
    journalctl -u arachne.service -n 200 --no-pager || true
    exit 1
  fi

  log "Verifying HTTP health endpoint"
  if curl -fsS http://127.0.0.1:8787/health >/dev/null 2>&1; then
    log "Health OK: http://127.0.0.1:8787/health"
  else
    warn "Health not reachable yet at http://127.0.0.1:8787/health"
    warn "Check nginx logs: sudo docker compose -p ${APP_NAME} --env-file ${ENV_FILE} -f ${SYSTEM_COMPOSE_FILE} -f ${NETWORK_OVERRIDE_FILE} -f ${RUNTIME_OVERRIDE_FILE} logs nginx --tail=200"
  fi

  log "Final health check"
  if ! curl -fsS http://127.0.0.1:8787/health >/dev/null 2>&1; then
    err "Health check failed: http://127.0.0.1:8787/health"
    compose_cmd ps || true
    compose_cmd logs nginx --tail=200 || true
    exit 1
  fi
}

main() {
  require_root
  need_cmd rsync
  need_cmd docker
  need_cmd systemctl
  need_cmd curl
  need_cmd sed

  log "Arachne System Installer"
  log "Source:   ${SRC_DIR}"
  log "Install:  ${INSTALL_DIR}"
  log "Env:      ${ENV_FILE}"
  log "Nginx:    ${NGINX_CONF_FILE}"
  log "Overrides:${NETWORK_OVERRIDE_FILE}, ${RUNTIME_OVERRIDE_FILE}"
  log "Data:     ${DATA_DIR}"

  if [[ -d "${SRC_DIR}/.git" && -f "${SRC_DIR}/.gitmodules" ]]; then
    log "Ensuring submodules are initialized (source dir)"
    (cd "${SRC_DIR}" && git submodule update --init --recursive) || \
      warn "Submodule init failed in source dir (continuing)."
  fi

  # If an older instance is running from previous install, stop it first (safe if not installed)
  if systemctl is-active --quiet "${APP_NAME}.service"; then
    log "Stopping existing service"
    systemctl stop "${APP_NAME}.service" || true
  fi

  sync_code
  ensure_data_dirs
  write_emitter
  init_env_file
  write_nginx_default_conf
  write_network_override
  write_runtime_override

  write_systemd_unit
  compose_smoke_test

  log "Installed. Useful commands:"
  log "  sudo systemctl status arachne.service --no-pager"
  log "  sudo journalctl -u arachne.service -f"
  log "  sudo docker compose -p ${APP_NAME} --env-file ${ENV_FILE} -f ${SYSTEM_COMPOSE_FILE} -f ${NETWORK_OVERRIDE_FILE} -f ${RUNTIME_OVERRIDE_FILE} ps"
  log "  curl -i http://127.0.0.1:8787/health"
  log "  erebus events --since 10m --filter 'source.name=arachne.systemd' --format json | tail"
}

main "$@"
