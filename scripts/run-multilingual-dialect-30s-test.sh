#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that"
ARTIFACTS="${ROOT}/artifacts"
RAW_MP4="${ARTIFACTS}/multilingual-dialect-30s-raw.mp4"
FINAL_MP4="${ARTIFACTS}/multilingual-dialect-30s-demo.mp4"
VOICE_WAV="${ARTIFACTS}/multilingual-dialect-voice.wav"
SCRIPT_TXT="${ARTIFACTS}/multilingual-dialect-script.txt"
TRANSCRIPT_JSON="${ARTIFACTS}/multilingual-dialect-transcript.json"
JUNIT_XML="${ARTIFACTS}/multilingual-dialect-30s-test.xml"
APP_PKG="com.example.callassistantsim"
APK_PATH="${ROOT}/android-test-app/app/build/outputs/apk/debug/app-debug.apk"
PHONE_NUMBER="+919922334455"
SERVER_URL="http://127.0.0.1:8000"
DURATION_SECONDS=30

mkdir -p "${ARTIFACTS}"

SERVER_STARTED="false"
if ! curl -fsS "${SERVER_URL}/health" >/dev/null 2>&1; then
  .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 >/tmp/multi-lang-30-uvicorn.log 2>&1 &
  UVICORN_PID=$!
  SERVER_STARTED="true"
  for _ in $(seq 1 40); do
    if curl -fsS "${SERVER_URL}/health" >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
fi

cleanup() {
  if [[ "${SERVER_STARTED}" == "true" && -n "${UVICORN_PID:-}" ]]; then
    kill "${UVICORN_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

adb wait-for-device
adb shell 'until [[ $(getprop sys.boot_completed) == 1 ]]; do sleep 1; done' >/dev/null
adb install -r "${APK_PATH}" >/dev/null
adb shell am force-stop "${APP_PKG}" >/dev/null 2>&1 || true
adb shell am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n "${APP_PKG}/.MainActivity" >/dev/null

.venv/bin/python "${ROOT}/scripts/build_multilingual_dialogue.py" --base-url "${SERVER_URL}" --out-dir "${ARTIFACTS}" >/tmp/multilingual-dialogue-30-meta.json

if [[ ! -f "${VOICE_WAV}" ]]; then
  echo "voice wav not generated" >&2
  exit 1
fi

adb shell rm -f /sdcard/multilingual-dialect-30s-raw.mp4
adb shell screenrecord --bit-rate 9000000 --time-limit "${DURATION_SECONDS}" /sdcard/multilingual-dialect-30s-raw.mp4 >/dev/null 2>&1 &
REC_PID=$!

sleep 2
adb emu gsm call "${PHONE_NUMBER}" >/dev/null
sleep 24
adb emu gsm cancel "${PHONE_NUMBER}" >/dev/null
wait "${REC_PID}" 2>/dev/null || true

adb pull /sdcard/multilingual-dialect-30s-raw.mp4 "${RAW_MP4}" >/dev/null

ffmpeg -y -i "${RAW_MP4}" -i "${VOICE_WAV}" \
  -map 0:v:0 -map 1:a:0 \
  -af "apad=pad_dur=${DURATION_SECONDS}" \
  -c:v copy -c:a aac -t "${DURATION_SECONDS}" "${FINAL_MP4}" >/dev/null 2>&1

duration="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${FINAL_MP4}" | awk '{printf "%.2f", $1}')"
duration_ok="false"
if awk "BEGIN {exit !(${duration} >= 29.0)}"; then
  duration_ok="true"
fi

lang_checks="false"
if grep -q "Kripya" "${SCRIPT_TXT}" && grep -q "Mee" "${SCRIPT_TXT}" && grep -q "May I know" "${SCRIPT_TXT}"; then
  lang_checks="true"
fi

failure_msg=""
if [[ ! -s "${FINAL_MP4}" ]]; then
  failure_msg="video_not_found"
elif [[ "${duration_ok}" != "true" ]]; then
  failure_msg="duration_lt_29s:${duration}"
elif [[ "${lang_checks}" != "true" ]]; then
  failure_msg="language_switch_markers_missing"
fi

failures=0
failure_block=""
if [[ -n "${failure_msg}" ]]; then
  failures=1
  failure_block="<failure message=\"${failure_msg}\">Expected multilingual/dialect responses with 30s recording.</failure>"
fi

cat > "${JUNIT_XML}" <<XML
<?xml version='1.0' encoding='UTF-8'?>
<testsuite name="integration.multilingual_dialect_30s" tests="1" failures="${failures}" errors="0" skipped="0" time="${duration}">
  <testcase classname="integration.multilingual_dialect_30s" name="simulate_caller_and_callee_multilingual_dialects_30s" time="${duration}">
    ${failure_block}
  </testcase>
</testsuite>
XML

echo "[multi-lang-30s] Video: ${FINAL_MP4}"
echo "[multi-lang-30s] Voice: ${VOICE_WAV}"
echo "[multi-lang-30s] Script: ${SCRIPT_TXT}"
echo "[multi-lang-30s] Transcript: ${TRANSCRIPT_JSON}"
echo "[multi-lang-30s] JUnit: ${JUNIT_XML}"
echo "[multi-lang-30s] Duration: ${duration}s"
