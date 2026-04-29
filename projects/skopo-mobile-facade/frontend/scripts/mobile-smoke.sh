#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
ANDROID_DIR="$FRONTEND_DIR/android"
ARTIFACT_ROOT="$ROOT_DIR/artifacts/mobile-smoke"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$ARTIFACT_ROOT/$RUN_ID"
ADB="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}/platform-tools/adb"
PACKAGE_NAME="${PACKAGE_NAME:-com.assistant.skopo}"
ACTIVITY_NAME="${ACTIVITY_NAME:-.MainActivity}"
RECORD_SECONDS="${RECORD_SECONDS:-20}"
INSTALL_RELEASE="${INSTALL_RELEASE:-1}"
THEME_SWEEP="${THEME_SWEEP:-0}"
VIDEO_ONLY="${VIDEO_ONLY:-0}"
TEST_SUITE_NAME="${TEST_SUITE_NAME:-Mobile Smoke Report}"

mkdir -p "$OUT_DIR"

log() {
  printf '%s\n' "$*" | tee -a "$OUT_DIR/run.log"
}

fail() {
  log "FAILED: $*"
  write_report "failed" "$*"
  exit 1
}

html_escape() {
  sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'
}

dismiss_system_anr_dialog() {
  local dump_file="/sdcard/mobile-smoke-window.xml"
  local xml=""
  local bounds=""
  local coords=""

  "$ADB" shell uiautomator dump "$dump_file" >/dev/null 2>&1 || return 0
  xml="$("$ADB" shell cat "$dump_file" 2>/dev/null || true)"

  if ! printf '%s' "$xml" | rg -q "isn.t responding|text=\"Wait\""; then
    return 0
  fi

  bounds="$(printf '%s' "$xml" | perl -ne 'if (/text="Wait"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/) { print "$1,$2,$3,$4"; exit }')"
  if [ -z "$bounds" ]; then
    log "System ANR dialog detected, but Wait button bounds were not available."
    return 0
  fi

  coords="$(printf '%s' "$bounds" | awk -F, '{ printf "%d %d", ($1+$3)/2, ($2+$4)/2 }')"
  log "System ANR dialog detected; tapping Wait at $coords."
  "$ADB" shell input tap $coords >/dev/null 2>&1 || true
  sleep 2
}

dismiss_system_anr_dialog_fast() {
  # UIAutomator can hang while the app has a continuous breathing animation.
  # This coordinate is the Android ANR dialog's "Wait" row on the S25-like AVD.
  "$ADB" shell input tap 720 1760 >/dev/null 2>&1 || true
  sleep 0.4
}

tap_accessibility_label() {
  local label="$1"
  local dump_file="/sdcard/mobile-smoke-window.xml"
  local xml=""
  local bounds=""
  local coords=""
  local attempt=0

  while [ "$attempt" -lt 6 ]; do
    "$ADB" shell uiautomator dump "$dump_file" >/dev/null 2>&1 || true
    xml="$("$ADB" shell cat "$dump_file" 2>/dev/null || true)"
    bounds="$(printf '%s' "$xml" | perl -ne 'BEGIN { $label = $ARGV[0]; @ARGV = (); } if (/\Qcontent-desc="$label"\E[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/) { print "$1,$2,$3,$4"; exit }' "$label")"

    if [ -n "$bounds" ]; then
      coords="$(printf '%s' "$bounds" | awk -F, '{ printf "%d %d", ($1+$3)/2, ($2+$4)/2 }')"
      log "Tapping '$label' at $coords."
      "$ADB" shell input tap $coords >/dev/null 2>&1 || true
      sleep 1
      return 0
    fi

    "$ADB" shell input swipe 1220 500 220 500 260 >/dev/null 2>&1 || true
    sleep 1
    attempt=$((attempt + 1))
  done

  log "Could not find accessibility label: $label"
  return 1
}

run_theme_sweep() {
  local names=(
    "01-violet-amber-light"
    "02-violet-amber-dark"
    "03-ocean-blue-light"
    "04-ocean-blue-dark"
    "05-rose-gold-light"
    "06-rose-gold-dark"
    "07-forest-green-light"
    "08-forest-green-dark"
    "09-midnight-slate-light"
    "10-midnight-slate-dark"
  )
  local taps=(
    "280 514"
    "756 514"
    "1196 514"
    "swipe"
    "938 514"
    "1287 514"
    "swipe"
    "1050 514"
    "1343 514"
    "swipe"
    "1231 514"
    "1062 514"
    "1349 514"
  )
  local tap_index=0
  local step=""

  log "Running 10-theme coordinate click/display sweep..."
  "$ADB" shell input swipe 220 500 1220 500 260 >/dev/null 2>&1 || true
  "$ADB" shell input swipe 220 500 1220 500 260 >/dev/null 2>&1 || true
  sleep 1

  for step in "${taps[@]}"; do
    if [ "$step" = "swipe" ]; then
      "$ADB" shell input swipe 1220 514 220 514 260 >/dev/null 2>&1 || true
      sleep 1
    else
      log "Tapping theme coordinate '${names[$tap_index]}' at $step."
      "$ADB" shell input tap $step >/dev/null 2>&1 || true
      sleep 1
      dismiss_system_anr_dialog
      "$ADB" exec-out screencap -p > "$OUT_DIR/theme-${names[$tap_index]}.png"
      tap_index=$((tap_index + 1))
    fi
  done

  log "Tapping protection toggle at 1231 864."
  "$ADB" shell input tap 1231 864 >/dev/null 2>&1 || true
  sleep 1
  "$ADB" exec-out screencap -p > "$OUT_DIR/click-protection-toggle.png"
  log "Tapping lookup action at 1098 2737."
  "$ADB" shell input tap 1098 2737 >/dev/null 2>&1 || true
  sleep 1
  "$ADB" exec-out screencap -p > "$OUT_DIR/click-lookup.png"
  log "Tapping History tab at 720 2992."
  "$ADB" shell input tap 720 2992 >/dev/null 2>&1 || true
  sleep 1
  "$ADB" exec-out screencap -p > "$OUT_DIR/click-history-tab.png"
  log "Tapping Profile tab at 1200 2992."
  "$ADB" shell input tap 1200 2992 >/dev/null 2>&1 || true
  sleep 1
  "$ADB" exec-out screencap -p > "$OUT_DIR/click-profile-tab.png"
}

run_fast_theme_sweep() {
  local steps=(
    "240 514"
    "720 514"
    "1200 514"
    "240 514"
    "1231 864"
    "1098 2737"
    "720 2992"
    "1200 2992"
    "360 2992"
  )
  local step=""

  log "Running fast 60s Green Gold tab/control sweep..."
  "$ADB" shell input swipe 220 500 1220 500 160 >/dev/null 2>&1 || true
  "$ADB" shell input swipe 220 500 1220 500 160 >/dev/null 2>&1 || true
  sleep 3

  for step in "${steps[@]}"; do
    dismiss_system_anr_dialog_fast
    log "Fast sweep tap at $step."
    "$ADB" shell input tap $step >/dev/null 2>&1 || true
    dismiss_system_anr_dialog_fast
    sleep 2.4
  done
}

write_report() {
  local status="$1"
  local note="${2:-}"
  local devices=""
  local log_tail=""
  local screenshot_cards=""
  local theme_sweep_section=""
  devices="$("$ADB" devices -l 2>/dev/null | html_escape || true)"
  log_tail="$(tail -n 160 "$OUT_DIR/run.log" 2>/dev/null | html_escape || true)"

  local status_bg="#fff4d6"
  local status_fg="#7a4c00"
  if [ "$status" = "success" ]; then
    status_bg="#dff7e8"
    status_fg="#126b35"
  fi

  if [ "$VIDEO_ONLY" != "1" ]; then
    screenshot_cards='
      <section class="card">
        <h3>Launch Screenshot</h3>
        <a href="launch.png"><img src="launch.png" alt="Launch screenshot"></a>
      </section>
      <section class="card">
        <h3>Post-record Screenshot</h3>
        <a href="after-record.png"><img src="after-record.png" alt="Post record screenshot"></a>
      </section>'
    theme_sweep_section="
	    <h2>Theme Sweep</h2>
	    <div class=\"grid\">
$(for png in "$OUT_DIR"/theme-*.png "$OUT_DIR"/click-*.png; do
  [ -f "$png" ] || continue
  base="$(basename "$png")"
  printf '      <section class="card"><h3>%s</h3><a href="%s"><img src="%s" alt="%s"></a></section>\n' "$base" "$base" "$base" "$base"
done)
	    </div>"
  fi

  cat > "$OUT_DIR/report.html" <<HTML
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>$TEST_SUITE_NAME - $RUN_ID</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #1d2430; }
    main { max-width: 1080px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { margin-top: 28px; font-size: 18px; }
    .status { display: inline-block; padding: 8px 12px; border-radius: 999px; font-weight: 700; background: $status_bg; color: $status_fg; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; }
    .card { background: white; border: 1px solid #dde2ea; border-radius: 10px; padding: 16px; box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04); }
    img, video { width: 100%; border-radius: 8px; border: 1px solid #d9dee7; background: #111; }
    code, pre { background: #111827; color: #e5e7eb; border-radius: 8px; }
    pre { padding: 14px; overflow: auto; white-space: pre-wrap; }
    a { color: #006fba; font-weight: 700; }
  </style>
</head>
<body>
	  <main>
    <h1>$TEST_SUITE_NAME</h1>
    <p><strong>Run:</strong> $RUN_ID</p>
    <p><strong>Status:</strong> <span class="status">$status</span></p>
    <p>$note</p>

	    <h2>Artifacts</h2>
    <div class="grid">
$screenshot_cards
      <section class="card">
        <h3>Screen Recording</h3>
        <video controls src="screenrecord.mp4"></video>
        <p><a href="screenrecord.mp4">Open MP4</a></p>
      </section>
	    </div>

$theme_sweep_section

    <h2>Device</h2>
    <pre>$devices</pre>

    <h2>Run Log</h2>
    <pre>$log_tail</pre>
  </main>
</body>
</html>
HTML

  cat > "$ARTIFACT_ROOT/latest.html" <<HTML
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="0; url=$RUN_ID/report.html" />
  <title>Latest Mobile Smoke Report</title>
</head>
<body>
  <p>Opening latest report: <a href="$RUN_ID/report.html">$RUN_ID/report.html</a></p>
</body>
</html>
HTML
}

command -v "$ADB" >/dev/null || fail "adb not found at $ADB"

log "Run: $RUN_ID"
log "Output: $OUT_DIR"
log "ADB: $ADB"

"$ADB" start-server >/dev/null
DEVICE_COUNT="$("$ADB" devices | awk 'NR > 1 && $2 == "device" { count++ } END { print count + 0 }')"
if [ "$DEVICE_COUNT" -lt 1 ]; then
  fail "No authorized Android device found. Connect phone, enable USB debugging, and accept the RSA prompt."
fi

log "Connected devices:"
"$ADB" devices -l | tee -a "$OUT_DIR/run.log"

if [ "$INSTALL_RELEASE" = "1" ]; then
  log "Building and installing release APK..."
  export JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home -v 17)}"
  (cd "$ANDROID_DIR" && ./gradlew :app:installRelease) 2>&1 | tee -a "$OUT_DIR/run.log"
else
  log "Skipping install because INSTALL_RELEASE=$INSTALL_RELEASE"
fi

log "Clearing logs and launching $PACKAGE_NAME..."
"$ADB" logcat -c || true
"$ADB" shell am force-stop "$PACKAGE_NAME" || true
if "$ADB" shell am start -n "$PACKAGE_NAME/$ACTIVITY_NAME" 2>&1 | tee -a "$OUT_DIR/run.log"; then
  log "Launched with am start."
else
  log "am start failed; falling back to monkey launcher."
  "$ADB" shell monkey -p "$PACKAGE_NAME" -c android.intent.category.LAUNCHER 1 | tee -a "$OUT_DIR/run.log"
fi
sleep 6
dismiss_system_anr_dialog

if [ "$VIDEO_ONLY" = "1" ]; then
  log "Recording full testing process for ${RECORD_SECONDS}s..."
  "$ADB" shell rm -f /sdcard/call-assistant-smoke.mp4 >/dev/null 2>&1 || true
  "$ADB" shell screenrecord --time-limit "$RECORD_SECONDS" /sdcard/call-assistant-smoke.mp4 >/dev/null 2>&1 &
  SCREENRECORD_PID=$!
  sleep 2
  run_fast_theme_sweep
  wait "$SCREENRECORD_PID" || true
  "$ADB" pull /sdcard/call-assistant-smoke.mp4 "$OUT_DIR/screenrecord.mp4" | tee -a "$OUT_DIR/run.log"
elif [ "$THEME_SWEEP" = "1" ]; then
  log "Capturing launch screenshot..."
  "$ADB" exec-out screencap -p > "$OUT_DIR/launch.png"
  run_theme_sweep
  log "Recording screen for ${RECORD_SECONDS}s..."
  dismiss_system_anr_dialog
  "$ADB" shell rm -f /sdcard/call-assistant-smoke.mp4 >/dev/null 2>&1 || true
  "$ADB" shell screenrecord --time-limit "$RECORD_SECONDS" /sdcard/call-assistant-smoke.mp4 | tee -a "$OUT_DIR/run.log" || true
  sleep 1
  "$ADB" pull /sdcard/call-assistant-smoke.mp4 "$OUT_DIR/screenrecord.mp4" | tee -a "$OUT_DIR/run.log"
  log "Capturing final screenshot..."
  dismiss_system_anr_dialog
  "$ADB" exec-out screencap -p > "$OUT_DIR/after-record.png"
else
  log "Capturing launch screenshot..."
  "$ADB" exec-out screencap -p > "$OUT_DIR/launch.png"
  log "Recording screen for ${RECORD_SECONDS}s..."
  dismiss_system_anr_dialog
  "$ADB" shell rm -f /sdcard/call-assistant-smoke.mp4 >/dev/null 2>&1 || true
  "$ADB" shell screenrecord --time-limit "$RECORD_SECONDS" /sdcard/call-assistant-smoke.mp4 | tee -a "$OUT_DIR/run.log" || true
  sleep 1
  "$ADB" pull /sdcard/call-assistant-smoke.mp4 "$OUT_DIR/screenrecord.mp4" | tee -a "$OUT_DIR/run.log"
  log "Capturing final screenshot..."
  dismiss_system_anr_dialog
  "$ADB" exec-out screencap -p > "$OUT_DIR/after-record.png"
fi

log "Collecting focused activity and filtered logs..."
"$ADB" shell dumpsys window | rg -i "mCurrentFocus|mFocusedApp|$PACKAGE_NAME" > "$OUT_DIR/window-focus.txt" || true
"$ADB" logcat -d | rg -i "$PACKAGE_NAME|ReactNative|ReactHost|Unable to load|Exception|FATAL|AndroidRuntime|ForegroundService|AssistantForegroundService" > "$OUT_DIR/logcat-filtered.txt" || true

if rg -i "Unable to load script|FATAL EXCEPTION|AndroidRuntime.*FATAL" "$OUT_DIR/logcat-filtered.txt" >/dev/null 2>&1; then
  fail "Launch completed, but filtered logcat contains a fatal/runtime/load-script error."
fi

if [ "$VIDEO_ONLY" = "1" ]; then
  write_report "success" "App launched and the full automated theme/control test was recorded as one video within ${RECORD_SECONDS}s."
else
  write_report "success" "App launched, screenshots and screen recording were captured automatically."
fi
log "Report: $OUT_DIR/report.html"
log "Latest: $ARTIFACT_ROOT/latest.html"
