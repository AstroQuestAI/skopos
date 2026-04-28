#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that"
ARTIFACTS="${ROOT}/artifacts"
RAW_MP4="${ARTIFACTS}/client-call-demo-raw.mp4"
VOICE_AIFF="${ARTIFACTS}/client-call-demo-voice.aiff"
FINAL_MP4="${ARTIFACTS}/client-call-demo-final.mp4"
PHONE_NUMBER="+919998887776"

mkdir -p "${ARTIFACTS}"

echo "[demo] Preparing emulator app state..."
adb shell pm grant com.example.callassistantsim android.permission.READ_PHONE_STATE >/dev/null 2>&1 || true
adb shell pm grant com.example.callassistantsim android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
adb shell am force-stop com.example.callassistantsim >/dev/null 2>&1 || true
adb shell am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n com.example.callassistantsim/.MainActivity >/dev/null

echo "[demo] Recording emulator screen..."
adb shell rm -f /sdcard/client-call-demo-raw.mp4
adb shell screenrecord --bit-rate 8000000 --time-limit 45 /sdcard/client-call-demo-raw.mp4 >/dev/null 2>&1 &
REC_PID=$!

sleep 2
echo "[demo] Triggering incoming GSM call ${PHONE_NUMBER}..."
adb emu gsm call "${PHONE_NUMBER}" >/dev/null
sleep 6
adb emu gsm cancel "${PHONE_NUMBER}" >/dev/null
sleep 2
adb shell am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n com.example.callassistantsim/.MainActivity >/dev/null
sleep 7

kill -INT "${REC_PID}" >/dev/null 2>&1 || true
wait "${REC_PID}" 2>/dev/null || true

echo "[demo] Pulling raw video..."
adb pull /sdcard/client-call-demo-raw.mp4 "${RAW_MP4}" >/dev/null

echo "[demo] Generating voice narration..."
say -v Samantha -r 175 -o "${VOICE_AIFF}" \
  "This demo shows a real incoming GSM call on Android emulator. When the call rings, our app auto screens it with the AI assistant, asks who is calling and the purpose, captures urgency and callback number, and stores a summary for review."

echo "[demo] Muxing narration with video..."
ffmpeg -y -i "${RAW_MP4}" -i "${VOICE_AIFF}" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest "${FINAL_MP4}" >/dev/null 2>&1

echo "[demo] Done."
echo "[demo] Final video: ${FINAL_MP4}"
