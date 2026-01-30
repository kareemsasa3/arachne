#!/usr/bin/env bash
set -euo pipefail

APP_NAME="arachne"
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

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "Run as root: sudo $0"
  fi
}

main() {
  require_root

  log "Arachne System Uninstaller"

  if systemctl list-unit-files | rg -n "^${APP_NAME}\.service" >/dev/null 2>&1; then
    log "Stopping/disabling service"
    systemctl stop "${APP_NAME}.service" || true
    systemctl disable "${APP_NAME}.service" || true
  fi

  # Best-effort: bring down compose if install dir exists
  if [[ -d "${INSTALL_DIR}/infrastructure" ]]; then
    log "Stopping docker compose stack (best-effort)"
    /usr/bin/docker compose -p "${APP_NAME}" --env-file "${ENV_FILE}" \
      -f "${SYSTEM_COMPOSE_FILE}" \
      -f "${NETWORK_OVERRIDE_FILE}" \
      -f "${RUNTIME_OVERRIDE_FILE}" \
      down || true
  fi

  log "Removing systemd unit"
  rm -f "${SYSTEMD_UNIT}"
  systemctl daemon-reload

  log "Removing emitter helper"
  rm -f "${EMIT_BIN}"

  log "Removing install dir: ${INSTALL_DIR}"
  rm -rf "${INSTALL_DIR}"

  log "Removing runtime overrides and nginx config"
  rm -f "${NETWORK_OVERRIDE_FILE}" "${RUNTIME_OVERRIDE_FILE}" "${NGINX_CONF_FILE}"

  # By default, keep env + data (because uninstall should not nuke your brain).
  if [[ "${ARACHNE_PURGE:-0}" == "1" ]]; then
    warn "ARACHNE_PURGE=1 set: removing env + data"
    rm -rf "${ENV_DIR}"
    rm -rf "${DATA_DIR}"
  else
    warn "Keeping env + data:"
    warn "  ${ENV_FILE}"
    warn "  ${DATA_DIR}"
    warn "To purge everything: sudo ARACHNE_PURGE=1 $0"
  fi

  log "Uninstall complete."
}

main "$@"
