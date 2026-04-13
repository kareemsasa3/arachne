#!/usr/bin/env bash
# deploy-system.sh — Sync this repo into /opt/arachne and restart the live stack.
#
# Usage:
#   sudo ./scripts/deploy-system.sh [--dry-run]
#
# Requires: rsync, docker, systemctl, curl, git
# Must be run as root (sudo).
#
# What it does:
#   1. Verifies git submodules are populated in the source tree
#   2. rsync repo → /opt/arachne (excluding build artefacts and dev-only files)
#   3. Records the deployed git revision to /opt/arachne/.deploy-revision
#   4. systemctl restart arachne.service
#   5. Post-deploy checks: service status, docker ps, health endpoint
#
# What it does NOT touch:
#   /etc/arachne/     — runtime config (env, overrides, nginx conf)
#   /var/lib/arachne/ — persistent scraper data
#
# Note on Type=oneshot RemainAfterExit semantics:
#   arachne.service is Type=oneshot with RemainAfterExit=yes.
#   systemctl restart on a oneshot service is fully synchronous: it blocks
#   until ExecStop completes and then until ExecStart completes (or fails).
#   By the time restart returns, the service has settled into its final
#   state (active or failed) — not a transient activating state.
#   The status check below is therefore checking the correct condition.

set -euo pipefail

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
APP_NAME="arachne"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="/opt/${APP_NAME}"
ENV_FILE="/etc/${APP_NAME}/${APP_NAME}.env"
REVISION_FILE="${INSTALL_DIR}/.deploy-revision"
DRY_RUN=false

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
log()  { printf "\033[1;34m[INFO]\033[0m %s\n"    "$*"; }
warn() { printf "\033[1;33m[WARN]\033[0m %s\n"    "$*"; }
err()  { printf "\033[1;31m[ERR ]\033[0m %s\n"    "$*" >&2; }
die()  { err "$*"; exit 1; }

# ---------------------------------------------------------------------------
# Preconditions
# ---------------------------------------------------------------------------
require_root() {
  [[ "${EUID}" -eq 0 ]] || die "Must run as root. Use: sudo $0 $*"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing dependency: $1"
}

parse_args() {
  for arg in "$@"; do
    case "${arg}" in
      --dry-run) DRY_RUN=true ;;
      -h|--help)
        echo "Usage: sudo $0 [--dry-run]"
        echo ""
        echo "  --dry-run   Show what rsync would transfer without writing anything."
        echo "              Does not restart the service or record a revision."
        exit 0
        ;;
      *) die "Unknown argument: ${arg}" ;;
    esac
  done
}

# ---------------------------------------------------------------------------
# Submodule check
# ---------------------------------------------------------------------------
# /opt/arachne is not a git checkout, so submodules are plain directories
# copied from this source tree. If a submodule is not populated here (e.g.
# after a fresh clone without --recurse-submodules), we'd rsync empty
# directories and silently break the build. Catch that early.
check_submodules() {
  local missing=()
  while IFS= read -r path; do
    [[ -n "${path}" ]] || continue
    local abs="${SRC_DIR}/${path}"
    # A populated submodule has files; an empty checkout is just an empty dir.
    if [[ -z "$(ls -A "${abs}" 2>/dev/null)" ]]; then
      missing+=("${path}")
    fi
  done < <(git -C "${SRC_DIR}" submodule foreach --quiet 'echo $displaypath' 2>/dev/null)

  if (( ${#missing[@]} > 0 )); then
    err "The following submodules are not populated in the source tree:"
    for m in "${missing[@]}"; do
      err "  ${SRC_DIR}/${m}"
    done
    die "Run 'git submodule update --init --recursive' in ${SRC_DIR}, then retry."
  fi

  log "Submodules OK: $(git -C "${SRC_DIR}" submodule foreach --quiet 'echo $displaypath' \
    2>/dev/null | tr '\n' ' ')"
}

# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------
sync_code() {
  local rsync_flags=(-a --delete --itemize-changes)
  ${DRY_RUN} && rsync_flags+=(--dry-run)

  # Exclude build artefacts and dev-only state that must not land in /opt.
  # Reasoning for each exclusion:
  #   .git          — target is not a git checkout
  #   node_modules  — rebuilt inside Docker images; never needed on host
  #   .next         — Next.js build output; built inside Docker
  #   dist / build  — compiled output for any service
  #   __pycache__   — Python bytecache
  #   .env          — dev .env files; runtime config lives in /etc/arachne/
  #   .vscode       — editor config; confirmed present in this repo, not for prod
  local excludes=(
    --exclude='.git'
    --exclude='node_modules'
    --exclude='.next'
    --exclude='dist'
    --exclude='build'
    --exclude='__pycache__'
    --exclude='.env'
    --exclude='.vscode'
  )

  if ${DRY_RUN}; then
    warn "DRY RUN — no files will be written"
    log "rsync preview: ${SRC_DIR}/ -> ${INSTALL_DIR}/"
  else
    log "Syncing: ${SRC_DIR}/ -> ${INSTALL_DIR}/"
    mkdir -p "${INSTALL_DIR}"
  fi

  rsync "${rsync_flags[@]}" "${excludes[@]}" \
    "${SRC_DIR}/" "${INSTALL_DIR}/"

  if ${DRY_RUN}; then
    log "Dry run complete. No changes made."
    exit 0
  fi

  # Fix ownership so the service (running as root) owns the install tree.
  chown -R root:root "${INSTALL_DIR}"
  log "Sync complete."
}

# ---------------------------------------------------------------------------
# Record deployed revision
# ---------------------------------------------------------------------------
record_revision() {
  local rev short_rev deploy_time
  rev="$(git -C "${SRC_DIR}" rev-parse HEAD)"
  short_rev="$(git -C "${SRC_DIR}" rev-parse --short HEAD)"
  deploy_time="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

  printf '%s %s deployed=%s\n' "${rev}" "${short_rev}" "${deploy_time}" \
    > "${REVISION_FILE}"

  log "Deployed revision: ${short_rev} (${rev})"
  log "  recorded at: ${REVISION_FILE}"
}

# ---------------------------------------------------------------------------
# Restart
# ---------------------------------------------------------------------------
restart_service() {
  log "Restarting ${APP_NAME}.service …"
  # systemctl restart on Type=oneshot RemainAfterExit is synchronous:
  # it blocks until ExecStart exits. By the time this returns the service
  # is in its final state (active or failed), not a transient state.
  systemctl restart "${APP_NAME}.service"
  log "${APP_NAME}.service restart returned."
}

# ---------------------------------------------------------------------------
# Post-deploy checks
# ---------------------------------------------------------------------------
check_service_status() {
  log "--- systemctl status ${APP_NAME}.service ---"
  # is-active on RemainAfterExit=yes is reliable post-restart (see note above).
  if ! systemctl is-active --quiet "${APP_NAME}.service"; then
    systemctl status "${APP_NAME}.service" --no-pager --lines=30 || true
    err "Service is not active. Dumping recent journal:"
    journalctl -u "${APP_NAME}.service" -n 80 --no-pager || true
    die "Deploy failed: ${APP_NAME}.service did not come up cleanly."
  fi
  systemctl status "${APP_NAME}.service" --no-pager --lines=10
}

check_containers() {
  log "--- docker ps (arachne containers) ---"
  docker ps --filter "name=${APP_NAME}" \
    --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

check_health() {
  local url="http://127.0.0.1:8787/health"
  local max_attempts=10
  local attempt=1

  log "Waiting for health endpoint: ${url}"
  while (( attempt <= max_attempts )); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      log "Health OK: ${url}"
      return 0
    fi
    warn "Attempt ${attempt}/${max_attempts}: not ready yet, retrying in 2s …"
    sleep 2
    (( attempt++ ))
  done

  warn "Health endpoint not responding after ${max_attempts} attempts."
  warn "Manual check:"
  warn "  curl -i ${url}"
  warn "  sudo journalctl -u ${APP_NAME}.service -n 200 --no-pager"
  warn "  sudo docker ps --filter name=${APP_NAME}"
  # Warn but do not hard-fail: containers may still be starting up.
  # The service itself is confirmed active above; this is container readiness.
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  parse_args "$@"
  require_root "$@"

  need_cmd rsync
  need_cmd docker
  need_cmd systemctl
  need_cmd curl
  need_cmd git

  log "=============================="
  log " Arachne local deploy"
  log "=============================="
  log "Source:  ${SRC_DIR}"
  log "Target:  ${INSTALL_DIR}"
  log "Service: ${APP_NAME}.service"
  ${DRY_RUN} && warn "Mode:    DRY RUN (no changes)"

  # Safety: confirm install dir exists (i.e. initial install-system.sh was run).
  [[ -d "${INSTALL_DIR}" ]] || \
    die "${INSTALL_DIR} does not exist. Run scripts/install-system.sh first."

  # Safety: confirm runtime config is in place before we touch the service.
  [[ -f "${ENV_FILE}" ]] || \
    die "${ENV_FILE} not found. Runtime config must be set up before deploying."

  check_submodules
  sync_code
  record_revision
  restart_service
  check_service_status
  check_containers
  check_health

  log "=============================="
  log " Deploy complete."
  log "=============================="
  log "Revision: $(cat "${REVISION_FILE}" 2>/dev/null || echo 'unknown')"
  log "Useful follow-up commands:"
  log "  sudo journalctl -u ${APP_NAME}.service -f"
  log "  sudo docker ps --filter name=${APP_NAME}"
  log "  curl -i http://127.0.0.1:8787/health"
  log "  cat ${REVISION_FILE}"
}

main "$@"
