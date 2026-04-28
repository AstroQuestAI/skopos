#!/usr/bin/env bash
set -euo pipefail

SIDECAR_URL="${SIDECAR_URL:-http://127.0.0.1:8090}"

echo "[sidecar-smoke] Waiting for sidecar health at ${SIDECAR_URL}/health ..."
for i in {1..90}; do
  if curl -fsS "${SIDECAR_URL}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -fsS "${SIDECAR_URL}/health" >/dev/null
echo "[sidecar-smoke] Sidecar is healthy"

echo "[sidecar-smoke] Running TTS -> STT roundtrip ..."
tts_resp="$(curl -fsS -X POST "${SIDECAR_URL}/tts/mulaw-b64" \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello this is Alex assistant. Please share your name and reason for calling."}')"
audio_b64="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["audio_b64"])' <<<"${tts_resp}")"

stt_payload="$(python3 -c 'import json,sys; print(json.dumps({"audio_b64": sys.stdin.read().strip()}))' <<<"${audio_b64}")"
stt_resp="$(curl -fsS -X POST "${SIDECAR_URL}/stt/transcribe-mulaw-b64" \
  -H "Content-Type: application/json" \
  -d "${stt_payload}")"

python3 - <<'PY' "${stt_resp}"
import json
import sys

data = json.loads(sys.argv[1])
text = (data.get("text") or "").lower()
if not text:
    raise SystemExit("STT returned empty text")
print("[sidecar-smoke] STT text:", data.get("text"))
print("[sidecar-smoke] PASS")
PY
