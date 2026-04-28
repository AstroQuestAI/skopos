#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that"
CSV_DEFAULT="${ROOT}/artifacts/voice_clean/training_metadata.weighted.csv"
OUT_DIR_DEFAULT="${ROOT}/external/OmniVoice/data"

INPUT_CSV="${INPUT_CSV:-${CSV_DEFAULT}}"
OUT_DIR="${OUT_DIR:-${OUT_DIR_DEFAULT}}"
DEV_RATIO="${DEV_RATIO:-0.10}"
SEED="${SEED:-42}"
FALLBACK_LANG="${FALLBACK_LANG:-te}"
RESPECT_WEIGHT="${RESPECT_WEIGHT:-1}"

ARGS=(
  "--input-csv" "${INPUT_CSV}"
  "--out-dir" "${OUT_DIR}"
  "--dev-ratio" "${DEV_RATIO}"
  "--seed" "${SEED}"
  "--fallback-language-id" "${FALLBACK_LANG}"
)

if [[ "${RESPECT_WEIGHT}" == "1" ]]; then
  ARGS+=("--respect-weight")
fi

python3 "${ROOT}/scripts/prepare_omnivoice_finetune_data.py" "${ARGS[@]}"

echo "[omnivoice-prepare] Wrote:"
echo "  ${OUT_DIR}/my_data_train.jsonl"
echo "  ${OUT_DIR}/my_data_dev.jsonl"
echo
echo "[omnivoice-prepare] Next:"
echo "  cd ${ROOT}/external/OmniVoice && bash examples/run_finetune.sh"
