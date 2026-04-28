#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that"
MANIFEST_DEFAULT="${ROOT}/artifacts/voice_clean/training_metadata.weighted.csv"
RUNS_DIR_DEFAULT="${ROOT}/artifacts/voice_adapt_runs"

MANIFEST="${MANIFEST:-${MANIFEST_DEFAULT}}"
RUNS_DIR="${RUNS_DIR:-${RUNS_DIR_DEFAULT}}"
RUN_NAME="${RUN_NAME:-adapt_$(date +%Y%m%d_%H%M%S)}"
RUN_DIR="${RUNS_DIR}/${RUN_NAME}"
EPOCHS="${EPOCHS:-4}"
VAL_SPLIT="${VAL_SPLIT:-0.15}"
BATCH_SIZE="${BATCH_SIZE:-8}"
LR="${LR:-1e-5}"

if [[ ! -f "${MANIFEST}" ]]; then
  echo "[voice-train] Missing manifest: ${MANIFEST}" >&2
  exit 1
fi

mkdir -p "${RUN_DIR}"
cp "${MANIFEST}" "${RUN_DIR}/manifest.csv"

cat > "${RUN_DIR}/train_config.env" <<EOF
MANIFEST=${MANIFEST}
RUN_DIR=${RUN_DIR}
EPOCHS=${EPOCHS}
VAL_SPLIT=${VAL_SPLIT}
BATCH_SIZE=${BATCH_SIZE}
LR=${LR}
EOF

cat > "${RUN_DIR}/README.txt" <<EOF
Voice adaptation run scaffold
-----------------------------
Manifest: ${MANIFEST}
Run dir: ${RUN_DIR}
Epochs: ${EPOCHS}
Val split: ${VAL_SPLIT}
Batch size: ${BATCH_SIZE}
LR: ${LR}

To run real training, set VOICE_TRAIN_CMD.
Example:
  export VOICE_TRAIN_CMD='python train.py --manifest \"${RUN_DIR}/manifest.csv\" --epochs ${EPOCHS} --batch-size ${BATCH_SIZE} --lr ${LR} --val-split ${VAL_SPLIT} --output \"${RUN_DIR}\"'
  scripts/train_voice_adapt.sh
EOF

if [[ -z "${VOICE_TRAIN_CMD:-}" ]]; then
  echo "[voice-train] Scaffold ready at: ${RUN_DIR}"
  echo "[voice-train] No VOICE_TRAIN_CMD provided, so this was a setup-only run."
  echo "[voice-train] Set VOICE_TRAIN_CMD and re-run to launch training."
  exit 0
fi

echo "[voice-train] Launching training command..."
echo "${VOICE_TRAIN_CMD}" | tee "${RUN_DIR}/train_command.txt"
bash -lc "${VOICE_TRAIN_CMD}" 2>&1 | tee "${RUN_DIR}/train.log"
echo "[voice-train] Completed. Logs: ${RUN_DIR}/train.log"
