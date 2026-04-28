#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:8010}"

echo "[smoke] Waiting for API health at ${API_URL}/health ..."
for i in {1..30}; do
  if curl -fsS "${API_URL}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -fsS "${API_URL}/health" >/dev/null
echo "[smoke] API is healthy"

echo "[smoke] Starting simulated call ..."
start_payload='{"from_number":"+919900001111","to_number":"+911234567890"}'
start_resp="$(curl -fsS -X POST "${API_URL}/api/sim/start" -H "Content-Type: application/json" -d "${start_payload}")"
call_sid="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["call_sid"])' <<<"${start_resp}")"
echo "[smoke] call_sid=${call_sid}"

echo "[smoke] Sending caller turn ..."
turn_payload="$(cat <<JSON
{"call_sid":"${call_sid}","caller_text":"My name is Priya Nair from ICICI Bank. This is urgent regarding account verification. Call me at 9898989898"}
JSON
)"
turn_resp="$(curl -fsS -X POST "${API_URL}/api/sim/turn" -H "Content-Type: application/json" -d "${turn_payload}")"

python3 - <<'PY' "${turn_resp}"
import json
import sys

data = json.loads(sys.argv[1])
details = data["session"]["details"]
summary = data["session"]["summary"] or ""
checks = {
    "caller_name": details.get("caller_name"),
    "company": details.get("company"),
    "urgency": details.get("urgency"),
    "callback_number": details.get("callback_number"),
}
missing = [k for k, v in checks.items() if not v]
if missing:
    raise SystemExit(f"Missing extracted fields: {missing}")
if "Priya Nair" not in summary:
    raise SystemExit("Summary does not include expected caller name")
if not data.get("should_end"):
    raise SystemExit("Expected should_end=true for this scripted turn")
print("[smoke] Extraction validated:", checks)
print("[smoke] Summary validated")
PY

echo "[smoke] PASS"
