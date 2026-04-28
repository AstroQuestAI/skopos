#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that"
ARTIFACTS="${ROOT}/artifacts"
TMP_DIR="${ARTIFACTS}/dialect_demo_tmp"
RAW_MP4="${ARTIFACTS}/dialect-call-30s-raw.mp4"
VOICE_WAV="${ARTIFACTS}/dialect-call-30s-voice.wav"
FINAL_MP4="${ARTIFACTS}/dialect-call-30s-demo.mp4"
SCRIPT_TXT="${ARTIFACTS}/dialect-call-30s-script.txt"
PHONE_NUMBER="+919900112233"
APP_PKG="com.example.callassistantsim"
APK_PATH="${ROOT}/android-test-app/app/build/outputs/apk/debug/app-debug.apk"

mkdir -p "${ARTIFACTS}" "${TMP_DIR}"
rm -f "${TMP_DIR}"/*.aiff "${TMP_DIR}"/*.wav "${TMP_DIR}/concat.txt"

line1="Assistant: Namaste, you have reached Alex's assistant. May I know who is calling?"
line2="Caller: Hello madam, main Hyderabad se Ramesh bol raha hoon, from Sri Lakshmi Traders."
line3="Assistant: Thank you Ramesh garu. Please tell me what this call is regarding."
line4="Caller: Koncham urgent undi, payment confirmation pending since yesterday."
line5="Assistant: Understood. Is this urgent for today, or can it wait until tomorrow morning?"
line6="Caller: Aaj hi better hai, but tomorrow morning also okay if he confirms by ten."
line7="Assistant: Sure. Please share your callback number slowly."
line8="Caller: Number note cheyandi, nine eight seven six five four three two one zero."
line9="Assistant: Got it. I will pass this to Alex with medium urgency."
line10="Caller: Dhanyavadam, thank you so much."

printf "%s\n%s\n%s\n%s\n%s\n%s\n%s\n%s\n%s\n%s\n" \
  "${line1}" "${line2}" "${line3}" "${line4}" "${line5}" \
  "${line6}" "${line7}" "${line8}" "${line9}" "${line10}" > "${SCRIPT_TXT}"

voice_a="${VOICE_A:-Samantha}"
voice_b="${VOICE_B:-Rishi}"

say -v "${voice_a}" -r 178 -o "${TMP_DIR}/01.aiff" "${line1}"
say -v "${voice_b}" -r 170 -o "${TMP_DIR}/02.aiff" "${line2}"
say -v "${voice_a}" -r 178 -o "${TMP_DIR}/03.aiff" "${line3}"
say -v "${voice_b}" -r 170 -o "${TMP_DIR}/04.aiff" "${line4}"
say -v "${voice_a}" -r 178 -o "${TMP_DIR}/05.aiff" "${line5}"
say -v "${voice_b}" -r 170 -o "${TMP_DIR}/06.aiff" "${line6}"
say -v "${voice_a}" -r 178 -o "${TMP_DIR}/07.aiff" "${line7}"
say -v "${voice_b}" -r 165 -o "${TMP_DIR}/08.aiff" "${line8}"
say -v "${voice_a}" -r 178 -o "${TMP_DIR}/09.aiff" "${line9}"
say -v "${voice_b}" -r 168 -o "${TMP_DIR}/10.aiff" "${line10}"

for n in 01 02 03 04 05 06 07 08 09 10; do
  ffmpeg -y -i "${TMP_DIR}/${n}.aiff" -ar 16000 -ac 1 "${TMP_DIR}/${n}.wav" >/dev/null 2>&1
  printf "file '%s/%s.wav'\n" "${TMP_DIR}" "${n}" >> "${TMP_DIR}/concat.txt"
done

ffmpeg -y -f concat -safe 0 -i "${TMP_DIR}/concat.txt" -ar 16000 -ac 1 "${VOICE_WAV}" >/dev/null 2>&1

echo "[dialect-demo] Launching app..."
adb install -r "${APK_PATH}" >/dev/null
adb shell am force-stop "${APP_PKG}" >/dev/null 2>&1 || true
adb shell am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n "${APP_PKG}/.MainActivity" >/dev/null

echo "[dialect-demo] Recording 30s screen capture..."
adb shell rm -f /sdcard/dialect-call-30s-raw.mp4
adb shell screenrecord --bit-rate 8000000 --time-limit 30 /sdcard/dialect-call-30s-raw.mp4 >/dev/null 2>&1 &
REC_PID=$!

sleep 2
adb emu gsm call "${PHONE_NUMBER}" >/dev/null
sleep 24
adb emu gsm cancel "${PHONE_NUMBER}" >/dev/null
wait "${REC_PID}" 2>/dev/null || true

adb pull /sdcard/dialect-call-30s-raw.mp4 "${RAW_MP4}" >/dev/null

ffmpeg -y -i "${RAW_MP4}" -i "${VOICE_WAV}" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest "${FINAL_MP4}" >/dev/null 2>&1

echo "[dialect-demo] Done."
echo "[dialect-demo] Video: ${FINAL_MP4}"
echo "[dialect-demo] Script: ${SCRIPT_TXT}"
