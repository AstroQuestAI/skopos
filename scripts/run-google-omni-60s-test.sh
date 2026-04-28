#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that"
ARTIFACTS="${ROOT}/artifacts"
RAW_MP4="${ARTIFACTS}/google-omni-60s-raw.mp4"
FINAL_MP4="${ARTIFACTS}/google-omni-60s-demo.mp4"
VOICE_WAV="${ARTIFACTS}/google-omni-60s-voice.wav"
SCRIPT_TXT="${ARTIFACTS}/google-omni-60s-script.txt"
TRANSCRIPT_JSON="${ARTIFACTS}/google-omni-60s-transcript.json"
JUNIT_XML="${ARTIFACTS}/google-omni-60s-test.xml"
APP_PKG="com.example.callassistantsim"
APK_PATH="${ROOT}/android-test-app/app/build/outputs/apk/debug/app-debug.apk"
PHONE_NUMBER="+919944556677"
DURATION_SECONDS=60

mkdir -p "${ARTIFACTS}"

.venv/bin/python "${ROOT}/scripts/build_google_omnivoice_60s_dialogue.py" >/tmp/google-omni-60s-meta.json

if [[ ! -f "${VOICE_WAV}" ]]; then
  echo "voice wav not generated" >&2
  exit 1
fi

adb wait-for-device
adb shell 'until [[ $(getprop sys.boot_completed) == 1 ]]; do sleep 1; done' >/dev/null
adb install -r "${APK_PATH}" >/dev/null
adb shell am force-stop "${APP_PKG}" >/dev/null 2>&1 || true
adb shell am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n "${APP_PKG}/.MainActivity" >/dev/null

adb shell rm -f /sdcard/google-omni-60s-raw.mp4
adb shell screenrecord --bit-rate 10000000 --time-limit "${DURATION_SECONDS}" /sdcard/google-omni-60s-raw.mp4 >/dev/null 2>&1 &
REC_PID=$!

sleep 2
adb emu gsm call "${PHONE_NUMBER}" >/dev/null
sleep 52
adb emu gsm cancel "${PHONE_NUMBER}" >/dev/null
wait "${REC_PID}" 2>/dev/null || true

adb pull /sdcard/google-omni-60s-raw.mp4 "${RAW_MP4}" >/dev/null

ffmpeg -y -i "${RAW_MP4}" -i "${VOICE_WAV}" \
  -map 0:v:0 -map 1:a:0 \
  -af "apad=pad_dur=${DURATION_SECONDS}" \
  -c:v copy -c:a aac -t "${DURATION_SECONDS}" "${FINAL_MP4}" >/dev/null 2>&1

duration="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${FINAL_MP4}" | awk '{printf "%.2f", $1}')"
duration_ok="false"
if awk "BEGIN {exit !(${duration} >= 59.0)}"; then
  duration_ok="true"
fi

speaker_checks="false"
if grep -q "Assistant(OmniVoice)" "${SCRIPT_TXT}" && grep -q "Caller(Google)" "${SCRIPT_TXT}"; then
  speaker_checks="true"
fi

failure_msg=""
if [[ ! -s "${FINAL_MP4}" ]]; then
  failure_msg="video_not_found"
elif [[ "${duration_ok}" != "true" ]]; then
  failure_msg="duration_lt_59s:${duration}"
elif [[ "${speaker_checks}" != "true" ]]; then
  failure_msg="speaker_markers_missing"
fi

failures=0
failure_block=""
if [[ -n "${failure_msg}" ]]; then
  failures=1
  failure_block="<failure message=\"${failure_msg}\">Expected 60s Google caller and OmniVoice responder recording.</failure>"
fi

cat > "${JUNIT_XML}" <<XML
<?xml version='1.0' encoding='UTF-8'?>
<testsuite name="integration.google_omni_60s" tests="1" failures="${failures}" errors="0" skipped="0" time="${duration}">
  <testcase classname="integration.google_omni_60s" name="simulate_google_caller_omni_responder_60s" time="${duration}">
    ${failure_block}
  </testcase>
</testsuite>
XML

echo "[google-omni-60s] Video: ${FINAL_MP4}"
echo "[google-omni-60s] Voice: ${VOICE_WAV}"
echo "[google-omni-60s] Script: ${SCRIPT_TXT}"
echo "[google-omni-60s] Transcript: ${TRANSCRIPT_JSON}"
echo "[google-omni-60s] JUnit: ${JUNIT_XML}"
echo "[google-omni-60s] Duration: ${duration}s"
