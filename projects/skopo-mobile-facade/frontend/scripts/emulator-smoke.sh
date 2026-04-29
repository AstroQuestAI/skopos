#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"
ADB="$ANDROID_SDK_ROOT/platform-tools/adb"
EMULATOR="$ANDROID_SDK_ROOT/emulator/emulator"
AVD_NAME="${AVD_NAME:-s25_ultra_like}"
BOOT_TIMEOUT_SECONDS="${BOOT_TIMEOUT_SECONDS:-240}"
RECORD_SECONDS="${RECORD_SECONDS:-15}"

log() {
  printf '%s\n' "$*"
}

fail() {
  log "FAILED: $*"
  exit 1
}

command -v "$ADB" >/dev/null || fail "adb not found at $ADB"
command -v "$EMULATOR" >/dev/null || fail "emulator not found at $EMULATOR"

export ANDROID_SDK_ROOT
export PATH="$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$PATH"

if ! "$EMULATOR" -list-avds | grep -qx "$AVD_NAME"; then
  fail "AVD '$AVD_NAME' was not found. Available AVDs: $("$EMULATOR" -list-avds | tr '\n' ' ')"
fi

"$ADB" start-server >/dev/null

if "$ADB" devices | awk 'NR > 1 && $1 ~ /^emulator-/ && $2 == "device" { found=1 } END { exit found ? 0 : 1 }'; then
  log "Using already-running emulator."
else
  log "Starting emulator '$AVD_NAME'..."
  nohup "$EMULATOR" -avd "$AVD_NAME" -no-snapshot-load -no-boot-anim -netdelay none -netspeed full \
    > "$ROOT_DIR/artifacts/emulator-$AVD_NAME.log" 2>&1 &
fi

log "Waiting for emulator device..."
"$ADB" wait-for-device

deadline=$((SECONDS + BOOT_TIMEOUT_SECONDS))
while true; do
  booted="$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  if [ "$booted" = "1" ]; then
    break
  fi
  if [ "$SECONDS" -ge "$deadline" ]; then
    fail "Emulator did not finish booting within ${BOOT_TIMEOUT_SECONDS}s"
  fi
  sleep 3
done

log "Unlocking emulator..."
"$ADB" shell input keyevent 224 >/dev/null 2>&1 || true
"$ADB" shell input keyevent 82 >/dev/null 2>&1 || true
"$ADB" shell input swipe 540 1800 540 500 250 >/dev/null 2>&1 || true

log "Running mobile smoke test on emulator..."
(
  cd "$FRONTEND_DIR"
  RECORD_SECONDS="$RECORD_SECONDS" npm run test:mobile
)
