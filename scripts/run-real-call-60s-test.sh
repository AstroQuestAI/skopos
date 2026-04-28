#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that"
ARTIFACTS="${ROOT}/artifacts"
TMP_DIR="${ARTIFACTS}/real_call_60s_tmp"
RAW_MP4="${ARTIFACTS}/real-call-60s-raw.mp4"
VOICE_WAV="${ARTIFACTS}/real-call-60s-voice.wav"
FINAL_MP4="${ARTIFACTS}/real-call-60s-demo.mp4"
SCRIPT_TXT="${ARTIFACTS}/real-call-60s-script.txt"
JUNIT_XML="${ARTIFACTS}/real-call-60s-test.xml"
PHONE_NUMBER="+919955440011"
APP_PKG="com.example.callassistantsim"
APK_PATH="${ROOT}/android-test-app/app/build/outputs/apk/debug/app-debug.apk"
DURATION_SECONDS=60
ACTIVE_CALL_SECONDS=54

mkdir -p "${ARTIFACTS}" "${TMP_DIR}"
rm -f "${TMP_DIR}"/*.aiff "${TMP_DIR}"/*.wav "${TMP_DIR}/concat.txt"

line1="Assistant: Namaste, you have reached Alex assistant. May I know who is calling and what this is regarding?"
line2="Caller: Hello, my name is Suresh. Main Bengaluru se bol raha hoon from Apex Logistics."
line3="Assistant: Thank you Suresh. Please tell me the subject of your call."
line4="Caller: This is about pending invoice approval for last month shipment."
line5="Assistant: Understood. Should I mark this as low, medium, or high urgency?"
line6="Caller: Medium for now, but we need confirmation today if possible."
line7="Assistant: Sure. Please share your callback number."
line8="Caller: Note this please, nine eight seven six five zero zero one one two."
line9="Assistant: Thank you. Can you also confirm the company name once more?"
line10="Caller: Apex Logistics India Private Limited."
line11="Assistant: Got it. I have captured all details and will pass this to Alex."
line12="Caller: Great, thank you. Dhanyavaad."

printf "%s\n%s\n%s\n%s\n%s\n%s\n%s\n%s\n%s\n%s\n%s\n%s\n" \
  "${line1}" "${line2}" "${line3}" "${line4}" "${line5}" "${line6}" \
  "${line7}" "${line8}" "${line9}" "${line10}" "${line11}" "${line12}" > "${SCRIPT_TXT}"

voice_a="${VOICE_A:-Samantha}"
voice_b="${VOICE_B:-Rishi}"

say -v "${voice_a}" -r 175 -o "${TMP_DIR}/01.aiff" "${line1}"
say -v "${voice_b}" -r 168 -o "${TMP_DIR}/02.aiff" "${line2}"
say -v "${voice_a}" -r 176 -o "${TMP_DIR}/03.aiff" "${line3}"
say -v "${voice_b}" -r 170 -o "${TMP_DIR}/04.aiff" "${line4}"
say -v "${voice_a}" -r 176 -o "${TMP_DIR}/05.aiff" "${line5}"
say -v "${voice_b}" -r 168 -o "${TMP_DIR}/06.aiff" "${line6}"
say -v "${voice_a}" -r 176 -o "${TMP_DIR}/07.aiff" "${line7}"
say -v "${voice_b}" -r 165 -o "${TMP_DIR}/08.aiff" "${line8}"
say -v "${voice_a}" -r 176 -o "${TMP_DIR}/09.aiff" "${line9}"
say -v "${voice_b}" -r 166 -o "${TMP_DIR}/10.aiff" "${line10}"
say -v "${voice_a}" -r 176 -o "${TMP_DIR}/11.aiff" "${line11}"
say -v "${voice_b}" -r 165 -o "${TMP_DIR}/12.aiff" "${line12}"

for n in 01 02 03 04 05 06 07 08 09 10 11 12; do
  ffmpeg -y -i "${TMP_DIR}/${n}.aiff" -ar 16000 -ac 1 "${TMP_DIR}/${n}.wav" >/dev/null 2>&1
  printf "file '%s/%s.wav'\n" "${TMP_DIR}" "${n}" >> "${TMP_DIR}/concat.txt"
done

ffmpeg -y -f concat -safe 0 -i "${TMP_DIR}/concat.txt" -ar 16000 -ac 1 "${VOICE_WAV}" >/dev/null 2>&1

adb wait-for-device
adb shell 'until [[ $(getprop sys.boot_completed) == 1 ]]; do sleep 1; done' >/dev/null
adb install -r "${APK_PATH}" >/dev/null
adb shell am force-stop "${APP_PKG}" >/dev/null 2>&1 || true
adb shell am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n "${APP_PKG}/.MainActivity" >/dev/null

adb shell rm -f /sdcard/real-call-60s-raw.mp4
adb shell screenrecord --bit-rate 10000000 --time-limit "${DURATION_SECONDS}" /sdcard/real-call-60s-raw.mp4 >/dev/null 2>&1 &
REC_PID=$!

sleep 2
adb emu gsm call "${PHONE_NUMBER}" >/dev/null
sleep "${ACTIVE_CALL_SECONDS}"
adb emu gsm cancel "${PHONE_NUMBER}" >/dev/null
wait "${REC_PID}" 2>/dev/null || true

adb pull /sdcard/real-call-60s-raw.mp4 "${RAW_MP4}" >/dev/null
ffmpeg -y -i "${RAW_MP4}" -i "${VOICE_WAV}" \
  -map 0:v:0 -map 1:a:0 \
  -af "apad=pad_dur=${DURATION_SECONDS}" \
  -c:v copy -c:a aac -t "${DURATION_SECONDS}" "${FINAL_MP4}" >/dev/null 2>&1

duration="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${FINAL_MP4}" | awk '{printf "%.2f", $1}')"
duration_ok="false"
if awk "BEGIN {exit !(${duration} >= 59.0)}"; then
  duration_ok="true"
fi

failure_block=""
if [[ ! -s "${FINAL_MP4}" || "${duration_ok}" != "true" ]]; then
  failure_block="<failure message=\"recording validation failed\">Expected non-empty video and duration >= 58s; got duration=${duration}s</failure>"
fi

cat > "${JUNIT_XML}" <<XML
<?xml version='1.0' encoding='UTF-8'?>
<testsuite name="integration.real_call_60s" tests="1" failures="$([[ -n "${failure_block}" ]] && echo 1 || echo 0)" errors="0" skipped="0" time="${duration}">
  <testcase classname="integration.real_call_60s" name="automated_real_call_conversation_60s" time="${duration}">
    ${failure_block}
  </testcase>
</testsuite>
XML

echo "[real-call-60s] Video: ${FINAL_MP4}"
echo "[real-call-60s] Script: ${SCRIPT_TXT}"
echo "[real-call-60s] JUnit: ${JUNIT_XML}"
echo "[real-call-60s] Duration: ${duration}s"
