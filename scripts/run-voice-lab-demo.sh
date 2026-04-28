#!/usr/bin/env bash
set -euo pipefail

CALLER_NUMBER="${1:-+919998887776}"
RING_SECONDS="${RING_SECONDS:-8}"
POST_LAUNCH_DELAY_SECONDS="${POST_LAUNCH_DELAY_SECONDS:-2}"
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:8000/health}"

echo "[voice-lab] Checking emulator..."
adb get-state >/dev/null

echo "[voice-lab] Checking backend health at ${BACKEND_HEALTH_URL}..."
curl -fsS "${BACKEND_HEALTH_URL}" >/dev/null

echo "[voice-lab] Installing latest debug APK..."
adb install -r \
  /Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that/android-test-app/app/build/outputs/apk/debug/app-debug.apk \
  >/dev/null

echo "[voice-lab] Granting runtime permissions..."
adb shell pm grant com.example.callassistantsim android.permission.RECORD_AUDIO >/dev/null 2>&1 || true
adb shell pm grant com.example.callassistantsim android.permission.READ_PHONE_STATE >/dev/null 2>&1 || true
adb shell pm grant com.example.callassistantsim android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true

echo "[voice-lab] Launching app..."
adb shell am force-stop com.example.callassistantsim >/dev/null 2>&1 || true
adb shell am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER \
  -n com.example.callassistantsim/.MainActivity >/dev/null

sleep "${POST_LAUNCH_DELAY_SECONDS}"

echo "[voice-lab] Triggering incoming emulator call from ${CALLER_NUMBER}..."
adb emu gsm call "${CALLER_NUMBER}" >/dev/null

echo "[voice-lab] Call is ringing. In the app, use 'Voice Lab Start', then 'Voice Lab Listen' and speak."
echo "[voice-lab] Keeping call active for ${RING_SECONDS}s ..."
sleep "${RING_SECONDS}"

echo "[voice-lab] Cancelling call..."
adb emu gsm cancel "${CALLER_NUMBER}" >/dev/null

echo "[voice-lab] Done. Continue conversation in Voice Lab controls if needed."
