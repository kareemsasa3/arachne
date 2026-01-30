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
  job_id="$(python - <<PY
import json, sys
try:
  print(json.loads(sys.argv[1]).get("job_id",""))
except Exception:
  print("")
PY
"$body")"

  echo "[OK] scheduled scrapes accepted: count=${#urls[@]} job_id=${job_id:-unknown} http=$resp_code"

  if command -v erebus >/dev/null 2>&1; then
    erebus emit --best-effort --source-name arachne.scheduler --type arachne.scrape.accepted \
      --payload "{\"count\":${#urls[@]},\"job_id\":\"${job_id:-}\",\"http\":$resp_code}" >/dev/null 2>&1 || true
  fi
  exit 0
fi

echo "[FAIL] scheduled scrapes rejected: http=$resp_code body=$(echo "$body" | tr '\n' ' ' | head -c 500)" >&2

if command -v erebus >/dev/null 2>&1; then
  esc="$(python - <<'PY'
import json, os
print(json.dumps({"http": int(os.environ["HTTP"]), "body": os.environ["BODY"][:500]}))
PY
)"
  # (keeping it simple; failure emit is optional—can skip if you prefer)
fi

exit 1
