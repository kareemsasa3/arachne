#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${ARACHNE_BASE_URL:-http://127.0.0.1:8787}"
SCRAPE_ENDPOINT="${BASE_URL}/api/arachne/scrape"
SITES_FILE="${ARACHNE_SITES_FILE:-/opt/arachne/infrastructure/system/schedules/sites.txt}"

command -v curl >/dev/null 2>&1 || { echo "[ERR] curl missing" >&2; exit 1; }
command -v python >/dev/null 2>&1 || { echo "[ERR] python missing" >&2; exit 1; }

if [[ ! -f "$SITES_FILE" ]]; then
  echo "[ERR] Sites file not found: $SITES_FILE" >&2
  exit 1
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

payload="$(python - <<'PY'
import json, os
urls = [u for u in os.environ["ARACHNE_URLS"].splitlines() if u.strip()]
print(json.dumps({"urls": urls}))
PY
)"

resp_code="$(curl -sS -o /tmp/arachne-scheduled-scrapes.out -w "%{http_code}" \
  -X POST "$SCRAPE_ENDPOINT" \
  -H "Content-Type: application/json" \
  --data "$payload" || true)"

body="$(cat /tmp/arachne-scheduled-scrapes.out 2>/dev/null || true)"

if [[ "$resp_code" == "202" ]]; then
  job_id="$(
python - <<'PY'
import json
import sys
from pathlib import Path
try:
    data = json.loads(Path("/tmp/arachne-scheduled-scrapes.out").read_text(encoding="utf-8"))
    print(data.get("job_id", ""))
except Exception:
    try:
        raw = Path("/tmp/arachne-scheduled-scrapes.out").read_text(encoding="utf-8")
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

exit 1
