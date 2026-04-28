#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that"
ARTIFACTS="${ROOT}/artifacts"
RAW_MP4="${ARTIFACTS}/omnivoice-2female-30s-raw.mp4"
FINAL_MP4="${ARTIFACTS}/omnivoice-2female-30s-demo.mp4"
VOICE_WAV="${ARTIFACTS}/omnivoice-2female-30s-voice.wav"
SCRIPT_TXT="${ARTIFACTS}/omnivoice-2female-30s-script.txt"
TRANSCRIPT_JSON="${ARTIFACTS}/omnivoice-2female-30s-transcript.json"
JUNIT_XML="${ARTIFACTS}/omnivoice-2female-30s-test.xml"
APP_PKG="com.example.callassistantsim"
APK_PATH="${ROOT}/android-test-app/app/build/outputs/apk/debug/app-debug.apk"
PHONE_NUMBER="+919944110022"
DURATION_SECONDS=30

mkdir -p "${ARTIFACTS}"
.venv/bin/python "${ROOT}/scripts/build_omnivoice_2female_30s_dialogue.py" >/tmp/omnivoice-2female-30s-meta.json

adb wait-for-device
adb shell 'until [[ $(getprop sys.boot_completed) == 1 ]]; do sleep 1; done' >/dev/null
adb install -r "${APK_PATH}" >/dev/null
adb shell am force-stop "${APP_PKG}" >/dev/null 2>&1 || true
adb shell am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n "${APP_PKG}/.MainActivity" >/dev/null

adb shell rm -f /sdcard/omnivoice-2female-30s-raw.mp4
adb shell screenrecord --bit-rate 9000000 --time-limit "${DURATION_SECONDS}" /sdcard/omnivoice-2female-30s-raw.mp4 >/dev/null 2>&1 &
REC_PID=$!

sleep 2
adb emu gsm call "${PHONE_NUMBER}" >/dev/null
sleep 24
adb emu gsm cancel "${PHONE_NUMBER}" >/dev/null
wait "${REC_PID}" 2>/dev/null || true

adb pull /sdcard/omnivoice-2female-30s-raw.mp4 "${RAW_MP4}" >/dev/null
ffmpeg -y -i "${RAW_MP4}" -i "${VOICE_WAV}" -map 0:v:0 -map 1:a:0 -af "apad=pad_dur=${DURATION_SECONDS}" -c:v copy -c:a aac -t "${DURATION_SECONDS}" "${FINAL_MP4}" >/dev/null 2>&1

duration="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${FINAL_MP4}" | awk '{printf "%.2f", $1}')"
failures=0
failure_block=""
if [[ ! -s "${FINAL_MP4}" ]]; then
  failures=1
  failure_block="<failure message=\"video_not_found\">Expected a non-empty 30s demo video.</failure>"
fi

cat > "${JUNIT_XML}" <<XML
<?xml version='1.0' encoding='UTF-8'?>
<testsuite name="integration.omnivoice_2female_30s" tests="1" failures="${failures}" errors="0" skipped="0" time="${duration}">
  <testcase classname="integration.omnivoice_2female_30s" name="simulate_omnivoice_two_female_30s" time="${duration}">
    ${failure_block}
  </testcase>
</testsuite>
XML

echo "[omnivoice-2female-30s] Video: ${FINAL_MP4}"
echo "[omnivoice-2female-30s] Voice: ${VOICE_WAV}"
echo "[omnivoice-2female-30s] Script: ${SCRIPT_TXT}"
echo "[omnivoice-2female-30s] Transcript: ${TRANSCRIPT_JSON}"
echo "[omnivoice-2female-30s] JUnit: ${JUNIT_XML}"
echo "[omnivoice-2female-30s] Duration: ${duration}s"
