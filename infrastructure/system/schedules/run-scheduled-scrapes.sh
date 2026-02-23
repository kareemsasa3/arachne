#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${ARACHNE_BASE_URL:-http://127.0.0.1:8787}"
SCRAPE_ENDPOINT="${BASE_URL}/api/arachne/scrape"
SITES_FILE="${ARACHNE_SITES_FILE:-/opt/arachne/infrastructure/system/schedules/sites.txt}"

command -v curl >/dev/null 2>&1 || { echo "[ERR] curl missing" >&2; exit 1; }

# Pick a Python interpreter (macOS usually has python3, not python)
PYTHON_BIN="${PYTHON_BIN:-python}"
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
  else
    echo "[ERR] python missing" >&2
    exit 1
  fi
fi

if [[ ! -f "$SITES_FILE" ]]; then
  echo "[ERR] Sites file not found: $SITES_FILE" >&2
  exit 1
fi

probe_ok() {
  local probe_url
  if [[ -n "${ARACHNE_HEALTH_URL:-}" ]]; then
    probe_url="$ARACHNE_HEALTH_URL"
  else
    probe_url="${BASE_URL}/"
  fi
  code="$(curl -sS -o /dev/null -w "%{http_code}" -m 2 --connect-timeout 1 "$probe_url" || true)"
  [[ "$code" != "000" && -n "$code" ]]
}

# Wait briefly for API to come up (e.g. after boot)
for i in {1..6}; do
  if probe_ok; then
    break
  fi
  sleep 5
done

if ! probe_ok; then
  echo "[WARN] Arachne API unavailable at ${BASE_URL}; skipping scheduled scrapes."
  if command -v erebus >/dev/null 2>&1; then
    erebus emit --best-effort --source-name arachne.scheduler --type arachne.scrape.skipped \
      --payload "{\"reason\":\"api_unavailable\",\"base_url\":\"${BASE_URL}\"}" >/dev/null 2>&1 || true
  fi
  exit 0
fi

urls=()
while IFS= read -r raw || [[ -n "$raw" ]]; do
  line="$(echo "$raw" | sed -e 's/#.*$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  [[ -z "$line" ]] && continue
  urls+=("$line")
done < "$SITES_FILE"

if [[ "${#urls[@]}" -eq 0 ]]; then
  echo "[WARN] No URLs found in $SITES_FILE"
  exit 0
fi

export ARACHNE_URLS
ARACHNE_URLS="$(printf "%s\n" "${urls[@]}")"

payload="$("$PYTHON_BIN" - <<'PY'
import json, os
urls = [u for u in os.environ["ARACHNE_URLS"].splitlines() if u.strip()]
print(json.dumps({"urls": urls}))
PY
)"

tmp_out="$(mktemp /tmp/arachne-scheduled-scrapes.XXXXXX.out)"
trap 'rm -f "$tmp_out"' EXIT
export ARACHNE_TMP_OUT="$tmp_out"
curl_rc=0
resp_code="$(
  curl -sS -o "$tmp_out" -w "%{http_code}" \
    -m 10 --connect-timeout 2 \
    -X POST "$SCRAPE_ENDPOINT" \
    -H "Content-Type: application/json" \
    --data "$payload"
)" || curl_rc=$?

# If curl failed (network/conn refused/etc), skip (timer will try again later)
if [[ "${curl_rc}" -ne 0 ]]; then
  echo "[WARN] curl failed (rc=${curl_rc}) posting to ${SCRAPE_ENDPOINT}; skipping."
  if command -v erebus >/dev/null 2>&1; then
    erebus emit --best-effort --source-name arachne.scheduler --type arachne.scrape.skipped \
      --payload "{\"reason\":\"curl_failed\",\"curl_rc\":${curl_rc},\"endpoint\":\"${SCRAPE_ENDPOINT}\"}" \
      >/dev/null 2>&1 || true
  fi
  exit 0
fi

body="$(cat "$tmp_out" 2>/dev/null || true)"

if [[ "$resp_code" == "202" ]]; then
  job_id="$(
"$PYTHON_BIN" - <<'PY'
import json, os
import sys
from pathlib import Path
try:
    data = json.loads(Path(os.environ["ARACHNE_TMP_OUT"]).read_text(encoding="utf-8"))
    print(data.get("job_id", ""))
except Exception:
    try:
        raw = Path(os.environ["ARACHNE_TMP_OUT"]).read_text(encoding="utf-8")
    except Exception:
        raw = ""
    raw = raw.replace("\n", " ")
    if len(raw) > 200:
        raw = raw[:200] + "...(truncated)"
    if raw:
        print("[WARN] scheduled scrapes accepted but response JSON malformed (job_id unavailable): "
              f"{raw}", file=sys.stderr)
    else:
        print("[WARN] scheduled scrapes accepted but response JSON malformed (job_id unavailable)",
              file=sys.stderr)
    print("")
PY
  )"

  echo "[OK] scheduled scrapes accepted: count=${#urls[@]} job_id=${job_id:-unknown} http=$resp_code"

  if command -v erebus >/dev/null 2>&1; then
    erebus emit --best-effort --source-name arachne.scheduler --type arachne.scrape.accepted \
      --payload "{\"count\":${#urls[@]},\"job_id\":\"${job_id}\",\"http\":$resp_code}" >/dev/null 2>&1 || true
  fi
  exit 0
fi

body="${body//$'\n'/ }"
if [[ ${#body} -gt 300 ]]; then
  body="${body:0:300}...(truncated)"
fi
echo "[ERR] scheduled scrapes rejected: http=${resp_code:-unknown} body=${body:-<empty>}" >&2
exit 1
