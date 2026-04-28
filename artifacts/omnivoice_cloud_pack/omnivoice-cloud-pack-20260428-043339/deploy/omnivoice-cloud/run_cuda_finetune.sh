#!/usr/bin/env bash
set -euo pipefail

BUNDLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OMNI_DIR="${BUNDLE_DIR}/external/OmniVoice"

PYTHON_BIN="${PYTHON_BIN:-python3}"
GPU_IDS="${GPU_IDS:-0}"
NUM_GPUS="${NUM_GPUS:-1}"
TRAIN_CONFIG="${TRAIN_CONFIG:-examples/config/train_config_finetune_sdpa.json}"
OUTPUT_DIR="${OUTPUT_DIR:-exp/omnivoice_finetune_cuda}"
STAGE="${STAGE:-0}"
STOP_STAGE="${STOP_STAGE:-1}"

if [[ ! -d "${BUNDLE_DIR}/voice_clean/clips" ]]; then
  echo "[cloud-train] Missing voice_clean/clips in bundle: ${BUNDLE_DIR}" >&2
  exit 1
fi

if [[ ! -f "${BUNDLE_DIR}/voice_clean/training_metadata.weighted.csv" ]]; then
  echo "[cloud-train] Missing weighted CSV in bundle: ${BUNDLE_DIR}/voice_clean/training_metadata.weighted.csv" >&2
  exit 1
fi

if [[ ! -d "${OMNI_DIR}" ]]; then
  mkdir -p "$(dirname "${OMNI_DIR}")"
  git clone https://github.com/k2-fsa/OmniVoice.git "${OMNI_DIR}"
fi

cd "${OMNI_DIR}"

if [[ ! -d ".venv" ]]; then
  "${PYTHON_BIN}" -m venv .venv
fi

source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e .

cp "${BUNDLE_DIR}/configs/train_config_finetune_cuda.json" examples/config/train_config_finetune_cuda.json

python "${BUNDLE_DIR}/scripts/prepare_omnivoice_finetune_data.py" \
  --input-csv "${BUNDLE_DIR}/voice_clean/training_metadata.weighted.csv" \
  --out-dir "${OMNI_DIR}/data" \
  --clip-dir "${BUNDLE_DIR}/voice_clean/clips" \
  --dev-ratio "${DEV_RATIO:-0.10}" \
  --seed "${SEED:-42}" \
  --fallback-language-id "${FALLBACK_LANG:-te}" \
  --respect-weight

if [[ "${STAGE}" == "0" ]]; then
  rm -rf data/finetune/tokens
fi

stage="${STAGE}" \
stop_stage="${STOP_STAGE}" \
GPU_IDS="${GPU_IDS}" \
NUM_GPUS="${NUM_GPUS}" \
TRAIN_CONFIG="${TRAIN_CONFIG}" \
OUTPUT_DIR="${OUTPUT_DIR}" \
bash examples/run_finetune.sh

echo "[cloud-train] Finished. Output: ${OMNI_DIR}/${OUTPUT_DIR}"
